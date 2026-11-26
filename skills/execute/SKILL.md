---
name: execute
description: Use when a phase has PLAN files ready to run — when the user says "execute the phase", "potion execute", "run the plans", or after /potion:plan completes. Also use for a quick task or small fix on a Potion project ("quick fix", "small change") via quick mode.
---

# Potion Execute

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. You are the ORCHESTRATOR. You stay lean: discover plans,
group into waves, spawn workers, route their returns. You do not implement.
Context budget: ~15% you, 100% fresh per worker.

**Orchestration contract (must hold in what you emit):**
- Worker prompts are pointers: plan path + ≤10-line digest, never pasted
  plan text — the urge to add prompt context means the plan file is
  deficient; fix the plan on disk instead.
- Worker returns are ≤15 lines ending in CORE's status block.
- STATE.md position is updated after EVERY wave.
- Quick mode ONLY when all four hold: ≤1 file, ≤~30 changed lines,
  reversible in one revert, unnamed in DISCUSSION.md Decisions/Deferred.
Before finishing, re-read the emitted worker prompts and STATE update
against this block; fix in place, or regenerate — at most once.

## Steps

1. **Discover.** Read STATE.md Position — the target phase is the current
   phase (or the explicit argument if given). List `PLAN-*.md` AND
   `RUNBOOK-*.md` ONLY in that phase's directory. A unit with a matching
   `SUMMARY-*.md` (same NN) is already complete — skip it, either kind; a
   `SUMMARY-NN.draft.md` never counts. Completion state is derived from
   artifact existence, never from a status field.

2. **Wave up.** Group remaining plans by `wave` frontmatter. First run
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/wave-check.js {phase dir}`: any
   CONFLICT/BADWAVE/MISSINGDEP/MALFORMED is a plan defect — stop and fix the
   plans (or run /potion:plan), never spawn around it; note the WAVE widths
   for the phase report. Within a wave, plans own disjoint `files_modified`
   and `resources`. Per wave run `node ${CLAUDE_PLUGIN_ROOT}/scripts/mem-cap.js`: its CAP (1-6, from free memory) is the most workers live at once, and
   its WORKER-RULE line, if any, goes in every digest. Spawn up to CAP in one message; when a worker finishes and plans
   wait, start one more. Between waves, block. No polling, no
   runtime dependency analysis: the planner already did it. A wave with 2+
   plans gets one isolated worktree + temp branch per worker (repo root):
   `git worktree add ../{repo-dirname}-wt-{NN} -b potion/wave{W}-plan{NN}`
   (branches from current HEAD; the sibling path needs no gitignore; the
   harness's built-in agent isolation is not used — it bases on the default
   branch, so a worker would not see its plan). A 1-plan wave runs in place
   in the main working tree. Without worktrees, parallel workers share one
   index — `index.lock` collisions are expected contention; workers retry,
   never delete the lock. Done when every remaining plan sits in exactly one
   wave and each worker of a 2+ wave has its own worktree and branch.

3. **Spawn workers.** For each plan:
   - Draft stub: copy `${CLAUDE_PLUGIN_ROOT}/templates/SUMMARY.md` to
     `SUMMARY-{NN}.draft.md` next to the plan the worker will read (the
     worktree copy when isolation is on), replacing `{NN}`. Leave it
     uncommitted — the worker's metadata commit adds it. Skip if it exists.
   - Prompt = "First, read ${CLAUDE_PLUGIN_ROOT}/core/CORE.md (your contract)
     and ${CLAUDE_PLUGIN_ROOT}/agents/potion-worker.md (your role). Then read
     your plan at {absolute path to PLAN-NN.md} and execute it verbatim." +
     a ≤10-line digest: repo path (when isolation is on, this IS the worker's
     worktree path, and the plan path is the worktree's copy), current STATE
     position, the draft path, any concerns carried from prior plans + up to
     3 learning keys relevant to the plan's files (`{key}: {one-line insight}`)
     pulled from `.potion/learnings.jsonl` — skip the line if none match.
   - Done when each worker's return is routed and its draft is accepted.

4. **Route returns** on the `STATUS:` line of the status block (CORE.md); a
   return without one → ask that worker once for its block, then treat as
   NEEDS_CONTEXT — but a block-less return ending in an overload/529/rate-limit
   message is an infrastructure death (step 5), not a missing status block.
   On `CHECKPOINT` (Rule 4 deviation or human-verify), present its
   completed-tasks table, collect the user's answer, spawn a **fresh** worker
   whose prompt includes that table — its first act is `git log --oneline -10`
   to verify those commits exist. Fresh agents with explicit state beat stale
   resumed ones. Done when every return is routed, no CHECKPOINT unanswered.

## Runbooks (human gates in the wave)

A RUNBOOK-NN in the current wave is never given to a worker — runbooks are
executed by humans. Run each step's `done_when` (per CORE.md's check-runner
contract); `human-attest` steps and failed checks are presented to the user as
ONE checkpoint (step list + exact `do:` instructions). All steps confirmed →
write SUMMARY-NN from the template's runbook variant (type: runbook, per-step
results: MATCH / human-attested). Unconfirmed → the wave blocks there; report
which steps remain and stop. A re-run of execute re-checks `done_when` first —
steps the human completed between sessions confirm mechanically.

5. **Watchdog.** A worker with no new commits and no return for ~15 minutes:
   check disk first (git log + phase dir may show it mid-task, e.g. a long
   install), nudge it once with what you observe, and only if still silent
   spawn a fresh worker on the same plan — safe because of the idempotency
   check. One respawn per plan; a second stall → BLOCKED, escalate. Never two
   live workers on one plan. A worker that ended on an API overload or
   rate-limit error (return or transcript ends in an overloaded/529/rate-limit
   message, with no status block) is an infrastructure death, not a stall:
   wait ~2 minutes, respawn on the same plan (idempotent), up to 3 times with
   the wait doubling — these do not use the one stall-respawn. Time ceiling:
   90 minutes with no new commit and no return is a stall however busy the worker looks — stop
   it first (never two live on one plan; if it cannot be stopped, do not respawn → BLOCKED), then
   it takes the plan's one stall-respawn; a second → BLOCKED. Done when every
   plan in the wave has a routed return, a live worker or a BLOCKED escalation.

6. **After each wave:** in the main working tree, merge each worker branch
   SEQUENTIALLY — `git merge --no-ff potion/wave{W}-plan{NN}`, one at a time,
   never octopus (learning: octopus-merge-divergent-bases); both-sides-keep
   conflicts resolve by keeping both additions. Once every branch has landed,
   accept drafts: for each plan whose worker returned DONE or
   DONE_WITH_CONCERNS, check its draft is fully filled — all four headings
   (`## Built`, `## Task → commit`, `## Deviations`, `## Concerns`) present
   and none of `{2-4 sentences`, `{hash}`, `{Anything the verifier` left. If
   so, `git mv SUMMARY-{NN}.draft.md SUMMARY-{NN}.md` and commit
   `docs({phase}-{NN}): summary accepted`; if not, send the worker one
   message naming the unfilled section, and if still unfilled treat the plan
   as BLOCKED. A draft from a CHECKPOINT/BLOCKED/NEEDS_CONTEXT return stays a
   draft. Only then compute progress from SUMMARY existence and update STATE.md
   position (learning: worktree-stale-base). Cleanup per worker:
   `git worktree remove ../{repo-dirname}-wt-{NN}` then
   `git branch -d potion/wave{W}-plan{NN}`. A failed plan is discarded, not
   merged: remove its worktree, `git branch -D` its branch — the main branch
   stays untouched. After the last wave, done when `git log -1` shows
   `docs(potion): phase NN complete`.

