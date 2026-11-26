#!/bin/sh
# Tests for scripts/mem-cap.js. Output: `PASS|FAIL name`; exit 1 on any FAIL.

SCRIPT="$(cd "$(dirname "$0")" && pwd)/mem-cap.js"
FAILS=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

# cap_is <name> <free-gb> <expected cap>
cap_is() {
  OUT="$(node "$SCRIPT" --free-gb "$2" 2>&1)"; RC=$?
  FIRST="$(echo "$OUT" | head -n 1)"
  case "$FIRST" in
    "CAP $3 (free "*) OK=1 ;;
    *) OK=0 ;;
  esac
  if [ "$RC" -eq 0 ] && [ "$OK" -eq 1 ]; then pass "$1"; else fail "$1"; echo "$OUT"; fi
}

# the field numbers of 2026-11-26
cap_is a-killed-at-0.9-is-one 0.9 1
cap_is b-after-cleanup-2.6-is-one 2.6 1
cap_is c-two-survived-at-4.0 4.0 2
cap_is d-5.4-is-three 5.4 3
# bounds
cap_is e-zero-free-still-one 0 1
cap_is f-plenty-is-six 32 6
cap_is g-exactly-enough-for-six 9 6
cap_is h-just-short-of-six 8.9 5

# (i) the worker rule line appears below the cap of six, and not at six
LOW="$(node "$SCRIPT" --free-gb 4)"
HIGH="$(node "$SCRIPT" --free-gb 32)"
if echo "$LOW" | grep -q '^WORKER-RULE ' && ! echo "$HIGH" | grep -q '^WORKER-RULE '; then
  pass i-worker-rule-only-when-short
else
  fail i-worker-rule-only-when-short
fi

# (j) no flag: reads the machine, still a cap from 1 to 6, exit 0
OUT="$(node "$SCRIPT" 2>&1)"; RC=$?
if [ "$RC" -eq 0 ] && echo "$OUT" | head -n 1 | grep -qE '^CAP [1-6] \(free [0-9]+\.[0-9] GB\)$'; then
  pass j-reads-the-machine
else
  fail j-reads-the-machine
  echo "$OUT"
fi

# (k) a bad --free-gb value falls back to the machine instead of failing
OUT="$(node "$SCRIPT" --free-gb nonsense 2>&1)"; RC=$?
if [ "$RC" -eq 0 ] && echo "$OUT" | head -n 1 | grep -qE '^CAP [1-6] '; then
  pass k-bad-flag-falls-back
else
  fail k-bad-flag-falls-back
fi

if [ "$FAILS" -gt 0 ]; then
  echo "$FAILS FAIL"
  exit 1
fi
exit 0
