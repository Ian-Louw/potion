---
plan: "{NN}"
phase: "{NN-slug}"
wave: 1                      # max(wave of dependencies) + 1; wave 1 = no deps
depends_on: []               # plan numbers this plan needs completed first
files_modified: []           # exclusive ownership — no other same-wave plan may touch these
escalations: []              # optional — grant names from .potion/escalations.md this plan's tasks invoke; a name absent or expired there is a plan-time defect
must_haves:
  truths:                    # 3-7 user-observable statements, true when done
    - "{User can … / The app … }"
  artifacts:                 # what must exist
    - path: "{src/…}"
      provides: "{what it contributes}"
  key_links:                 # what must be wired — where 80% of stubs hide
    - from: "{caller}"
      to: "{callee}"
      via: "{import / fetch / handler}"
---

<objective>
{One paragraph. What this plan achieves and why it matters to the phase goal.}
</objective>

<context>
{EVERYTHING the executor needs, inlined. This plan is the only thing the
worker is guaranteed to read — paste the content that matters rather than
referencing other docs. The executor has zero context and questionable taste.

Two tiers, clearly separated:
- LOCKED (product decisions from DISCUSSION.md): scope, UX shape, architecture
  choices. Re-litigating one is a defect; changing one is Rule 4.
- TECHNICAL NOTES (the planner's best current understanding): API names, exact
  signatures, config details. Installed typings and versioned docs WIN over
  these — a worker correcting a wrong technical note is a Rule 1 deviation,
  recorded in the SUMMARY, never a Rule 4 stop.}
</context>

<tasks>
<task n="1">
files: {exact paths}
action: {specific enough that a different Claude instance could do it without
         asking a single question. No "TBD", no "appropriate error handling",
         no "similar to task N" — those are plan failures.}
verify: {command to run + expected result}
done: {user-observable definition of done}
</task>

<task n="2">
…
</task>
<!-- 2-3 tasks max. Each 15-60 minutes of agent time. More tasks = new plan. -->
</tasks>

<spec_deltas>
capability: {slug}                     # targets .potion/specs/{slug}/spec.md
purpose: {one line}                    # REQUIRED only when the spec file doesn't exist yet
ADDED:
### Requirement: {id} — {statement}
- GIVEN …
- WHEN …
- THEN …
MODIFIED:
### Requirement: {existing-id} — {statement}
{full replacement block}
REMOVED: {id}
RENAMED: {old-id} -> {new-id}
</spec_deltas>
<!-- Optional section. Ops optional, any subset/order; multiple `capability:`
blocks allowed. The <spec_deltas> markers must start at column 0 — the merge
script ignores indented occurrences (documentation examples). ADDED/MODIFIED
carry FULL requirement blocks (header + scenarios) — the merge is textual,
never interpretive. Omit the section entirely when the plan changes no specced
behavior. -->

<verification>
{How the executor proves the must_haves before writing SUMMARY:
commands to run, outputs to expect, flows to exercise.}
</verification>
