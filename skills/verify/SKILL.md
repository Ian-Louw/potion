---
name: verify
description: Use after executing a phase, or whenever work is about to be declared done — when the user says "verify", "potion verify", "audit the work", "did the agents actually do it", "is the phase actually done", or before shipping anything user-facing.
---

# Potion Verify

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. You are the ORCHESTRATOR of
verification, not the auditor — the static audit is done by a spawned verifier
who was deliberately told nothing about what the executors claimed. The prime
directive for everyone involved:

```
DO NOT TRUST SUMMARIES.
```

A SUMMARY.md documents what an agent SAID it did. Verification checks what
actually exists. Task completion ≠ goal achievement.

## The protocol — four steps, fixed ownership

**Step 1 — Deterministic checks (you).** Target phase: the explicit argument
if given; otherwise the current phase in STATE.md's Position. State which you
chose. Then run the project's mechanical verifiers:
test suite, build, type check, lint. Then run every `type:check` learning in
`.potion/learnings.jsonl` — those are ratchet locks. A check that MISMATCHES is
a regression; a check whose command ERRORS is `CHECK_BROKEN` → route to
/potion:learn for repair or tombstone, never report it as a regression.
Check runner contract: `cmd` runs via POSIX sh from the repo root. If
`expect` is `exit N`, compare the exit code; otherwise compare the
command's trimmed stdout to `expect` exactly. A nonzero exit with matching
stdout is still a MATCH — never add `|| true` to appease the runner. A
command that cannot execute at all (tool missing, path gone) is ERROR →
CHECK_BROKEN.

**Step 2 — Blind static ladder (spawned verifier).** Spawn an agent:
"First read ${CLAUDE_PLUGIN_ROOT}/core/CORE.md and
${CLAUDE_PLUGIN_ROOT}/agents/potion-verifier.md. Audit phase {NN-slug} of
{repo path}." + the phase's must_haves inlined + relevant locked decisions.
Do NOT tell it what the executors claimed or what step 1 found. It writes the
ladder results into VERIFICATION.md and returns truth statuses:
`STATIC_ONLY | FAILED | HUMAN_NEEDED` (vocabulary is closed — no invented
statuses). VERIFIED is assigned only in step 3.

**Step 3 — Runtime evidence (you).** Freshness precondition:
before judging behavior, confirm the running process serves HEAD — after
any code change, reload or rebuild first (e.g. one dev-menu reload for
Metro). Evidence gathered against a stale bundle is not evidence.
Every STATIC_ONLY truth gets a live pass:
start the app/tool yourself (if Claude can run it, Claude runs it) and exercise
the truth. Where a browser tool exists use the diff pattern: snapshot → act →
snapshot-diff — a state diff is proof, a claim is not. Proof artifacts
land in `phases/NN-slug/evidence/` named `{plan-or-cycle}-{slug}.{ext}`
(e.g. `03-share-flow.png`, `cycle2-t7-logcat.txt`); VERIFICATION.md's
Runtime evidence column references them by path — a path is checkable, a
claim is not. For CLI/library/pipeline
projects, the equivalent: one real invocation / import-and-call in a scratch
script. Also cross-check each SUMMARY's task→commit table against `git log`
— "do not trust summaries" includes their hashes. Truths you genuinely cannot
check become HUMAN_NEEDED with: what to test, expected result, why it needs a
human — batched into ONE checkpoint at the end (verification fatigue is real).

**Step 4 — Verdict (you).**

**Harvest before verdict (pass only).** On a pass verdict, distill the phase
before it goes cold: sweep the phase's SUMMARY Deviations and Concerns, the
verifier's ladder/panel reasoning in VERIFICATION.md, and any .potion/debug/
files closed during the phase. Log what clears the 5-minute bar as ordinary
learnings (files field pointing at the source artifact), max 5 entries —
distillation, not transcription. Grep learnings.jsonl for existing keys
first: harvest only what fell through during the phase, never re-log. Zero
new entries is a valid outcome — say so explicitly. Qualifying entries then
ride the normal promote-up bar (CORE: Cross-repo knowledge).

VERIFICATION.md's verdict is `pass` ONLY when every
truth is VERIFIED, or is HUMAN_NEEDED and the user has acknowledged it this
cycle. STATIC_ONLY is never a final state — it is your unfinished step 3.
Set `verified_at` by running `date -Iseconds` and pasting the output — never
type a timestamp from memory (a hand-written one has already tripped the
ship gate once).

## Report

Update `phases/NN-slug/VERIFICATION.md` from
`${CLAUDE_PLUGIN_ROOT}/templates/VERIFICATION.md` — mandatory frontmatter:
`verdict`, `verified_at` (ISO datetime), `cycle` (increment on each pass),
`gaps` (truth / status / reason / missing), `accepted` (user-acknowledged gaps).

## The gap flywheel

Gaps found → `/potion:plan` (gaps mode) writes fix plans continuing the phase's
plan numbering → `/potion:execute` runs them → re-verify: failed items get the
full protocol, previously-passed items get a quick regression check. Report
`gaps_closed / gaps_remaining / regressions`.

**Loop budget: 3 cycles**, tracked by the `cycle` field (the counter must live
on disk — sessions `/clear` between steps). If gaps survive cycle 3, stop:
this is a wrong-approach problem, not a persistence problem. Escalate with the
surviving gaps and what was tried. Unbounded retry is automating drift.

**Hot-loop exception (expensive environments).** When reproducing or
re-verifying a gap requires costly environment setup — an emulator boot, a
device, a slow service — ONE agent may run the full gap cycle
(investigate → gap plan → fix → re-verify) inside a single environment
session instead of four separate spawns. The books stay honest: the debug
file, gap PLAN, SUMMARY, evidence, and learnings must all land on disk
exactly as the separated protocol would produce them, and cleanup rules
still apply. This trades blind separation for environment economy — use it
only when setup cost genuinely dominates.

**Quick tier (native apps).** Bundling cannot see runtime-only failures
(an undeclared native dependency red-screens the app while `expo export`
passes). After any dependency change, run a cheap boot-and-smoke check
(app reaches its first screen) early — don't wait for the full drive to
discover the app doesn't start. The boot-and-smoke check only counts if the
booted bundle is HEAD — reload after changes before judging. The quick tier supplements the protocol;
a phase verdict still requires the full four steps once per cycle.

## Red flags

| Thought | Reality |
|---|---|
| "The summaries all say done" | That's why this skill exists. Check the disk. |
| "I watched the workers succeed, this is a formality" | You're anchored. That's why the ladder is spawned blind. |
| "Tests pass, ship it" | Tests prove tests. Truths are user-observable — exercise the flow. |
| "STATIC_ONLY is basically verified" | It's your step 3 todo list, not a verdict. |
| "The check entry fails but it's probably the check's fault" | ERROR vs MISMATCH is a mechanical distinction. Make it, don't guess it. |

## Exit

Verdict per truth, gap count, evidence collected. Route non-gap findings —
your own judgment calls and the blind verifier's non-blocking observations —
into STATE.md's ## Parked, one line each, tagged `from cycle-N verifier`.
Nothing evaporates. Clean → `/potion:ship`.
Gaps → `/potion:plan` gaps mode (mention the cycle number).
