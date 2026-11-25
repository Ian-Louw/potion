#!/bin/sh
# Piped-payload tests for hooks/stop-drift.js and hooks/worker-finish.js.
# Builds throwaway git repos under $(mktemp -d), pipes synthetic hook JSON
# into each hook, prints one `PASS|FAIL name` line per case, exits 1 on any
# FAIL. POSIX sh; runs under Git Bash on Windows.
#
#   sh scripts/hooks-test.sh

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SD="$ROOT/hooks/stop-drift.js"
WF="$ROOT/hooks/worker-finish.js"

T=$(mktemp -d) || exit 1
trap 'rm -rf "$T"' EXIT INT TERM

FAILS=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1 — $2"; FAILS=$((FAILS + 1)); }

# A path node understands: `pwd -W` gives C:/... on Git Bash, plain pwd elsewhere.
npath() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }

# run <hook.js> <payload>: sets CODE; stdout in $T/out, stderr in $T/err.
run() {
  printf '%s' "$2" | node "$1" >"$T/out" 2>"$T/err"
  CODE=$?
}

commit() {
  git -C "$1" -c user.name=t -c user.email=t@example.invalid \
    -c commit.gpgsign=false commit -q -m "$2"
}

# ---------------------------------------------------------------- stop-drift

R="$T/sd"
PH="$R/.potion/phases/02-alpha"
mkdir -p "$PH"
git init -q "$R"
echo "plan" >"$PH/PLAN-01.md"
state() { printf '# State\n\n%s\n- Status: executing\n' "$1" >"$R/.potion/STATE.md"; }
state '- Phase: 2 of 5 — 02-alpha'
git -C "$R" add .potion
commit "$R" "feat(02-alpha-01): x"
RN=$(npath "$R")
SD_PAYLOAD='{"cwd":"'"$RN"'"}'
MSG='PLAN-01 has commits but no SUMMARY-01'

# expect_drift <name> [<stderr substring>]
expect_drift() {
  run "$SD" "$SD_PAYLOAD"
  if [ "$CODE" -ne 2 ]; then
    fail "$1" "exit $CODE, wanted 2"
  elif [ -n "$2" ] && ! grep -qF "$2" "$T/err"; then
    fail "$1" "stderr lacks '$2'"
  else
    pass "$1"
  fi
}
expect_exit0() {
  run "$1" "$2"
  if [ "$CODE" -ne 0 ]; then fail "$3" "exit $CODE, wanted 0"; else pass "$3"; fi
}

# (a) NN of M — NN-slug
expect_drift "a stop-drift: 'N of M — NN-slug' phase line blocks" "$MSG"

# (b) NN (slug) — no slug on the line, resolved from the phases directory
state '- Phase: 2 (alpha) — discussed'
expect_drift "b stop-drift: 'N (slug)' phase line blocks" "$MSG"

# (p) NN (slug) with a trailing date — the date is never taken as the slug
state '- Phase: 2 (alpha) — discussed 2026-11-20'
expect_drift "p stop-drift: 'N (slug) — discussed <date>' phase line blocks" "$MSG"

# (q) no phase on the line, only a date → nothing resolves, check skipped
state '- Phase: wrapping up 2026-11-20'
expect_exit0 "$SD" "$SD_PAYLOAD" "q stop-drift: date-only phase line passes"

# (c) bare NN-slug
state '- Phase: 02-alpha'
expect_drift "c stop-drift: 'NN-slug' phase line blocks" "$MSG"

# (d) a draft is not a SUMMARY
echo "draft" >"$PH/SUMMARY-01.draft.md"
expect_drift "d stop-drift: SUMMARY-01.draft.md does not satisfy the check" "$MSG"

# (g) one-shot: the same failing repo passes once stop_hook_active is set
expect_exit0 "$SD" '{"cwd":"'"$RN"'","stop_hook_active":true}' \
  "g stop-drift: stop_hook_active passes a failing repo"

# (e) the real SUMMARY clears it
echo "summary" >"$PH/SUMMARY-01.md"
expect_exit0 "$SD" "$SD_PAYLOAD" "e stop-drift: SUMMARY-01.md present passes"

# (f) byte cap: 10 lines, one of them 13000 chars (SUMMARY still present, so
# the byte cap is the only possible defect)
{
  printf '# State\n\n- Phase: 02-alpha\n- Status: executing\n'
  head -c 13000 /dev/zero | tr '\0' 'x'
  printf '\nl6\nl7\nl8\nl9\nl10\n'
} >"$R/.potion/STATE.md"
LINES=$(wc -l <"$R/.potion/STATE.md" | tr -d ' ')
run "$SD" "$SD_PAYLOAD"
if [ "$LINES" -ne 10 ]; then
  fail "f stop-drift: byte cap" "fixture has $LINES lines, wanted 10"
elif [ "$CODE" -ne 2 ]; then
  fail "f stop-drift: byte cap" "exit $CODE, wanted 2"
elif ! grep -qF 'bytes (cap 12000)' "$T/err"; then
  fail "f stop-drift: byte cap" "stderr lacks 'bytes (cap 12000)'"
