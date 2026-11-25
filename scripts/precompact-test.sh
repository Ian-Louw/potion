#!/bin/sh
# Fixture test for hooks/pre-compact.js (the PreCompact position digest).
# Prints `PASS|FAIL name` per case, exits 1 on any FAIL, last line
# `N PASS, M FAIL`.
#
# Every fixture is a throwaway `mktemp -d` holding .potion/STATE.md and a
# phase directory. Nothing here touches this repo's own .potion/.

root="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$root/hooks/pre-compact.js"
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

# nodepath <dir> — the directory as node sees it, forward slashes (`pwd -W`
# on Git Bash, `cygpath -m` under an MSYS dash, plain `pwd` elsewhere)
nodepath() {
  (cd "$1" && { pwd -W 2>/dev/null || cygpath -m "$PWD" 2>/dev/null || pwd; })
}

# mkfix <phase line> — new fixture with .potion/phases/01-x. Sets:
#   d  the temp dir as the shell sees it
#   w  the same dir as node sees it
mkfix() {
  d=$(mktemp -d)
  TMPS="$TMPS $d"
  mkdir -p "$d/.potion/phases/01-x"
  printf '# State\n\n## Position\n%s\n- Status: executing\n' "$1" > "$d/.potion/STATE.md"
  w=$(nodepath "$d")
}

# compact — run the hook in the current fixture with a PreCompact payload
compact() {
  (cd "$d" && printf '{"cwd":"%s","hook_event_name":"PreCompact"}' "$w" | node "$HOOK")
}

# ------------------------------------------------------------ (a) digest

mkfix "- Phase: 1 of 1 — 01-x"
printf '# Plan 01\n' > "$d/.potion/phases/01-x/PLAN-01.md"
printf '# Plan 02\n' > "$d/.potion/phases/01-x/PLAN-02.md"
printf '# Summary 01\n' > "$d/.potion/phases/01-x/SUMMARY-01.md"
printf '# Summary 02 draft\n' > "$d/.potion/phases/01-x/SUMMARY-02.draft.md"
out=$(compact); rc=$?
if [ "$rc" -eq 0 ] &&
  has "$out" "POTION POSITION" &&
  has "$out" "Phase: 01-x" &&
  has "$out" "1 of 2 complete" &&
  has "$out" "drafts: 1"; then
  ok "pre-compact-digest"
else
  bad "pre-compact-digest" "rc=$rc out=$out"
fi

# ------------------------------------------------- (b) verification state

mkfix "- Phase: 1 of 1 — 01-x"
printf '# Plan 01\n' > "$d/.potion/phases/01-x/PLAN-01.md"
printf -- '---\ncycle: 2\nverdict: "gaps"\n---\n# Verification\n' > "$d/.potion/phases/01-x/VERIFICATION.md"
out=$(compact); rc=$?
if [ "$rc" -eq 0 ] && has "$out" "cycle 2, verdict gaps"; then
  ok "pre-compact-verification-state"
else
  bad "pre-compact-verification-state" "rc=$rc out=$out"
fi

# ------------------------------------------ (c) silent outside a potion repo

d=$(mktemp -d)
TMPS="$TMPS $d"
w=$(nodepath "$d")
out=$(compact); rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
  ok "pre-compact-silent-outside-potion"
else
  bad "pre-compact-silent-outside-potion" "rc=$rc out=$out"
fi

# ------------------------------------------------------ (d) garbage stdin

mkfix "- Phase: 1 of 1 — 01-x"
(cd "$d" && printf 'not json {{{ \001\002' | node "$HOOK" >/dev/null 2>&1); rc=$?
if [ "$rc" -eq 0 ]; then
  ok "pre-compact-garbage-stdin"
else
  bad "pre-compact-garbage-stdin" "rc=$rc"
fi

# ------------------------------------------------ (e) unresolvable phase

mkfix "- Phase: wrapping up"
out=$(compact); rc=$?
if [ "$rc" -eq 0 ] && has "$out" "Phase: unresolved"; then
  ok "pre-compact-phase-unresolved"
else
  bad "pre-compact-phase-unresolved" "rc=$rc out=$out"
fi

for t in $TMPS; do rm -rf "$t"; done

echo "$PASSES PASS, $FAILS FAIL"
[ "$FAILS" -eq 0 ]
