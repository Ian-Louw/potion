---
name: init
description: Use when starting Potion on a project for the first time — when the user says "potion init", "set up potion", or asks to start a new project with the Potion workflow and no .potion/ directory exists yet.
---

# Potion Init

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Creates the project's durable memory.

## Guards

- Not a git repository → offer `git init` (Potion requires git; commits are its
  ground truth). Declined → stop with the explanation.
- `.potion/` exists with unchecked phases → stop: "Potion is already
  initialized. Use /potion:resume to pick up, or /potion:discuss for the next
  phase."
- `.potion/` exists with ALL phases checked off → this is a new cycle, not an
  error. New-cycle procedure:
  1. Interview for the next batch of requirements (step 2 as written).
  2. Propose new phases numbered CONTINUING from the highest existing phase
     number (6 phases done → next is 07).
  3. APPEND them to PROJECT.md's `## Phases` — never rewrite PROJECT.md,
     never touch Key decisions or Out of scope.
  4. Update STATE.md position to the first new phase and create its
     `phases/NN-slug/` directory.
  5. Run step 6's commit.

## Steps

1. **Understand the project.** If the repo has code, spend a few minutes mapping it
   (stack, entry points, conventions) — do not launch a research pipeline; one pass
   is enough. If it's empty, this is greenfield.

2. **Interview — one question at a time**, per the question contract. You need:
   - What is this? (2-3 sentences)
   - The core value — the single thing that must work.
   - 3-7 active requirements as user-observable truths.
   - What is explicitly out of scope, and why.
   Stop asking as soon as you can write a PROJECT.md the user would sign.
   If the user asks whether the idea is worth building, be direct — interest
   is not demand; behavior counts, money counts. Unsolicited, keep it to one
   sentence at most.

3. **Propose phases.** Break active requirements into 2-6 phases, each with a goal
   stated as an outcome ("users can authenticate") not an activity ("build auth").
   Present the list, adjust once, lock it.

4. **Write the state** from `${CLAUDE_PLUGIN_ROOT}/templates/`:
   - `.potion/PROJECT.md` — filled template, phases appended as a `## Phases` list
     with checkboxes.
   - `.potion/STATE.md` — position: Phase 1, no plans yet, status: planning.
   - `.potion/phases/01-{slug}/` — empty directory for the first phase.

5. **Housekeeping:** append `.potion/learnings.jsonl merge=union` to
   `.gitattributes` (append-only files merge sanely across branches).

6. **Commit:** `chore(potion): initialize project memory`.

## Exit

Report what was created and the phase list. Next up: `/potion:discuss` for the
next unchecked phase.
