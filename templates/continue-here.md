---
phase: "{NN-slug}"
plan: "{NN}"
task: "{N}"
branch: "{branch}"
paused: "{ISO datetime}"
---

# Continue here

<!-- Transient file. The resumer deletes it after reading. -->

Status before pause: {planning | executing | verifying | blocked}
<!-- Closed vocabulary, copied from STATE.md before it was set to paused.
     (paused itself is excluded — you can't pause into paused.) -->

Dirty tree: {clean | WIP commit {hash} — one line on what's half-done}
<!-- If pause found uncommitted source edits, they were committed as
     `wip(potion): paused mid {phase}-{plan} task {N}` and recorded here. -->

Unpushed: {in sync | N commits ahead of origin | no upstream}
<!-- Recorded at pause time; an unpushed stall is invisible to other machines. -->

## Completed so far

| Task | Commit | Note |
|---|---|---|
| {task} | {hash} | {one line} |

<!-- Resumer's first act: verify these commits exist in git log. Git is ground truth. -->

## Decisions made

- {decision + why — so next session doesn't re-debate it; a decision
  superseding a same-day checkpoint answer MUST cite the superseded commit
  hash}

## Next action

{Concrete enough to act on without reading anything else. "Run X, then implement
task 3 of PLAN-02.md starting with the handler in api/auth.ts."}

## Context

{Mental state, gotchas, things tried that didn't work, open worries.}
