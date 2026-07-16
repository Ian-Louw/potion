#!/bin/sh
# merge-specs.sh — deterministic validate-then-apply spec delta merge.
#
# Usage: sh scripts/merge-specs.sh <phase-dir>   (run from the target repo root)
# SPECS_DIR env var overrides the target root (default: .potion/specs).
#
# Scans every PLAN-*.md in <phase-dir> for <spec_deltas> sections (markers
# recognized ONLY at column 0 — indented occurrences are documentation
# examples and are ignored). Validates every op across every plan first;
# ANY failure prints all findings and exits 1 having written NOTHING.
#
# POSIX sh + awk only. No bash-isms, no node.

set -u

PHASE_DIR=${1:-}
SPECS_DIR=${SPECS_DIR:-.potion/specs}
TAB=$(printf '\t')

if [ -z "$PHASE_DIR" ] || [ ! -d "$PHASE_DIR" ]; then
  echo "ERROR: phase dir not found: ${PHASE_DIR:-<missing>}" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

OPS="$TMP/ops.txt"        # op <TAB> slug <TAB> id <TAB> extra (blockfile | new-id | -)
PURPOSES="$TMP/purposes.txt"
ERRORS="$TMP/errors.txt"
: > "$OPS"; : > "$PURPOSES"; : > "$ERRORS"

# ---------------------------------------------------------------- parse ----
for plan in "$PHASE_DIR"/PLAN-*.md; do
  [ -f "$plan" ] || continue
  bn=$(basename "$plan" | tr -c 'A-Za-z0-9' '_')
  awk -v tmp="$TMP" -v ops="$OPS" -v purposes="$PURPOSES" -v errors="$ERRORS" \
      -v plan="$plan" -v bn="$bn" '
    { sub(/\r$/, "") }
    /^<spec_deltas>$/   { inD=1; mode=""; blk=""; slug=""; next }
    /^<\/spec_deltas>$/ { inD=0; mode=""; blk=""; slug=""; next }
    !inD { next }
    /^capability:[ \t]/ {
      slug=$0; sub(/^capability:[ \t]+/,"",slug); sub(/[ \t]+$/,"",slug)
      mode=""; blk=""; next
    }
    /^purpose:[ \t]/ {
      if (slug == "") { print "MALFORMED: purpose before capability line in " plan >> errors; next }
      p=$0; sub(/^purpose:[ \t]+/,"",p)
      print slug "\t" p >> purposes; next
    }
    /^ADDED:/    { mode="ADDED";    blk=""; next }
    /^MODIFIED:/ { mode="MODIFIED"; blk=""; next }
    /^REMOVED:[ \t]/ {
      if (slug == "") { print "MALFORMED: op before capability line in " plan >> errors; next }
      id=$0; sub(/^REMOVED:[ \t]+/,"",id); gsub(/[ \t]/,"",id)
      print "REMOVED\t" slug "\t" id "\t-" >> ops
      mode=""; blk=""; next
    }
    /^RENAMED:[ \t]/ {
      if (slug == "") { print "MALFORMED: op before capability line in " plan >> errors; next }
      s=$0; sub(/^RENAMED:[ \t]+/,"",s)
      if (split(s, a, / -> /) == 2) {
        gsub(/[ \t]/,"",a[1]); gsub(/[ \t]/,"",a[2])
        print "RENAMED\t" slug "\t" a[1] "\t" a[2] >> ops
      } else {
        print "MALFORMED: RENAMED line invalid in " plan ": " $0 >> errors
      }
      mode=""; blk=""; next
    }
    mode != "" && /^### / {
      if ($0 !~ /^### Requirement: [a-z0-9-]+ — /) {
        print "MALFORMED: header not matching \047### Requirement: [a-z0-9-]+ — \047 in " plan ": " $0 >> errors
        blk=""; next
      }
      if (slug == "") { print "MALFORMED: op before capability line in " plan >> errors; blk=""; next }
      id=$0; sub(/^### Requirement: /,"",id); sub(/ — .*/,"",id)
      if (blk != "") close(blk)
      nblk++
      blk = tmp "/blk-" bn "-" nblk
      print $0 > blk
      print mode "\t" slug "\t" id "\t" blk >> ops
      next
    }
    mode != "" && blk != "" { print $0 >> blk; next }
    mode != "" && blk == "" && NF > 0 {
      print "MALFORMED: content before requirement header in " plan ": " $0 >> errors
      next
    }
  ' "$plan"
done

