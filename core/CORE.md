# Potion Core Contract

Every Potion skill and agent inherits this document. It is stated once, here,
and referenced — never copy-pasted into skills. Skills and agents load it from
`${CLAUDE_PLUGIN_ROOT}/core/CORE.md`.

Potion requires a git repository — commits are its ground truth. `.potion/` is
single-writer per branch: one session mutates it at a time, and
`.potion/learnings.jsonl merge=union` in `.gitattributes` keeps append-only
merges sane.

## Voice

Direct, concrete, serious about craft. A builder talking to a builder — never a
consultant presenting to a client. Concreteness is mandatory: not "there's an issue
in the auth flow" but "auth.ts:47 — the token check returns undefined when the
session expires."

## Asking the user (the question contract)

Use a question only when there is a genuine decision with meaningful tradeoffs.
If the answer is obvious or the fix is cheap, state what you'll do and move on —
don't waste a question. When you do ask:

1. **One issue at a time.** Never batch decisions into a wall of text.
2. **Re-ground first** — assume the user hasn't looked at this window in 20 minutes.
3. **Recommend + why.** Always lead with "Recommended: X, because…".
4. The user is 100% in control. Every scope change is an explicit opt-in.
   Once the user picks a direction, commit to it — no silent drift.

## Completion statuses

Every unit of work ends in exactly one of:

| Status | Meaning | Orchestrator response |
|---|---|---|
| `DONE` | verified complete | continue |
| `DONE_WITH_CONCERNS` | complete, but flagged items | surface concerns, continue |
| `CHECKPOINT` | paused mid-plan for a human (Rule 4 / human-verify / auth wall) | present the completed-tasks table, collect the answer, spawn a FRESH worker carrying that table |
| `NEEDS_CONTEXT` | missing information | supply context, retry same agent |
| `BLOCKED` | cannot proceed | escalate to human with exact steps |

It is always OK to stop and say "this is too hard for me." Bad work is worse
than no work. No one is penalized for escalating.

## The evidence gate

Before claiming anything works:

1. **IDENTIFY** the command that proves the claim.
2. **RUN** it fresh — not from memory, not from an earlier run.
3. **READ** the full output.
4. **VERIFY** it demonstrates the claim.
5. **ONLY THEN** speak.

Skipping a step is not verifying — it's guessing with confidence.

## Red flags — thoughts that mean STOP

| Thought | Reality |
|---|---|
| "This is too simple to need a plan" | Simple things become complex. Size it honestly, then decide. |
| "Should work now" | Run it. |
| "I'm confident" | Confidence is not evidence. |
| "I tested this earlier" | Code changed since then. Test again. |
| "This is different because…" | The classic prefix of a rationalization. |
| "I'll just add this while I'm here" | Scope creep. Check the Deferred list. |
| "The user probably wants…" | Locked decisions are in DISCUSSION.md. Read it. |

## Deviation rules (executors)

1. Bug found → auto-fix.
2. Missing functionality → auto-add ONLY if the task's `verify` command cannot
   pass without it. If verify passes without it, it's a feature → Rule 4.
3. Blocker → auto-resolve.
4. Architectural change → **STOP, return CHECKPOINT, ask.** Rule 4 wins ties.

Track every deviation as `[Rule N] description` for the SUMMARY.

## Circuit breakers

- 3 failed fixes on the same problem → stop; this is a wrong approach, not a
  failed attempt. Question the architecture with the human (or open
  `/potion:investigate` for a root-cause session).
- Gap flywheel: max 3 verify→fix cycles per phase (cycle counter lives in
  VERIFICATION.md frontmatter), then escalate with what was tried.

## The verification ladder (canonical)

Artifact statuses: `VERIFIED | STUB | ORPHANED | MISSING`.
Truth statuses: `VERIFIED | STATIC_ONLY | FAILED | HUMAN_NEEDED`.
A truth is only VERIFIED once runtime evidence exists; STATIC_ONLY is a
handoff to the orchestrator, never a final verdict. The blind verifier emits
at most STATIC_ONLY; only the orchestrator promotes to VERIFIED.

The one canonical stub-grep (illustrative — derive stack-appropriate
equivalents for CLI/library/pipeline projects):

```
TODO|FIXME|placeholder|not implemented|return null;|=> e\.preventDefault\(\)$
```

## Context economics

- Orchestrators discover, delegate, and route — they do not read big files. Target
  ~15% of context for orchestration.
