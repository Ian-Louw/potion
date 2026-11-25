#!/bin/sh
# Fixture test for scripts/gap-recurrence.js (has a gap from the previous
# verify cycle come back?). Prints `PASS|FAIL name` per case, exits 1 on any
# FAIL, last line `N PASS, M FAIL`.
#
# Every fixture is a throwaway `mktemp -d` git repository holding
# .potion/phases/01-x/VERIFICATION.md. Nothing here touches this repo's own
# .potion/. The script is always run from inside the fixture with a relative
# phase path, so no shell-to-node path translation is needed.

root="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$root/scripts/gap-recurrence.js"
PHASE=".potion/phases/01-x"
PASSES=0
FAILS=0
TMPS=""

ok()  { echo "PASS $1"; PASSES=$((PASSES + 1)); }
bad() { echo "FAIL $1${2:+ — $2}"; FAILS=$((FAILS + 1)); }

# has <haystack> <needle> → 0 when the needle is a substring
has() {
  case "$1" in
    *"$2"*) return 0 ;;
    *) return 1 ;;
  esac
}

fgit() {
  git -C "$d" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false "$@"
}

# mkfix — new empty git fixture with the phase directory. Sets d.
mkfix() {
  d=$(mktemp -d)
  TMPS="$TMPS $d"
  mkdir -p "$d/$PHASE"
  fgit init -q
}

# wv <cycle> <verdict> [truth...] — write VERIFICATION.md with that cycle,
# verdict and gap truths (none → `gaps: []`), and commit it.
wv() {
  wv_cycle=$1
  wv_verdict=$2
  shift 2
  f="$d/$PHASE/VERIFICATION.md"
  {
    printf -- '---\n'
    printf 'phase: "01-x"\n'
    printf 'verdict: "%s"\n' "$wv_verdict"
    printf 'cycle: %s                      # increments each verify pass\n' "$wv_cycle"
    if [ "$#" -eq 0 ]; then
      printf 'gaps: []                      # empty list when verdict: pass\n'
    else
      printf 'gaps:\n'
      for wv_truth in "$@"; do
        printf '  - truth: "%s"\n' "$wv_truth"
        printf '    status: "FAILED"\n'
        printf '    reason: "truth: this reason line must never be read as a gap"\n'
      done
    fi
    printf 'accepted: []\n'
    printf -- '---\n\n# Verification\n\nProse mentioning truth: "Alpha works" is not a gap.\n'
  } > "$f"
  fgit add "$PHASE/VERIFICATION.md"
  fgit commit -q -m "cycle $wv_cycle $wv_verdict"
}

# run [dir] — run the script from inside the fixture. Sets out and rc.
run() {
  out=$(cd "$d" && node "$SCRIPT" "${1:-$PHASE}" 2>/dev/null); rc=$?
}

A="Alpha works end to end"
B="Beta is wired"
C="Gamma has a test"

# --------------------------------------------- (a) one recurring, one new

mkfix
wv 1 gaps "$A" "$B"
wv 2 gaps "$A" "$C"
run
if [ "$rc" -eq 0 ] &&
  has "$out" "CYCLE 2" &&
  has "$out" "RECURRING $A" &&
  has "$out" "NEW $C" &&
  has "$out" "RESULT recurring=1 new=1" &&
  ! has "$out" "nothing to compare"; then
  ok "recurring-and-new"
else
  bad "recurring-and-new" "rc=$rc out=$out"
fi

# ------------------------------------------------- (j) run leaves no trace

if [ -z "$(fgit status --porcelain)" ]; then
  ok "working-tree-unchanged"
else
  bad "working-tree-unchanged" "$(fgit status --porcelain)"
fi

# ------------------------ (b) case, spacing and a trailing full stop differ

mkfix
wv 1 gaps "$A" "$B"
wv 2 gaps "alpha   WORKS end to  end." "$C"
run
if [ "$rc" -eq 0 ] &&
  has "$out" "RECURRING alpha   WORKS end to  end." &&
  has "$out" "RESULT recurring=1 new=1"; then
  ok "recurring-normalised"
else
  bad "recurring-normalised" "rc=$rc out=$out"
fi

# ------------------------------------------------- (c) entirely new gaps

