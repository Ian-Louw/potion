---
name: execute
description: Use when a phase has PLAN files ready to run — when the user says "execute the phase", "potion execute", "run the plans", or after /potion:plan completes. Also use for a quick task or small fix on a Potion project ("quick fix", "small change") via quick mode.
---

# Potion Execute

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. You are the ORCHESTRATOR. You stay lean: discover plans,
group into waves, spawn workers, route their returns. You do not implement.
Context budget: ~15% you, 100% fresh per worker.

## Steps

1. **Discover.** Read STATE.md Position — the target phase is the current
   phase (or the explicit argument if given). List `PLAN-*.md` ONLY in that
   phase's directory. A plan with a matching `SUMMARY-*.md` (same NN) is
   already complete — skip it. Completion state is derived from artifact
   existence, never from a status field.

2. **Wave up.** Group remaining plans by `wave` frontmatter. Within a wave, plans
   own disjoint `files_modified` — spawn them as parallel agents in one message.
   Between waves, block. No polling, no runtime dependency analysis: the planner
   already did it. Parallel workers share one git index: commits will
   occasionally collide on `index.lock` — that's expected contention, workers
   retry (never delete the lock). If a wave has 4+ plans, prefer isolated
   worktrees per worker and merge after the wave.

3. **Spawn workers.** For each plan:
   - Prompt = "First, read ${CLAUDE_PLUGIN_ROOT}/core/CORE.md (your contract)
     and ${CLAUDE_PLUGIN_ROOT}/agents/potion-worker.md (your role). Then read
     your plan at {absolute path to PLAN-NN.md} and execute it verbatim." +
     a ≤10-line digest: repo path, current STATE position, and any concerns
     carried from prior plans + up to 3 learning keys relevant to the plan's
     files (`{key}: {one-line insight}`) pulled from `.potion/learnings.jsonl`
     — pointers, not pastes; skip the line if none match. Workers share the
     filesystem — point, don't paste. The plan file itself must already be self-contained; if you feel
     the urge to add context to the prompt, the plan is deficient — fix the
     plan file instead, so the record on disk matches what ran.
   - Workers write SUMMARY to disk and return ≤15 lines: status, commits,
     one-line verification result, deviations, concerns.

4. **Route returns** by status (see CORE.md table). On `CHECKPOINT` returns
   (Rule 4 deviation or human-verify), present the worker's completed-tasks table,
   collect the user's answer, then spawn a **fresh** worker whose prompt includes
   that table — its first act is `git log --oneline -10` to verify those commits
   exist. Fresh agents with explicit state beat resumed agents with stale context.

5. **Watchdog.** A worker with no new commits and no return for ~15 minutes:
   check disk first (git log + phase dir may show it mid-task, e.g. a long
   install), nudge it once with what you observe, and only if still silent
   spawn a fresh worker on the same plan — safe because of the idempotency
   check. One respawn per plan; a second stall → BLOCKED, escalate. Never two
   live workers on one plan.

5. **After each wave:** update STATE.md position. After the last wave:
   `docs(potion): phase NN complete` commit.

## Small-task escape hatch (quick mode)

A task qualifies for inline execution ONLY if all four hold: ≤1 file, ≤~30
changed lines, reversible in one revert, and not named in any DISCUSSION.md
Decisions or Deferred bucket. Still mandatory: atomic commit, evidence gate
before claiming done, one-line note in STATE.md. The ratchet: the third
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
concern that no next plan consumes into STATE.md's ## Parked, one line each,
tagged `from SUMMARY-NN`. Nothing evaporates. Next up: `/potion:verify`
— suggest `/clear` first: verification must not be anchored by what this
session watched the workers claim.
