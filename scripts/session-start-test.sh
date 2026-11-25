#!/bin/sh
# Tests for hooks/session-start.js standing-notice behaviour: the once-a-day
# throttle, the startup-only rule, the pre-commit mirror name check and the
# evidence-staleness nag.
#
# Output: one `PASS|FAIL name` line per case; exit 1 on any FAIL.
#
# The hook takes the repo from its working directory (process.cwd()) and the
# source from the stdin JSON payload, so each case cds into a throwaway repo.
# POTION_NOTICES_FILE always points at a temp file — the real
# ~/.claude/potion/notices.json is never read or written here.

HOOK="$(cd "$(dirname "$0")/.." && pwd)/hooks/session-start.js"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FAILS=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

# new_repo: a minimal Potion repo whose only drift is what the caller leaves
# out. Echoes its path.
new_repo() {
  r="$(mktemp -d "$WORK/repo.XXXXXX")"
  mkdir -p "$r/.potion"
  printf '# State\n\n## Position\n- Phase: 01-test\n- Status: idle\n\n## Fog\n\n## Decision queue\n' \
    > "$r/.potion/STATE.md"
  echo "$r"
}

# complete_repo: everything the grammar-drift scan looks for, except the
# pre-commit mirror (the caller picks which mirror file to create).
complete_repo() {
  r="$(new_repo)"
  echo "none-needed: test repo" > "$r/.potion/verify-env.md"
  mkdir -p "$r/.potion/specs" "$r/.potion/scripts"
  echo "$r"
}

new_notices() {
  mktemp -u "$WORK/notices.XXXXXX"
}

# run_hook <repo> <source> <notices-file> → stdout of the hook; exit code in RC.
run_hook() {
  OUT="$(cd "$1" && echo "{\"source\":\"$2\",\"cwd\":\"$1\"}" |
    POTION_NOTICES_FILE="$3" node "$HOOK")"
  RC=$?
}

has() { printf '%s\n' "$OUT" | grep -qF -- "$1"; }

TODAY="$(date +%F)"
YESTERDAY="$(node -e 'const d=new Date();d.setDate(d.getDate()-1);console.log(d.toLocaleDateString("sv-SE"))')"

# (a) drifted repo (no verify-env.md), first run → notice shows.
repo="$(new_repo)"
notices="$(new_notices)"
run_hook "$repo" startup "$notices"
if has "POTION GRAMMAR DRIFT" && has "shown once a day"; then
  pass "a-drift-first-run-shows"
else
  fail "a-drift-first-run-shows"
fi

# (b) second run, same day, same repo and notices file → throttled.
run_hook "$repo" startup "$notices"
if ! has "POTION GRAMMAR DRIFT" && has "Potion project detected"; then
  pass "b-second-run-same-day-throttled"
else
  fail "b-second-run-same-day-throttled"
fi

# (c) stored date moved back to yesterday → shows again.
sed "s/$TODAY/$YESTERDAY/g" "$notices" > "$notices.tmp" && mv "$notices.tmp" "$notices"
if grep -qF "$YESTERDAY" "$notices"; then
  run_hook "$repo" startup "$notices"
  if has "POTION GRAMMAR DRIFT"; then
    pass "c-next-day-shows-again"
  else
    fail "c-next-day-shows-again"
  fi
else
  fail "c-next-day-shows-again"
fi

# (d) source clear with a fresh notices file → suppressed entirely.
repo="$(new_repo)"
notices="$(new_notices)"
run_hook "$repo" clear "$notices"
if ! has "POTION GRAMMAR DRIFT" && has "Potion project detected"; then
  pass "d-clear-suppressed"
else
  fail "d-clear-suppressed"
fi

# (e) .cjs mirror plus everything else present → no mirror complaint, and
# therefore no drift notice at all.
repo="$(complete_repo)"
echo "// mirror" > "$repo/.potion/scripts/pre-commit.cjs"
notices="$(new_notices)"
run_hook "$repo" startup "$notices"
if ! has "mirror not installed" && ! has "legacy .js" && ! has "POTION GRAMMAR DRIFT" &&
  has "Potion project detected"; then
  pass "e-cjs-mirror-accepted"
else
  fail "e-cjs-mirror-accepted"
fi

# (f) only the legacy pre-commit.js → legacy line, not "not installed".
repo="$(complete_repo)"
echo "// mirror" > "$repo/.potion/scripts/pre-commit.js"
notices="$(new_notices)"
run_hook "$repo" startup "$notices"
if has "legacy .js" && ! has "mirror not installed"; then
  pass "f-legacy-js-mirror-flagged"
else
  fail "f-legacy-js-mirror-flagged"
fi

# (g) newest field-evidence report is years old → evidence-staleness nag.
repo="$(new_repo)"
mkdir -p "$repo/.potion/research"
echo "# evidence" > "$repo/.potion/research/2020-01-01-field-evidence-1.md"
notices="$(new_notices)"
run_hook "$repo" startup "$notices"
if has "POTION EVIDENCE STALENESS" && has "2020-01-01" && has "/potion:evidence"; then
  pass "g-old-evidence-nags"
else
  fail "g-old-evidence-nags"
fi

# (h) field-evidence report dated today → no nag.
repo="$(new_repo)"
mkdir -p "$repo/.potion/research"
echo "# evidence" > "$repo/.potion/research/2020-01-01-field-evidence-1.md"
echo "# evidence" > "$repo/.potion/research/$TODAY-field-evidence-2.md"
notices="$(new_notices)"
run_hook "$repo" startup "$notices"
if ! has "POTION EVIDENCE STALENESS" && has "Potion project detected"; then
  pass "h-fresh-evidence-silent"
else
  fail "h-fresh-evidence-silent"
fi

# (i) garbage notices file → hook still exits 0 and the notice still shows.
repo="$(new_repo)"
notices="$(new_notices)"
printf '{{{' > "$notices"
run_hook "$repo" startup "$notices"
if [ "$RC" -eq 0 ] && has "POTION GRAMMAR DRIFT"; then
  pass "i-garbage-notices-file-fails-open"
else
  fail "i-garbage-notices-file-fails-open"
fi

# (j) Phase line `N (slug) — discussed <date>`: the compaction digest resolves
# the phase directory by number (never the date) and tallies its plans.
repo="$(new_repo)"
mkdir -p "$repo/.potion/phases/02-alpha"
echo "plan" > "$repo/.potion/phases/02-alpha/PLAN-01.md"
echo "summary" > "$repo/.potion/phases/02-alpha/SUMMARY-01.md"
printf '# State\n\n## Position\n- Phase: 2 (alpha) — discussed 2026-11-20\n- Status: executing\n\n## Fog\n\n## Decision queue\n' \
  > "$repo/.potion/STATE.md"
notices="$(new_notices)"
run_hook "$repo" compact "$notices"
if has "Plans: 1 of 1 complete"; then
  pass "j-dated-phase-line-plan-tally"
else
  fail "j-dated-phase-line-plan-tally"
fi

[ "$FAILS" -eq 0 ] || exit 1
exit 0