# ------------------------------------------------------------- validate ----
# Same requirement id touched by more than one op across the whole phase.
awk -F'\t' '
  { key=$2 "/" $3; cnt[key]++; ex[key]=$3
    if ($1 == "RENAMED") { k2=$2 "/" $4; cnt[k2]++; ex[k2]=$4 } }
  END { for (k in cnt) if (cnt[k] > 1)
          print "CONFLICT: " ex[k] " targeted by multiple ops" }
' "$OPS" >> "$ERRORS"

while IFS=$TAB read -r op slug id extra; do
  file="$SPECS_DIR/$slug/spec.md"
  case $op in
    ADDED)
      if [ -f "$file" ]; then
        if grep -q "^### Requirement: $id — " "$file"; then
          echo "CONFLICT: ADDED $id already exists in $file" >> "$ERRORS"
        fi
      else
        if ! grep -q "^$slug$TAB" "$PURPOSES"; then
          echo "MALFORMED: capability $slug has no spec file and no purpose line" >> "$ERRORS"
        fi
      fi
      if ! grep -q '^- GIVEN ' "$extra"; then
        echo "MALFORMED: requirement block missing GIVEN ($slug/$id)" >> "$ERRORS"
      fi
      ;;
    MODIFIED)
      if [ ! -f "$file" ] || ! grep -q "^### Requirement: $id — " "$file"; then
        echo "MALFORMED: MODIFIED $id not found in $file" >> "$ERRORS"
      fi
      if ! grep -q '^- GIVEN ' "$extra"; then
        echo "MALFORMED: requirement block missing GIVEN ($slug/$id)" >> "$ERRORS"
      fi
      ;;
    REMOVED)
      if [ ! -f "$file" ] || ! grep -q "^### Requirement: $id — " "$file"; then
        echo "MALFORMED: REMOVED $id not found in $file" >> "$ERRORS"
      fi
      ;;
    RENAMED)
      if [ ! -f "$file" ] || ! grep -q "^### Requirement: $id — " "$file"; then
        echo "MALFORMED: RENAMED $id not found in $file" >> "$ERRORS"
      fi
      if [ -f "$file" ] && grep -q "^### Requirement: $extra — " "$file"; then
        echo "MALFORMED: RENAMED $extra already exists in $file" >> "$ERRORS"
      fi
      ;;
  esac
done < "$OPS"

if [ -s "$ERRORS" ]; then
  cat "$ERRORS"
  exit 1
fi

# ---------------------------------------------------------------- apply ----
# trim_trailing_blanks: awk program reused for post-apply normalization
TRIM='{l[NR]=$0} END{n=NR; while (n>0 && l[n] ~ /^[ \t]*$/) n--; for (i=1;i<=n;i++) print l[i]}'

while IFS=$TAB read -r op slug id extra; do
  dir="$SPECS_DIR/$slug"
  file="$dir/spec.md"
  case $op in
    ADDED)
      if [ ! -f "$file" ]; then
        mkdir -p "$dir"
        purpose=$(awk -F'\t' -v s="$slug" '$1==s { sub(/^[^\t]*\t/,""); print; exit }' "$PURPOSES")
        printf '# %s — spec\n\nPurpose: %s\n' "$slug" "$purpose" > "$file"
      fi
      printf '\n' >> "$file"
      awk "$TRIM" "$extra" >> "$file"
      ;;
    MODIFIED)
      awk -v id="$id" -v blk="$extra" '
        BEGIN { while ((getline l < blk) > 0) b[++m]=l
                while (m > 0 && b[m] ~ /^[ \t]*$/) m-- }
        skip && /^### / { print ""; skip=0 }
        skip { next }
        $0 ~ ("^### Requirement: " id " — ") {
          for (i=1; i<=m; i++) print b[i]; skip=1; next }
        { print }
      ' "$file" | awk "$TRIM" > "$file.tmp" && mv "$file.tmp" "$file"
      ;;
    REMOVED)
      awk -v id="$id" '
        skip && /^### / { skip=0 }
        skip { next }
        $0 ~ ("^### Requirement: " id " — ") { skip=1; next }
        { print }
      ' "$file" | awk "$TRIM" > "$file.tmp" && mv "$file.tmp" "$file"
      ;;
    RENAMED)
      awk -v old="$id" -v new="$extra" '
        $0 ~ ("^### Requirement: " old " — ") {
          sub("^### Requirement: " old " — ", "### Requirement: " new " — ") }
        { print }
      ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
      ;;
  esac
  echo "APPLIED: $op $slug/$id"
done < "$OPS"

exit 0