mkfix
wv 1 gaps "$A"
wv 2 gaps "$B" "$C"
run
if [ "$rc" -eq 0 ] &&
  has "$out" "NEW $B" &&
  has "$out" "NEW $C" &&
  ! has "$out" "RECURRING" &&
  has "$out" "RESULT recurring=0 new=2" &&
  ! has "$out" "nothing to compare"; then
  ok "all-new"
else
  bad "all-new" "rc=$rc out=$out"
fi

# ------------------------------------------------------- (d) cycle 1 only

mkfix
wv 1 gaps "$A" "$B"
run
if [ "$rc" -eq 0 ] &&
  has "$out" "RESULT recurring=0 new=2 (nothing to compare)" &&
  ! has "$out" "RECURRING"; then
  ok "cycle-1-nothing-to-compare"
else
  bad "cycle-1-nothing-to-compare" "rc=$rc out=$out"
fi

# ------------------- (e) an intermediate re-save of the same cycle number

mkfix
wv 1 gaps "$A" "$B"
wv 2 gaps "Delta is documented" "Epsilon is logged"
wv 2 gaps "$A" "$C"
run
if [ "$rc" -eq 0 ] &&
  has "$out" "RECURRING $A" &&
  has "$out" "NEW $C" &&
  has "$out" "RESULT recurring=1 new=1"; then
  ok "skips-same-cycle-resave"
else
  bad "skips-same-cycle-resave" "rc=$rc out=$out"
fi

# ---------------------------------- (f) cycle 3 compares against cycle 2

mkfix
wv 1 gaps "$A"
wv 2 gaps "$B"
wv 3 gaps "$A"
run
if [ "$rc" -eq 0 ] &&
  has "$out" "CYCLE 3" &&
  has "$out" "NEW $A" &&
  ! has "$out" "RECURRING" &&
  has "$out" "RESULT recurring=0 new=1" &&
  ! has "$out" "nothing to compare"; then
  ok "compares-previous-cycle-only"
else
  bad "compares-previous-cycle-only" "rc=$rc out=$out"
fi

# ------------------------------------------------------- (g) verdict pass

mkfix
wv 1 gaps "$A"
wv 2 pass
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT recurring=0 new=0 (nothing to compare)"; then
  ok "verdict-pass-nothing-to-compare"
else
  bad "verdict-pass-nothing-to-compare" "rc=$rc out=$out"
fi

# -------------------------------------------------- (h) no VERIFICATION.md

mkfix
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT recurring=0 new=0 (nothing to compare)"; then
  ok "no-verification-file"
else
  bad "no-verification-file" "rc=$rc out=$out"
fi

# ------------------------------------------------ (i) nonexistent directory

run ".potion/phases/99-nope"
if [ "$rc" -eq 2 ] && [ -z "$out" ]; then
  ok "nonexistent-directory-exit-2"
else
  bad "nonexistent-directory-exit-2" "rc=$rc out=$out"
fi

# ------------------------------- only frontmatter `truth:` values are gaps
# The body of cycle 2 carries a `gaps:` list naming a truth that WAS a
# frontmatter gap in cycle 1. Body text is never a gap: it must not be
# reported at all, let alone as recurring.

mkfix
wv 1 gaps "$A"
wv 2 gaps "$B"
printf '\ngaps:\n  - truth: "%s"\n    status: "FAILED"\n' "$A" >> "$d/$PHASE/VERIFICATION.md"
fgit add "$PHASE/VERIFICATION.md"
fgit commit -q -m "cycle 2 with a gap-shaped body"
run
if [ "$rc" -eq 0 ] &&
  ! has "$out" "RECURRING" &&
  ! has "$out" "$A" &&
  ! has "$out" "reason line" &&
  has "$out" "NEW $B" &&
  has "$out" "RESULT recurring=0 new=1" &&
  ! has "$out" "nothing to compare"; then
  ok "body-truth-line-is-not-a-gap"
else
  bad "body-truth-line-is-not-a-gap" "rc=$rc out=$out"
fi

# ------------------------------------ every YAML shape a gaps list is written in

