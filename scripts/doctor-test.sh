#!/bin/sh
# Tests for scripts/doctor.js — prints `PASS|FAIL name`, exits 1 on any FAIL.
# Every fixture is a throwaway `mktemp -d` repo; the doctor is read-only.

DOCTOR="$(cd "$(dirname "$0")" && pwd)/doctor.js"
FAILS=0
TMPS=""

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

# mkfix <phase line> <phase dir name> — healthy fixture; prints its path
mkfix() {
  d=$(mktemp -d)
  mkdir -p "$d/.potion/specs" "$d/.potion/scripts" "$d/.potion/phases/$2"
  {
    echo "# State"
    echo ""
    echo "## Position"
    echo "$1"
    echo ""
    echo "## Fog"
    echo ""
    echo "## Decision queue"
  } > "$d/.potion/STATE.md"
  echo "none-needed: fixture" > "$d/.potion/verify-env.md"
  echo "// fixture" > "$d/.potion/scripts/pre-commit.cjs"
  echo "$d"
}

doctor() { (cd "$1" && node "$DOCTOR"); }

# (a) healthy fixture
A=$(mkfix "- Phase: 1 of 1 — 01-x" "01-x"); TMPS="$TMPS $A"
OUT=$(doctor "$A")
if ! echo "$OUT" | grep -q "^FAIL " && echo "$OUT" | grep -q "^OK state-phase "; then
  pass healthy-fixture
else
  fail healthy-fixture; echo "$OUT"
fi

# (b) no .potion
B=$(mktemp -d); TMPS="$TMPS $B"
OUT=$(doctor "$B"); CODE=$?
if echo "$OUT" | grep -q "^FAIL potion-dir " && [ "$CODE" -eq 1 ]; then
  pass no-potion-dir
else
  fail no-potion-dir; echo "exit=$CODE"; echo "$OUT"
fi

# (c) number-only Phase line resolves numerically
C=$(mkfix "- Phase: 3 (thing)" "03-thing"); TMPS="$TMPS $C"
OUT=$(doctor "$C")
if echo "$OUT" | grep -q "^OK state-phase "; then
  pass phase-by-number
else
  fail phase-by-number; echo "$OUT"
fi

# (d) unresolvable Phase line
D=$(mkfix "- Phase: wrapping up" "01-x"); TMPS="$TMPS $D"
OUT=$(doctor "$D")
if echo "$OUT" | grep -q "^WARN state-phase "; then
  pass phase-unresolved
else
  fail phase-unresolved; echo "$OUT"
fi

# (e) oversized STATE
E=$(mkfix "- Phase: 1 of 1 — 01-x" "01-x"); TMPS="$TMPS $E"
head -c 13000 /dev/zero | tr '\0' 'x' >> "$E/.potion/STATE.md"
echo "" >> "$E/.potion/STATE.md"
OUT=$(doctor "$E")
if echo "$OUT" | grep -q "^WARN state-caps "; then
  pass state-caps
else
  fail state-caps; echo "$OUT"
fi

# (f) legacy pre-commit.js only
F=$(mkfix "- Phase: 1 of 1 — 01-x" "01-x"); TMPS="$TMPS $F"
mv "$F/.potion/scripts/pre-commit.cjs" "$F/.potion/scripts/pre-commit.js"
OUT=$(doctor "$F")
if echo "$OUT" | grep -q "^WARN repo-mirror "; then
  pass legacy-mirror
else
  fail legacy-mirror; echo "$OUT"
fi

# (g) read-only: listing (+ content checksums, + git status) identical before/after
G=$(mkfix "- Phase: 1 of 1 — 01-x" "01-x"); TMPS="$TMPS $G"
(cd "$G" && git init -q . >/dev/null 2>&1)
snap() {
  (
    cd "$G" || exit 1
    find . -type f | sort
    find . -type f -not -path "./.git/*" | sort | xargs cksum
    if [ -d .git ]; then git status --porcelain; fi
  )
}
BEFORE=$(snap)
doctor "$G" >/dev/null
doctor "$G" >/dev/null
AFTER=$(snap)
if [ -n "$BEFORE" ] && [ "$BEFORE" = "$AFTER" ]; then
  pass read-only
else
  fail read-only
fi

# (h) Phase line `N (slug) — discussed <date>` resolves the directory
H=$(mkfix "- Phase: 2 (alpha) — discussed 2026-11-20" "02-alpha"); TMPS="$TMPS $H"
OUT=$(doctor "$H")
if echo "$OUT" | grep -q "^OK state-phase .*phases/02-alpha/"; then
  pass phase-dated-line
else
  fail phase-dated-line; echo "$OUT"
fi

# (i) same shape, but no 09-* directory exists → unresolved, never the date
I=$(mkfix "- Phase: 9 (ghost) — discussed 2026-11-20" "01-x"); TMPS="$TMPS $I"
OUT=$(doctor "$I")
if echo "$OUT" | grep -q "^WARN state-phase "; then
  pass phase-dated-line-no-dir
else
  fail phase-dated-line-no-dir; echo "$OUT"
fi

for t in $TMPS; do rm -rf "$t"; done

[ "$FAILS" -eq 0 ] || exit 1
exit 0
