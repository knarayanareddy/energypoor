#!/bin/sh
# Build the minimal NSS/NSPR stubs Chromium needs when the image has no libnss3.
#
# This is NOT NSS. Every symbol returns NULL or 0, so Chromium sees "no
# certificate database". That is enough for http://localhost and nothing else:
# TLS does not work against these stubs. They exist so the A1/A2/A3/A4/A11/A12
# measurements can run in a sandbox without libnss3, not to browse the web.
set -e
cd "$(dirname "$0")"
OUT="${1:-$(pwd)/lib}"
mkdir -p "$OUT"
cc -shared -fPIC -O1 -o "$OUT/libnss3.so" stub.c
cp "$OUT/libnss3.so" "$OUT/libnssutil3.so"
cp "$OUT/libnss3.so" "$OUT/libnspr4.so"
echo "built stubs in $OUT"
