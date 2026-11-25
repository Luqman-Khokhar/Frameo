/*
 * xcap — Frameo's X11 capture helper.
 *
 * Grabs the screen (or a region) as raw 32-bit BGRX frames and guarantees that
 * Frameo's own windows (toolbar, overlays, main window) never appear in them.
 *
 * How exclusion works (X11 has no "exclude from capture" flag):
 *   1. Grab the root window (fast, full fidelity: wallpaper, panel, menus...).
 *   2. Find Frameo's windows by _NET_WM_PID / WM_CLASS, every frame.
 *   3. For the rectangle each of them covers (plus a margin for WM shadows),
 *      rebuild the pixels from a clean base snapshot taken before Frameo's
 *      windows were shown, then re-draw the other applications' windows on top
 *      in stacking order. The toolbar's pixels are never copied to the output.
 *
 * Usage:
 *   xcap --pid N [--class frameo] [--keep-title STR] [--region x,y,w,h] [--base file]
 *        [--save-base file] (--once out.raw | --stream [--fps F])
 */
#define _GNU_SOURCE
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xatom.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <signal.h>
#include <time.h>
#include <errno.h>

#define MAXWIN 512
#define MARGIN 24

typedef struct { int x, y, w, h; } Rect;
typedef struct { Window id; Rect r; int excl; int managed; int keep; } Win;
typedef struct { Window id; int excl; int managed; int keep; long frame; } Cache;

static volatile sig_atomic_t stop_flag = 0;
static void on_sig(int s) { (void)s; stop_flag = 1; }
static int on_xerr(Display *d, XErrorEvent *e) { (void)d; (void)e; return 0; }

static Display *dpy;
static Window root;
static int scr_w, scr_h;
static long excl_pid = -1;
static const char *excl_class = "frameo";
static Atom a_pid, a_wmstate, a_name, a_utf8;
static const char *keep_title = NULL; /* windows whose title contains this are NEVER excluded (live ink overlay) */
static Cache cache[MAXWIN * 2];
static int ncache = 0;
static long frame_no = 0;

