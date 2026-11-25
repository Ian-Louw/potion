#!/bin/sh
# install-repo-hooks.sh — install potion's repo-side enforcement into a
# target repo, so secret protection holds with no plugin loaded.
#
# Usage: sh install-repo-hooks.sh [--force]
#   Run with cwd = target repo root.
#
# Copies the pre-commit mirror (as pre-commit.cjs) and ci-verify.sh into
# <target>/.potion/scripts/ (potion-owned copies — overwriting them is fine),
# then writes a .git/hooks/pre-commit shim pointing at the copy. The mirror
# is installed with a .cjs extension so Node loads it as CommonJS even when
# the host repo's package.json sets "type": "module"; a legacy
# .potion/scripts/pre-commit.js from an older install is removed. Refuses to
# overwrite an existing pre-commit hook unless --force is given — never
# clobber a host repo's hooks. The one exception is potion's own old shim
# (it points at the legacy .js mirror): that is replaced without --force.

set -u

dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# (1) must be run inside a git repository
gitdir=$(git rev-parse --git-dir 2>/dev/null) || {
  echo "install-repo-hooks: not a git repository" >&2
  exit 1
}

# (2) copy the potion-owned scripts into .potion/scripts/
mkdir -p .potion/scripts
cp "$dir/repo-hooks/potion-pre-commit.js" .potion/scripts/pre-commit.cjs
echo "installed .potion/scripts/pre-commit.cjs"
if [ -e .potion/scripts/pre-commit.js ]; then
  rm -f .potion/scripts/pre-commit.js
  echo "removed legacy .potion/scripts/pre-commit.js"
fi
cp "$dir/ci-verify.sh" .potion/scripts/ci-verify.sh
echo "installed .potion/scripts/ci-verify.sh"

# (3) never clobber an existing host hook without --force — except potion's
# own old shim, recognised by its reference to the legacy .js mirror
hookpath="$gitdir/hooks/pre-commit"
if [ -e "$hookpath" ] && [ "${1:-}" != "--force" ]; then
  if grep -qF '.potion/scripts/pre-commit.js' "$hookpath" 2>/dev/null; then
    echo "replacing potion's legacy pre-commit shim"
  else
    echo "refusing to overwrite existing pre-commit hook (use --force)" >&2
    exit 1
  fi
fi

# (4) write the shim
mkdir -p "$gitdir/hooks"
cat > "$hookpath" <<'SHIM'
#!/bin/sh
exec node "$(git rev-parse --show-toplevel)/.potion/scripts/pre-commit.cjs"
SHIM
chmod +x "$hookpath"
echo "installed pre-commit shim at $hookpath"
