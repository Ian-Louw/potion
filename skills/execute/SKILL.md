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
- Worker returns are ≤15 lines: status, commits, one-line verification
  result, deviations, concerns.
- STATE.md position is updated after EVERY wave.
- Quick mode ONLY when all four hold: ≤1 file, ≤~30 changed lines,
  reversible in one revert, unnamed in DISCUSSION.md Decisions/Deferred.
Before finishing, re-read the emitted worker prompts and STATE update
against this block; fix in place, or regenerate — at most once.

## Steps

1. **Discover.** Read STATE.md Position — the target phase is the current
   phase (or the explicit argument if given). List `PLAN-*.md` AND
   `RUNBOOK-*.md` ONLY in that phase's directory. A unit with a matching
   `SUMMARY-*.md` (same NN) is already complete — skip it, either kind.
   Completion state is derived from artifact existence, never from a status
   field.

2. **Wave up.** Group remaining plans by `wave` frontmatter. Within a wave, plans
   own disjoint `files_modified` — spawn them as parallel agents in one message.
   Between waves, block. No polling, no runtime dependency analysis: the planner
   already did it. A wave with 2+ plans gets one isolated worktree + temp
   branch per worker — from the repo root, per worker:
   `git worktree add ../{repo-dirname}-wt-{NN} -b potion/wave{W}-plan{NN}`
   (branches from current HEAD; the sibling path keeps the repo clean, no
   gitignore needed). A 1-plan wave runs in place in the main working tree.
   Fallback if worktrees are unavailable: parallel workers share one index —
   `index.lock` collisions are expected contention; workers retry, never
   delete the lock. Done when every remaining plan sits in exactly one wave
   and each worker of a 2+ wave has its own worktree and branch.

3. **Spawn workers.** For each plan:
   - Prompt = "First, read ${CLAUDE_PLUGIN_ROOT}/core/CORE.md (your contract)
     and ${CLAUDE_PLUGIN_ROOT}/agents/potion-worker.md (your role). Then read
     your plan at {absolute path to PLAN-NN.md} and execute it verbatim." +
     a ≤10-line digest: repo path (when isolation is on, this IS the worker's
     worktree path, and the plan path is the worktree's copy), current STATE
     position, any concerns
     carried from prior plans + up to 3 learning keys relevant to the plan's
     files (`{key}: {one-line insight}`) pulled from `.potion/learnings.jsonl`
     — skip the line if none match. Pointer shape per the contract above.
   - Done when each worker's SUMMARY is on disk and its ≤15-line return is
     routed.

4. **Route returns** by status (see CORE.md table). On `CHECKPOINT` returns
   (Rule 4 deviation or human-verify), present the worker's completed-tasks table,
   collect the user's answer, then spawn a **fresh** worker whose prompt includes
   that table — its first act is `git log --oneline -10` to verify those commits
   exist. Fresh agents with explicit state beat resumed agents with stale
   context. Done when every worker return is routed per the CORE.md table and
   no CHECKPOINT is left unanswered.

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
   live workers on one plan. Done when the wave has zero unaccounted-for
   workers: every plan has a routed return, a live worker, or a BLOCKED
   escalation.

6. **After each wave:** in the main working tree, merge each worker branch
   SEQUENTIALLY — `git merge --no-ff potion/wave{W}-plan{NN}`, one at a time,
   never octopus (learning: octopus-merge-divergent-bases); both-sides-keep
   conflicts resolve by keeping both additions. Only after every branch has
   landed, compute progress from SUMMARY existence and update STATE.md
   position (learning: worktree-stale-base). Cleanup per worker:
   `git worktree remove ../{repo-dirname}-wt-{NN}` then
   `git branch -d potion/wave{W}-plan{NN}`. A failed plan is discarded, not
   merged: remove its worktree, `git branch -D` its branch — the main branch
   stays untouched. After the last wave, done when `git log -1` shows
   `docs(potion): phase NN complete`.

## Small-task escape hatch (quick mode)

Qualifying conditions: the four in the orchestration contract above — all
must hold. Still mandatory: atomic commit, evidence gate
before claiming done, one-line note in STATE.md.
Evidence files: before writing, run `git check-ignore -q <name>` from the
host repo root — an ignored name (e.g. `*.log`) gets a non-ignored one
(`.txt`); trim raw logs to the relevant window (the scrubber blocks
.potion/ files over 256 KB). Quick tasks skip
`<spec_deltas>` unless they change specced behavior — then write the delta and
run `scripts/merge-specs.sh` in the same session. The ratchet: the third
consecutive quick task on a project is a phase wearing a disguise — stop and
run /potion:discuss.

## Red flags

| Thought | Reality |
|---|---|
| "I'll just implement this plan myself, it's short" | Your context is the orchestration budget. Spawn the worker. |
| "The worker said done, moving on" | Its SUMMARY exists? Its commits exist? Then move on. |
| "I'll batch all checkpoint questions at the end" | Checkpoints block their wave. Handle them when they fire. |

## Exit

Phase report: plans completed, deviations, concerns. Route every SUMMARY
concern that no next plan consumes into STATE.md's ## Fog, one line each,
tagged `from SUMMARY-NN`. Nothing evaporates. Next up: `/potion:verify`
— suggest `/clear` first: verification must not be anchored by what this
session watched the workers claim.
