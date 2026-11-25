---
name: doctor
description: Use when potion seems off or before a long unattended run — when the user says "potion doctor", "check potion", "is potion set up right", "why didn't the hook fire", or when a POTION GRAMMAR DRIFT notice points here. Read-only.
---

# Potion Doctor

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. One preflight for the repo and
the install: every check in one place, nothing changed on disk.

## Steps

1. From the target repo's root, run:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js
   ```

   (`--repo <path>` checks another repo.) Exit 1 means at least one FAIL —
   that is a finding, not a tool error. Done when: a `RESULT` line printed.

2. **Show the output verbatim** — every `OK|WARN|FAIL <id> — <detail>` line
   and the `RESULT` line, in a code block. Never summarize a line away.
   Done when: the user can see the full output.

3. For each WARN or FAIL, give the one fixing command from the table. An id
   printed twice gets one row. Done when: every non-OK line has its fix
   beside it.

   | id | Fix |
   |---|---|
   | `potion-dir` | `/potion:init` — this repo has no `.potion/STATE.md` |
   | `plugin-version` | reinstall or update the plugin so the install record matches the source |
   | `hooks-registered` | restore the missing hook file under `${CLAUDE_PLUGIN_ROOT}/hooks/`, or reinstall the plugin |
   | `state-caps` | trim STATE.md to gist-and-link form (≤60 lines, ≤12000 bytes) |
   | `state-phase` | rewrite the Phase line as `- Phase: N of M — NN-slug` |
   | `grammar` | `/potion:update` |
   | `repo-mirror` | `sh ${CLAUDE_PLUGIN_ROOT}/scripts/install-repo-hooks.sh` |
   | `escalations` | the human decides or renews each expired escalation |
   | `decision-queue` | the human decides or renews each expired entry |
   | `phase-artifacts` | stale draft: the human confirms, then deletes it; orphan SUMMARY: check its number against the plans |
   | `permission-mode` | start the session in a mode other than bypass before an agent loop |
   | `check errored` (any id) | report the message as-is; a broken check is a potion bug |

## Rule

Doctor never fixes anything itself. It reports; the human or the named skill
acts. No edits, no commits, no installs from this skill — even when the fix
is one command and obviously right.

## Exit

One line: the `RESULT` line, plus the first fix to run (or "all clear").
