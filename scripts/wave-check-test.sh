#!/bin/sh
# Fixture test for scripts/wave-check.js (the wave grammar checker).
# Prints `PASS|FAIL name` per case, exits 1 on any FAIL, last line
# `N PASS, M FAIL`.
#
# Every fixture is a throwaway `mktemp -d` phase directory of small PLAN
# files. Nothing here touches this repo's own .potion/.

root="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$root/scripts/wave-check.js"
PASSES=0
FAILS=0
TMPS=""

ok()  { printf 'PASS %s\n' "$1"; PASSES=$((PASSES + 1)); }
bad() { printf 'FAIL %s%s\n' "$1" "${2:+ — $2}"; FAILS=$((FAILS + 1)); }

# has <haystack> <needle> → 0 when the needle is a substring
has() {
  case "$1" in
    *"$2"*) return 0 ;;
    *) return 1 ;;
  esac
}

# nodepath <dir> — the directory as node sees it, forward slashes (`pwd -W`
# on Git Bash, `cygpath -m` under an MSYS dash, plain `pwd` elsewhere)
nodepath() {
  (cd "$1" && { pwd -W 2>/dev/null || cygpath -m "$PWD" 2>/dev/null || pwd; })
}

# mkfix — new empty phase dir. Sets d (shell path) and w (node path).
mkfix() {
  d=$(mktemp -d)
  TMPS="$TMPS $d"
  w=$(nodepath "$d")
}

# mkplan <file> <plan> <wave> <depends_on> <files_modified> <resources>
# — each list argument is the inline list body, e.g. '"01"' or 'src/a.js, b'
mkplan() {
  printf -- '---\nplan: "%s"\nphase: "01-x"\nwave: %s\ndepends_on: [%s]\nfiles_modified: [%s]\nresources: [%s]\nmust_haves:\n  truths:\n    - "x"\n---\n\n<objective>\nresources: [body-text-is-never-parsed]\n</objective>\n' \
    "$2" "$3" "$4" "$5" "$6" > "$d/$1"
}

# run — run the checker on the current fixture. Sets out and rc.
run() {
  out=$(node "$CHECK" "$w" 2>/dev/null); rc=$?
}

# ------------------------------------------- (a) disjoint same-wave plans

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' 'port:3000'
mkplan PLAN-02.md 02 1 '' 'src/b.js' 'port:3001'
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT ok conflicts=0 badwave=0 missingdep=0 malformed=0" &&
  has "$out" "WAVE 1 width=2 plans=01,02"; then
  ok "a-disjoint-same-wave-ok"
else
  bad "a-disjoint-same-wave-ok" "rc=$rc out=$out"
fi

# ------------------------------------------------- (b) shared file

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js, src/c.js' ''
mkplan PLAN-02.md 02 1 '' '"src/b.js", "src/a.js"' ''
run
if [ "$rc" -eq 1 ] &&
  has "$out" "CONFLICT file src/a.js — PLAN-01 and PLAN-02 (wave 1)" &&
  has "$out" "RESULT fail conflicts=1 badwave=0 missingdep=0 malformed=0"; then
  ok "b-shared-file-conflict"
else
  bad "b-shared-file-conflict" "rc=$rc out=$out"
fi

# backslashes normalise to slashes before matching
mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 1 '' 'src\a.js' ''
run
if [ "$rc" -eq 1 ] && has "$out" "CONFLICT file src/a.js"; then
  ok "b-backslash-path-normalised"
else
  bad "b-backslash-path-normalised" "rc=$rc out=$out"
fi

# ------------------------------------- (c) shared resource, case-insensitive

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' 'port:3000'
mkplan PLAN-02.md 02 1 '' 'src/b.js' 'Port:3000'
run
if [ "$rc" -eq 1 ] &&
  has "$out" "CONFLICT resource port:3000 — PLAN-01 and PLAN-02 (wave 1)" &&
  has "$out" "RESULT fail conflicts=1"; then
  ok "c-shared-resource-conflict"
else
  bad "c-shared-resource-conflict" "rc=$rc out=$out"
fi

