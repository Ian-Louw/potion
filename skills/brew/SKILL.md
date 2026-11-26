---
name: brew
description: Use when the user wants a phase driven end-to-end without hand-cranking — "brew the phase", "run the whole loop", "potion brew", or "take this phase to done". Also "potion auto", "auto mode", "run it unattended", "keep going without me". Requires the phase's DISCUSSION.md to exist (a human locked the decisions first); without one, run /potion:discuss and stop.
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

## Auto mode

Brew IS auto mode: one invocation carries a discussed phase from plan to a verification verdict.
- No /clear: the context-heavy stages (plan, verify) run in fresh subagents.
- No "go" between stages: each stage's agents run in the background; their completion re-invokes this session.
- Nothing keeps the session running. If a turn ever ends with nothing in flight and the phase unfinished,
  say exactly which stage is next and that the human can type "go" or `/potion:next`. Never schedule or arrange
  your own continuation — the one exception is the single watchdog fallback wakeup while agents are running.
- Scope is fixed: to a verification verdict. Never ship, never start the next phase's discuss, never push.

## Stage dispatch (fresh context, no /clear)

```
plan (if no PLAN/RUNBOOK files) → permission preflight → execute wave-by-wave → verify
  verdict pass → done: update STATE/PROJECT, report, STOP
  verdict gaps → cycle < 3? plan gaps → execute → re-verify (loop)
               → cycle = 3? ESCALATE (human gate)
```

Every agent is spawned by the main session — no stage agent spawns another. Between stages,
re-derive position from disk (count SUMMARY vs PLAN files, read VERIFICATION frontmatter; a
gaps verdict whose `tested_sha` is behind later code commits is stale → verify, not plan) —
the loop must survive your own context being compacted mid-run.

- **plan** (only if no PLAN/RUNBOOK files): spawn ONE general-purpose agent: "Read
  ${CLAUDE_PLUGIN_ROOT}/core/CORE.md and ${CLAUDE_PLUGIN_ROOT}/skills/plan/SKILL.md, then plan
  phase {slug} of {repo} exactly per that skill (gaps mode if VERIFICATION.md lists gaps). You
  cannot ask the human: if the skill says STOP and ask, return CHECKPOINT with the question
  instead. Do not spawn agents. Return ≤15 lines: the plan table." Read only the return and
  the plan frontmatter.
- **permission preflight** (before the first wave, once per phase): read each plan's tasks for
  commands the auto-mode classifier denies in the field — production writes, deploy/publish,
  remote shells (ssh, scp), changes that weaken security controls. Any such step must already
  be a RUNBOOK step or carry an `escalations:` entry name present and unexpired in
  `.potion/escalations.md`; otherwise this is a human gate NOW — record it and stop — rather
  than a stall at hour two. Never add allow rules, never suggest bypass mode.
- **execute**: /potion:execute rules verbatim; the main session spawns the workers (waves, drafts, merge-back, watchdog).
- **verify**: spawn TWO agents in one message, both told nothing about worker returns or
  SUMMARY claims: (1) a general-purpose "runtime verifier", the phase's must_haves inlined:
  "Read CORE.md and ${CLAUDE_PLUGIN_ROOT}/skills/verify/SKILL.md. For phase {slug} of {repo}
  run step 1 (preflight + deterministic checks) and step 3 (runtime evidence for every
  must-have truth, evidence files under the phase's evidence/ directory, SUMMARY task→commit
  cross-check) and write those sections of VERIFICATION.md from the template. Do not run
  step 2, do not set the verdict, do not spawn agents. Return ≤15 lines."; (2)
  potion:potion-verifier per verify step 2, told to return its ladder as text (it must not
  write VERIFICATION.md while agent 1 is writing it; its ≤15-line limit does not apply to that
  ladder; the status block still ends the return). The main session then writes the ladder
  into VERIFICATION.md, sets the verdict per verify step 4 and the verdict contract, harvests
  learnings, regenerates the evidence index. It judges only from those two outputs.
- **gaps**: verdict gaps and cycle < 3 → first run `node ${CLAUDE_PLUGIN_ROOT}/scripts/gap-recurrence.js {phase dir}`.
  The script matches a gap's text exactly (case, spacing and final punctuation aside): also read
  both cycles' gaps yourself — a reworded gap about the same truth is a recurrence too.
  A RECURRING gap, or a plan that was respawned after a stall this run, means the last fix did
  not work: before planning again, consult the advisor (or run /potion:investigate on that gap
  when there is none) and plan from the root cause it finds — never re-issue the same fix.
  Then plan (gaps mode) → execute → verify again. Cycle 3 → escalate (human gate).

## Advisor (when the session has one)

If you have an `advisor` tool, call it at these three points (and at the stuck-loop trigger in the
gaps stage); if you do not, skip them silently — never ask the human to enable it mid-run and
never treat its absence as a gate.
1. Plan accepted, before the first wave: give it the phase goal, the locked Decisions and the plan
   table; ask what is missing or risky. A blocker it finds goes back to planning once; advice is not a gate.
2. Before a cycle-3 escalation: give it the three cycles' gaps and your theory; put its view
   beside yours in the escalation.
3. Before recording the verdict: give it the truths table with the runtime evidence paths; ask what
   a skeptic would still doubt. A doubt it raises is checked or recorded — never waved through,
   never allowed to flip a verdict without evidence.
The advisor advises; the verifiers verify; the human decides gates.

## Human gates — the ONLY reasons to stop mid-loop

A gate is a reason to stop and report what the human must do. A message from the human always wins.

- A worker returns `CHECKPOINT` (Rule 4 / human-verify / auth wall).
- Verification produces `human_needed` items (batch them, one stop).
- A wave reaches a RUNBOOK whose `done_when` checks don't all pass — present the remaining
  steps, then stop (the human acts; a later brew re-checks mechanically).
- The gap flywheel reaches cycle 3.
- Anything would touch a Deferred item or contradict a locked Decision.
- The user interrupts (their kill switch — honor it instantly and pause
  cleanly: current stage finishes its disk writes, then /potion:pause).

## Watchdog

/potion:execute's watchdog (disk check → one nudge → one fresh respawn, never two live workers
on a plan) applies to EVERY agent brew spawns, verifiers included. While workers run in the
background, end your turn normally — their completion re-invokes you; if the harness offers wakeups, set one ~20 min fallback for the disk check.
`/potion:brew headless` (a `claude -p` run): ending the turn ends the run — spawn every agent in the foreground, tell each to run commands in the foreground, and never end the turn before a verdict or a human gate.

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
| "It ran unattended this far, so I can skip this checkpoint" | Autonomy between gates, never through them. Stop. |
| "I'll verify it myself, I saw the workers succeed" | You are anchored. Fresh agents verify; you only combine their outputs. |
| "The advisor agrees, so it's verified" | Agreement is not evidence. The truths table decides. |

## Exit

Record the loop: `node ${CLAUDE_PLUGIN_ROOT}/scripts/metrics.js record --stage brew --agents {every subagent spawned} --gate-stops {N} --respawns {N} --minutes {N}`,
then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/metrics.js report` and paste its lines into the report as **Usage**.
Phase report: cycles used, plans executed, deviations, gaps closed, evidence paths, learnings added, Usage.
Next up: /potion:ship (human) or the next phase's discuss (human). Commit the metrics line: `docs(potion): phase {NN} brew metrics` (stage `.potion/metrics.jsonl` by name) — a run ends with a clean tree.