# wf <cycle> <format> — write VERIFICATION.md (verdict gaps) whose frontmatter
# after `cycle:` is the printf format given, and commit it.
wf() {
  f="$d/$PHASE/VERIFICATION.md"
  {
    printf -- '---\nphase: "01-x"\nverdict: "gaps"\ncycle: %s\n' "$1"
    # shellcheck disable=SC2059
    printf "$2"
    printf -- '---\n\n# Verification\n'
  } > "$f"
  fgit add "$PHASE/VERIFICATION.md"
  fgit commit -q -m "cycle $1 hand-written"
}

# shape <name> — after two wf calls: A recurs, C is new, nothing else is read
shape() {
  run
  if [ "$rc" -eq 0 ] &&
    has "$out" "RECURRING $A" &&
    has "$out" "NEW $C" &&
    ! has "$out" "$B" &&
    ! has "$out" "not this" &&
    has "$out" "RESULT recurring=1 new=1" &&
    ! has "$out" "nothing to compare"; then
    ok "$1"
  else
    bad "$1" "rc=$rc out=$out"
  fi
}

# zero-indented list items; a zero-indented list under another key is not gaps
mkfix
wf 1 "gaps:\n- truth: \"$A\"\n  status: \"FAILED\"\n- truth: \"$B\"\n  status: \"FAILED\"\naccepted: []\n"
wf 2 "gaps:\n- truth: \"$A\"\n  status: \"FAILED\"\n  reason: \"truth: not this\"\n- truth: $C\n  status: FAILED\naccepted:\n- truth: \"$B\"\n"
shape "zero-indent-list"

# a single-quoted truth, and the truth not the item's first key
mkfix
wf 1 "gaps:\n  - truth: '$A'\n    status: FAILED\n"
wf 2 "gaps:\n- status: FAILED\n  truth: '$A'\n- status: FAILED\n  truth: '$C'\n"
shape "single-quoted-truth"

# an indented cycle compared with a zero-indented one
mkfix
wv 1 gaps "$A" "$B"
wf 2 "gaps:\n- truth: \"$A\"\n- truth: \"$C\"\n"
shape "indented-then-zero-indent"

# flow-map items
mkfix
wf 1 "gaps:\n  - {truth: \"$A\", status: FAILED, reason: \"truth: not this, either\"}\n"
wf 2 "gaps:\n- {status: FAILED, reason: \"truth: not this\", truth: \"$A\"}\n- {truth: '$C', status: FAILED}\n"
shape "flow-map-items"

# block scalars: the more-indented lines join into one string
mkfix
wf 1 "gaps:\n  - truth: >-\n      Alpha works\n      end to end\n    status: \"FAILED\"\n"
wf 2 "gaps:\n- truth: |\n    Alpha works\n    end to end\n  status: FAILED\n  reason: \"truth: not this\"\n- truth: >\n    Gamma has\n\n    a test\n  status: FAILED\naccepted: []\n"
shape "block-scalar-truth"

# a plain and a quoted truth wrapped onto more-indented lines
mkfix
wf 1 "gaps:
  - truth: Alpha works
      end to end
    status: FAILED
  - truth: \"$B\"
"
wf 2 "gaps:
  - truth: \"Alpha works
      end to end\"
    status: FAILED
    reason: \"truth: not this\"
  - truth: Gamma has
      a test
    status: FAILED
accepted: []
"
shape "wrapped-truth"

# the whole list on one line, as flow maps
mkfix
wf 1 "gaps: [{truth: \"$A\", status: FAILED}, {truth: \"$B\"}]
"
wf 2 "gaps: [{truth: \"$A\", status: FAILED, reason: \"truth: not this\"}, {status: FAILED, truth: $C}]
accepted: []
"
shape "inline-gaps-list"

# a truth key nested deeper inside a gap item is not a gap
mkfix
wf 1 "gaps:
  - truth: \"$A\"
    detail:
      truth: \"$B\"
"
wf 2 "gaps:
  - truth: \"$A\"
    detail:
      truth: \"$B\"
      also:
        - truth: not this
  - truth: \"$C\"
"
shape "nested-truth-key-ignored"

for t in $TMPS; do rm -rf "$t"; done

echo "$PASSES PASS, $FAILS FAIL"
[ "$FAILS" -eq 0 ]
