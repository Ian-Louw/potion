---
name: brew
description: Use when the user wants a phase driven end-to-end without hand-cranking — "brew the phase", "run the whole loop", "potion brew", or "take this phase to done". Requires the phase's DISCUSSION.md to exist (a human locked the decisions first); without one, run /potion:discuss and stop.
---

# Potion Brew

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Brew is the closed loop with the
crank automated: plan → execute → verify → gap-cycle, repeating until the
phase passes or a human gate fires. You are the loop operator — you spend your
context on routing and judgment, never on implementation or auditing.

**Loop contract (must hold in how the loop runs, stops, and reports):**
- Compose, never inline: plan / execute / verify rules apply verbatim from
  their own skills — brew adds only sequencing, gates, and budgets.
- Stop mid-loop ONLY at a human gate: worker CHECKPOINT, batched
  human_needed items, an unpassed RUNBOOK, gap cycle 3, a Deferred or
  locked-Decision touch, or a user interrupt. Everything else — Rules 1-3
  deviations, gap plans, re-verification, watchdog respawns — proceeds
  without asking; "shall I continue?" between stages defeats brew.
- Between stages, re-derive position from disk, never from memory.
Before finishing (or stopping at a gate), re-read your report against this
block; fix in place, or regenerate it — at most once.

## Preconditions (all hard)

1. `.potion/` exists and STATE.md points at the target phase.
2. `phases/{NN-slug}/DISCUSSION.md` exists — brew NEVER invents decisions.
   Missing → run /potion:discuss with the user, then stop; brew again later.
3. Git working tree is clean (uncommitted work → show the user, stop).

## The loop

```
plan (if no PLAN files)          → /potion:plan rules apply verbatim
  ↓
execute wave-by-wave             → /potion:execute rules + the watchdog below
  ↓
verify (four-step protocol)      → /potion:verify rules verbatim
  ↓
verdict pass  → done: update STATE/PROJECT, report, STOP
verdict gaps  → cycle < 3? plan gaps → execute → re-verify (loop)
              → cycle = 3? ESCALATE (human gate)
```

Between stages, re-derive position from disk (count SUMMARY vs PLAN files,
read VERIFICATION frontmatter) — never from your memory of the loop. The loop
must survive your own context being compacted mid-run.

## Human gates — the ONLY reasons to stop mid-loop

- A worker returns `CHECKPOINT` (Rule 4 / human-verify / auth wall).
- Verification produces `human_needed` items (batch them, one stop).
- A wave reaches a RUNBOOK whose `done_when` checks don't all pass — present
  the remaining steps, then stop (the human acts; a later brew re-checks
  mechanically).
- The gap flywheel reaches cycle 3.
- Anything would touch a Deferred item or contradict a locked Decision.
- The user interrupts (their kill switch — honor it instantly and pause
  cleanly: current stage finishes its disk writes, then /potion:pause).

## Watchdog

/potion:execute's watchdog (disk check → one nudge → one fresh respawn,
never two live workers on a plan) applies to EVERY agent brew spawns,
verifier included. If the harness supports scheduled wakeups, prefer a long
fallback wakeup (~20 min) over polling while waves run — workers notify on
completion.

## Budgets (inherited, enforced here)

- Gap flywheel: 3 cycles (VERIFICATION.md `cycle` field is the counter).
- Watchdog respawn: once per plan; a second stall on the same plan → BLOCKED,
  escalate with the plan and both transcripts' evidence.
- Wall-clock sanity: if the loop has run 3+ hours without a stage completing,
  something is wrong — pause and report rather than grind.

## Red flags

| Thought | Reality |
|---|---|
| "The user probably wants me to keep going past this checkpoint" | Gates are the contract that makes autonomy safe. Stop. |
| "I remember where the loop is" | Disk knows. Re-derive position before every stage. |
| "I'll just implement this bit myself, spawning is overhead" | Your context is the loop's fuel gauge. Spawn workers. |
| "Cycle 3 failed but I can see the fix" | That's what cycle-3 escalation is FOR — show the human your theory. |

## Exit

Phase report: cycles used, plans executed, deviations, gaps closed, evidence
paths, learnings added. Next up: /potion:ship or the next phase's discuss.
