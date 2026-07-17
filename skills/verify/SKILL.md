---
name: verify
description: Use after executing a phase, or whenever work is about to be declared done — when the user says "verify", "potion verify", "audit the work", "did the agents actually do it", "is the phase actually done", or before shipping anything user-facing.
---

# Potion Verify

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. You are the ORCHESTRATOR of
verification, not the auditor — the static audit is a spawned verifier told
nothing of executor claims. Prime directive: **DO NOT TRUST SUMMARIES** — a
SUMMARY documents what an agent SAID; verification checks what exists. Task
completion ≠ goal achievement.

**Verdict contract (must hold in the emitted VERIFICATION.md):**
- Closed truth vocabulary: `VERIFIED | STATIC_ONLY | FAILED |
  COULD_NOT_CHECK(reason) | HUMAN_NEEDED`. STATIC_ONLY is never final;
  only your runtime step promotes a truth to VERIFIED.
- Verdict `pass` ONLY when every truth is VERIFIED, HUMAN_NEEDED
  acknowledged this cycle, or COULD_NOT_CHECK converted by the user this
  cycle — an unconverted COULD_NOT_CHECK can never pass.
- `verified_at` from fresh `date -Iseconds` — a hand-typed timestamp has
  tripped the ship gate once already.
- Runtime proof is an evidence path, not a claim.
Before finishing, re-read the emitted VERIFICATION.md against this block;
fix in place, or regenerate it — at most once.

## The protocol — four steps, fixed ownership

**Step 1 — Deterministic checks (you).** Target phase: the explicit argument
if given, else the current phase in STATE.md's Position — state which.
Preflight (before anything expensive): build green? test runner present?
`.potion/verify-env.md` present, recipe satisfiable for this phase's runtime
truths? Record results in VERIFICATION.md's ## Preflight table. A runtime
truth whose env check fails is COULD_NOT_CHECK(reason) NOW — do not spawn
tools or burn a live attempt to rediscover it. verify-env MISSING entirely →
stop; that's a /potion:discuss defect (declaration-required). Then run the
project's mechanical verifiers: test suite, build, type check, lint. Then
every `type:check` learning in `.potion/learnings.jsonl` — ratchet locks. A
check that MISMATCHES is a regression; a check whose command ERRORS is
`CHECK_BROKEN` → route to /potion:learn for repair or tombstone, never
report it as a regression. A check keyed `witness-*` that MISMATCHES gets
one repo-wide grep for its marker: found elsewhere = DRIFT (route to
/potion:learn to re-pin), absent = REGRESSION — lead with it.
Check runner contract: per CORE.md — MATCH on
stdout/exit, CHECK_BROKEN on ERROR; never add `|| true`.

**Step 2 — Blind static ladder (spawned verifier).** Spawn an agent: "First
read ${CLAUDE_PLUGIN_ROOT}/core/CORE.md and
${CLAUDE_PLUGIN_ROOT}/agents/potion-verifier.md. Audit phase {NN-slug} of
{repo path}." + the phase's must_haves inlined + relevant locked decisions
+ the phase's `<spec_deltas>` requirement IDs and scenario text
(delta-scoped: touched requirements only).
Do NOT tell it what the executors claimed or what step 1 found. Done when its
ladder results sit in VERIFICATION.md with statuses from `STATIC_ONLY |
FAILED | HUMAN_NEEDED` only.

**Step 3 — Runtime evidence (you).** Freshness first: confirm the running
process serves HEAD — reload/rebuild after any code change (e.g. one dev-menu
reload for Metro); stale-bundle evidence is not evidence. Every STATIC_ONLY
truth gets a live pass: start the app/tool yourself (if Claude can run it,
Claude runs it) and exercise the truth. Where a browser tool exists, diff
pattern: snapshot → act → snapshot-diff — a state diff is proof, a claim is
not. Proof artifacts land in `phases/NN-slug/evidence/` named
`{plan-or-cycle}-{slug}.{ext}` (e.g. `03-share-flow.png`,
`cycle2-t7-logcat.txt`); VERIFICATION.md's Runtime evidence column references
them by path — a path is checkable, a claim is not. CLI/library/pipeline
equivalent: one real invocation / import-and-call in a scratch script.
Cross-check each SUMMARY's task→commit table against `git log` — "do not
trust summaries" includes their hashes. Use the verify-env recipe for live
sessions. A truth blocked ENVIRONMENTALLY (closed reasons per CORE.md) is
COULD_NOT_CHECK(reason). A truth only a human can attest BY NATURE is
HUMAN_NEEDED with: what to test, expected result, why. Batch both kinds into
ONE checkpoint at the end (verification fatigue is real).

