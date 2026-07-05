---
name: resume
description: Use when returning to a Potion project — when the user says "resume", "where was I", "pick up where we left off", "continue the project", or a session starts in a repo whose .potion/STATE.md shows status paused.
---

# Potion Resume

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Restore position from disk, verify it against git, go.

## Steps

1. Read `.potion/STATE.md`. If `.potion/continue-here.md` exists, read it too.

2. **Verify against ground truth.** The continue-here table lists commit hashes —
   confirm they exist in `git log`. Check `git status` for uncommitted work the
   pause didn't capture, and `git status .potion/` for merge-conflict markers
   (another session or branch touched the state — stop and show the user before
   proceeding). Disk claims, git confirms. On mismatch, show the user
   both and ask which reality wins; never silently pick one.

3. Surface the top 3 relevant learnings from `.potion/learnings.jsonl` (newest
   wins per key; skip entries whose `files` no longer exist — flag those as stale).
   When one changes your behavior, say "Prior learning applied: {key}."

4. Brief the user in 5 lines: position, last session's stopping point, decisions
   made there, the next action. If continue-here.md's `Dirty tree` field records
   a WIP commit, say so: "you are mid-task N, WIP commit {hash} holds partial
   work." Then — unless the user redirects — do the next action. Resume means
   resume, not summarize.

5. Delete `continue-here.md` (it's transient), then set STATE.md status to the
   recorded `Status before pause` value (closed vocabulary — never invent a
   status). If the field is missing (pre-fix pause file), derive: unexecuted
   PLAN with no SUMMARY → executing; all SUMMARYs present, no VERIFICATION
   verdict → verifying; else planning.
   Commit: `chore(potion): resume`.

## Red flags

| Thought | Reality |
|---|---|
| "I remember this project" | Memory is stale. The files are current. Read them. |
| "I'll re-plan from scratch to be safe" | Decisions in DISCUSSION.md are locked. Resume, don't restart. |
