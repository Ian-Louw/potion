#!/bin/sh
# install-repo-hooks.sh — install potion's repo-side enforcement into a
# target repo, so secret protection holds with no plugin loaded.
#
# Usage: sh install-repo-hooks.sh [--force]
#   Run with cwd = target repo root.
#
# Copies potion-pre-commit.js and ci-verify.sh into <target>/.potion/scripts/
# (potion-owned copies — overwriting them is fine), then writes a
# .git/hooks/pre-commit shim pointing at the copy. Refuses to overwrite an
# existing pre-commit hook unless --force is given — never clobber a host
# repo's hooks.

set -u

dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# (1) must be run inside a git repository
gitdir=$(git rev-parse --git-dir 2>/dev/null) || {
  echo "install-repo-hooks: not a git repository" >&2
  exit 1
}

# (2) copy the potion-owned scripts into .potion/scripts/
mkdir -p .potion/scripts
cp "$dir/repo-hooks/potion-pre-commit.js" .potion/scripts/pre-commit.js
echo "installed .potion/scripts/pre-commit.js"
cp "$dir/ci-verify.sh" .potion/scripts/ci-verify.sh
echo "installed .potion/scripts/ci-verify.sh"

# (3) never clobber an existing host hook without --force
hookpath="$gitdir/hooks/pre-commit"
if [ -e "$hookpath" ] && [ "${1:-}" != "--force" ]; then
  echo "refusing to overwrite existing pre-commit hook (use --force)" >&2
  exit 1
fi

# (4) write the shim
mkdir -p "$gitdir/hooks"
cat > "$hookpath" <<'SHIM'
#!/bin/sh
exec node "$(git rev-parse --show-toplevel)/.potion/scripts/pre-commit.js"
SHIM
chmod +x "$hookpath"
echo "installed pre-commit shim at $hookpath"
