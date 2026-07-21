---
name: plan
description: Use when a phase needs an execution plan — when the user says "plan the phase", "potion plan", or after /potion:discuss completes. Also use with gaps mode when VERIFICATION.md lists unresolved gaps.
---

# Potion Plan

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Produces PLAN files that are executed **verbatim** by fresh
agents. A plan is a prompt, not a document.

**Plan-emission contract (must hold in every emitted PLAN/RUNBOOK):**
- The specificity test: could a different Claude instance execute this
  without asking a single question? Placeholders ("TBD", "appropriate
  error handling", "similar to task N") are plan failures.
- Frontmatter: `wave = max(deps)+1`; `files_modified` exclusive across
  same-wave plans; 2-3 tasks per plan.
- Numbering: PLAN-NN and RUNBOOK-NN share one pool — the next number is
  one past the highest existing of either; never reuse a number.
Before finishing, re-read each emitted plan against this block; fix in
place, or regenerate it — at most once.

## The Iron Law

```
PLAN GOAL-BACKWARD, NOT FORWARD
```

Never start from "what tasks make sense?" Start from the phase goal and derive:

1. **Truths** — 3-7 user-observable statements that must be TRUE when done.
2. **Artifacts** — what must EXIST for each truth (path + what it provides).
3. **Key links** — what must be WIRED (from → to → via). This is where 80% of
   stubs hide: the component that's never imported, the API that's never called.

## Steps

1. Read STATE.md, PROJECT.md, and the phase's DISCUSSION.md. Decisions are locked;
   Deferred is untouchable. Done only when `phases/NN-slug/DISCUSSION.md`
   exists — absent means run /potion:discuss first.

   **Gate preflight:** read DISCUSSION.md's `gates:` frontmatter. Work blocked on
   a `hitl` gate becomes RUNBOOK-{NN}.md (from `${CLAUDE_PLUGIN_ROOT}/templates/RUNBOOK.md`)
   in the phase's plan numbering and wave order — never an executable PLAN;
   downstream plans `depends_on` the runbook's number. `afk` gates are handled
   inside plans. Field rationale: two audited repos wrote plans that were never
   executable (0/4, 0/1) because human gates were discovered at run time instead
   of plan time.

   **Escalation preflight:** a plan whose tasks invoke a gated mutation (deploy,
   publish, prod write) declares the grant names in `escalations:` frontmatter.
   Before emitting, read `.potion/escalations.md`: every referenced name must
   exist with `expires` today-or-later. Missing or expired → STOP and ask the
   human, presenting a ready-to-paste registry line (grammar in
   templates/escalations.md, 90-day default expiry) — the human edits and commits
   the registry, then planning resumes. Undeclared commands still wall at run
   time; declaring is what makes the lane sanctioned.

2. If the phase needs research (unfamiliar library, external API), do a focused
   pass now and write findings into the plans' `<context>` — not a separate
   research pipeline.

   Also read `.potion/learnings.jsonl`: grep for entries whose `key`, `files`,
   or `insight` match the phase's stack, files, or failure modes. Inline every
   match into the affected plan's TECHNICAL NOTES as
   `Prior learning applied: {key} — {one-line insight}`. A pitfall the flywheel
   already paid for must never be re-purchased by a fresh worker.
   Do the same for the user-scope journal `~/.claude/potion/knowledge.jsonl`
   (if present): matches are inlined as `Prior cross-repo learning: {key}
   (from {repo})` — a pitfall paid for in another repo is never re-purchased
   here.
   If `.potion/knowledge/index.md` (or the user-scope
   `~/.claude/potion/pages/index.md`) lists a page matching the phase's stack,
   read the page — synthesis beats fragments; the jsonl grep remains the
   fallback when no page matches.

3. **Write plans** from `${CLAUDE_PLUGIN_ROOT}/templates/PLAN.md`: 15-60
   minutes of agent time per task; frontmatter, task count, and numbering per
   the emission contract above. Done when every PLAN-NN.md / RUNBOOK-NN.md
   exists on disk in `phases/NN-slug/`.

   **Verify-env refusal:** before writing any plan whose truths need a live
   session (login flows, on-device behavior, served UI — not CLI invocations or
   disk reads): `.potion/verify-env.md` must exist as a recipe or a
   `none-needed: <why>` declaration. Absent → STOP; ask the user the verify-env
   question (`${CLAUDE_PLUGIN_ROOT}/templates/verify-env.md`) and write the file
   first. Silence is the only illegal state.

   **Spec deltas:** a plan that changes behavior described in `.potion/specs/`
   (or establishes behavior worth speccing) carries a `<spec_deltas>` section
   per templates/PLAN.md — full requirement text, IDs per the spec format.
   Ship merges them mechanically; a missing delta means the spec silently rots.

   Inline everything the executor needs in `<context>` — the plan is the ONLY
   thing the worker is guaranteed to read, and a worker sent hunting through the
   repo for intent will reconstruct the wrong intent. Write for an engineer with
   zero context and questionable taste.

   Separate the two tiers in `<context>`: LOCKED product decisions (from
   DISCUSSION.md) versus TECHNICAL NOTES (your best current understanding of
   APIs and signatures). You WILL sometimes be wrong about APIs — that's fine
   if it's labeled: the worker verifies technical notes against installed
   typings and corrects them under Rule 1. An unlabeled wrong "decision" is
   how workers ship deprecated calls out of misplaced obedience.

4. **Self-check (adversarial pass, max 3 iterations).** Re-read each plan as a
   hostile reviewer:
   - Does every truth trace to at least one task? (Missing = blocker)
   - Does every artifact have a task that wires it? (Orphan = blocker)
   - Any task missing files/action/verify/done? Any plan with 4+ tasks?
   - Does anything contradict a locked Decision or touch a Deferred item?
   - Are names consistent across tasks? (`clearLayers()` in task 1 but
     `clearAllLayers()` in task 3 is a bug you're shipping.)
   Fix findings surgically — surgeon, not architect. Done when a pass yields
   zero findings; if issues survive 3 passes, show them to the user.

5. Update STATE.md. Done when `git log -1` shows `docs(potion): phase NN plans`.

## Gaps mode

Gaps mode is steps 1-5 with these substitutions — step 2 (research) is usually
unnecessary, and plans target exactly the structured gaps. The adversarial
self-check (step 4) and STATE.md update + commit (step 5) ALWAYS apply.

When invoked with gaps (from /potion:verify), read the structured gaps in
VERIFICATION.md frontmatter and write fix plans (`gap_closure: true`) targeting
exactly those gaps — nothing else. Numbering per the emission contract (a
reused number whose SUMMARY exists is silently skipped by execute; abort if
`SUMMARY-{NN}` already exists for your chosen number). Check VERIFICATION.md's `cycle`: if
this would be cycle 4, stop and escalate instead — the flywheel budget is 3.

## Red flags

| Thought | Reality |
|---|---|
| "I'll reference the doc instead of inlining it" | The worker is guaranteed to read ONE file. Paste it. |
| "The executor will know what 'appropriate' means" | That word is the plan failing. Specify it. |
| "Tasks 4 and 5 are tiny, they can stay" | Tiny tasks are how plans hit 80% context. New plan. |
| "The human steps can go in the plan's context" | A worker can't press console buttons. hitl-gated work is a RUNBOOK. |

## Exit

Summary table: plan | wave | tasks | must-have truths. Next up: `/potion:execute`
— suggest `/clear` first; the plans carry everything.
