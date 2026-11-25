---
name: next
description: Use when the user wants the next step without naming it — "next", "go", "continue", "keep going", "what's next", "potion next" — on a project with a .potion/ directory. Runs the next stage or names the human gate that blocks it.
---

# Potion Next

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. One command for "do the next
thing": derive where the project stands, then run that stage — or name the
human gate in the way.

## Steps

1. **Derive position from disk, never memory.** STATE.md Position; then the
   phase directory: DISCUSSION.md? PLAN/RUNBOOK files? A SUMMARY per plan
   (drafts do not count)? VERIFICATION.md verdict and cycle? Is
   `.potion/continue-here.md` present?

2. **Route by the first row that matches:**

   | On disk | Next |
   |---|---|
   | continue-here.md exists | /potion:resume |
   | no DISCUSSION.md for the current phase | /potion:discuss — a human gate; say so and start it with the user |
   | DISCUSSION.md, no PLAN/RUNBOOK | /potion:plan |
   | a plan without its SUMMARY | /potion:execute |
   | all summaries, no VERIFICATION verdict | /potion:verify (in a session that ran execute, prefer /potion:brew so verification gets fresh agents) |
   | verdict gaps, cycle < 3, code moved since (`git log --oneline {tested_sha}..HEAD -- . ':(exclude).potion'` prints commits) | /potion:verify — the gap fixes ran; the verdict is stale |
   | verdict gaps, cycle < 3, no code since | /potion:plan gaps mode |
   | verdict gaps at cycle 3, or escalated | human gate — show the gaps and the theory; stop |
   | verdict pass, not shipped | /potion:ship — human-gated; ask before starting |
   | shipped | /potion:discuss for the next phase — human gate |

3. **Announce, then run.** One line: what you derived and what you are
   running. Then run that skill's steps — next means do it, not describe it.

## Rules

- Never skip a human gate because the user said "go".
- "go" answers a gate only when the gate's question was the last thing asked.

## Red flags

| Thought | Reality |
|---|---|
| "I remember where we were" | Disk knows. Derive it. |
| "The user said go, so ship" | Ship and discuss are human gates — ask the gate's own question. |
