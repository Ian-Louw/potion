#!/bin/sh
# Tests for scripts/metrics.js. Output: `PASS|FAIL name`; exit 1 on any FAIL.
# Fixtures live under `mktemp -d`; nothing is written to the real repo.

SCRIPT="$(cd "$(dirname "$0")" && pwd)/metrics.js"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
FAILS=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

# new_repo <name> -> prints the path of a fresh fixture repo with .potion/
new_repo() {
  mkdir -p "$ROOT/$1/.potion/phases"
  echo "$ROOT/$1"
}

# check_last <repo> <js expression over r> -> exit 0 when the expression holds
# for the parsed last line of .potion/metrics.jsonl
check_last() {
  tail -n 1 "$1/.potion/metrics.jsonl" | node -e '
    let s = "";
    process.stdin.on("data", (d) => { s += d; });
    process.stdin.on("end", () => {
      let r;
      try { r = JSON.parse(s); } catch (e) { process.exit(2); }
      process.exit(eval(process.argv[1]) ? 0 : 1);
    });
  ' "$2"
}

# (a) explicit phase, counts derived from disk, machine timestamp
R="$(new_repo a)"
P="$R/.potion/phases/07-alpha"
mkdir -p "$P"
: > "$P/PLAN-01.md"; : > "$P/PLAN-02.md"; : > "$P/SUMMARY-01.md"; : > "$P/SUMMARY-02.draft.md"
(cd "$R" && node "$SCRIPT" record --stage execute --phase 07-alpha >/dev/null 2>&1)
if check_last "$R" 'r.stage === "execute" && r.phase === "07-alpha" && r.plans === 2 && r.summaries === 1 && r.drafts === 1 && /^\d{4}-\d{2}-\d{2}T/.test(r.ts)'; then
  pass a-explicit-phase-counts
else
  fail a-explicit-phase-counts
fi

# (b) phase derived from an unpadded STATE number matching dir 03-thing
R="$(new_repo b)"
mkdir -p "$R/.potion/phases/03-thing" "$R/.potion/phases/13-other"
: > "$R/.potion/phases/03-thing/PLAN-01.md"
printf '# State\n\n## Position\n- Phase: 3 (thing)\n- Status: executing\n' > "$R/.potion/STATE.md"
(cd "$R" && node "$SCRIPT" record --stage verify >/dev/null 2>&1)
if check_last "$R" 'r.phase === "03-thing" && r.plans === 1 && r.stage === "verify"'; then
  pass b-phase-derived-from-state
else
  fail b-phase-derived-from-state
fi

# (c) cycle and verdict from VERIFICATION.md frontmatter
R="$(new_repo c)"
P="$R/.potion/phases/02-beta"
mkdir -p "$P"
printf -- '---\ncycle: 2\nverdict: gaps\n---\n\n# Verification\n' > "$P/VERIFICATION.md"
(cd "$R" && node "$SCRIPT" record --stage verify --phase 02-beta >/dev/null 2>&1)
if check_last "$R" 'r.cycle === 2 && r.verdict === "gaps"'; then
  pass c-cycle-verdict
else
  fail c-cycle-verdict
fi

# (d) pass-through flags: numeric stay numbers, note stays a string
R="$(new_repo d)"
(cd "$R" && node "$SCRIPT" record --stage execute --workers 4 --max-wave-width 3 --note "x y" >/dev/null 2>&1)
if check_last "$R" 'r.workers === 4 && r.max_wave_width === 3 && r.note === "x y"'; then
  pass d-pass-through-flags
else
  fail d-pass-through-flags
fi

# (e) two records -> exactly two lines
R="$(new_repo e)"
(cd "$R" && node "$SCRIPT" record --stage execute >/dev/null 2>&1)
(cd "$R" && node "$SCRIPT" record --stage verify >/dev/null 2>&1)
N="$(wc -l < "$R/.potion/metrics.jsonl" | tr -d ' ')"
if [ "$N" = "2" ]; then pass e-append-only-two-lines; else fail e-append-only-two-lines; fi

# (f) not a potion repo -> exit 0, nothing created
R="$ROOT/f"
mkdir -p "$R"
(cd "$R" && node "$SCRIPT" record --stage execute >/dev/null 2>&1)
RC=$?
if [ "$RC" -eq 0 ] && [ ! -e "$R/.potion" ]; then
  pass f-no-potion-dir-silent
else
  fail f-no-potion-dir-silent
fi

# (g) append fails (metrics.jsonl is a directory) -> exit 0, skip on stderr
R="$(new_repo g)"
mkdir -p "$R/.potion/metrics.jsonl"
ERR="$(cd "$R" && node "$SCRIPT" record --stage execute 2>&1 >/dev/null)"
RC=$?
case "$ERR" in
  *"metrics: skipped"*) SKIPPED=1 ;;
  *) SKIPPED=0 ;;
esac
if [ "$RC" -eq 0 ] && [ "$SKIPPED" -eq 1 ]; then
  pass g-append-failure-exits-zero
else
  fail g-append-failure-exits-zero
fi

# (h) Phase line `N (slug) — discussed <date>`, no --phase -> the directory,
# never the date
R="$(new_repo h)"
mkdir -p "$R/.potion/phases/02-alpha"
printf '# State\n\n## Position\n- Phase: 2 (alpha) — discussed 2026-11-20\n- Status: executing\n' > "$R/.potion/STATE.md"
(cd "$R" && node "$SCRIPT" record --stage verify >/dev/null 2>&1)
if check_last "$R" 'r.phase === "02-alpha"' &&
  tail -n 1 "$R/.potion/metrics.jsonl" | grep -qF '"phase":"02-alpha"'; then
  pass h-dated-phase-line-resolves-dir
else
  fail h-dated-phase-line-resolves-dir
fi

if [ "$FAILS" -gt 0 ]; then
  echo "$FAILS FAIL"
  exit 1
fi
exit 0
