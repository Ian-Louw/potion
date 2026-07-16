#!/bin/sh
# merge-specs-test.sh — fixture self-test for scripts/merge-specs.sh.
# Cases: (1) CLEAN 4-op merge, (2) SEEDED CONFLICT with atomicity proof,
# (3) MALFORMED delta with atomicity proof. Exits 0 only when all pass.
# POSIX sh + awk fixtures under mktemp -d; run from the repo root.

set -u

MERGE=$(dirname "$0")/merge-specs.sh
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAIL=0

fail() {
  echo "FAIL: $1"
  shift
  for line in "$@"; do echo "  $line"; done
  FAIL=1
}

# ------------------------------------------------- pristine fixture tree ----
PRISTINE="$TMP/pristine-specs"
mkdir -p "$PRISTINE/alpha"
cat > "$PRISTINE/alpha/spec.md" <<'EOF'
# alpha — spec

Purpose: fixture capability for the merge self-test

### Requirement: keep-one — original statement to be modified

- GIVEN an original precondition
- WHEN the original action happens
- THEN the original outcome holds

### Requirement: remove-me — statement that will be removed

- GIVEN something removable
- WHEN removal is merged
- THEN this block is gone

### Requirement: old-name — statement that keeps its text through a rename

- GIVEN a stable scenario
- WHEN only the id changes
- THEN the body is untouched
EOF

fresh_tree() { # $1 = dest
  rm -rf "$1"
  cp -r "$PRISTINE" "$1"
}

# ------------------------------------------------------- case 1: CLEAN -----
PHASE1="$TMP/phase-clean"
mkdir -p "$PHASE1"
cat > "$PHASE1/PLAN-01.md" <<'EOF'
<spec_deltas>
capability: alpha
ADDED:
### Requirement: added-req — a brand new requirement

- GIVEN a fixture tree
- WHEN the clean merge runs
- THEN this block appears at EOF
MODIFIED:
### Requirement: keep-one — replaced statement text

- GIVEN a fixture tree
- WHEN the clean merge runs
- THEN replacement-marker is present
REMOVED: remove-me
RENAMED: old-name -> new-name
</spec_deltas>
EOF

SPECS1="$TMP/specs-clean"
fresh_tree "$SPECS1"
OUT=$(SPECS_DIR="$SPECS1" sh "$MERGE" "$PHASE1" 2>&1)
RC=$?
SPEC="$SPECS1/alpha/spec.md"
if [ "$RC" -ne 0 ]; then
  fail "clean: expected exit 0, got $RC" "$OUT"
elif ! grep -q '^### Requirement: added-req — ' "$SPEC"; then
  fail "clean: ADDED id missing from spec" "$(cat "$SPEC")"
elif ! grep -q 'replacement-marker' "$SPEC"; then
  fail "clean: MODIFIED replacement text missing" "$(cat "$SPEC")"
elif grep -q 'remove-me' "$SPEC"; then
  fail "clean: REMOVED id still present" "$(cat "$SPEC")"
elif ! grep -q '^### Requirement: new-name — ' "$SPEC"; then
  fail "clean: RENAMED new id missing" "$(cat "$SPEC")"
elif grep -q '^### Requirement: old-name — ' "$SPEC"; then
  fail "clean: RENAMED old id still present" "$(cat "$SPEC")"
else
  echo "PASS: clean"
fi

# --------------------------------------------- case 2: SEEDED CONFLICT -----
PHASE2="$TMP/phase-conflict"
mkdir -p "$PHASE2"
cat > "$PHASE2/PLAN-01.md" <<'EOF'
<spec_deltas>
capability: alpha
MODIFIED:
### Requirement: keep-one — first plan rewrite

- GIVEN plan one
- WHEN it modifies keep-one
- THEN conflict looms
</spec_deltas>
EOF
cat > "$PHASE2/PLAN-02.md" <<'EOF'
<spec_deltas>
capability: alpha
MODIFIED:
### Requirement: keep-one — second plan rewrite

- GIVEN plan two
- WHEN it also modifies keep-one
- THEN the merge must refuse
</spec_deltas>
EOF

SPECS2="$TMP/specs-conflict"
fresh_tree "$SPECS2"
cp -r "$SPECS2" "$TMP/specs-conflict-before"
OUT=$(SPECS_DIR="$SPECS2" sh "$MERGE" "$PHASE2" 2>&1)
RC=$?
if [ "$RC" -eq 0 ]; then
  fail "conflict: expected nonzero exit, got 0" "$OUT"
elif ! echo "$OUT" | grep -q 'CONFLICT:'; then
  fail "conflict: output lacks CONFLICT:" "$OUT"
elif ! diff -r "$TMP/specs-conflict-before" "$SPECS2" > /dev/null 2>&1; then
  fail "conflict: specs tree mutated despite refusal" \
       "$(diff -r "$TMP/specs-conflict-before" "$SPECS2" 2>&1)"
else
  echo "PASS: conflict"
fi

# -------------------------------------------------- case 3: MALFORMED ------
PHASE3="$TMP/phase-malformed"
mkdir -p "$PHASE3"
cat > "$PHASE3/PLAN-01.md" <<'EOF'
<spec_deltas>
capability: alpha
REMOVED: nonexistent-id
</spec_deltas>
EOF

SPECS3="$TMP/specs-malformed"
fresh_tree "$SPECS3"
cp -r "$SPECS3" "$TMP/specs-malformed-before"
OUT=$(SPECS_DIR="$SPECS3" sh "$MERGE" "$PHASE3" 2>&1)
RC=$?
if [ "$RC" -eq 0 ]; then
  fail "malformed: expected nonzero exit, got 0" "$OUT"
elif ! echo "$OUT" | grep -q 'MALFORMED:'; then
  fail "malformed: output lacks MALFORMED:" "$OUT"
elif ! diff -r "$TMP/specs-malformed-before" "$SPECS3" > /dev/null 2>&1; then
  fail "malformed: specs tree mutated despite refusal" \
       "$(diff -r "$TMP/specs-malformed-before" "$SPECS3" 2>&1)"
else
  echo "PASS: malformed"
fi

exit $FAIL
