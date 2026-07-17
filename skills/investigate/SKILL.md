---
name: investigate
description: Use when a failure's cause is unknown — a bug, a failing test, "why is this broken", "it worked yesterday", a tripped circuit breaker (3 failed fixes), or any moment a fix is about to be attempted without a reproduced root cause.
---

# Potion Investigate

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. The gap flywheel handles KNOWN
gaps; this skill exists for unknown causes — including the moment a circuit
breaker trips and hands you a mystery.

## The Iron Law

```
NO FIX WITHOUT A REPRODUCED ROOT CAUSE
```

A fix applied to an unreproduced bug is a guess wearing a fix's clothing. If
you cannot make it happen on demand, you cannot know you made it stop.

## The session file — investigations survive compaction

Investigations burn context and die at `/clear`. First act: create
`.potion/debug/{slug}.md`:

```markdown
## Symptom        {exact error/behavior, verbatim — plus how to reproduce}
## Evidence       {facts observed, with commands and output — append-only}
## Hypotheses     {each: statement → test that would falsify it → result}
## Eliminated     {hypotheses killed, and by what evidence}
## Root cause     {empty until PROVEN — reproduced on demand, mechanism explained}
```

Update it as you go — a fresh session must be able to continue from the file
alone. Delete it (or move the conclusion to learnings) when closed.

## Method

1. **Reproduce first.** Make the failure happen on demand. Can't reproduce →
   that's the investigation, not a blocker to skip. Done when: Symptom holds a
   command (or steps) that triggers the failure on demand.
2. **Read the actual error.** The full text, the stack, the line — pasted
   verbatim into Evidence. Not the vibe.
3. **One hypothesis at a time**, cheapest test first. Every test's result goes
   in Evidence — including the boring ones; eliminated hypotheses are progress.
4. **Trace, don't guess**: follow the data from where it's right to where it's
   wrong. Done when: the session file names the boundary — the bug's home.
5. Root cause proven → fix it (smallest change that kills the mechanism),
   re-run the reproduction to watch it stop, then `/potion:learn` — a root
   cause that took >5 minutes is automatically above the logging bar, and if
   it can recur, promote a `check`.

Breaker inherited from CORE: 3 falsified hypotheses in a row on the same
theory → the theory is wrong, not the tests. Zoom out one level (component →
architecture) or escalate with the session file.

## Red flags

| Thought | Reality |
|---|---|
| "I'm pretty sure it's X, let me just fix it" | Prove it or it's a guess. Guesses ship new bugs. |
| "I can't reproduce it, but the fix is obvious" | Then you can't know the fix worked. Reproduce first. |
| "Just one quick fix before investigating properly" | The quick fix IS the thrashing. Session file first. |
| "The error message is misleading" | Maybe. Evidence decides that, not intuition. |

## Exit

Root cause + fix + reproduction-now-passes evidence, learning logged. Or:
session file handed to the user with hypotheses eliminated and next tests named.
