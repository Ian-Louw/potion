---
name: discuss
description: Use before planning a phase — when the user says "discuss phase", "let's talk through the next phase", or when /potion:plan is requested but no DISCUSSION.md exists for the target phase.
---

# Potion Discuss

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Purpose: lock the user's decisions BEFORE planning, so no
downstream agent ever re-litigates them or sneaks in deferred scope.

**Emission contract — DISCUSSION.md:** three body buckets (`## Decisions` —
LOCKED; `## Claude's Discretion`; `## Deferred`); every idea raised in
conversation lands in exactly one bucket — nothing evaporates; external
prerequisites become `gates:` frontmatter entries typed hitl or afk, each
carrying added/expires dates (omit the
frontmatter when the phase has no gates); exit updates STATE.md — gist-and-link
recent decisions, consumed fog/queue items removed, conscious rejections moved
to PROJECT.md's ## Out of scope. Before finishing, re-read the emitted
DISCUSSION.md against this block; fix in place, or regenerate it —
at most once.

## Steps

1. Read `.potion/STATE.md` and `.potion/PROJECT.md`. Identify the target phase.
   If the phase's goal implies runtime-proof truths and `.potion/verify-env.md`
   is absent, ask the verify-env question now (recipe or `none-needed: <why>` —
   see `templates/verify-env.md`) and write the file; planning will refuse
   runtime truths without it. Done when: the target phase is named and
   `.potion/verify-env.md` exists (or is confirmed not required this phase).

2. **Find the decisions that actually matter.** Read any existing code the phase
   touches, and the ## Fog and ## Decision queue sections in STATE.md — fog
   items are candidate forks; surface the FULL Decision queue and force a call
   or a conscious renewal on every expired entry — and PROJECT.md's
   ## Out of scope ledger, which is settled: never re-litigate an entry there.
   Also scan every phases/*/RUNBOOK-*.md lacking its SUMMARY plus the target
   phase's DISCUSSION gates for entries whose expires date has passed; force a
   decide-renew-or-abandon call on each expired gate before the forks are
   discussed.
   List the 3-7 genuine forks in the road: UX shape, data
   model choices, integration points, tradeoffs with real consequences. Forks
   with a conventional answer you can defend in one sentence: decide them
   yourself — but every self-decided fork MUST appear in the Claude's
   Discretion bucket WITH the answer chosen. A decision that appears in no
   bucket is the defect.
   Enumerate external prerequisites the phase's work depends on — credentials,
   dashboard/console toggles, store accounts, physical devices. Tag each `hitl`
   (a human must act) or `afk` (agents can do it unattended), and record
   added + expires per the step-4 grammar; /potion:plan
   turns hitl-gated work into RUNBOOKs, never executable PLANs. Done when: the
   3-7 fork list is written out, every self-decided fork has its chosen answer
   noted, and every prerequisite carries a hitl/afk tag.

3. **Ask one question at a time**, per the question contract. Lead each with a
   recommendation and why. Push back when warranted — "This is wrong because…"
   beats "You might want to consider…". Do not pad the conversation. Done
   when: every fork from step 2 has a recorded answer bound for a bucket.

4. **Write `phases/NN-slug/DISCUSSION.md`** per the emission contract:

   ```yaml
   ---
   gates:
     - {gate: "<short name>", type: hitl | afk, unblocks: "<what work waits on this>", added: YYYY-MM-DD, expires: YYYY-MM-DD}
   ---
   ```

   Expiry is mandatory — no indefinite gates. A gate whose ETA is genuinely
   unknowable gets a review date capped at 14 days out. Expired gates are
   decided, renewed (one conscious line bumping expires), or abandoned —
   never silently carried.

   ```markdown
   ## Decisions            <!-- LOCKED. Re-litigating one downstream is a defect. -->
   - {decision} — {why}

   ## Claude's Discretion  <!-- genuinely free choices -->
   - {area} — {chosen approach}

   ## Deferred             <!-- explicitly out of scope for this phase -->
   - {idea} — {why deferred}
   ```

   Done when: the file exists at `phases/NN-slug/DISCUSSION.md` with all three
   bucket headers.

5. Update STATE.md (recent decisions, last activity). Remove every fog/queue
   item this discussion consumed (it now lives in a DISCUSSION bucket); move
   items the user consciously rejected to PROJECT.md's ## Out of scope with a
   one-line why — nothing evaporates, nothing zombies. Recent decisions
   entries use gist-and-link form (pointer to DISCUSSION.md, <=8-word gist).
   Commit. Done when: `git log -1 --oneline` shows
   `docs(potion): phase NN discussion`.

## Exit

Show the three buckets. Next up: `/potion:plan` — suggest `/clear` first;
DISCUSSION.md carries everything forward.
