CC ?= gcc
CFLAGS ?= -O2 -Wall
all: xcap
xcap: xcap.c
	$(CC) $(CFLAGS) -o xcap xcap.c -lX11
clean:
	rm -f xcap
