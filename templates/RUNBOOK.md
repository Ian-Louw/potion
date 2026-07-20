---
plan: "{NN}"
phase: "{NN-slug}"
type: runbook
wave: 1                      # max(wave of dependencies) + 1; wave 1 = no deps
depends_on: []               # plan/runbook numbers this runbook needs completed first
gate: "{the hitl gate this clears, from DISCUSSION.md gates}"
expires: "{YYYY-MM-DD — copied from the gate's DISCUSSION entry}"
---

<!-- Executed by a HUMAN. Potion's role: present steps, run done_when checks,
     write SUMMARY-{NN} (type: runbook) when all steps are confirmed.
     Never spawn a worker on a runbook. -->

## Steps

Each step is one human action. `done_when` is either a mechanical check
(`cmd` + `expect`, per CORE.md's check-runner contract — cmd runs via POSIX sh
from the repo root) or `human-attest — {what the human confirms they saw}`
when no command can prove it.

### {N}. {imperative step title}
do: {exact human action — console URL, menu path, command to paste}
done_when: {cmd + expect, per CORE.md's check-runner contract}   <!-- OR -->
done_when: human-attest — {exactly what the human confirms they saw}

### 1. Set the cron secret (worked example — mechanical)
do: In the Supabase dashboard → Project Settings → Edge Functions → Secrets,
    add `CRON_SECRET` with the value from the password manager entry "cron".
done_when: cmd: supabase secrets list | grep CRON_SECRET
           expect: exit 0

### 2. Submit the app for review (worked example — human-attest)
do: In the Play Console → Production → Create new release, upload the signed
    bundle and click "Send for review".
done_when: human-attest — the Play Console shows the app in 'In review'.

## Completion

All steps confirmed → write SUMMARY-{NN}.md with `type: runbook` frontmatter
listing per-step results (mechanical vs human-attested). The SUMMARY's
existence is the completion record.
