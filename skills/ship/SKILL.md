---
name: ship
description: Use when work is ready to leave the branch — when the user says "ship", "potion ship", "create the PR", "get this merged", or "push this up".
---

# Potion Ship

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Ship = merge base in, prove it still works, package it
honestly, PR.

**Emission contract — the ship checklist, in order:** VERIFICATION.md
`verdict: pass` and fresh (the gate does not negotiate); base merged, tests
re-run POST-merge; merge-specs.sh applied — nonzero exit BLOCKS ship, the
human resolves; changelog cross-checked so every branch commit maps to a
bullet; version bumped if the project versions; the PR carries evidence and
publishing stays human-gated — never force-push, never skip hooks; STATE.md
and PROJECT.md updated. Before finishing, re-read the emitted PR body and
changelog against this block; fix in place, or regenerate —
at most once.

## Steps

1. **Gate.** The phase's VERIFICATION.md must have `verdict: pass` (or every
   open gap listed in its `accepted` frontmatter — an acceptance is valid ONLY
   if it records an explicit user statement (who + date + their words or a
   paraphrase). You may PROPOSE accepting a gap; only the user accepts.
   Self-recorded acceptance is a gate violation, not a shortcut.)
   **Staleness check:** compare `verified_at` against the newest commit
   touching non-`.potion` files — any code commit after verification means the
   verification describes code that no longer exists → re-run /potion:verify.
   No verification at all → run /potion:verify first. This gate does not
   negotiate.

2. **Sync.** Detect the base branch, merge it in, resolve conflicts. Re-run the
   test suite AFTER the merge — pre-merge green proves nothing about post-merge.
   Done when: the post-merge suite output shows green.

3. **Spec merge.** `sh ${CLAUDE_PLUGIN_ROOT}/scripts/merge-specs.sh
   .potion/phases/{NN-slug}` — applies the phase's `<spec_deltas>` to
   .potion/specs/. Nonzero exit → STOP and show the CONFLICT/MALFORMED output;
   the human edits deltas or specs and re-runs — never hand-merge. Applied ops →
   commit `docs(potion): phase NN spec merge`. No deltas is a clean no-op.

4. **Evidence gate** (from CORE.md): identify the command that proves the branch
   works, run it fresh, read the output. "It passed before the merge" → run it again.

5. **Changelog by cross-check.** List every commit on the branch. Count them.
   Write the changelog, then verify every commit maps to at least one bullet —
   a summary that silently drops commits is a lie of omission.

6. **Version bump** if the project versions releases (patch/minor by content).
   Done when: the version file and changelog header show the new number (or n/a).

7. **Commit, push, PR.** PR body: what changed, why, verification evidence
   (test output, screenshots), deviations from plan, known concerns.
   Never force-push; never skip hooks. Done when: the PR URL exists.

8. Update STATE.md (phase shipped) and PROJECT.md (check off requirements that
   are now true). Done when: both files show it and the update is committed.

## Red flags

| Thought | Reality |
|---|---|
| "Verification was yesterday, still fine" | The merge changed the code. Re-run. |
| "CI will catch it" | CI is a backstop, not a verifier. Evidence before the PR. |
| "Minor conflicts, auto-resolved, no re-test needed" | Conflicts are code changes. Test again. |

## Exit

PR link, changelog, evidence summary. Next up: `/potion:discuss` for the next phase.
