#!/bin/sh
# Table test for hooks/phase-slug.js (resolvePhase) — prints `PASS|FAIL name`,
# exits 1 on any FAIL, ends with `N PASS, M FAIL`.
# Rule under test: a number at the very start of the Phase value, or else the
# first slug-shaped token if it is an existing directory; never a number from
# the middle of the line.
# Every fixture is a throwaway `mktemp -d` holding a .potion/ directory.

root="$(cd "$(dirname "$0")/.." && pwd)"
PASSES=0
FAILS=0
TMPS=""

resolve() {
  node -e 'const r=require(process.argv[1]).resolvePhase(require("fs").readFileSync(process.argv[2],"utf8"),process.argv[3]);console.log(r?r.slug:"null")' "$root/hooks/phase-slug.js" "$1/.potion/STATE.md" "$1/.potion"
}

# row <name> <expected> <mode> <phase line text> [dir...]
#   mode lf      — `- Phase: <text>` with LF line endings
#   mode crlf    — the same, CRLF line endings
#   mode indent  — `  - Phase: <text>` (indented; not a Phase line)
#   mode nodirs  — LF, and no phases/ directory at all
row() {
  name=$1; want=$2; mode=$3; text=$4
  shift 4
  d=$(mktemp -d)
  TMPS="$TMPS $d"
  mkdir -p "$d/.potion"
  if [ "$mode" != nodirs ]; then
    mkdir -p "$d/.potion/phases"
    for p in "$@"; do mkdir -p "$d/.potion/phases/$p"; done
  fi
  case "$mode" in
    crlf)   printf '# State\r\n\r\n## Position\r\n- Phase: %s\r\n- Status: executing\r\n' "$text" > "$d/.potion/STATE.md" ;;
    indent) printf '# State\n\n## Position\n  - Phase: %s\n- Status: executing\n' "$text" > "$d/.potion/STATE.md" ;;
    *)      printf '# State\n\n## Position\n- Phase: %s\n- Status: executing\n' "$text" > "$d/.potion/STATE.md" ;;
  esac
  got=$(resolve "$d")
  if [ "$got" = "$want" ]; then
    echo "PASS $name"; PASSES=$((PASSES + 1))
  else
    echo "FAIL $name (want $want, got $got)"; FAILS=$((FAILS + 1))
  fi
}

TABBED=$(printf '23 (x)	—	plan 4')

row prescribed                 23-field-fixes lf     '23 of 25 — 23-field-fixes' 23-field-fixes
row number-paren               02-alpha       lf     '2 (alpha)' 02-alpha
row literal-slug               02-alpha       lf     '02-alpha' 02-alpha
row trailing-iso-date          23-field-fixes lf     '23 (field-fixes) — discussed 2026-11-20' 23-field-fixes 20-x 11-y
row leading-iso-date           null           lf     '2026-11-20 — 23 (field-fixes)' 23-field-fixes
row iso-date-space-number      null           lf     '2026-11-20 23 (x)' 23-x
row clock-time-space-number    null           lf     '10:30 23 (x)' 23-x
row date-count-then-number     null           lf     '2026-11-20 4 plans left — 23 (x)' 04-z 23-x
row n-of-m                     03-a           lf     '3 of 23' 03-a 23-b
row n-of-m-missing-n           null           lf     '5 of 23' 23-b
row n-slash-m-missing-n        null           lf     '5/23' 23-b
row decimal                    01.5-x         lf     '1.5 (hotfix)' 01-a 01.5-x 05-five
row integer-beside-decimal     01-a           lf     '1 (a)' 01-a 01.5-x
row ambiguous                  null           lf     '23 (a)' 23-a 23-b
row ambiguous-then-plan        null           lf     '23 (a) — plan 4 next' 23-a 23-b 04-z
row ghost-slug-then-number     null           lf     '99-ghost — then 23' 23-b
row missing-then-after         null           lf     '24 (next) — after 23 shipped' 23-b
row ghost-then-slash-date      null           lf     '9 (ghost) — discussed 20/11/2026' 20-other
row ghost-then-clock-time      null           lf     '9 (ghost) — discussed 2026-11-20 10:30' 10-ten
row date-only                  null           lf     'wrapping up 2026-11-20' 20-x
row digit-in-word-two-dirs     null           lf     'v2 rework — 23 (x)' 02-old 23-x
row digit-in-word-one-dir      null           lf     'v2 rework — 23 (x)' 23-x
row earlier-number-in-prose    null           lf     'cycle 4 — 23 (field-fixes)' 04-z 23-field-fixes
row later-slug-current-missing null           lf     '24 of 25 — 24-next (23-field-fixes shipped)' 23-field-fixes
row lead-beats-other-slug      02-alpha       lf     '2 (alpha) — after 01-setup' 01-setup 02-alpha
row parenthesised-prefix-slug  23-field-fixes lf     '(wip) 23-field-fixes' 23-field-fixes 02-b
row exponent-garbage           null           lf     '1e3 (x)' 01-a 03-b 1000-k
row huge-number                null           lf     '10000000000000000001 (x)' 10000000000000000000-x
row three-part-version         null           lf     '1.5.2 — 23 (x)' 01.5-x 23-x
row number-word                null           lf     'three (3)' 03-x
row all-complete               null           lf     'none — all 25 phases complete' 25-last
row tabs                       23-x           lf     "$TABBED" 23-x 04-z
row crlf                       23-field-fixes crlf   '23 (field-fixes) — discussed 2026-11-20' 23-field-fixes
row indented                   null           indent '23 (x)' 23-x
row no-phases-dir              null           nodirs '23 (x)'
row empty                      null           lf     '' 23-x

for t in $TMPS; do rm -rf "$t"; done

echo "$PASSES PASS, $FAILS FAIL"
[ "$FAILS" -eq 0 ] || exit 1
exit 0
