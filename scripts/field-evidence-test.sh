#!/bin/sh
# field-evidence-test.sh — fixture test for scripts/field-evidence.js.
# Prints `PASS|FAIL name` per assertion; exits 1 on any FAIL.
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/field-evidence.js"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
FAILS=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }
check() { # name, exit status of the assertion
  if [ "$2" -eq 0 ]; then pass "$1"; else fail "$1"; fi
}

ROOT="$T/root"
TR="$T/transcripts"

# repoA: 01-a discussed only; 02-b two plans, one summary, one draft
mkdir -p "$ROOT/repoA/.potion/phases/01-a" "$ROOT/repoA/.potion/phases/02-b"
echo "# State" > "$ROOT/repoA/.potion/STATE.md"
echo "# Discussion" > "$ROOT/repoA/.potion/phases/01-a/DISCUSSION.md"
for f in PLAN-01.md PLAN-02.md SUMMARY-01.md SUMMARY-02.draft.md; do
  echo "# $f" > "$ROOT/repoA/.potion/phases/02-b/$f"
done

# repoB: nested one level deeper; one phase, plan + summary, no verification, metrics
mkdir -p "$ROOT/group/repoB/.potion/phases/01-x"
echo "# State" > "$ROOT/group/repoB/.potion/STATE.md"
echo "# plan" > "$ROOT/group/repoB/.potion/phases/01-x/PLAN-01.md"
echo "# summary" > "$ROOT/group/repoB/.potion/phases/01-x/SUMMARY-01.md"
cat > "$ROOT/group/repoB/.potion/metrics.jsonl" <<'EOF'
{"stage":"execute","workers":2,"ts":"2026-11-01"}
{"stage":"execute","workers":4,"ts":"2026-11-02"}
EOF

# worker worktree copy — must be ignored
cp -R "$ROOT/repoA" "$ROOT/repoA-wt-01"

# transcripts: one project, one file
mkdir -p "$TR/proj-one"
cat > "$TR/proj-one/session.jsonl" <<'EOF'
{"type":"user","timestamp":"2026-11-20T10:00:00Z","message":{"content":"<command-name>/potion:execute</command-name>"}}
{"type":"user","timestamp":"2026-11-20T10:05:00Z","message":{"content":"<command-name>/clear</command-name>"}}
{"type":"user","timestamp":"2026-11-20T10:06:00Z","message":{"content":"<command-name>/potion:execute</command-name>"}}
{"type":"user","timestamp":"2026-11-20T10:07:00Z","message":{"content":[{"type":"tool_result","content":"Subagents should return findings as text, not files."}]}}
{"type":"user","timestamp":"2026-11-20T10:08:00Z","message":{"content":"Stop hook feedback: POTION DRIFT: STATE.md position is stale"}}
{"type":"user","isSidechain":true,"timestamp":"2026-11-20T10:09:00Z","message":{"content":"<command-name>/potion:plan</command-name>"}}
EOF

BEFORE=$(cd "$T" && find . | sort)
OUT=$(node "$SCRIPT" --root "$ROOT" --transcripts "$TR")
STATUS=$?
AFTER=$(cd "$T" && find . | sort)

has() { printf '%s\n' "$OUT" | grep -qF -- "$1"; }
hasline() { printf '%s\n' "$OUT" | grep -qFx -- "$1"; }

# (a) both repos listed, the -wt- copy not
[ "$STATUS" -eq 0 ] && has "| repoA |" && has "| repoB |" && ! has "repoA-wt-01"
check "a-repos-listed-worktree-ignored" $?

# (b) repoA row: 2 phases, 2 plans, 0 runbooks, 1 summary, 1 draft
has "| repoA | 2 | 2 | 0 | 1 | 1 |"
check "b-repoA-row-counts" $?

# (c) discussed, never planned names 01-a
hasline "- repoA: 01-a — discussed, never planned"
check "c-discussed-never-planned" $?

# (d) plans ahead of summaries names 02-b
has "- repoA: 02-b — plans ahead of summaries (2 plans/runbooks, 1 summaries)"
check "d-plans-ahead-of-summaries" $?

# (e) no verification names repoB's phase
hasline "- repoB: 01-x — no verification"
check "e-no-verification" $?

# (f) metrics: workers median 3, max 4
has "| execute | 2 | workers | 2 | 3 | 4 |"
check "f-metrics-median-max" $?

# (g) transcripts: execute=2, plan=0, clear=1, clear-then-potion=1, refusals=1, stop blocks=1
hasline "- typed /potion:execute: 2" && ! has "potion:plan" && hasline "- typed potion commands: 2" \
  && hasline "- /clear: 1" && hasline "- /clear then potion: 1" \
  && hasline "- SUMMARY write refusals: 1" && hasline "- stop-drift blocks: 1"
check "g-transcript-counts" $?

# (h) read-only: fixture listing identical before and after
[ -n "$BEFORE" ] && [ "$BEFORE" = "$AFTER" ]
check "h-read-only" $?

if [ "$FAILS" -gt 0 ]; then
  echo "---- report output ----"
  printf '%s\n' "$OUT"
  exit 1
fi
exit 0
