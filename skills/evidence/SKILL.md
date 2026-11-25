---
name: evidence
description: Use when it is time to find out how potion is actually performing — when the user says "field evidence", "audit potion usage", "how is potion doing across my projects", "what should we improve", or when a POTION EVIDENCE STALENESS notice appears.
---

# Potion Evidence

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. The script counts; you judge;
the human decides. Law 5: every candidate cites the observed failure it fixes
or is marked `[no-failure-yet]`.

## Steps

1. **One question, with defaults.** Ask which root directories to scan and
   whether transcripts may be read — they are private. Recommended: root = the
   parent of the current repo; transcripts dir = `~/.claude/projects`. A "no"
   on transcripts is a valid answer: run without them and say so under limits.
   Done when: the roots and the transcripts answer are in hand.

2. **Run the script; keep the raw output.** It reads only.

   ```
   mkdir -p .potion/research/evidence
   node ${CLAUDE_PLUGIN_ROOT}/scripts/field-evidence.js --root <dir> [--root <dir>…] \
     [--transcripts <dir>] [--since <last cutoff>] > .potion/research/evidence/$(date +%F)-raw.md
   ```

   Transcripts run to gigabytes — background it with a generous timeout. Done
   when: `.potion/research/evidence/{date}-raw.md` ends with a `## Limits` section.

3. **Read the previous pass.** Open the newest
   `.potion/research/*field-evidence*.md` for the last cutoff date and the
   standing recurrence checks — each one is re-answered this pass, with a
   number. No previous pass → this is N=1, all time. Done when: the cutoff and
   the recurrence list are in hand.

4. **Write `.potion/research/{date}-field-evidence-{N}.md`:**
   - **Inputs and limits** — roots, cutoff, whether transcripts were read, and
     the raw output's Limits and Could-not-read sections carried over.
   - **What works** — with the counts that show it.
   - **Breaking points** — numbered `E-NN`, each carrying its number from the
     raw output. No number, no breaking point.
   - **Ranked candidates** — each tagged `fixes E-NN` or `[no-failure-yet]`.
     A `[no-failure-yet]` candidate can never be Tier 1.
   - **Explicit rejections** — what was considered and dropped, with why.
   - **Proposed phase shape** — a shape, not a plan.

   Done when: every candidate carries exactly one tag and every `E-NN` cites a
   count from the raw file.

5. **Stop.** The human decides what converts into phases. Record their call in
   STATE.md's Recent decisions. Done when: the decision line is written — or
   the human has deferred, and that is recorded instead.

## Rule

Never put private project names from other repos into a file the public mirror
receives — research docs and raw output stay in `.potion/`. Quote learning
keys and counts, never another repo's insight text.

## Red flags

| Thought | Reality |
|---|---|
| "The numbers look bad, I'll soften them" | Report the count and its limit; the human judges. |
| "This idea is exciting, Tier 1" | No observed failure, no Tier 1 (Law 5). |

## Exit

One line: report path, breaking-point and candidate counts, decision pending or made.