static long get_pid(Window w) {
  Atom t; int f; unsigned long n, after; unsigned char *d = NULL; long v = -1;
  if (XGetWindowProperty(dpy, w, a_pid, 0, 1, False, XA_CARDINAL, &t, &f, &n, &after, &d) == Success && d) {
    if (f == 32 && n == 1) v = (long)(*(unsigned long *)d);
    XFree(d);
  }
  return v;
}
static int class_match(Window w) {
  XClassHint ch; int m = 0;
  if (XGetClassHint(dpy, w, &ch)) {
    if (ch.res_class && strcasestr(ch.res_class, excl_class)) m = 1;
    if (ch.res_name && strcasestr(ch.res_name, excl_class)) m = 1;
    if (ch.res_name) XFree(ch.res_name);
    if (ch.res_class) XFree(ch.res_class);
  }
  return m;
}
static int is_excl(Window w) { return (excl_pid > 0 && get_pid(w) == excl_pid) || class_match(w); }
static int has_wmstate(Window w) {
  Atom t; int f; unsigned long n, after; unsigned char *d = NULL; int ok = 0;
  if (XGetWindowProperty(dpy, w, a_wmstate, 0, 2, False, AnyPropertyType, &t, &f, &n, &after, &d) == Success) {
    ok = (t != None && n > 0);
    if (d) XFree(d);
  }
  return ok;
}
static int title_match(Window w) {
  int m = 0; Atom t; int f; unsigned long n, after; unsigned char *d = NULL; char *nm = NULL;
  if (XGetWindowProperty(dpy, w, a_name, 0, 64, False, a_utf8, &t, &f, &n, &after, &d) == Success && d) {
    if (n && strstr((char *)d, keep_title)) m = 1;
    XFree(d);
  }
  if (!m && XFetchName(dpy, w, &nm) && nm) { if (strstr(nm, keep_title)) m = 1; XFree(nm); }
  return m;
}
/* A top-level window is Frameo's if it or one of its children (WM frame -> client) is. */
static void classify(Window top, int *excl, int *managed, int *keepOut) {
  Window r, p, *ch = NULL; unsigned int n = 0, i;
  int keep = 0;
  *excl = is_excl(top); *managed = has_wmstate(top);
  if (keep_title && title_match(top)) keep = 1;
  if (XQueryTree(dpy, top, &r, &p, &ch, &n) && ch) {
    for (i = 0; i < n; i++) {
      if (!*excl && is_excl(ch[i])) *excl = 1;
      if (!*managed && has_wmstate(ch[i])) *managed = 1;
      if (keep_title && !keep && title_match(ch[i])) keep = 1;
    }
    XFree(ch);
  }
  if (keep) *excl = 0;
  *keepOut = keep;
}
static Cache *cache_get(Window w) {
  int i;
  for (i = 0; i < ncache; i++) if (cache[i].id == w) {
    if (frame_no - cache[i].frame > 30) { classify(w, &cache[i].excl, &cache[i].managed, &cache[i].keep); cache[i].frame = frame_no; }
    return &cache[i];
  }
  if (ncache >= MAXWIN * 2) ncache = 0;
  cache[ncache].id = w; cache[ncache].frame = frame_no;
  classify(w, &cache[ncache].excl, &cache[ncache].managed, &cache[ncache].keep);
  return &cache[ncache++];
}
static int list_windows(Win *out) {
  Window r, p, *ch = NULL; unsigned int n = 0, i; int c = 0;
  if (!XQueryTree(dpy, root, &r, &p, &ch, &n) || !ch) return 0;
  for (i = 0; i < n && c < MAXWIN; i++) {
    XWindowAttributes at;
    if (!XGetWindowAttributes(dpy, ch[i], &at)) continue;
    if (at.map_state != IsViewable || at.class == InputOnly) continue;
    Cache *k = cache_get(ch[i]);
    out[c].id = ch[i];
    out[c].r.x = at.x + at.border_width; out[c].r.y = at.y + at.border_width;
    out[c].r.w = at.width; out[c].r.h = at.height;
    out[c].excl = k->excl; out[c].managed = k->managed; out[c].keep = k->keep;
    c++;
  }
  XFree(ch);
  return c;
}
static int intersect(Rect a, Rect b, Rect *o) {
  int x1 = a.x > b.x ? a.x : b.x, y1 = a.y > b.y ? a.y : b.y;
  int x2 = (a.x + a.w < b.x + b.w) ? a.x + a.w : b.x + b.w;
  int y2 = (a.y + a.h < b.y + b.h) ? a.y + a.h : b.y + b.h;
  if (x2 <= x1 || y2 <= y1) return 0;
  o->x = x1; o->y = y1; o->w = x2 - x1; o->h = y2 - y1; return 1;
}
static void blit(unsigned char *dst, int dw, Rect region, XImage *img, int ox, int oy, int alpha) {
  int y, x;
  for (y = 0; y < img->height; y++) {
    unsigned char *s = (unsigned char *)img->data + (size_t)y * img->bytes_per_line;
    unsigned char *d = dst + ((size_t)(oy + y - region.y) * dw + (ox - region.x)) * 4;
    if (!alpha) { memcpy(d, s, (size_t)img->width * 4); continue; }
    for (x = 0; x < img->width; x++, s += 4, d += 4) { /* premultiplied ARGB over what is there */
      int a = s[3], ia = 255 - a;
      d[0] = (unsigned char)(s[0] + d[0] * ia / 255);
      d[1] = (unsigned char)(s[1] + d[1] * ia / 255);
      d[2] = (unsigned char)(s[2] + d[2] * ia / 255);
    }
  }
}
/* Rebuild rect `fix` (screen coords) of the output from base + other windows. */
static void repair(unsigned char *out, Rect region, Rect fix, const unsigned char *base, Win *wins, int nw) {
  int y, i;
  for (y = 0; y < fix.h; y++) {
    unsigned char *d = out + ((size_t)(fix.y + y - region.y) * region.w + (fix.x - region.x)) * 4;
    if (base) memcpy(d, base + ((size_t)(fix.y + y) * scr_w + fix.x) * 4, (size_t)fix.w * 4);
    else memset(d, 0, (size_t)fix.w * 4);
  }
  for (i = 0; i < nw; i++) {
    Rect hit;
    if (wins[i].excl || (!wins[i].managed && !wins[i].keep)) continue; /* keep = live ink overlay, redrawn over repaired areas */
    if (!intersect(wins[i].r, fix, &hit)) continue;
    XImage *im = XGetImage(dpy, wins[i].id, hit.x - wins[i].r.x, hit.y - wins[i].r.y, hit.w, hit.h, AllPlanes, ZPixmap);
    if (!im) continue;
    if (im->bits_per_pixel == 32) blit(out, region.w, region, im, hit.x, hit.y, im->depth == 32);
    XDestroyImage(im);
  }
}
/* Grab one frame of `region` into `out` (region.w*region.h*4 bytes). Returns 0 on success. */
static int grab(unsigned char *out, Rect region, const unsigned char *base) {
  static Win before[MAXWIN], after[MAXWIN];
  int nb, na, i, j;
  frame_no++;
  nb = list_windows(before);
  XImage *im = XGetImage(dpy, root, region.x, region.y, region.w, region.h, AllPlanes, ZPixmap);
  if (!im) return 1;
  if (im->bits_per_pixel != 32) { XDestroyImage(im); return 3; }
  for (j = 0; j < im->height; j++)
    memcpy(out + (size_t)j * region.w * 4, (unsigned char *)im->data + (size_t)j * im->bytes_per_line, (size_t)region.w * 4);
  XDestroyImage(im);
  na = list_windows(after);
  /* Union of Frameo rects from before and after the grab: covers a toolbar that is being dragged. */
  Win *lists[2] = { before, after }; int counts[2] = { nb, na };
  int any = 0;
  for (i = 0; i < 2; i++) for (j = 0; j < counts[i]; j++) if (lists[i][j].excl) {
    Rect pad = { lists[i][j].r.x - MARGIN, lists[i][j].r.y - MARGIN, lists[i][j].r.w + 2 * MARGIN, lists[i][j].r.h + 2 * MARGIN };
    Rect screen = { 0, 0, scr_w, scr_h }, c1, fix;
    if (!intersect(pad, screen, &c1) || !intersect(c1, region, &fix)) continue;
    repair(out, region, fix, base, after, na);
    any = 1;
  }
  (void)any;
  return 0;
}
static unsigned char *read_file(const char *path, size_t want) {
  FILE *f = fopen(path, "rb"); if (!f) return NULL;
  unsigned char *b = malloc(want); if (!b) { fclose(f); return NULL; }
  if (fread(b, 1, want, f) != want) { free(b); b = NULL; }
  fclose(f); return b;
}
int main(int argc, char **argv) {
  const char *once = NULL, *base_path = NULL, *save_base = NULL;
  int stream = 0, fps = 30, i;
  Rect region = { 0, 0, 0, 0 }; int have_region = 0;
  for (i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--pid") && i + 1 < argc) excl_pid = atol(argv[++i]);
    else if (!strcmp(argv[i], "--class") && i + 1 < argc) excl_class = argv[++i];
    else if (!strcmp(argv[i], "--keep-title") && i + 1 < argc) keep_title = argv[++i];
    else if (!strcmp(argv[i], "--region") && i + 1 < argc) { have_region = sscanf(argv[++i], "%d,%d,%d,%d", &region.x, &region.y, &region.w, &region.h) == 4; }
    else if (!strcmp(argv[i], "--base") && i + 1 < argc) base_path = argv[++i];
    else if (!strcmp(argv[i], "--save-base") && i + 1 < argc) save_base = argv[++i];
    else if (!strcmp(argv[i], "--once") && i + 1 < argc) once = argv[++i];
    else if (!strcmp(argv[i], "--stream")) stream = 1;
    else if (!strcmp(argv[i], "--fps") && i + 1 < argc) fps = atoi(argv[++i]);
  }
  if (!once && !stream && !save_base) { fprintf(stderr, "xcap: nothing to do\n"); return 2; }
  dpy = XOpenDisplay(NULL);
  if (!dpy) { fprintf(stderr, "xcap: cannot open X display\n"); return 4; }
  XSetErrorHandler(on_xerr);
  root = DefaultRootWindow(dpy);
  scr_w = DisplayWidth(dpy, DefaultScreen(dpy)); scr_h = DisplayHeight(dpy, DefaultScreen(dpy));
  a_pid = XInternAtom(dpy, "_NET_WM_PID", False); a_wmstate = XInternAtom(dpy, "WM_STATE", False);
  a_name = XInternAtom(dpy, "_NET_WM_NAME", False); a_utf8 = XInternAtom(dpy, "UTF8_STRING", False);
  if (!have_region) { region.x = 0; region.y = 0; region.w = scr_w; region.h = scr_h; }
  { Rect screen = { 0, 0, scr_w, scr_h }, c; if (!intersect(region, screen, &c)) { fprintf(stderr, "xcap: region outside screen\n"); return 2; } region = c; }
  region.w &= ~1; region.h &= ~1; if (region.w < 2 || region.h < 2) { fprintf(stderr, "xcap: region too small\n"); return 2; }
  signal(SIGINT, on_sig); signal(SIGTERM, on_sig); signal(SIGPIPE, SIG_IGN);

  if (save_base) {
    Rect full = { 0, 0, scr_w, scr_h };
    unsigned char *b = malloc((size_t)scr_w * scr_h * 4);
    if (!b || grab(b, full, NULL)) { fprintf(stderr, "xcap: base grab failed\n"); return 1; }
    FILE *f = fopen(save_base, "wb"); if (!f) return 1;
    fwrite(b, 1, (size_t)scr_w * scr_h * 4, f); fclose(f); free(b);
    if (!once && !stream) return 0;
  }
  unsigned char *base = base_path ? read_file(base_path, (size_t)scr_w * scr_h * 4) : NULL;
  size_t fsz = (size_t)region.w * region.h * 4;
  unsigned char *buf = malloc(fsz); if (!buf) return 1;
  if (once) {
    int rc = grab(buf, region, base);
    if (rc) { fprintf(stderr, "xcap: grab failed (%d)\n", rc); return rc; }
    FILE *f = fopen(once, "wb"); if (!f) return 1;
    fwrite(buf, 1, fsz, f); fclose(f);
    fprintf(stdout, "%d %d %d %d %d %d\n", region.x, region.y, region.w, region.h, scr_w, scr_h);
    return 0;
  }
  if (fps < 1) fps = 30;
  if (fps > 120) fps = 120;
  struct timespec next; clock_gettime(CLOCK_MONOTONIC, &next);
  long step = 1000000000L / fps;
  while (!stop_flag) {
    if (grab(buf, region, base)) break;
    if (fwrite(buf, 1, fsz, stdout) != fsz) break;
    fflush(stdout);
    next.tv_nsec += step; while (next.tv_nsec >= 1000000000L) { next.tv_nsec -= 1000000000L; next.tv_sec++; }
    clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, NULL);
  }
  return 0;
}