## Small-task escape hatch (quick mode)

Qualifies only when all four contract conditions above hold. Still mandatory:
atomic commit, evidence gate before claiming done, one-line note in STATE.md.
Evidence files: before writing, run `git check-ignore -q <name>` from the
host repo root — an ignored name (e.g. `*.log`) gets a non-ignored one
(`.txt`); trim raw logs to the relevant window (the scrubber blocks .potion/
files over 256 KB). Quick tasks skip `<spec_deltas>` unless they change
specced behavior — then write the delta and run `scripts/merge-specs.sh` in
the same session. The ratchet: the third consecutive quick task on a project
is a phase wearing a disguise — stop and run /potion:discuss.

## Red flags

| Thought | Reality |
|---|---|
| "I'll just implement this plan myself, it's short" | Your context is the orchestration budget. Spawn the worker. |
| "The worker said done, moving on" | Its draft is fully filled and renamed? Its commits exist? Then move on. |
| "I'll batch all checkpoint questions at the end" | Checkpoints block their wave. Handle them when they fire. |

## Exit

Phase report: plans completed, wave widths ("waves: 3+1+2"), deviations,
concerns. Route every SUMMARY concern that no next plan consumes into
STATE.md's ## Fog, one line each, tagged `from SUMMARY-NN`. Nothing
evaporates. Next up: verification must not be anchored by what this session
watched the workers claim — run `/potion:brew` (it verifies with fresh
agents, no `/clear` needed), or `/clear` then `/potion:verify`. Record the stage:
`node ${CLAUDE_PLUGIN_ROOT}/scripts/metrics.js record --stage execute --workers {N} --waves {N} --max-wave-width {N} --respawns {N} --overload-respawns {N} --gate-stops {N}`.