elif grep -qF 'lines (cap' "$T/err"; then
  fail "f stop-drift: byte cap" "line cap fired on a 10-line file"
else
  pass "f stop-drift: 10-line STATE over 12000 bytes blocks"
fi

# (h) not a potion project
mkdir -p "$T/plain"
expect_exit0 "$SD" '{"cwd":"'"$(npath "$T/plain")"'"}' \
  "h stop-drift: cwd without .potion passes"

# ------------------------------------------------------------- worker-finish

W="$T/wf"
WPH="$W/.potion/phases/02-alpha"
mkdir -p "$WPH"
echo "plan" >"$WPH/PLAN-01.md"
WN=$(npath "$W")
PLAN="$WN/.potion/phases/02-alpha/PLAN-01.md"
DRAFT="$WPH/SUMMARY-01.draft.md"

unfilled() {
  # The real template when available, so the markers are never hand-copied.
  if [ -f "$ROOT/templates/SUMMARY.md" ]; then
    cp "$ROOT/templates/SUMMARY.md" "$DRAFT"
  else
    printf '## Built\n\n{2-4 sentences: x}\n\n| 1. t | {hash} | x |\n' >"$DRAFT"
  fi
}
filled() {
  printf '# Summary — plan 01\n\n## Built\n\nA thing.\n\n## Task → commit\n\n| Task | Commit | One line |\n|---|---|---|\n| 1. x | abc1234 | did x |\n\n## Deviations\n\nNone.\n\n## Concerns\n\nNone\n' >"$DRAFT"
}

# Fake subagent transcript: first line is a JSON object naming the plan path.
TR="$T/transcript.jsonl"
printf '{"type":"user","message":{"role":"user","content":"read your plan at %s and execute it"}}\n' "$PLAN" >"$TR"
TRN="$(npath "$T")/transcript.jsonl"

# wf_payload <agent_type> <stop_hook_active> <last message> [<transcript>]
wf_payload() {
  printf '{"cwd":"%s","stop_hook_active":%s,"agent_type":"%s","agent_id":"a1","agent_transcript_path":"%s","last_assistant_message":"%s"}' \
    "$WN" "$2" "$1" "${4:-$TRN}" "$3"
}
# expect_silent <name> <payload>
expect_silent() {
  run "$WF" "$2"
  if [ "$CODE" -ne 0 ]; then
    fail "$1" "exit $CODE, wanted 0"
  elif [ -s "$T/out" ]; then
    fail "$1" "stdout not empty: $(cat "$T/out")"
  else
    pass "$1"
  fi
}
blocks() {
  run "$WF" "$1"
  [ "$CODE" -eq 0 ] && grep -qF '"decision":"block"' "$T/out" &&
    grep -qF 'SUMMARY-01.draft.md' "$T/out"
}

# (i) unfilled draft + DONE → block. On Windows also prove the transcript's
# native shape: backslash separators, doubled by JSON encoding.
unfilled
I_OK=1
blocks "$(wf_payload potion:potion-worker false 'status: DONE')" || I_OK=0
case "$PLAN" in
  [A-Za-z]:/*)
    BS_PLAN=$(printf '%s' "$PLAN" | sed 's|/|\\\\|g')
    printf '{"type":"user","message":{"role":"user","content":"read your plan at %s and execute it"}}\n' "$BS_PLAN" >"$T/transcript-bs.jsonl"
    blocks "$(wf_payload potion:potion-worker false 'status: DONE' "$(npath "$T")/transcript-bs.jsonl")" || I_OK=0
    ;;
esac
if [ "$I_OK" -eq 1 ]; then
  pass "i worker-finish: unfilled draft + DONE blocks with the draft path"
else
  fail "i worker-finish: unfilled draft + DONE" "exit $CODE, stdout: $(cat "$T/out")"
fi

# (k) unfilled draft, CHECKPOINT return
expect_silent "k worker-finish: unfilled draft + CHECKPOINT passes" \
  "$(wf_payload potion:potion-worker false 'CHECKPOINT: need a human')"

# (l) some other agent type
expect_silent "l worker-finish: agent_type Explore passes" \
  "$(wf_payload Explore false 'status: DONE')"

# (m) one-shot
expect_silent "m worker-finish: stop_hook_active passes" \
  "$(wf_payload potion:potion-worker true 'status: DONE')"

# (o) garbage stdin
expect_silent "o worker-finish: garbage stdin passes" 'not json {{{'

# (n) final SUMMARY already exists (draft still unfilled beside it)
echo "summary" >"$WPH/SUMMARY-01.md"
expect_silent "n worker-finish: SUMMARY-01.md already exists passes" \
  "$(wf_payload potion:potion-worker false 'status: DONE')"
rm "$WPH/SUMMARY-01.md"

# (j) filled draft
filled
expect_silent "j worker-finish: filled draft passes" \
  "$(wf_payload potion:potion-worker false 'status: DONE')"

if [ "$FAILS" -gt 0 ]; then
  echo "$FAILS FAILED"
  exit 1
fi
echo "all passed"
