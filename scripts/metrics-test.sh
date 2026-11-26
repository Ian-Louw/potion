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

# (i) a cycle line with a trailing comment is recorded as the number alone
R="$(new_repo i)"
P="$R/.potion/phases/03-gamma"
mkdir -p "$P"
printf -- '---\nverdict: "gaps"\ncycle: 2                      # increments each verify pass\n---\n' > "$P/VERIFICATION.md"
(cd "$R" && node "$SCRIPT" record --stage verify --phase 03-gamma --gaps 1 >/dev/null 2>&1)
if check_last "$R" 'r.cycle === 2 && r.verdict === "gaps"'; then
  pass i-cycle-comment-stripped
else
  fail i-cycle-comment-stripped
fi

# (j) report sums a phase's lines, ignores other phases, and writes nothing
: > "$P/PLAN-01.md"; : > "$P/PLAN-02.md"; : > "$P/SUMMARY-01.md"; : > "$P/SUMMARY-02.md"
(cd "$R" && node "$SCRIPT" record --stage execute --phase 03-gamma --workers 2 --waves 1 --max-wave-width 2 --respawns 1 --overload-respawns 1 --gate-stops 0 >/dev/null 2>&1)
(cd "$R" && node "$SCRIPT" record --stage execute --phase 09-other --workers 50 >/dev/null 2>&1)
printf -- '---\nverdict: "pass"\ncycle: 3\n---\n' > "$P/VERIFICATION.md"
(cd "$R" && node "$SCRIPT" record --stage verify --phase 03-gamma --gaps 0 >/dev/null 2>&1)
(cd "$R" && node "$SCRIPT" record --stage brew --phase 03-gamma --agents 5 --gate-stops 1 --respawns 0 --minutes 12 >/dev/null 2>&1)
BEFORE="$(wc -c < "$R/.potion/metrics.jsonl")"
OUT="$(cd "$R" && node "$SCRIPT" report --phase 03-gamma 2>&1)"; RC=$?
AFTER="$(wc -c < "$R/.potion/metrics.jsonl")"
if [ "$RC" -eq 0 ] && [ "$BEFORE" = "$AFTER" ] &&
  echo "$OUT" | grep -qxF 'USAGE 03-gamma' &&
  echo "$OUT" | grep -qxF '  plans: 2 of 2 complete' &&
  echo "$OUT" | grep -qxF '  workers spawned: 2' &&
  echo "$OUT" | grep -qxF '  agents spawned (all kinds): 5' &&
  echo "$OUT" | grep -qxF '  waves: 1, widest 2' &&
  echo "$OUT" | grep -qxF '  verify cycles: 2, verdict pass' &&
  echo "$OUT" | grep -qxF '  respawns: 1 (plus 1 after an overload)' &&
  echo "$OUT" | grep -qxF '  gate stops: 1' &&
  echo "$OUT" | grep -qxF '  time: 12 min in brew'; then
  pass j-report-sums-one-phase
else
  fail j-report-sums-one-phase
  echo "$OUT"
fi

# (k) report with nothing recorded, and outside a potion repo, still exits 0
OUT="$(cd "$R" && node "$SCRIPT" report --phase 77-none 2>&1)"; RC=$?
OUT2="$(cd "$ROOT" && node "$SCRIPT" report 2>&1)"; RC2=$?
if [ "$RC" -eq 0 ] && [ "$RC2" -eq 0 ] &&
  echo "$OUT" | grep -qxF '  no metrics recorded' &&
  echo "$OUT2" | grep -qxF '  no metrics recorded'; then
  pass k-report-nothing-recorded
else
  fail k-report-nothing-recorded
fi

# (l) a runbook and its summary count on both sides (field run printed "6 of 5")
R="$(new_repo l)"
P="$R/.potion/phases/05-rb"
mkdir -p "$P"
: > "$P/PLAN-01.md"; : > "$P/RUNBOOK-02.md"; : > "$P/SUMMARY-01.md"; : > "$P/SUMMARY-02.md"
(cd "$R" && node "$SCRIPT" record --stage execute --phase 05-rb --workers 1 >/dev/null 2>&1)
OUT="$(cd "$R" && node "$SCRIPT" report --phase 05-rb 2>&1)"
if echo "$OUT" | grep -qxF '  plans and runbooks: 2 of 2 complete (1 runbook)'; then
  pass l-runbook-counted-both-sides
else
  fail l-runbook-counted-both-sides
  echo "$OUT"
fi

if [ "$FAILS" -gt 0 ]; then
  echo "$FAILS FAIL"
  exit 1
fi
exit 0
