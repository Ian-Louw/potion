---
name: pair
description: Use when the user wants a hands-on session lane — "pair with me", "pairing mode", "hands-on session", "work on this with me directly" — or is ending one: "wrap up the pairing session", "pair exit". No PLAN files, no spawned workers; exit emits a SUMMARY plus mini-verify.
---

# Potion Pair

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. A session-long hands-on lane:
enter → work directly with the human → exit emits a lightweight SUMMARY plus
mini-verify. Every timestamp in the marker and the SUMMARY is derived
mechanically (`date -Iseconds`) — never hand-typed.

## Enter

1. **Stale-marker check first.** If `.potion/pairing.md` already exists, a
   previous session died un-exited — offer a retroactive exit FIRST (the
   recorded baseline..HEAD still computes; run the Exit sequence against it)
   before starting a new session. `/potion:resume` performs this same check
   in its step 1, so the marker is caught from either entry point.
2. Write `.potion/pairing.md` containing exactly three mechanical fields:
   `started: {date -Iseconds output}`, `baseline: {git rev-parse HEAD}`,
   `intent: {one line from the user — ask if not offered}`. It is transient,
   in the spirit of continue-here.md.
3. Announce the lane: hands-on, no PLAN files, no worker spawning; exit via
   `/potion:pair exit` or saying "wrap up".

## During

Normal collaborative work. Atomic commits at natural seams. CORE.md's
deviation rules and red flags still apply. The session is the worker — no
spawning.

## Exit

Triggered by the user saying "exit" / "wrap up" or invoking the skill with exit.

1. Commit any uncommitted hands-on work, with the user's ok.
2. Compute the commit list: `git log --oneline {baseline}..HEAD`.
3. Mini-verify: run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/ci-verify.sh` and
   capture the CHECK/RESULT lines. A MISMATCH is a regression this session
   caused — fix it before exiting, or if the user declines, record it as an
   explicit concern in the SUMMARY. Never silent.
4. Evidence gate per CORE.md: identify and run FRESH the ONE command that
   best proves the session's main change; capture command + output.
5. Write the SUMMARY (numbering and body below).
6. Delete `.potion/pairing.md`.
7. Update STATE.md tolerantly — the file may not be init-shaped: update the
   Position "Last activity" line and `## Session continuity` when present;
   append any missing section in minimal form instead of assuming it exists
   (including `## Fog` if concerns need routing). Route unconsumed concerns
   to `## Fog` tagged `from SUMMARY-NN`.
8. Commit the exit bookkeeping — the SUMMARY file, STATE.md, and the
   pairing.md deletion: `git add -A .potion && git commit -m
   "docs(potion): pairing exit SUMMARY-{NN}"`. The scrubber hook screens
   this commit like any other; if it blocks, fix the flagged content —
   never bypass.

### SUMMARY numbering

When STATE.md's Position names a phase whose dir exists and is not shipped:
NN = one past the highest existing PLAN/RUNBOOK/SUMMARY number in that dir
(shared pool), written as `SUMMARY-NN.md` there. Otherwise write
`.potion/phases/pairing/SUMMARY-{YYYY-MM-DD}-{slug}.md` (slug from the
intent, kebab-case, ≤4 words); create the dir if absent.

### SUMMARY body

Frontmatter `type: pairing`, then: intent; session span (started/ended
timestamps, both from `date -Iseconds`); commit range and the
`git log --oneline` list; mini-verify table (one row per CHECK line plus the
RESULT line); evidence gate (command, trimmed output, what it proves);
deviations/concerns.

## Red flags

| Thought | Reality |
|---|---|
| "It was just a quick session, skip the SUMMARY" | Unrecorded work is how shipped-but-unverified happens — the SUMMARY is the whole point. |
| "I'll hand-type the timestamp" | `date -Iseconds`, always. |
| "That MISMATCH was probably pre-existing" | The baseline is recorded — check it. Fix or record as a concern; never silent. |
