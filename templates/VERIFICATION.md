---
phase: "{NN-slug}"
verdict: "{pass | gaps | escalated}"
verified_at: "{ISO datetime — ship compares this against the newest code commit}"
cycle: 1                      # increments each verify pass; 3 is the budget
gaps:                         # empty list when verdict: pass
  - truth: "{the must-have truth}"
    status: "{STUB | ORPHANED | MISSING | FAILED | HUMAN_NEEDED}"
    reason: "{what the ladder found}"
    missing: "{what would close it}"
accepted: []                  # gaps the user explicitly accepted, with date
---

# Verification — {phase}

## Level 0 — deterministic

| Check | Result |
|---|---|
| {test suite / build / lint} | {pass/fail + one line} |
| check:{key} (ratchet) | {pass / REGRESSION / CHECK_BROKEN} |

## Ladder (static, blind)

| Artifact | Exists | Substantive | Wired | Status |
|---|---|---|---|---|
| {path} | ✓ | ✓ | ✓ | VERIFIED |

## Truths

<!-- Final status vocabulary: VERIFIED | STATIC_ONLY | FAILED | HUMAN_NEEDED -->
<!-- Runtime evidence entries are PATHS into phases/NN-slug/evidence/
     ({plan-or-cycle}-{slug}.{ext}) plus a ≤1-line note — not prose claims. -->

| Truth | Static | Runtime evidence | Final |
|---|---|---|---|
| {truth} | ✓ | {evidence/{plan-or-cycle}-{slug}.{ext} — ≤1-line note} | VERIFIED |

## Summary cross-check

{Each SUMMARY's task→commit table checked against git log — OK / mismatches listed}
