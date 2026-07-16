---
name: discuss
description: Use before planning a phase — when the user says "discuss phase", "let's talk through the next phase", or when /potion:plan is requested but no DISCUSSION.md exists for the target phase.
---

# Potion Discuss

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Purpose: lock the user's decisions BEFORE planning, so no
downstream agent ever re-litigates them or sneaks in deferred scope.

## Steps

1. Read `.potion/STATE.md` and `.potion/PROJECT.md`. Identify the target phase.
   If the phase's goal implies runtime-proof truths and `.potion/verify-env.md`
   is absent, ask the verify-env question now (recipe or `none-needed: <why>` —
   see `templates/verify-env.md`) and write the file; planning will refuse
   runtime truths without it.

2. **Find the decisions that actually matter.** Read any existing code the phase
   touches, and the `## Parked` list in STATE.md — parked ideas are candidate
   forks for this phase. List the 3-7 genuine forks in the road: UX shape, data
   model choices, integration points, tradeoffs with real consequences. Forks
   with a conventional answer you can defend in one sentence: decide them
   yourself — but every self-decided fork MUST appear in the Claude's
   Discretion bucket WITH the answer chosen. A decision that appears in no
   bucket is the defect.
   Enumerate external prerequisites the phase's work depends on — credentials,
   dashboard/console toggles, store accounts, physical devices. Tag each `hitl`
   (a human must act) or `afk` (agents can do it unattended). These become the
   `gates:` frontmatter list in step 4; /potion:plan turns hitl-gated work into
   RUNBOOKs, never executable PLANs.

3. **Ask one question at a time**, per the question contract. Lead each with a
   recommendation and why. Push back when warranted — "This is wrong because…"
   beats "You might want to consider…". Stop when the fork list is exhausted;
   do not pad the conversation.

4. **Write `phases/NN-slug/DISCUSSION.md`** with three body sections (plus
   optional YAML frontmatter — omit the frontmatter entirely when the phase
   has no gates):

   ```yaml
   ---
   gates:
     - {gate: "<short name>", type: hitl | afk, unblocks: "<what work waits on this>"}
   ---
   ```

   ```markdown
   ## Decisions            <!-- LOCKED. Re-litigating one downstream is a defect. -->
   - {decision} — {why}

   ## Claude's Discretion  <!-- genuinely free choices -->
   - {area} — {chosen approach}

   ## Deferred             <!-- explicitly out of scope for this phase -->
   - {idea} — {why deferred}
   ```

   Every idea raised in conversation lands in one of the three buckets. Nothing
   evaporates.

5. Update STATE.md (recent decisions, last activity). Remove every parked
   item this discussion consumed from STATE.md's ## Parked (it now lives in a
   DISCUSSION bucket — nothing evaporates, nothing zombies). Commit:
   `docs(potion): phase NN discussion`.

## Exit

Show the three buckets. Next up: `/potion:plan` — suggest `/clear` first;
DISCUSSION.md carries everything forward.
