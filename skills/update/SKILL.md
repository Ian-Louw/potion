---
name: update
description: Use when an installed repo's .potion grammar lags the current templates — when the user says "potion update", "migrate this repo", "upgrade potion grammar", or when a POTION GRAMMAR DRIFT notice appears at session start / resume.
---

# Potion Update

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`.

This is the ONLY mutating grammar-migration entry point. Other surfaces
(resume, session-start) may notice drift and point here — notice lives
elsewhere, mutation lives here. Migrations are idempotent detector+transform
pairs keyed on CURRENT REPO STATE, never version-chain bookkeeping: field
repos skip many versions, so state decides, not history. All detector
commands are POSIX sh, run from the TARGET repo root (the repo being
migrated, not the plugin repo).

## Migration table (v1)

1. **M1 verify-env** — detect: `test -f .potion/verify-env.md` fails.
   Transform: ask the human the verify-env question (session recipe or
   `none-needed: <why>`, shapes per
   `${CLAUDE_PLUGIN_ROOT}/templates/verify-env.md`) and write the FILLED
   file — the human is present; this skill is human-invoked. If the human
   defers, write the template stub verbatim and flag loudly in the exit
   report that planners will refuse runtime-proof truths until it is
   declared.
2. **M2 three-bucket STATE** — detect: `grep -q '^## Fog' .potion/STATE.md`
   or `grep -q '^## Decision queue' .potion/STATE.md` fails. Transform: insert the missing empty section(s),
   each with its one-line HTML comment from
   `${CLAUDE_PLUGIN_ROOT}/templates/STATE.md`, after `## Blockers` (Fog
   first, then Decision queue). Never touch existing sections. A legacy
   `## Parked` section stays in place for the interactive pass — NEVER
   migrated mechanically.
3. **M3 specs bootstrap** — detect: `test -d .potion/specs` fails.
   Transform: create `.potion/specs/` containing a 3-line README.md:
   current-truth statement, format pointer to potion's templates/spec.md,
   "mutated only by merge-specs.sh on ship, or a human".
4. **M4 repo-side hooks** — detect: `test -f .potion/scripts/pre-commit.js`
   fails, OR it passes but `.git/hooks/pre-commit` does not exist at all.
   Transform: run
   `sh "${CLAUDE_PLUGIN_ROOT}/scripts/install-repo-hooks.sh"` from the
   target repo root. On its refusal (existing foreign hook): surface the
   refusal verbatim, ask the human, re-run with --force ONLY on their
   explicit word — never force unprompted. Mirror installed + foreign hook
   still in place is the signature of a declined force — a STANDING human
   decision, not a pending migration: the detector reports current, the
   report notes "foreign hook kept (standing decision)", and the offer is
   repeated only when the human raises it. This keeps re-runs convergent
   and matches the session-start drift leg, which keys on the mirror file
   only.
5. **M5 housekeeping lines** — detect: `grep -q merge=union .gitattributes`
   or `grep -q verify-env.local .gitignore` fails. Transform: append the
   missing line(s) exactly as init step 5 writes them (create the file if
   absent).
6. **M6 escalations registry** — OFFER, not a transform. Detect:
   `test -f .potion/escalations.md` fails. One question: does this repo
   want the sanctioned-mutation registry? Point at potion's
   `templates/escalations.md` as ready-to-paste. NEVER write the file —
   only a human edits it. Declined or deferred → note in the report,
   nothing else.

CI adoption is deliberately not in the v1 list — init covers new repos.

## Steps

1. **Preflight.** Confirm this is a git repo and `.potion/` exists — if not,
   stop: /potion:init is the right door. Require
   `git status --porcelain .potion/` clean — uncommitted .potion state →
   stop and show the user; never migrate over a dirty state dir. Run ALL
   detectors and present the report: each M# marked APPLIES or current,
   plus whether `## Parked` exists in STATE.md (T1). Done when: the human
   has seen the report and said go.
2. **Mechanical pass.** Apply every firing transform among M1–M5. Commit
   ALL of it as ONE summary commit —
   `chore(potion): update — grammar migrations (M1 M2 …)`
   — listing the applied migration ids. Each migration whose detector
   reports current is skipped independently. If all detectors report
   current: say "grammar current — nothing to migrate", make NO commit,
   continue. Done when: the commit exists (or was correctly skipped) and a
   re-run of every detector reports current.
3. **Interactive triage (T1)** — only if `## Parked` exists in STATE.md.
   Walk the items one at a time per the question contract, each with a
   recommendation + why. Route per the human's call — the machine never
   assigns a disposition:
   - **Fog** (STATE.md, cap 6, one line, tagged with source)
   - **Decision queue** (STATE.md, cap 5, with added + expires dates)
   - **Out of scope** (PROJECT.md ledger, with the one-line why)
   - **gap** — append to the current phase's VERIFICATION.md `gaps:`
     frontmatter if one exists; else write it to Fog tagged `[defect]` at
     line start (the promotion doctrine guarantees it cannot rot there).
   A route that would breach a cap: surface the cap, ask which existing
   item it displaces or pick another route — never exceed silently. When
   the section is empty, delete the `## Parked` header + its comment.
   Commit once: `chore(potion): update — parked triage`. Done when: no
   `## Parked` remains and the triage commit exists.
4. **Escalations offer (M6) + exit report.** Run the M6 offer, then report:
   applied vs skipped table, any surfaced refusals, verify-env status,
   triage tally. Update STATE.md's Last activity line as part of whichever
   commit lands last. Done when: the report is on screen.

## Red flags

| Thought | Reality |
|---|---|
| "The Parked items are obvious, I'll route them myself" | That guessing is F-21 — the failure this lane exists to kill. Every item gets a human call. |
| "The repo is only missing one thing, skip the report" | The report IS the contract. It costs 10 seconds. |
| "I'll fix the app's code while I'm here" | Update touches .potion/ grammar and repo hooks only. |