# --------------------------- (d) same resource, different waves → no conflict

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' 'port:3000'
mkplan PLAN-02.md 02 2 '"01"' 'src/b.js' 'Port:3000'
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT ok" && ! has "$out" "CONFLICT"; then
  ok "d-resource-across-waves-ok"
else
  bad "d-resource-across-waves-ok" "rc=$rc out=$out"
fi

# ------------------------------------------------------------ (e) bad wave

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 1 '"01"' 'src/b.js' ''
run
if [ "$rc" -eq 1 ] &&
  has "$out" "BADWAVE PLAN-02 — wave 1, must be at least 2" &&
  has "$out" "RESULT fail conflicts=0 badwave=1 missingdep=0 malformed=0"; then
  ok "e-badwave"
else
  bad "e-badwave" "rc=$rc out=$out"
fi

# ------------------------------------------------------ (f) missing dependency

mkfix
mkplan PLAN-01.md 01 1 '"09"' 'src/a.js' ''
run
if [ "$rc" -eq 1 ] &&
  has "$out" "MISSINGDEP PLAN-01 — depends on 09, no such plan or runbook" &&
  has "$out" "RESULT fail conflicts=0 badwave=0 missingdep=1 malformed=0"; then
  ok "f-missingdep"
else
  bad "f-missingdep" "rc=$rc out=$out"
fi

# ---------------------------------------------------- (g) YAML block lists

mkfix
printf -- '---\nplan: "01"\nwave: 1\ndepends_on: []\nfiles_modified:\n  - src/a.js\n  - "src/c.js"\nresources:\n  - db:dev   # the dev database\n---\nbody\n' > "$d/PLAN-01.md"
printf -- '---\nplan: 02\nwave: 1\nfiles_modified:\n  - src/b.js\n  - src/a.js\n---\nbody\n' > "$d/PLAN-02.md"
run
if [ "$rc" -eq 1 ] &&
  has "$out" "CONFLICT file src/a.js — PLAN-01 and PLAN-02 (wave 1)" &&
  has "$out" "conflicts=1 "; then
  ok "g-block-list-conflict"
else
  bad "g-block-list-conflict" "rc=$rc out=$out"
fi

# ------------------------------------ (h) a completed plan will not run again

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 1 '' 'src/a.js' ''
printf '# Summary 01\n' > "$d/SUMMARY-01.md"
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT ok" && ! has "$out" "CONFLICT" &&
  has "$out" "WAVE 1 width=1 plans=02"; then
  ok "h-summary-excludes-plan"
else
  bad "h-summary-excludes-plan" "rc=$rc out=$out"
fi

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 1 '' 'src/a.js' ''
printf '# Summary 01 draft\n' > "$d/SUMMARY-01.draft.md"
run
if [ "$rc" -eq 1 ] && has "$out" "CONFLICT file src/a.js" &&
  has "$out" "WAVE 1 width=2 plans=01,02"; then
  ok "h-draft-summary-does-not-count"
else
  bad "h-draft-summary-does-not-count" "rc=$rc out=$out"
fi

# a completed plan is still a valid dependency target
mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 2 '"01"' 'src/a.js' ''
printf '# Summary 01\n' > "$d/SUMMARY-01.md"
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT ok" && ! has "$out" "MISSINGDEP" &&
  has "$out" "WAVE 2 width=1 plans=02" && ! has "$out" "WAVE 1"; then
  ok "h-completed-plan-is-a-dependency-target"
else
  bad "h-completed-plan-is-a-dependency-target" "rc=$rc out=$out"
fi

# ----------------------------------------------------------- (i) serial

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 2 '"01"' 'src/b.js' ''
mkplan PLAN-03.md 03 3 '"01", "02"' 'src/c.js' ''
run
if [ "$rc" -eq 0 ] && has "$out" "SERIAL — 3 of 3 waves have width 1" &&
  has "$out" "RESULT ok"; then
  ok "i-serial-line"
else
  bad "i-serial-line" "rc=$rc out=$out"
fi

# two plans are too few to call serial
mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 2 '"01"' 'src/b.js' ''
run
if [ "$rc" -eq 0 ] && ! has "$out" "SERIAL"; then
  ok "i-no-serial-under-three-plans"
