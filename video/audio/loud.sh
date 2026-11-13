#!/bin/sh
# loudness of each file: integrated LUFS, range, true peak, then the momentary loudness once a second
FF="$1"; shift
for f in "$@"; do
  out=$("$FF" -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1)
  echo "$f | $(echo "$out" | tail -12 | grep -E "I:|LRA:|Peak:" | tr -s ' ' | tr '\n' ' ')"
  echo "   M each s: $(echo "$out" | grep -oE "t: [0-9.]+ +TARGET:-23 LUFS +M: *-?[0-9.]+" | awk '{t=$2; m=$NF; if (int(t*10+0.5)%10==0) printf "%s ", m}')"
done