**Step 4 — Verdict (you).**

**Harvest before verdict (pass only).** Distill the phase before it goes
cold: sweep the phase's SUMMARY Deviations and Concerns, the verifier's
ladder/panel reasoning in VERIFICATION.md, and any .potion/debug/ files
closed during the phase. Log what clears the 5-minute bar as ordinary
learnings (files field → source artifact), max 5 entries — distillation, not
transcription. Grep learnings.jsonl for existing keys first: never re-log.
Zero new entries is a valid outcome — say so explicitly. Qualifying entries
ride the normal promote-up bar (CORE: Cross-repo knowledge).

**Witnesses.** When promoting a gap-fix or a truth whose proof is a
distinctive code marker, append a `type:check` witness — key
`witness-{phase}-{slug}`, cmd a grep for the marker, expect its output.
A few per phase, judgment yours.

Fill verdict + `verified_at` per the contract block above. A conversion
lands in `accepted` with reason + why + date; before asking for one, fix
the environment or ask the human, in that order.

## Report

Update `phases/NN-slug/VERIFICATION.md` from
`${CLAUDE_PLUGIN_ROOT}/templates/VERIFICATION.md` — mandatory frontmatter:
`verdict`, `verified_at` (ISO datetime), `cycle` (increment on each pass),
`gaps` (truth / status / reason / missing), `accepted` (user-acknowledged gaps).

**Evidence index.** After filling VERIFICATION.md, (re)generate the index
on every verdict: `sh ${CLAUDE_PLUGIN_ROOT}/scripts/gen-evidence-index.sh
phases/{NN-slug}/evidence` — a regenerable cache; hand-editing is a defect.
Uncited artifacts (Truths `-`) and DUPLICATE lines are findings.

## The gap flywheel

Gaps found → `/potion:plan` (gaps mode) writes fix plans continuing the phase's
plan numbering → `/potion:execute` runs them → re-verify: failed items get the
full protocol, previously-passed items get a quick regression check. Report
`gaps_closed / gaps_remaining / regressions`.

**Loop budget: 3 cycles**, tracked by the `cycle` field (the counter must live
on disk — sessions `/clear` between steps). If gaps survive cycle 3, stop:
this is a wrong-approach problem, not a persistence problem. Escalate with the
surviving gaps and what was tried. Unbounded retry is automating drift.

**Hot-loop exception.** When a gap's repro needs costly environment setup
(emulator boot, device, slow service), ONE agent may run the full gap cycle
(investigate → gap plan → fix → re-verify) in a single environment session
instead of four spawns. The books stay honest: debug file, gap PLAN, SUMMARY,
evidence, and learnings land on disk exactly as the separated protocol would
produce them. Use only when setup cost genuinely dominates.

**Quick tier (native apps).** Bundling cannot see runtime-only failures (an
undeclared native dependency red-screens the app while `expo export` passes).
After any dependency change, run a cheap boot-and-smoke check early — app
reaches its first screen, booted bundle = HEAD. Supplements the protocol; a
phase verdict still requires the full four steps once per cycle.

## Red flags

| Thought | Reality |
|---|---|
| "The summaries all say done" | That's why this skill exists. Check the disk. |
| "I watched the workers succeed, this is a formality" | You're anchored. That's why the ladder is spawned blind. |
| "Tests pass, ship it" | Tests prove tests. Truths are user-observable — exercise the flow. |
| "STATIC_ONLY is basically verified" | It's your step 3 todo list, not a verdict. |
| "I can't check it, so HUMAN_NEEDED" | Nature or circumstance? An auth wall is COULD_NOT_CHECK(auth-wall) — and it blocks pass until converted. |
| "The check entry fails but it's probably the check's fault" | ERROR vs MISMATCH is a mechanical distinction. Make it, don't guess it. |

## Exit

Verdict per truth, gap count, evidence collected. Route non-gap findings —
your own judgment calls and the blind verifier's non-blocking observations —
into STATE.md's ## Fog, one line each, tagged `from cycle-N verifier` —
blocking human calls go to ## Decision queue with added/expires dates instead.
Nothing evaporates. Clean → `/potion:ship`. Gaps → `/potion:plan` gaps mode
(mention the cycle number).