else
  bad "i-no-serial-under-three-plans" "rc=$rc out=$out"
fi

# ---------------------------------------------------------- (j) runbooks

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
printf -- '---\nphase: "01-x"\nwave: 1\ndepends_on: []\n---\n\n# Runbook\n' > "$d/RUNBOOK-03.md"
mkplan PLAN-04.md 04 2 '"03"' 'src/b.js' ''
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT ok" &&
  has "$out" "WAVE 1 width=2 plans=01,03" &&
  has "$out" "WAVE 2 width=1 plans=04"; then
  ok "j-runbook-is-a-unit"
else
  bad "j-runbook-is-a-unit" "rc=$rc out=$out"
fi

# a runbook is named RUNBOOK-NN in messages
mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
printf -- '---\nwave: 1\ndepends_on: ["01"]\n---\n' > "$d/RUNBOOK-02.md"
run
if [ "$rc" -eq 1 ] && has "$out" "BADWAVE RUNBOOK-02 — wave 1, must be at least 2"; then
  ok "j-runbook-label"
else
  bad "j-runbook-label" "rc=$rc out=$out"
fi

# ------------------------------------------------------ (k) empty directory

mkfix
run
if [ "$rc" -eq 0 ] && [ "$out" = "RESULT ok conflicts=0 badwave=0 missingdep=0 malformed=0" ]; then
  ok "k-empty-directory"
else
  bad "k-empty-directory" "rc=$rc out=$out"
fi

# ------------------------------------------------ (l) nonexistent directory

mkfix
out=$(node "$CHECK" "$w/no-such-phase" 2>/dev/null); rc=$?
err=$(node "$CHECK" "$w/no-such-phase" 2>&1 >/dev/null)
if [ "$rc" -eq 2 ] && [ -z "$out" ] && [ -n "$err" ]; then
  ok "l-nonexistent-directory-exit-2"
else
  bad "l-nonexistent-directory-exit-2" "rc=$rc out=$out err=$err"
fi

