---
name: resume
description: Use when returning to a Potion project — when the user says "resume", "where was I", "pick up where we left off", "continue the project", or a session starts in a repo whose .potion/STATE.md shows status paused.
---

# Potion Resume

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Restore position from disk, verify it against git, go.

## Steps

1. Read `.potion/STATE.md`. If `.potion/continue-here.md` exists, read it
   too. If `.potion/pairing.md` exists, a pairing session died un-exited —
   before anything else, offer the retroactive exit: run `/potion:pair exit`
   against the marker's recorded baseline (the baseline..HEAD commit list
   still computes), which emits the missing SUMMARY and deletes the marker;
   if the user declines, note the surviving marker in the step-4 brief and
   continue. Done when: state files are loaded and any pairing marker is
   either retroactively exited or explicitly deferred.

2. **Verify against ground truth.** The continue-here table lists commit hashes —
   confirm they exist in `git log`. Check `git status` for uncommitted work the
   pause didn't capture, and `git status .potion/` for merge-conflict markers
   (another session or branch touched the state — stop and show the user before
   proceeding). Disk claims, git confirms. On mismatch, show the user
   both and ask which reality wins; never silently pick one.
   **Expired-gate sweep:** scan the current phase's DISCUSSION.md gates and
   every phases/*/RUNBOOK-*.md lacking its SUMMARY for `expires: YYYY-MM-DD`
   values that have passed; each expired gate is surfaced in the step-4 brief
   as decide-renew-or-abandon (renewal = one conscious line bumping expires).
   Done when: every
   listed hash is found in `git log`, `.potion/` shows no conflict markers,
   and expired gates (if any) are queued for the brief.

3. Surface the top 3 relevant learnings from `.potion/learnings.jsonl` (newest
   wins per key; skip entries whose `files` no longer exist — flag those as stale).
   When one changes your behavior, say "Prior learning applied: {key}."
   Done when: up to 3 keys are named in the brief (or none exist, and you say so).

4. Brief the user in 5 lines: position, last session's stopping point, decisions
   made there, the next action. If continue-here.md's `Dirty tree` field records
   a WIP commit, say so: "you are mid-task N, WIP commit {hash} holds partial
   work." If the phase is stalled on a human gate (STATE status blocked, or
   Blockers/continue-here naming a waiting-on-human item) AND an unexecuted
   PLAN exists with no RUNBOOK in the phase, offer the guided retrofit before
   resuming: extract the human-action steps into RUNBOOK-{next number in the
   phase's shared pool} from templates/RUNBOOK.md (with the gate's expires
   date), put the remaining agent work in PLAN-{next+1} with depends_on the
   runbook, and close the original plan with SUMMARY-NN.md carrying
   `type: superseded` and `superseded_by: ["RUNBOOK-{X}", "PLAN-{Y}"]`. The
   offer is a question — the user opts in; declining leaves everything
   untouched. Then — unless the user redirects — do the next action. Resume means
   resume, not summarize.

5. Delete `continue-here.md` (it's transient), then set STATE.md status to the
   recorded `Status before pause` value (closed vocabulary — never invent a
   status). If the field is missing (pre-fix pause file), derive: unexecuted
   PLAN with no SUMMARY → executing; all SUMMARYs present, no VERIFICATION
   verdict → verifying; else planning. Done when: continue-here.md is gone,
   STATE.md's status is a closed-vocabulary value, and `git log -1 --oneline`
   shows `chore(potion): resume`.

## Red flags

| Thought | Reality |
|---|---|
| "I remember this project" | Memory is stale. The files are current. Read them. |
| "I'll re-plan from scratch to be safe" | Decisions in DISCUSSION.md are locked. Resume, don't restart. |
