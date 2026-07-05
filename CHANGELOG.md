# Changelog

## 1.4.0 — 2026-07-05

The self-audit release: the knowledge layer now lints itself — cache fixes are
automatic, truth changes are human-gated. This completes the Karpathy-pattern
set: journal (append-only truth) → pages (distilled cache) → lint (the
auditor that keeps them honest).

### Lint — four hunts over the knowledge tree
- New "Lint" section in the learn skill, run over project scope then user
  scope (commit fe6c069): (1) contradictions — semantic judgment of entry
  insights and page syntheses, Claude is the linter; (2) stale claims —
  `files` backpointers gone from disk, page claims superseded by newer
  same-key entries; (3) orphans — page `### {key}` blocks with no live
  journal line; (4) coverage gaps — confidence >= 8 live entries no page
  distills
- Trigger: runs automatically after every Distill, or on demand via
  `/potion:learn lint`
- The safety line — cache-auto, truth-human: cache-side findings (orphans,
  stale page claims, coverage gaps) are fixed by rebuilding the affected
  page whole from the journal; truth-side findings (contradictions, any
  urge to tombstone or reword a journal entry) are NEVER self-resolved
- Parked routing: truth-side findings go to STATE.md `## Parked`, one line,
  both sources cited — the next /potion:discuss tables them
- CORE contract: lint safety line under Learnings, core/CORE.md
  (commit a8f7973)

### Evidence
- Live proof on the real knowledge tree, both scopes: clean baseline lint;
  a transparently seeded cache-side orphan detected by hunt 3 and
  auto-rebuilt away (rebuilt page byte-identical to HEAD); truth journals
  sha1-identical across the entire run — the linter has teeth and a muzzle:
  `.potion/phases/08-lint/evidence/02-lint-transcript.txt` (commit d7b24cb)

## 1.3.0 — 2026-07-05

The distillation release: journals stay ground truth, pages make them readable.

### Distillation pages
- New pages layer in two scopes: project journal distills to
  `.potion/knowledge/` (committed with the repo), user journal to
  `~/.claude/potion/pages/` (outside git) — each with an `index.md` listing
  every page with its one-line scope and entry count
- Pages are a regenerable cache, never ground truth: rebuilt whole from the
  deduped journal, never hand-edited, safe to delete; when a page and the
  journal disagree, the journal wins and the page is due a rebuild
- Source-backed claims: every `### {key}` block cites the journal entry key
  it distills (user scope also cites the source repo) — an uncited claim is
  a defect
- CORE contract: "Distillation pages" subsection under Learnings,
  core/CORE.md (commit 55b4fa7)
- Procedure: new "Distill" section in the learn skill — dedup newest-wins,
  drop tombstones, cluster 2-6 entries per page, regenerate pages whole,
  rewrite index (commit a641ecb)
- Planners prefer synthesis: planning reads pages before raw journal
  fragments when both exist (commit f509289)
- Trigger honesty: automatic distillation fires at compaction (~500 lines),
  which no journal has reached — the trigger is dormant until then. On-demand
  runs via `/potion:learn distill` work today and produced the evidence below.

### Evidence
- First real distillation, both scopes: 9 project entries → 3 pages + index
  in `.potion/knowledge/`; 3 user entries → 1 page + index in
  `~/.claude/potion/pages/`; every citation spot-checked to exactly one
  journal line:
  `.potion/phases/07-distill/evidence/02-distill-transcript.txt`
  (commit 371fc19)

## 1.2.0 — 2026-07-05

The harvest release: no closed phase goes cold with its insights unharvested.

### Phase-close harvest
- `/potion:verify` step 4 gains "Harvest before verdict" (pass verdicts only):
  sweep the phase's SUMMARY Deviations/Concerns, the verifier's
  ladder/panel reasoning in VERIFICATION.md, and any `.potion/debug/` files
  closed during the phase; distill what clears the 5-minute bar into
  `.potion/learnings.jsonl` — max 5 entries, `files` backpointers to the
  source artifact (commit f5e260b)
- Duplicate guard: grep existing keys first, harvest only what fell through
  during the phase, never re-log; zero new entries is a valid outcome, stated
  explicitly
- CORE principle: "Phase-close ingest: a pass verdict triggers a harvest of
  the phase's SUMMARY/VERIFICATION/debug reasoning into learnings" —
  Learnings section, core/CORE.md (commit e3b1438)
- Composes with 1.1.0's promote-up bar: harvested entries ride the normal
  CORE Cross-repo knowledge bar (confidence >= 8, generalizable, loop-born)
  into `~/.claude/potion/knowledge.jsonl`

### Evidence
- The procedure run for real against the cold storage that motivated it —
  01-harden's 42-finding audit reasoning: 9 artifacts swept, duplicates
  skipped, 3 distilled entries appended, 2 promoted up:
  `.potion/phases/06-ingest/evidence/02-retro-ingest-transcript.txt`
  (commit 713dc61)

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
