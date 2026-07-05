# Changelog

## 1.1.0 — 2026-07-05

The compounding release: what one repo learns, every repo knows.

### Cross-repo knowledge journal
- New user-scope journal `~/.claude/potion/knowledge.jsonl` — same grammar as
  `.potion/learnings.jsonl` plus a mandatory provenance field:
  `{"source":{"repo":"<repo-name>","key":"<original-key>","ts":"<date>"}}`
- Promotion bar (CORE): confidence >= 8, generalizable beyond the source repo
  (tools, frameworks, protocols — never business logic, secrets, or private
  URLs), and born inside potion's verified loop
- Memory-poisoning guard: external text is never promoted — only loop-born
  entries cross the repo boundary
- Append-only, newest-wins by key; interleaved appends from parallel sessions
  absorbed by that rule; same ~500-line compaction as the repo journal
- `/potion:learn` promotes up when the bar clears ("Promoted: {key}"), creates
  the directory on first use; when in doubt, don't

### Delivery
- Planners grep `~/.claude/potion/knowledge.jsonl` in plan step 2 and cite
  matches as `Prior cross-repo learning: {key} (from {repo})`
- session-start hook surfaces the newest journal entries under a
  "Cross-repo knowledge" header with `(from {repo})` provenance

### Evidence
- Real end-to-end run — genuine promotion, live hook delivery, plan-side
  grep + attribution: `.potion/phases/05-compound/evidence/03-e2e-transcript.txt`

## 1.0.0 — 2026-07-05

The campaign release: potion brewed itself. `.potion/` in this repo is the
live record — design, three phases, two first-cycle pass verdicts so far
(01-harden and 02-empower, both cycle 1, zero gaps). The audits and fixes
below were executed by potion's own loop: workers, blind verifiers, refuter
panels.

### 01-harden — six-lens audit
- 119 agents over 27 files (10 finders per lens, 3-refuter adversarial
  panels, refute-by-default), full coverage, no finders lost
- 60 raw findings → 42 unique; 25 confirmed by the panels; 11 refuted
- 20 behavioral defects fixed across 6 plans / 14 commits; 5 style findings
  accepted with reasons on record. Highlights:
  - Verifier never emits VERIFIED — the orchestrator is the single promotion
    point
  - Ratchet checks take their own `check-{source}` key, so newest-wins dedup
    can no longer shadow a lock
  - init gained a real new-cycle procedure (and PROJECT.md its `## Phases`
    section)
  - Lossless pause↔resume: closed-vocab status captured and restored
  - Gap acceptance is user-only
  - One law canon
  - Install modes that work (skills-dir mode removed)

### 02-empower — six mechanisms, every one citing dogfood evidence (Law 10)
- `evidence/` convention — canonical home for runtime proof artifacts,
  referenced by path from VERIFICATION.md
- Check-runner contract — POSIX sh from repo root, trimmed-stdout vs `exit N`
  semantics; kills the `|| true` hack
- Build-freshness precondition — verify confirms the running app corresponds
  to HEAD before judging behavior
- Learnings delivery — planners grep learnings.jsonl into TECHNICAL NOTES;
  worker digests carry matching entry keys
- Concern→Parked routing — non-gap findings land in STATE.md's Parked list;
  nothing evaporates
- Continuity freshness — any skill that moves position refreshes the
  Session-continuity block

### 03-polish
- README truth-checked against HEAD and given a stranger-ready
  "Quickstart: your first brew"
- This release

## 0.3.0 — 2026-07-03

Loop release, informed by the dogfood-project dogfood (3 phases, emulator-verified
CamScanner clone) — the mechanisms that had to be improvised by hand are now
codified.

### New
- **`/potion:brew`** — the autonomous phase loop: plan → execute → verify →
  gap-cycle until pass or a human gate (CHECKPOINT, human_needed batch,
  cycle-3 escalation, Deferred/locked conflicts, user interrupt). Requires a
  human-locked DISCUSSION.md; re-derives position from disk between stages so
  it survives context compaction.
- **Watchdog** (execute + brew): stalled worker → check disk → nudge once →
  respawn fresh (idempotency makes it safe); one respawn per plan.
- **Hot-loop exception** (verify): expensive environments (emulator/device)
  may run the full gap cycle in one agent's environment session — artifacts
  on disk stay identical to the separated protocol.
- **Quick verification tier** (verify): boot-and-smoke after dependency
  changes on native apps — bundling can't see runtime-only failures.

### Changed
- **Two-tier plan context**: LOCKED product decisions vs TECHNICAL NOTES
  (planner's best API understanding). Typings win over technical notes;
  correcting them is Rule 1, not Rule 4 — workers no longer ship deprecated
  calls out of misplaced obedience (observed twice in dogfood-project).
- execute discovery now requires number-matched SUMMARY (mirrors the verifier).

## 0.2.0 — 2026-07-03

Hardening release after the first dogfood (Cauldron) and a three-lens deep audit
(red-team, skill-craft, gaps/installability).

### Install
- Added `.claude-plugin/marketplace.json` — `/plugin marketplace add` now works on the bare repo
- All cross-file references anchored to `${CLAUDE_PLUGIN_ROOT}` (they previously resolved into the user's project)
- Agents gained frontmatter and now register as spawnable agent types
- plugin.json: repository/homepage fields

### Protocol
- Verify rewritten as a four-step protocol with fixed ownership: deterministic checks (orchestrator) → blind static ladder (spawned potion-verifier) → runtime evidence (orchestrator) → verdict; closed truth vocabulary incl. STATIC_ONLY
- Ship gate: staleness check (`verified_at` vs newest code commit) and durable gap acceptance
- Gap flywheel: cycle counter lives in VERIFICATION.md frontmatter; gap plans continue the phase's numbering
- Workers: idempotency check before task 1 (crash-safe re-execution), index.lock retry rule for parallel waves
- Quick mode: observable predicates (≤1 file, ≤30 lines, one revert) + third-consecutive ratchet
- Deviation Rule 2 now keys off the task's verify command, not "critical"
- Cut the unwired runaway-score arithmetic; 3-strike breaker + flywheel budget remain

### New
- `/potion:investigate` — root-cause debugging with a durable `.potion/debug/` session file (Iron Law: no fix without a reproduced root cause)
- Parked-ideas convention (`## Parked` in STATE.md, read by discuss)
- Phase-list mutability: `NN.5` insertion, init re-runs as a new cycle when all phases complete
- Templates: SUMMARY.md, VERIFICATION.md
- Red-flag tables for plan and worker; CHECKPOINT added to the canonical status table
- session-start hook reads the learnings tail (newest entries) instead of the head

## 0.1.0 — 2026-07-03

Initial release: 9 skills, 2 agents, 1 hook. Distilled from GSD, Superpowers,
and gstack; closed-loop design (Law 11) with ratchet learnings.
