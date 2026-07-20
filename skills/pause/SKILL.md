---
name: pause
description: Use when stopping mid-phase — when the user says "pause", "checkpoint this", "I need to stop", "switching projects", or a session is ending with uncommitted position. Not needed between phases; STATE.md already covers that.
---

# Potion Pause

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Write the handoff so the next session starts in seconds,
not by archaeology.

## Steps

1. **Infer, don't interrogate.** Position, branch, completed tasks and their commit
   hashes come from git state and this conversation. Only ask if something genuinely
   cannot be inferred. Done when: position, branch, and task hashes are in hand.

2. Write `.potion/continue-here.md` from `${CLAUDE_PLUGIN_ROOT}/templates/continue-here.md`:
   completed-tasks table **with commit hashes** (git is ground truth for the
   resumer), decisions made this session (so they don't get re-debated), a next
   action concrete enough to execute without reading anything else, and context —
   gotchas, dead ends already tried, open worries. The dead ends matter most;
   they're the most expensive thing to rediscover.

   Fill `Status before pause` with STATE.md's current status (closed vocabulary:
   planning | executing | verifying | blocked) — capture it now, before step 3
   overwrites it with `paused`. Done when: `.potion/continue-here.md` exists
   with every template field filled — no `{placeholders}` remain.

3. **Uncommitted source edits?** Commit them as
   `wip(potion): paused mid {phase}-{plan} task {N}` — never amend, never stash
   (commits are potion's ground truth; a stash is invisible to a fresh session).
   Record the WIP hash and a one-line description of what's half-done in
   continue-here.md's `Dirty tree` field. Clean tree → write `clean`.
   **Unpushed-state check:** run `git rev-list --count @{upstream}..HEAD`;
   surface the result to the user BEFORE the stall is recorded — "branch is N
   commits ahead of origin — push now or this stall is invisible beyond this
   machine" (command error = no upstream, surfaced as such); record the answer
   in continue-here.md's Unpushed field. Never auto-push.
   Done when: `git status --short` prints nothing outside `.potion/` and the
   Unpushed field is filled.

4. Update STATE.md: status `paused`, Session Continuity block pointing at
   continue-here.md. Done when: STATE.md's status line reads `paused`.

5. Commit both. Done when: `git log -1 --oneline` shows
   `chore(potion): pause checkpoint`.

6. **Process hygiene:** stop any dev servers or watchers this session started,
   or hand over PIDs and kill commands explicitly. Done when: nothing this
   session started is still running, or the PIDs are in the exit line.

## Exit

One line: where we stopped, what resumes it (`/potion:resume`).
