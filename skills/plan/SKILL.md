---
name: plan
description: Use when a phase needs an execution plan — when the user says "plan the phase", "potion plan", or after /potion:discuss completes. Also use with gaps mode when VERIFICATION.md lists unresolved gaps.
---

# Potion Plan

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Produces PLAN files that are executed **verbatim** by fresh
agents. A plan is a prompt, not a document.

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
   Deferred is untouchable. If DISCUSSION.md doesn't exist, run /potion:discuss first.

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

3. **Write plans** from `${CLAUDE_PLUGIN_ROOT}/templates/PLAN.md`: 2-3 tasks each, 15-60 minutes of agent
   time per task, exclusive `files_modified` per same-wave plan, `wave = max(deps)+1`.
   Inline everything the executor needs in `<context>` — the plan is the ONLY
   thing the worker is guaranteed to read, and a worker sent hunting through the
   repo for intent will reconstruct the wrong intent. Write for an engineer with
   zero context and questionable taste.

   Placeholders are plan failures: "TBD", "add appropriate error handling",
   "similar to task N". The specificity test: could a different Claude instance
   execute this without asking a single question?

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
   Fix findings surgically — surgeon, not architect. If issues survive 3 passes,
   show them to the user.

5. Update STATE.md. Commit: `docs(potion): phase NN plans`.

## Gaps mode

Gaps mode is steps 1-5 with these substitutions — step 2 (research) is usually
unnecessary, and plans target exactly the structured gaps. The adversarial
self-check (step 4) and STATE.md update + commit (step 5) ALWAYS apply.

When invoked with gaps (from /potion:verify), read the structured gaps in
VERIFICATION.md frontmatter and write fix plans (`gap_closure: true`) targeting
exactly those gaps — nothing else. Numbering: continue the phase's sequence —
next number after the highest existing PLAN-NN, never reuse (a reused number
whose SUMMARY exists is silently skipped by execute; abort if `SUMMARY-{NN}`
already exists for your chosen number). Check VERIFICATION.md's `cycle`: if
this would be cycle 4, stop and escalate instead — the flywheel budget is 3.

## Red flags

| Thought | Reality |
|---|---|
| "I'll reference the doc instead of inlining it" | The worker is guaranteed to read ONE file. Paste it. |
| "The executor will know what 'appropriate' means" | That word is the plan failing. Specify it. |
| "Tasks 4 and 5 are tiny, they can stay" | Tiny tasks are how plans hit 80% context. New plan. |

## Exit

Summary table: plan | wave | tasks | must-have truths. Next up: `/potion:execute`
— suggest `/clear` first; the plans carry everything.
