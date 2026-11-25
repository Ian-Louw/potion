#!/bin/sh
# scrub-test.sh — fixture tests for the scrubber's recorded field cases.
#
# Usage: sh scripts/scrub-test.sh
#   Prints `PASS|FAIL name` per case; exits 1 on any FAIL.
#
# Every case runs in its own throwaway `mktemp -d` git repo with a .potion/
# dir — never in the potion repo itself. Cases a-d and f drive the repo-side
# mirror through the shim install-repo-hooks.sh writes. Case e drives the
# plugin-side PreToolUse hook (hooks/scrub-commit.js) with a hook payload on
# stdin: the oversize leg lives only there, and "the whole command was
# rejected" is a PreToolUse fact, not a git pre-commit one.
#
# This file must never contain a secret-shaped literal: the built-in-pattern
# case assembles its fake token from two shell variables at run time.

set -u

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
install="$root/scripts/install-repo-hooks.sh"
scrub="$root/hooks/scrub-commit.js"

fails=0
tmpdirs=""
out=""

cleanup() {
  for d in $tmpdirs; do
    rm -rf "$d"
  done
}
trap cleanup EXIT

pass() { echo "PASS $1"; }
fail() {
  echo "FAIL $1 — $2"
  fails=$((fails + 1))
}

# new_repo [esm] — fresh git repo with a .potion/ dir; cwd moves into it.
new_repo() {
  d=$(mktemp -d) || exit 1
  tmpdirs="$tmpdirs $d"
  cd "$d" || exit 1
  git init -q . || exit 1
  mkdir -p .potion
  if [ "${1:-}" = "esm" ]; then
    printf '{"type":"module"}\n' > package.json
  fi
}

# commit — commit what is staged; output lands in $out, returns git's status.
commit() {
  out=$(git -c user.name=t -c user.email=t@example.invalid \
    commit -q -m "fixture" 2>&1)
}

# ---- (a) esm-install: the mirror runs under "type": "module" -------------
name="esm-install"
new_repo esm
if ! sh "$install" >/dev/null 2>&1; then
  fail "$name" "install-repo-hooks.sh failed"
elif [ ! -f .potion/scripts/pre-commit.cjs ]; then
  fail "$name" ".potion/scripts/pre-commit.cjs missing after install"
elif ! grep -q 'pre-commit\.cjs' "$(git rev-parse --git-dir)/hooks/pre-commit"; then
  fail "$name" "shim does not point at the .cjs mirror"
else
  echo "harmless note" > .potion/note.md
  git add .potion/note.md
  if commit; then
    pass "$name"
  else
    fail "$name" "commit failed: $out"
  fi
fi

# ---- (b) legacy-upgrade: old .js mirror + old shim are replaced ----------
name="legacy-upgrade"
new_repo
mkdir -p .potion/scripts
cp "$root/scripts/repo-hooks/potion-pre-commit.js" .potion/scripts/pre-commit.js
hook="$(git rev-parse --git-dir)/hooks/pre-commit"
mkdir -p "$(dirname "$hook")"
cat > "$hook" <<'OLDSHIM'
#!/bin/sh
exec node "$(git rev-parse --show-toplevel)/.potion/scripts/pre-commit.js"
OLDSHIM
chmod +x "$hook"
if ! sh "$install" >/dev/null 2>&1; then
  fail "$name" "install refused to replace potion's own legacy shim"
elif [ -e .potion/scripts/pre-commit.js ]; then
  fail "$name" "legacy .potion/scripts/pre-commit.js still present"
elif [ ! -f .potion/scripts/pre-commit.cjs ]; then
  fail "$name" ".potion/scripts/pre-commit.cjs missing after install"
elif ! grep -q 'pre-commit\.cjs' "$hook"; then
  fail "$name" "shim still points at the legacy mirror"
else
  echo "harmless note" > .potion/note.md
  git add .potion/note.md
  if commit; then
    pass "$name"
  else
    fail "$name" "commit failed: $out"
  fi
fi

# ---- (c) declared-literal: pasted declared value blocks, with remedy -----
name="declared-literal"
new_repo esm
sh "$install" >/dev/null 2>&1
echo "SEED_PW=Zq7-probe-Value-91" > .potion/verify-env.local
echo ".potion/verify-env.local" > .gitignore
mkdir -p .potion/phases/01-x
echo "Log in with password Zq7-probe-Value-91 to seed." \
  > .potion/phases/01-x/PLAN-01.md
git add .gitignore .potion/phases/01-x/PLAN-01.md
if commit; then
  fail "$name" "commit succeeded with a declared value in PLAN-01.md"
else
  case "$out" in
    *"Remedy: refer to it by name"*) pass "$name" ;;
    *) fail "$name" "blocked without the remedy sentence: $out" ;;
  esac
fi

# ---- (d) declared-by-name: same repo, the name instead of the value ------
name="declared-by-name"
echo "Log in with SEED_PW in .potion/verify-env.local to seed." \
  > .potion/phases/01-x/PLAN-01.md
git add .potion/phases/01-x/PLAN-01.md
if commit; then
  pass "$name"
else
  fail "$name" "commit failed: $out"
fi

# ---- (e) oversize: 300 KB .potion evidence blocks, with remedy -----------
name="oversize"
new_repo esm
sh "$install" >/dev/null 2>&1
mkdir -p .potion/phases/01-x/evidence
head -c 307200 /dev/zero | tr '\0' 'a' > .potion/phases/01-x/evidence/big.log
git add .potion/phases/01-x/evidence/big.log
payload='{"tool_name":"Bash","tool_input":{"command":"git commit -m fixture"}}'
out=$(printf '%s' "$payload" | node "$scrub" 2>&1)
rc=$?
if [ "$rc" -ne 2 ]; then
  fail "$name" "scrubber exit $rc, expected 2 (block): $out"
else
  case "$out" in
    *"Remedy: this whole command was rejected"*) pass "$name" ;;
    *) fail "$name" "blocked without the remedy sentence: $out" ;;
  esac
fi

# ---- (f) real-secret-still-blocked: built-in pattern still blocks --------
name="real-secret-still-blocked"
new_repo esm
sh "$install" >/dev/null 2>&1
# AWS-access-key shape, split so no matching literal exists in this file.
head_part="AKIA"
tail_part="QRSTUVWXYZ234567"
echo "aws key: ${head_part}${tail_part}" > .potion/note.md
git add .potion/note.md
if commit; then
  fail "$name" "commit succeeded with a secret-shaped token in .potion/"
else
  case "$out" in
    *"POTION PRE-COMMIT: blocked"*) pass "$name" ;;
    *) fail "$name" "commit failed, but not on the scrubber block: $out" ;;
  esac
fi

cd "$root" || exit 1
[ "$fails" -eq 0 ] || exit 1
exit 0