# ------------------------------------------------------------ (m) read-only

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' 'port:3000'
mkplan PLAN-02.md 02 1 '"07"' 'src/a.js' 'port:3000'
printf '# Summary 02 draft\n' > "$d/SUMMARY-02.draft.md"
before=$(cd "$d" && ls -1a && cat ./*)
run
after=$(cd "$d" && ls -1a && cat ./*)
if [ "$rc" -eq 1 ] && [ "$before" = "$after" ]; then
  ok "m-read-only"
else
  bad "m-read-only" "rc=$rc"
fi

# ------------------------------- (n) completed units are history, not judged
# A finished plan numbered into wave 1 beside its own dependency (a grammar
# slip that already ran) must not block the phase's gap cycle.

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 1 '"01"' 'src/b.js' ''
: > "$d/SUMMARY-01.md"
: > "$d/SUMMARY-02.md"
mkplan PLAN-03.md 03 3 '"01"' 'src/c.js' ''
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT ok" && ! has "$out" "BADWAVE"; then
  ok "n-completed-units-not-judged"
else
  bad "n-completed-units-not-judged" "rc=$rc out=$out"
fi

# ------------------------- (o) a later wave than strictly needed is legal
# Gap plans are numbered by cycle; only running BEFORE an unfinished
# dependency is an error.

mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 02 4 '"01"' 'src/b.js' ''
run
if [ "$rc" -eq 0 ] && has "$out" "RESULT ok"; then
  ok "o-later-wave-is-legal"
else
  bad "o-later-wave-is-legal" "rc=$rc out=$out"
fi

# ------------------------------------- (p) a plan the checker cannot read
# The checker must never answer RESULT ok for a unit it did not understand.

# unclosed frontmatter on one of two wave-1 plans sharing a file
mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
printf -- '---\nplan: "02"\nwave: 1\ndepends_on: []\nfiles_modified: [src/a.js]\n\n<objective>\nbody\n</objective>\n' > "$d/PLAN-02.md"
run
if [ "$rc" -eq 1 ] &&
  has "$out" "MALFORMED PLAN-02.md — frontmatter is not closed" &&
  has "$out" "RESULT fail conflicts=0 badwave=0 missingdep=0 malformed=1" &&
  ! has "$out" "RESULT ok"; then
  ok "p-unclosed-frontmatter-malformed"
else
  bad "p-unclosed-frontmatter-malformed" "rc=$rc out=$out"
fi

# a file that does not open with a frontmatter at all
mkfix
printf '# A plan with no frontmatter\n\nwave: 1\n' > "$d/PLAN-01.md"
run
if [ "$rc" -eq 1 ] &&
  has "$out" "MALFORMED PLAN-01.md — frontmatter is not closed" &&
  ! has "$out" "RESULT ok"; then
  ok "p-no-frontmatter-malformed"
else
  bad "p-no-frontmatter-malformed" "rc=$rc out=$out"
fi

# wave: missing — left out of waves, still a dependency target
mkfix
printf -- '---\nplan: "01"\ndepends_on: []\nfiles_modified: [src/a.js]\n---\nbody\n' > "$d/PLAN-01.md"
mkplan PLAN-02.md 02 2 '"01"' 'src/b.js' ''
run
if [ "$rc" -eq 1 ] &&
  has "$out" "MALFORMED PLAN-01.md — wave is missing" &&
  ! has "$out" "MISSINGDEP" && ! has "$out" "WAVE 1" &&
  has "$out" "RESULT fail conflicts=0 badwave=0 missingdep=0 malformed=1"; then
  ok "p-wave-missing-malformed"
else
  bad "p-wave-missing-malformed" "rc=$rc out=$out"
fi

# wave: 2.5 (and 0, -1, text) is not a wave
mkfix
mkplan PLAN-01.md 01 2.5 '' 'src/a.js' ''
mkplan PLAN-02.md 02 0 '' 'src/b.js' ''
mkplan PLAN-03.md 03 -1 '' 'src/c.js' ''
mkplan PLAN-04.md 04 soon '' 'src/d.js' ''
run
if [ "$rc" -eq 1 ] &&
  has "$out" "MALFORMED PLAN-01.md — wave is not a positive integer" &&
  has "$out" "MALFORMED PLAN-02.md — wave is not a positive integer" &&
  has "$out" "MALFORMED PLAN-03.md — wave is not a positive integer" &&
  has "$out" "MALFORMED PLAN-04.md — wave is not a positive integer" &&
  has "$out" "malformed=4" && ! has "$out" "RESULT ok"; then
  ok "p-wave-not-a-positive-integer-malformed"
else
  bad "p-wave-not-a-positive-integer-malformed" "rc=$rc out=$out"
fi

# the file name's number is the id; a disagreeing plan: is reported
mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 03 1 '' 'src/b.js' ''
mkplan PLAN-04.md 04 2 '"02"' 'src/c.js' ''
run
if [ "$rc" -eq 1 ] &&
  has "$out" "MALFORMED PLAN-02.md — file name says 02 but plan: says 03" &&
  ! has "$out" "MISSINGDEP" &&
  has "$out" "WAVE 1 width=2 plans=01,02" &&
  has "$out" "RESULT fail conflicts=0 badwave=0 missingdep=0 malformed=1"; then
  ok "p-file-name-and-plan-id-disagree"
else
  bad "p-file-name-and-plan-id-disagree" "rc=$rc out=$out"
fi

# a malformed unit whose lists could be read is still checked for exclusivity
mkfix
mkplan PLAN-01.md 01 1 '' 'src/a.js' ''
mkplan PLAN-02.md 03 1 '' 'src/a.js' ''
run
if [ "$rc" -eq 1 ] && has "$out" "MALFORMED PLAN-02.md" &&
  has "$out" "CONFLICT file src/a.js — PLAN-01 and PLAN-02 (wave 1)" &&
  has "$out" "RESULT fail conflicts=1 badwave=0 missingdep=0 malformed=1"; then
  ok "p-malformed-unit-still-checked-for-exclusivity"
else
  bad "p-malformed-unit-still-checked-for-exclusivity" "rc=$rc out=$out"
fi

# a completed unit is history: never judged, even when unreadable
mkfix
printf -- '---\nplan: "01"\nfiles_modified: [src/a.js]\n---\nbody\n' > "$d/PLAN-01.md"
: > "$d/SUMMARY-01.md"
mkplan PLAN-02.md 02 1 '"01"' 'src/b.js' ''
run
if [ "$rc" -eq 0 ] && ! has "$out" "MALFORMED" &&
  has "$out" "RESULT ok conflicts=0 badwave=0 missingdep=0 malformed=0"; then
  ok "p-completed-unit-not-judged-malformed"
else
  bad "p-completed-unit-not-judged-malformed" "rc=$rc out=$out"
fi

# ------------------------------------------- (q) one file, many spellings

# pathpair <name> <first plan's entry> <second plan's entry> <conflict|none>
pathpair() {
  mkfix
  mkplan PLAN-01.md 01 1 '' "$2" ''
  mkplan PLAN-02.md 02 1 '' "$3" ''
  run
  if [ "$4" = conflict ]; then
    if [ "$rc" -eq 1 ] &&
      has "$out" "CONFLICT file $2 — PLAN-01 and PLAN-02 (wave 1)" &&
      has "$out" "RESULT fail conflicts=1 badwave=0 missingdep=0 malformed=0"; then
      ok "$1"
    else
      bad "$1" "rc=$rc out=$out"
    fi
  elif [ "$rc" -eq 0 ] && ! has "$out" "CONFLICT" &&
    has "$out" "RESULT ok conflicts=0 badwave=0 missingdep=0 malformed=0"; then
    ok "$1"
  else
    bad "$1" "rc=$rc out=$out"
  fi
}

pathpair "q-leading-dot-slash-same-file" './src/a.js' 'src/a.js' conflict
pathpair "q-doubled-slash-same-file" 'src//a.js' 'src/a.js' conflict
pathpair "q-case-differs-same-file" 'SRC/A.JS' 'src/a.js' conflict
pathpair "q-directory-covers-its-files" 'src/' 'src/a.js' conflict
pathpair "q-file-under-a-directory-entry" 'src/a.js' 'src' conflict
pathpair "q-prefix-must-end-at-a-separator" 'src/ab.js' 'src/a.js' none
pathpair "q-directory-name-prefix-is-not-a-parent" 'src' 'src-old/a.js' none

# -------------------------------------------------- (r) CRLF line endings

mkfix
printf -- '---\r\nplan: "01"\r\nwave: 1\r\ndepends_on: []\r\nfiles_modified:\r\n  - src/a.js\r\nresources: [port:3000]\r\n---\r\n\r\nbody\r\n' > "$d/PLAN-01.md"
printf -- '---\r\nplan: "02"\r\nwave: 1\r\ndepends_on: []\r\nfiles_modified: [src/a.js]\r\nresources: []\r\n---\r\n\r\nbody\r\n' > "$d/PLAN-02.md"
run
if [ "$rc" -eq 1 ] && ! has "$out" "MALFORMED" &&
  has "$out" "WAVE 1 width=2 plans=01,02" &&
  has "$out" "CONFLICT file src/a.js — PLAN-01 and PLAN-02 (wave 1)" &&
  has "$out" "RESULT fail conflicts=1 badwave=0 missingdep=0 malformed=0"; then
  ok "r-crlf-plans-parsed"
else
  bad "r-crlf-plans-parsed" "rc=$rc out=$out"
fi

# --------------------------------------------- (s) a dependency cycle

mkfix
mkplan PLAN-01.md 01 1 '"02"' 'src/a.js' ''
mkplan PLAN-02.md 02 2 '"01"' 'src/b.js' ''
run
if [ "$rc" -eq 1 ] &&
  has "$out" "BADWAVE PLAN-01 — wave 1, must be at least 3" &&
  has "$out" "RESULT fail conflicts=0 badwave=1 missingdep=0 malformed=0"; then
  ok "s-two-plan-cycle-badwave"
else
  bad "s-two-plan-cycle-badwave" "rc=$rc out=$out"
fi

# ---------------------------------------------------------------- cleanup

for t in $TMPS; do
  rm -rf "$t"
done

printf '%s PASS, %s FAIL\n' "$PASSES" "$FAILS"
[ "$FAILS" -eq 0 ]