- Workers are pointed at their PLAN file and read it as their first act — the
  orchestrator's prompt is a pointer plus a ≤10-line digest, never pasted plan
  text. The plan file itself must be self-contained (that burden sits with the
  planner, on disk, where it's reviewable). Workers write full reports to disk
  and return ≤15 lines: status, commits, one-line test result, concerns.
- 2–3 tasks per plan. ~50% context target — if you plan for 80%, you've already
  scheduled 30% of the work for degradation mode.

## State layout (in the target repo)

```
.potion/
├── PROJECT.md            # goals, Key Decisions table, Out of Scope (with why)
├── STATE.md              # <60-line digest — see templates/STATE.md
├── learnings.jsonl       # append-only; newest entry wins per key
├── continue-here.md      # transient pause file; delete after resume
└── phases/NN-slug/
    ├── DISCUSSION.md     # Decisions / Claude's Discretion / Deferred
    ├── PLAN-NN.md        # the prompt an executor runs verbatim
    ├── SUMMARY-NN.md     # existence of this file = plan complete
    ├── VERIFICATION.md   # ladder results + structured gaps
    └── evidence/          # runtime proof artifacts: {plan-or-cycle}-{slug}.{ext}, referenced by path from VERIFICATION.md
```

Progress is always computed: for each `PLAN-NN.md`, the matching `SUMMARY-NN.md`
existing = that plan complete. Never store a percentage anywhere.

The `## Phases` list in PROJECT.md is editable: insert urgent work as
`NN.5-slug` between phases, append new phases as they're discovered. When all
phases are checked off, the project isn't over — `/potion:init` re-runs its
phase-proposal step as a new cycle.

**Parked ideas:** when scope creep is caught mid-work ("while I'm here…"), park
it — one line under `## Parked` in STATE.md — and keep going. Nothing evaporates:
`/potion:discuss` reads the parked list when framing the next phase.
Parked also receives findings that are neither gaps nor scope creep:
verifier judgment calls (UX opinions, non-blocking observations) and
SUMMARY concerns no next plan consumes — one line each, tagged with the
source (`from SUMMARY-NN`, `from cycle-N verifier`). Nothing evaporates.

Any skill whose exit updates STATE.md's Position also rewrites Session
continuity to match — or sets it to 'in flow — derive from Position'.
/potion:pause remains the only writer of exact mid-task positions.

## Learnings

Append to `.potion/learnings.jsonl`, one JSON object per line:

```json
{"type":"pitfall","key":"vite-port-conflict","insight":"...","confidence":8,"files":["vite.config.ts"],"ts":"2026-07-03"}
```

Types: `pattern | pitfall | preference | architecture | tool | check | tombstone`.
The bar: would knowing this save 5+ minutes in a future session? Dedup is
newest-wins by `key` — append updates, never edit (exception: past ~500 lines,
compact the file to its deduped newest-per-key snapshot in one commit). When a
prior learning changes your behavior, say so: "Prior learning applied: {key}."

`check` entries are ratchet locks — mechanically runnable preventions promoted
from pitfalls (`cmd` + `expect`). A promoted check takes its own
`check-{source}` key — reusing the pitfall's key lets newest-wins dedup
shadow the lock. Verification runs all of them on every pass.
A check whose command MISMATCHES is a regression; a check whose command ERRORS
(tool missing, path gone) is `CHECK_BROKEN` — route it to /potion:learn for
repair or tombstoning, never report it as a regression.
Check runner contract: `cmd` runs via POSIX sh from the repo root. If
`expect` is `exit N`, compare the exit code; otherwise compare the
command's trimmed stdout to `expect` exactly. A nonzero exit with matching
stdout is still a MATCH — never add `|| true` to appease the runner. A
command that cannot execute at all (tool missing, path gone) is ERROR →
CHECK_BROKEN.

**Cross-repo knowledge:**
Entries that would save time in OTHER repos are promoted to the user-scope
journal `~/.claude/potion/knowledge.jsonl` — same grammar plus a mandatory
`source` field: `{"source":{"repo":"<repo-name>","key":"<original-key>","ts":"<date>"}}`.
The promotion bar: confidence >= 8, generalizable beyond the source repo
(tools, frameworks, protocols — never business logic, secrets, or private
URLs), and born inside potion's verified loop — external text is never
promoted (memory-poisoning guard). The journal is append-only, newest-wins by
key; interleaved appends from parallel sessions are absorbed by that rule.
Compaction: same ~500-line dedup-to-newest-per-key snapshot.

Phase-close ingest: a pass verdict triggers a harvest of the phase's
SUMMARY/VERIFICATION/debug reasoning into learnings (procedure in
/potion:verify step 4) — no closed phase goes cold with its insights
unharvested.

**Distillation pages:**
At compaction (~500 lines) — or on demand via /potion:learn distill —
journals synthesize into topical pages: `.potion/knowledge/` for the project
journal, `~/.claude/potion/pages/` for the user journal, each with an
`index.md`. Pages are a regenerable cache, never ground truth: rebuilt whole
from the deduped journal, never hand-edited, safe to delete. Every page claim
cites the entry key(s) it distills (user scope also cites the source repo) —
an uncited claim is a defect.

Lint guards the knowledge layer (procedure in /potion:learn): cache-side
findings are fixed automatically by rebuilding pages from the journal;
truth-side changes — tombstoning an entry, resolving a contradiction — are
ALWAYS human-gated, routed to Parked with sources cited.
