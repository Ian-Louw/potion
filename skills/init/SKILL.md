---
name: init
description: Use when starting Potion on a project for the first time — when the user says "potion init", "set up potion", or asks to start a new project with the Potion workflow and no .potion/ directory exists yet.
---

# Potion Init

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. Creates the project's durable memory.

**Emission contract — all of these exist before exit:** `.potion/PROJECT.md`
(goals, Key Decisions, Out of Scope, `## Phases` checklist);
`.potion/STATE.md` (position: phase 1); `.potion/verify-env.md` (recipe or
`none-needed: <why>` — never absent); `.potion/phases/01-{slug}/` directory;
the `merge=union` line in `.gitattributes`; the `verify-env.local` line in
`.gitignore`; the installed repo-side pre-commit hook (`.git/hooks/pre-commit`
shim + `.potion/scripts/pre-commit.js`, or a surfaced refusal); the init
commit. Before finishing, re-read the emitted files
against this block; fix in place, or regenerate —
at most once.

## Guards

- Not a git repository → offer `git init` (Potion requires git; commits are its
  ground truth). Declined → stop with the explanation.
- `.potion/` exists with unchecked phases → stop: "Potion is already
  initialized. Use /potion:resume to pick up, or /potion:discuss for the next
  phase."
- `.potion/` exists with ALL phases checked off → this is a new cycle, not an
  error. New-cycle procedure:
  1. Interview for the next batch of requirements (step 2 as written,
     including the verify-env question if `.potion/verify-env.md` is absent).
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
   is enough. If it's empty, this is greenfield. Done when: you can state
   stack + entry points in two lines (or "greenfield").

2. **Interview — one question at a time**, per the question contract. You need:
   - What is this? (2-3 sentences)
   - The core value — the single thing that must work.
   - 3-7 active requirements as user-observable truths.
   - What is explicitly out of scope, and why.
   - How does a verifier get a live runtime session? (test account / seed
     command / emulator recipe — or explicitly nothing: a no-auth CLI needs
     only `none-needed: <why>`.)
   Done when: every bullet above has an answer you could paste into
   PROJECT.md — then stop asking.
   If the user asks whether the idea is worth building, be direct — interest
   is not demand; behavior counts, money counts. Unsolicited, keep it to one
   sentence at most.

3. **Propose phases.** Break active requirements into 2-6 phases, each with a goal
   stated as an outcome ("users can authenticate") not an activity ("build auth").
   Present the list, adjust once, lock it. Done when: the user has approved
   the phase list.

4. **Write the state** from `${CLAUDE_PLUGIN_ROOT}/templates/`:
   - `.potion/PROJECT.md` — filled template, phases appended as a `## Phases` list
     with checkboxes.
   - `.potion/STATE.md` — position: Phase 1, no plans yet, status: planning.
   - `.potion/verify-env.md` — from `templates/verify-env.md`, filled with the
     interview answer (recipe or `none-needed: <why>`).
   - `.potion/phases/01-{slug}/` — empty directory for the first phase.
   Done when: all four paths exist on disk.

5. **Housekeeping:** append `.potion/learnings.jsonl merge=union` to
   `.gitattributes` (append-only files merge sanely across branches). Append
   `.potion/verify-env.local` to `.gitignore` (create `.gitignore` if absent)
   — one line, with the comment "secret values for the runtime session recipe".
   Install the repo-side hooks: run
   `sh "${CLAUDE_PLUGIN_ROOT}/scripts/install-repo-hooks.sh"` from the repo
   root (installs the pre-commit secret mirror + ci-verify copy into
   `.potion/scripts/`). If it refuses over an existing pre-commit hook,
   surface the refusal to the human and ask before re-running with --force —
   never force unprompted. Then offer CI adoption as ONE question: copy
   `${CLAUDE_PLUGIN_ROOT}/templates/ci.yml` to
   `.github/workflows/potion-verify.yml`? (Mechanical verify on push/PR; no
   key needed.) Skip silently only if the user already declined CI.
   Done when: `grep merge=union .gitattributes` and
   `grep verify-env.local .gitignore` each print one line, and the installer
   reported the pre-commit shim installed (or its refusal was surfaced).

6. **Commit.** Done when: `git log -1 --oneline` shows
   `chore(potion): initialize project memory`.

## Exit

Report what was created and the phase list. Next up: `/potion:discuss` for the
next unchecked phase.
