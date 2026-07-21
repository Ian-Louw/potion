# Changelog

> Potion is developed in a private potion-managed working repo (the ultimate
> dogfood). Commit hashes and evidence paths cited below refer to that repo's
> history; this public repo carries one clean commit per release.

## 1.15.0 — 2026-07-21

The verify-burrs release: cycle 3 closes. Evidence files can no longer bloat
or collide (256 KB hook block + write-time gitignore probe), staleness is now
a mechanical SHA comparison instead of a hand-adjacent timestamp, and the
five Tier-3 craft lines from the field-evidence doc land in the files that
execute them. Verified in one cycle: 12/12 truths + 5/5 spec scenarios
runtime-verified, 11/11 artifacts through the blind ladder, 0 gaps — and the
new SHA gate's first live use was gating this very ship.

### Evidence hygiene (Tier-1 #7, F-22/32)
- scrub-commit.js gains a size leg: a changed `.potion/` file over 256 KB
  blocks the in-session commit with a trim instruction, exactly like a
  secret hit — override is the human committing manually; `.potion/`-scoped,
  every error path fails open (8cb59f8; 4-case fixture matrix 9ecc089;
  summary 0355b88; merged 2c59905; specs `evidence-hygiene/
  size-cap-blocks-commit`, `size-cap-scope-and-failure`).
- Prompt-side half: execute and verify check `git check-ignore -q` on the
  chosen evidence filename before writing and trim raw logs to the relevant
  window (197099d; spec `evidence-hygiene/gitignore-collision-check`).

### Tested-SHA pinning (Tier-1 #8, F-31)
- VERIFICATION.md frontmatter gains `tested_sha`, recorded mechanically via
  `git rev-parse HEAD` at verify time; `verified_at` is demoted to
  human-readable context (00d2255; summary 8887de6; merged 31ee5b3; spec
  `sha-pinning/verification-records-tested-sha`).
- Ship's staleness gate is now `git log {tested_sha}..HEAD -- .
  ':(exclude).potion'` — any non-.potion commit after the tested SHA means
  stale; docs-only commits are exempt by construction; a missing field is
  treated as stale outright (c73ae0b; fixture matrix e51d1e4; spec
  `sha-pinning/ship-staleness-compares-sha`).

### Tier-3 craft sweep + fog folds
- The five craft lines, each in its executing file: dual-grammar bridge
  (init+discuss, F-34), test-idiom capture (verify, F-40),
  checkpoint-decision provenance (continue-here template, F-36), dirty-tree
  honesty (pause, F-17), independent-ship rule (plan+ship, F-37) — all skill
  caps held, verify and plan at exactly 150 (d7a03b6).
- Three fog folds: RUNBOOK `expires` must render a literal date, escalations
  note that a grant padded inside its quotes fails closed, plan's escalation
  preflight states its resume mechanics (af00b8d; craft-grep matrix +
  live check-ignore probe 9c90b9d).

### Phase record
- Discussion 420cf60, plans 85a1c8b, wave-1 position e2304cd, plan-03
  summary aeb637a, phase complete b63a09c, this release commit.
- Verification: cycle-1 pass — blind ladder clean, orchestrator re-proved
  size cap and SHA gate on fresh fixtures, 3 new phase-21 witnesses
  (ci-verify 25/25), 0 new ordinary learnings (d07087d); spec merge b68ccad.
- Housekeeping: M4 grammar migration applied to this repo via the phase-20
  update lane (d0abe4b).

## 1.14.0 — 2026-07-21

The distribution release: shipped mechanisms now reach already-installed
repos. A dedicated `/potion:update` skill diffs a repo's `.potion` grammar
against current templates and applies migrations mechanically — one summary
commit, idempotent, no-clobber honored, every judgment call routed to a
human. Session start and `/potion:resume` surface grammar drift as a
warn-only notice pointing at the update lane, and observed defects get a
write-time `- [defect]` tag that verify/discuss/plan promote mechanically
instead of letting them rot in Fog. Verified in one cycle: 15/15 truths
runtime-verified, 12/12 artifacts through the blind ladder, 0 gaps — and
proven live by migrating partner-repo, a real installed repo.

### Update lane (new skill)
- `/potion:update` — the dedicated, human-invoked grammar-migration entry
  point: state-keyed M1–M6 detector+transform table (verify-env, three-bucket
  STATE, specs bootstrap, repo-side hooks, housekeeping lines, escalations
  offer-never-write) and a four-step flow: preflight report → go →
  one-summary-commit mechanical pass → one-at-a-time Parked triage → offer +
  exit report (6a0f4b1; detectors tightened to runnable POSIX sh ae4b75f;
  spec `update-lane/update-dedicated-entrypoint`). README utilities line
  names the lane (0e2bb8f); summary 6b2261a; merged 3187c67.
- Firing migrations land in ONE `chore(potion): update — grammar migrations
  (…)` commit naming the applied ids; current detectors are skipped
  independently; a fully current repo is a clean no-op — "grammar current —
  nothing to migrate", zero commits (specs
  `update-lane/update-mechanical-one-commit`, `update-idempotent`).
- Judgment stays human: legacy Parked items triaged one at a time with a
  recommendation, each routed by a one-line human call; hook install honors
  the phase-19 no-clobber refusal (`--force` only on explicit word); the
  escalations registry is offered, never written (specs
  `update-lane/update-interactive-triage`, `update-no-clobber-hooks`,
  `update-escalations-offer-only`).

### Drift notice
- Session-start hook grows a grammar-drift leg: five fs/string checks plus a
  legacy-Parked flag print a POTION GRAMMAR DRIFT block naming exactly what's
  missing and pointing at `/potion:update` — warn-only, fail-open in its own
  try/catch, silent on current and non-potion repos (57a0bdd; specs
  `drift-notice/drift-notice-warn-only`, `drift-notice-fail-open`,
  `drift-notice-silent-when-current`).
- `/potion:resume` runs the same sweep in step 2 and carries the finding into
  its brief — notice only, resume never migrates (0645885); summary 09be31b;
  merged 354eb42.

### [defect] tag promotion
- Write-time grammar: an observed failure is recorded as a line-start
  `- [defect] ` bullet; untagged prose stays ordinary fog — no touch-time
  inference, ever. Grammar and routing rule live in CORE.md Bucket homes and
  the STATE template (aaca94f; spec `defect-promotion/defect-write-time-tag`).
- Promotion on touch: verify's step-1 sweep promotes surviving tagged lines
  to gaps before any verdict and its exit instructs write-time tagging;
  discuss promotes to the Decision queue before any fork is discussed —
  removal from the bucket rides the same edit (bbd0824; spec
  `defect-promotion/defect-promotion-on-touch`).
- Plan reads the promotion list first and hard-stops on any unpromoted
  `- [defect]` line (df5c740; spec
  `defect-promotion/plan-reads-promotion-list-first`); summary de0968f;
  merged c0487e8.

### Proof
- Fixture dogfood matrix: full migration in one commit (CASE A), partial
  skip (CASE B), idempotent re-run with foreign hook byte-identical
  (CASE C2), no-clobber refusal surfaced verbatim, simulated triage routes
  landed (28e19ae) — CASE C1 caught a real M4 detector re-fire, fixed in the
  shipped skill under [Rule 1]. Drift-notice matrix D1–D3 plus the [defect]
  plan hard-stop probe, verbatim stdout (f7b0fbe); summary 24cdd6f.
- Live proof (RUNBOOK-05): partner-repo — a real installed repo — migrated by
  Ian's hand: 5-item drift block observed, preflight → go, migrations M1–M5
  in one commit (partner-repo 0b3c3e9), 7 Parked items triaged by real human
  calls, escalations declined and honestly absent.

### Verification & bookkeeping
- Cycle-1 verify: blind ladder 12/12 artifacts VERIFIED, fresh
  orchestrator-run drift matrix and partner-repo re-check at HEAD, 3 headless
  [defect]/resume probes, 22/22 ratchet checks green (b497f22); spec merge
  9431311.
- Phase records: discussion f7070a3, plans 5d84499, wave positions
  af6b46b / 96372be, completion b562dba.
- README count honesty: "Eleven skills" prose and the `skills-11` badge
  undercounted the thirteen skills the README itself enumerates — corrected
  in this release commit.

## 1.13.0 — 2026-07-21

The escalation-lane release: recurring gated mutations stop re-begging for
permission, and a target repo keeps its secret protection even with no
plugin loaded. A human grants a named wrapper + exact command once in a
standing registry; the PermissionRequest hook approves only a byte-exact,
unexpired match — everything else, including every internal error, falls
through to the normal wall. The hook is structurally incapable of denying.
Verified in one cycle: 13/14 truths runtime-verified fresh, the one
real-event observation user-accepted as COULD_NOT_CHECK (headless sessions
cannot isolate a PermissionRequest approval on this machine).

### Escalation lane (new capability)
- Standing repo-level registry `.potion/escalations.md` with single-line
  grant grammar (name, wrapper, exact command, grantor, added, expires) and
  a fail-open line-oriented loader; template with copyable worked example
  and renewal ceremony (90d69f4; spec
  `escalation-lane/registry-standing-grants`).
- PermissionRequest hook auto-approves ONLY a trimmed byte-exact command
  match whose grant is unexpired and whose wrapper file exists; near-miss,
  undeclared, expired, inert (no expires), missing wrapper, missing
  registry, garbage stdin, and non-Bash tools all produce no decision and
  exit 0 — the hook never denies and never exits nonzero (f9148c5; specs
  `escalation-lane/exact-match-approve-only`,
  `escalation-mandatory-expiry`, `escalation-never-denies`).
- Proof: 9-case direct-payload fixture matrix plus an honest record of the
  headless layer-B confounders (8ce71e5); plan record 13a41f2, merged
  f83aa7e.
- Expired or expiry-less grants surface at session start as
  decide-renew-or-abandon — warn-posture, fail-open, never blocks
  (a6d9f50; spec `escalation-lane/expired-escalation-surfacing`); proof
  matrix 41a1474; summary d661743.
- Plans declare grants by name in new `escalations:` frontmatter; the
  planner refuses to emit a plan referencing an absent or expired grant and
  presents a ready-to-paste registry line instead — the human alone edits
  the registry (d291797; spec
  `escalation-lane/plan-references-grants-by-name`).

### Repo-side enforcement (plugin-free)
- Checked-in pre-commit mirror of the secret scrubber: staged secret-shaped
  content under `.potion/`, declared verify-env.local values repo-wide, and
  verify-env.local itself all block at `git commit` with pattern/KEY + file
  named, values never printed; override is `git commit --no-verify`;
  fail-open on every error. Self-locating installer refuses to clobber an
  existing pre-commit hook without `--force` (f8a7a95; specs
  `enforcement-hooks/repo-side-pre-commit-mirror`,
  `installer-never-clobbers`).
- Adoptable `templates/ci.yml`: mechanical ci-verify job active by default,
  agentic blind-verify documented as bring-your-own-key opt-in comments
  only — no key ships anywhere; /potion:init housekeeping now installs the
  repo-side hooks for new repos and offers ci.yml as one question
  (8bc7f3d; specs `ci-verification/adoptable-ci-template`,
  `enforcement-hooks/init-installs-repo-hooks`). Proof: 8-case plugin-free
  fixture matrix, redacted (b8a8619); summary 09c06e8; merged 9a33863.

### Verification & bookkeeping
- Cycle-1 verify: blind static ladder (14 artifacts VERIFIED, 7 key links
  traced), fresh orchestrator-run fixture matrices at HEAD, dogfood
  enactments of both prompt-enforced truths, SUMMARY→git cross-check clean;
  2 learnings + 4 phase-19 witnesses harvested (c2566f4); spec merge
  513b7ff.
- Phase records: discussion b366e2f, plans 6b8070d, completion + session
  continuity 056be8a / 52d8b4c.

## 1.12.0 — 2026-07-20

The liveness release: repos that look busy but aren't get caught. A
two-signal staleness beacon fires at session start when STATE claims motion
nothing backs, a completion claim without a verification verdict trips the
stop nudge, and every human gate now carries a mandatory expiry with a
decide-renew-or-abandon lifecycle. All warn-posture, all fail-open — potion
signals stalls, it never traps a session. Verified in one cycle, 14/14
truths, all runtime evidence from fresh synthetic fixtures.

### Staleness beacon (behavior change)
- New session-start leg: two-signal staleness — STATE claims
  executing/verifying/planning but the last commit is >=3 days old
  (abandonment), or repo commits continue while `.potion/` sits untouched
  >=3 days (potion bypassed) — each with a distinct warning and a
  pause-or-resume offer; 3 days is a fixed constant, no config knob
  (b8c89a7; spec `enforcement-hooks/staleness-beacon-two-signal`).
- A STATE `Last activity` date lagging the actual last commit by >=3 days is
  surfaced as a stale-Position line naming both dates (b8c89a7; spec
  `enforcement-hooks/beacon-stale-position`).
- Expired-gate scan: uncleared gates in the current phase's DISCUSSION.md or
  RUNBOOK frontmatter whose `expires` date has passed are surfaced by name,
  date, and source file; a runbook cleared by its SUMMARY stays silent
  (e33ea45; spec `enforcement-hooks/beacon-expired-gates`). The gate-name
  regex excludes newlines so multi-line frontmatter can't leak past the line
  end (e33514d, a Rule-1 fix).
- Proof: 7-case synthetic fixture matrix committed as evidence (453af4c);
  plan record 6a005a6, merged 56baa31.

### Completion-claim tripwire (behavior change)
- stop-drift check 3: a STATE status claiming shipped/complete/completed/done
  for the current phase with no `verdict:` line in that phase's
  VERIFICATION.md blocks the stop once, naming the phase and
  `/potion:verify`; one-shot rule and non-claiming statuses untouched,
  fail-open (9f3a11b; specs `enforcement-hooks/stop-nudge-completion-claim`,
  `stop-nudge-one-shot` modified).
- Proof: 6-case synthetic payload matrix (1f9742f); summary 9550bff, merged
  92105eb.

### Gate lifecycle (behavior change)
- Discuss gates grammar now carries `added` and `expires` on every entry —
  expiry is mandatory; a genuinely unknowable ETA gets a review date capped
  at 14 days out; discuss step 2 forces a decide-renew-or-abandon call on
  every expired gate (13cf897; spec `gate-lifecycle/gate-expiry-mandatory`,
  `expired-gate-decision`).
- Resume sweeps expired gates and offers the blocked-PLAN retrofit: human
  steps become a RUNBOOK, remaining agent work a follow-up PLAN, the
  original closed by a `type: superseded` SUMMARY — declining leaves
  everything untouched (c0a3c17; spec `gate-lifecycle/blocked-plan-retrofit`).
- Pause surfaces "branch N commits ahead of origin" (or "no upstream")
  before a stall is recorded — never auto-pushes — and records it in
  continue-here.md's new `Unpushed` field; RUNBOOK template frontmatter
  carries the gate's `expires` date for the session-start scan (265dbc9;
  spec `gate-lifecycle/pause-unpushed-check`); summary 01fb007, merged
  54bec67.

### Process
- Phase 18 record: discussion (a411163), plans (0b60cef), completion
  (5bd4e07), verification cycle-1 pass 14/14 with three fresh live evidence
  files, two harvested learnings, and three new witness checks (9da4e2e),
  and the mechanical spec merge — 9 ops across `enforcement-hooks` and the
  new `gate-lifecycle` capability (9dce070).

## 1.11.0 — 2026-07-20

The secret-ratchet release: the scrubber can now catch human-shaped
passwords, not just machine-shaped keys. Cycle 3 opens on the highest-weight
field finding (F-20 — a fixture password committed 10× in a dogfood repo):
any value declared in a project's gitignored `verify-env.local` becomes a
literal scrub pattern, standing leaks in committed HEAD are surfaced and
quarantined, and the originating leak itself is cleaned. Verified in one
cycle, 21/21 truth and scenario rows.

### Declared-secret ratchet (behavior change)
- New `hooks/declared-secrets.js`: parses `verify-env.local` KEY=value lines
  (8-char minimum floor, fail-open on any read error) and finds leaked files
  via `git grep -F -f -` with values passed over stdin — never argv
  (1da6924, 7efc672).
- The commit scrubber scans the WHOLE-REPO staged and unstaged diffs for
  declared values — not just `.potion/` — and blocks with the KEY name; the
  secret value never appears in any message. A repo with no
  `verify-env.local` sees byte-identical pre-existing behavior
  (1da6924; spec `enforcement-hooks/scrubber-blocks-declared-values`).

### Retro-scan for standing leaks (behavior change)
- Session start in a repo whose committed HEAD contains a declared value
  emits a loud `POTION SECRET RETRO-SCAN` warning naming the KEY and every
  affected file, and instructs the session to record a STATE blocker; commits
  touching a contaminated file are blocked, while unrelated commits pass —
  a standing leak never bricks unrelated work (616fa28;
  spec `enforcement-hooks/retro-scan-standing-leak`).

### Template
- `templates/verify-env.md` now rules that fixture credentials live in
  `.local` and are referenced BY NAME, and that declared values double as
  scrub patterns (6356a9f; spec `verify-env/fixture-credentials-by-name`).

### Field cleanup and live proof
- The originating partner-app leak is dead in HEAD: 10 files scrubbed to
  KEY-name references + gitignore guard (partner-app commit 4986874); rotation
  consciously deferred to pre-launch by human amendment — demo-only accounts,
  value never pushed, Decision-queue entry expires 2026-10-17 (11f5db2,
  f866f03).
- Live mischief proofs committed: a planted declared password blocked in a
  real headless session (SENTINEL-BLOCKED) and the retro-scan observed firing
  (SENTINEL-RETRO); the same password literal was scrubbed from phase-16
  evidence (de41adf, e9650cb).

### Process
- Phase 17 record: discussion + cycle-3 conversion (50beae8), plans + runbook
  (b330391), wave tracking (4a99ec6), executor summaries (be4db32, 8c17f19,
  bd34ce5), completion (60a00f3), verification cycle-1 pass 21/21 with fresh
  runtime matrix (9649044), and the mechanical spec merge (c504678).

## 1.10.0 — 2026-07-18

The live-proof release: every enforcement hook has now been observed firing
on real events in real sessions — no more synthetic-stdin-only proofs — and
the two cycle-1 dogfood burrs in the pair skill and the check-runner contract
are closed. Phase 15 converts the campaign's last two unchecked field-evidence
requirements; verified in one cycle, 8/8 truths.

### Pairing exit hardening (behavior change)
- Exit step 7 now tolerates a non-init-shaped STATE.md — missing sections
  (Fog, Session continuity) are appended in minimal form, never assumed
  present; new step 8 explicitly commits the exit bookkeeping (SUMMARY,
  STATE.md, marker deletion), screened by the scrubber like any commit
  (commit d638dc2; spec `pairing-mode/pair-exit-emits-summary` extended).

### Check-runner contract (documentation)
- `scripts/ci-verify.sh` header now states that sh-reserved exits 126/127
  ALWAYS classify BROKEN regardless of stdout, and forbids checks that
  intentionally exit 126/127 (use 1-125) — code behavior unchanged (commit
  879e110; new spec `ci-verification/broken-reserved-exit-codes`).

### Live hook proofs (evidence, phases/15-live-proof/evidence/)
- Stop-hook drift nudge observed live in a real headless session: drifted
  fixture surfaced both defects (STATE over cap, PLAN with commits but no
  SUMMARY), one-shot retry honored; clean-fixture control stayed silent
  (commits 96bedb4, a27eb5f).
- SessionStart startup digest observed injecting position context into a
  real session (commit a27eb5f).
- Secret scrubber observed blocking a REAL commit of a planted fake sbp_
  token in a live session — fixture git log proves nothing landed; it also
  live-blocked this phase's own plan commit when a matching literal briefly
  existed in PLAN-03 (commit 148e653).
- Compaction re-grounding digest proven headless-untriggerable with three
  documented attempts — typed COULD_NOT_CHECK, hitl observation queued as
  the remaining route (commit 8e6924f).

### Process (bookkeeping commits)
- Phase 15 discussion, plans, worker summaries, cycle-1 verification (8/8
  VERIFIED, independent orchestrator re-runs + pair-exit enactment), spec
  merge, and 4 harvested learnings + 2 new ratchet witnesses (now 10 checks)
  (commits 230bb25, da8b155, 074c39a, 3bb5582, 6c5dd9f, eaf587d, 42fb57a,
  6e36896).

## 1.9.0 — 2026-07-18

The pairing-and-CI release: a hands-on pairing lane with honest exits, a
generic ratchet-check runner wired into two-layer GitHub CI (mechanical on
every push, agentic strictly opt-in), and worktree isolation as the default
for parallel execution waves. Phase 14 closes the Best-Potion Campaign's
planned arc — verified in two cycles with the one found gap closed and
dogfooded.

### CI verification (new capability)
- `scripts/ci-verify.sh`: generic runner for every `type:check` learning —
  one machine-readable `CHECK MATCH|MISMATCH|BROKEN` line per check, exit
  nonzero exactly on MISMATCH, BROKEN as warning, missing learnings file is
  a clean pass (commits 2b0db82, 513f4ef); sh exit 126/127 classified as
  BROKEN, never MISMATCH (commit 263f1e4).
- Mechanical workflow `.github/workflows/ci.yml` on every push/PR: ratchet
  suite + vocabulary grep + hook syntax checks (commit e0a1969).
- Agentic workflow `.github/workflows/agentic-verify.yml`: opt-in only
  (workflow_dispatch or `agentic-verify` label, never plain push), runs the
  blind verifier headlessly, uploads a verdict artifact, fails on FAILED
  truths (commit e14adde). Ships inert by descope: no hosted API key; an
  early-fail guard names the missing secret (commits f398768, dbee1db).

### Worktree-default execution (new capability)
- 2+ parallel plans in a wave each get an isolated worktree + temp branch by
  default (the old 4+ heuristic is gone); merge-back is sequential --no-ff,
  progress/STATE update only after all land, failed plans discard without
  touching main (commit 8ab57ae).
- Execute steps 2, 4, 5 now each end with a checkable "Done when" (commit 0b28fe3).

### Pairing mode (new capability)
- `/potion:pair` skill: session-long hands-on lane — Enter writes a transient
  `.potion/pairing.md` marker, Exit emits a `type: pairing` SUMMARY with
  intent, baseline..HEAD commit list, mini-verify results (full ratchet suite
  via ci-verify.sh) and one fresh evidence command, then deletes the marker
  (commit a85d852); README utilities list names it (commit 19944e3).
- Dead-session recovery wired at BOTH entry points: resume step 1 now checks
  for a stale pairing marker and offers the retroactive exit before normal
  resume proceeds (commit dc36df5), and pair's Enter step references resume's
  real check instead of aspirational wording (commit 83a2f4e) — the gap
  cycle-1 verification caught, closed and dogfooded in cycle 2.

### Specs
- Phase-14 spec merge applied 8 delta ops, creating three capability trees:
  ci-verification, worktree-execution, pairing-mode; the duplicate
  pair-stale-session-recovery ops were collapsed to one ADDED at the ship
  gate — the merge-specs BLOCK path fired live for the first time and held
  (commit d430463).

### Process record
- Phase 14 discussion, plans, worker summaries, wave/state bookkeeping,
  verification cycles 1 (fail: 1 gap) and 2 (pass; witness-14 ratchet check
  added, suite now 8 checks), and the gaps-cycle plan: commits abf1be3,
  fade70e, 79f9871, f398768, a62a725, 8b51ad3, fac1a29, bdbd1d5, 3cd138d,
  a9edc93, f0271ec, 5fecd2e, 905af94, a2427e9.
- `.potion/` stays committed as-is — privacy question raised and resolved
  (commit f13eebf).

## 1.8.0 — 2026-07-17

The knowledge-and-craft release: the unbounded Parked list is replaced by
three bucket homes split by nature, learnings carry their originating
incidents, every skill leads with its emission contract and ends its steps
with checkable criteria, and the full spec tree survived its first bounded
sweep against cited sources — clean.

### Three bucket homes (Parked retired)
- CORE.md state doctrine: out-of-scope ledger in PROJECT.md (conscious
  rejections, human-present writes, never graduates), Fog (cap 6) and
  Decision queue (cap 5, dated added+expires) in STATE.md; templates
  updated, no form of the park-word remains in core/, skills/, or templates/
  (commit 10e822e).
- Four skills rewired from Parked routing: blocking human calls → Decision
  queue, everything else → Fog (commits 53ea823, f23f32f).
- This repo's own STATE.md rebuilt under the new doctrine — gist-and-link
  decisions, 41 lines (commit ae2ef9f); PROJECT.md ledger extended with the
  13 attested rejections (commits b7b1f35, ca7e110).

### Parked triage (dogfood of the new buckets)
- All 19 parked items triaged into a one-sitting attestation table with a
  bucket and a why per row (commits 816bc7b, 2a8c335, b0bd3c0).
- Attestation by delegation recorded verbatim as the human act; corrections
  applied, buckets final; standing confirmation queued with an expiry
  (commit 6185302).

### Incident-carrying learnings
- Learnings grammar gains an optional `incident: {date, bad, fix}` object;
  5 existing entries backfilled from phase artifacts via same-key appends
  (commit 223b0f8); the requirement landed in the learnings-flywheel spec
  via the phase-12 merge machinery (commit 4b6b476).

### Skill doctor (all 11 skills)
- Emission contracts hoisted into each skill's top guaranteed-read band with
  a bounded self-check, and every mandatory step given an observable
  completion criterion: verify + plan (commit 20a64c5), learn + execute
  (commit 358f184), brew reshaped as a thin composer with the watchdog
  deduped to a pointer (commits 102dba4, 2f9d58f), discuss + init
  (commit 4f65c5f), ship + investigate (commit 2f6280f), pause + resume —
  no hoist needed, recorded with why (commits 812c791, 48b11b0).
- The 150-line bar held after every edit; largest skill sits at exactly 150
  (verify), the rest between 47 and 134.

### Spec sweep (first full-tree exercise)
- All 32 on-disk requirements re-checked against their cited source files:
  clean sweep, 0 mismatches; SPECS_DIR-copy merge validation exit 0
  (commits ea79e2c, 32fe0a4, 8d31cff).

### Verification
- Phase 13 verified pass, cycle 1: 24/24 truths VERIFIED with runtime
  evidence paths, all 5 ratchet checks MATCH, 19/19 SUMMARY-cited commits
  confirmed against git log (commit 4ca02f4).

### Bookkeeping
- Phase 13 discussion, plans, and completion markers (commits 335309e,
  402479b, 2bb7b37).
- Plugin manifests caught up to the changelog: 1.7.0's release commit bumped
  only CHANGELOG.md, leaving plugin.json/marketplace.json at 1.6.0 — both
  now carry the real version.

## 1.7.0 — 2026-07-17

The living-specs release: `.potion/specs/` now carries the current truth of
how the system behaves, plans carry mechanical deltas against it, ship merges
them with a script that refuses to guess, and the verifier audits touched
requirements scenario-by-scenario.

### Spec merge machinery
- `templates/spec.md`: the canonical spec format — `### Requirement: id —
  statement` headers, GIVEN/WHEN/THEN scenarios, `<!-- source: -->` comments
  (commit 3e5f9a3).
- `scripts/merge-specs.sh`: deterministic validate-then-apply merge of plan
  `<spec_deltas>` (ADDED/MODIFIED/REMOVED/RENAMED) into `.potion/specs/`;
  any conflict or malformed delta exits nonzero naming the requirement ID
  with the tree left untouched; POSIX sh+awk, column-0 markers only
  (commit 46382a6).
- Fixture self-test covering clean 4-op merge, seeded-conflict atomicity, and
  malformed deltas, wired into the verify ratchet as
  `check-merge-specs-selftest` (commit 608ce4c).

### Spec backfill (dogfood)
- Six capability specs seeded into potion's own `.potion/specs/` — 32
  requirements across verification-ladder, verify-env, evidence-index,
  enforcement-hooks, learnings-flywheel, plan-runbook-gating — every
  requirement source-cited to the implementing file, shipped behavior only
  (commits 22d4894, a43a678).

### Verification upgrades
- Evidence INDEX generator extracted verbatim to
  `scripts/gen-evidence-index.sh` (phase 10/11 regeneration byte-identical);
  the verify skill regains line-bar headroom (commit 26cab82).
- Blind verifier contract gains a delta-scoped Spec scenarios audit;
  `templates/VERIFICATION.md` gains the Spec scenarios table and mandates the
  `| N. text |` truth-row shape the INDEX citation regex depends on
  (commit 78a21d4).
- Witness checks: `type:check` entries keyed `witness-{phase}-{slug}` guard
  the untouched spec tree; a MISMATCH triggers one repo-wide grep — found
  elsewhere = DRIFT (re-pin), absent = REGRESSION. Two real witnesses seeded;
  verify's step-2 spawn prompt now inlines the phase's spec deltas
  (commit 86f865d).

### Workflow wiring
- CORE.md: `.potion/specs/` in the state layout plus a Living specs contract
  every skill inherits (commit 7074344).
- `templates/PLAN.md` documents the `<spec_deltas>` grammar; skills/plan
  instructs writing deltas whenever a phase changes specced behavior
  (commit ab9b12d).
- skills/ship gains the spec-merge step (blocks on nonzero exit — the human
  resolves, the agent never hand-merges); skills/execute quick mode documents
  the spec-delta exemption (commit a53b23b).

### Process records
- Phase 12 discussion, plans, per-plan summaries, verification (cycle 1 pass,
  14/14 truths, live conflict/merge/index/witness evidence), and state
  bookkeeping (commits 0bb2199, 2b679db, e6a2654, 1de7bfb, f656784, 49e135f,
  9dd1c99, cc58eb8, e9eb306).

## 1.6.0 — 2026-07-16

The enforcement release: discipline now holds mechanically. Secrets are
blocked before they can enter a commit, bookkeeping drift gets one concrete
nudge, compaction can no longer lose a phase's position, and evidence
directories carry a generated, hash-checked index.

### Enforcement hooks
- PreToolUse secret scrubber: `git commit` is blocked (exit 2) when
  uncommitted `.potion/` content carries a secret-shaped string (sk-/sbp_/
  AKIA/private-key/JWT patterns) or would commit `verify-env.local`; the
  block names the pattern and file, and the only override is the human
  committing manually — no agent-usable bypass. Fails open on everything
  else (commits 0fe282f, 2443377; seeded proofs in bd97df0).
- Stop-hook drift nudge, one-shot by design: stopping with STATE.md over the
  60-line cap or a plan with tagged commits but no SUMMARY blocks once with
  the concrete defects; the second stop always passes — bookkeeping never
  traps a session (commits 7fed8b8, 2443377).

### Compaction re-grounding
- The SessionStart hook's compact branch re-injects a mechanical mid-phase
  digest — verbatim Position lines plus a SUMMARY-derived plan tally and a
  re-read-STATE.md instruction — so long runs survive compaction without
  trusting the summarizer (commit 524dc7c; real-payload proof with tally
  cross-check in fa30168, summary 2963340).

### Evidence index
- Every `evidence/` dir now gets a generated `INDEX.md` — path, sha256-8,
  producer, truths proven — (re)generated by /potion:verify on every verdict;
  hand-editing is a defect, byte-identical duplicates are flagged by hash
  (commit 270f0db; live proof over phase 10's real evidence plus a seeded
  duplicate in bf7ce68, summary 3416bef).

### Contract documentation
- CORE.md documents the enforcement layer (block vs warn posture, manual
  override, fail-open rule) and the INDEX.md regenerable-cache line in the
  state layout, cross-checked by grep against the shipped scripts — 11
  anchors, zero mismatches (commits 5cfeb50, f630c4d, summary 2ce95bc).

### Process
- Phase 11 discussion locked the block/warn split by irreversibility
  (2e8116a); 4 plans in 2 waves (270a2ce); executed 4/4 (88b0262); verified
  cycle-1 pass, 11/11 truths, with the INDEX truth-row citation defect found
  and fixed in-cycle (58d76e1).
- marketplace.json version had lagged at 1.4.1 since the 1.5.0 release; both
  manifests now carry 1.6.0.

## 1.5.0 — 2026-07-16

The runtime-boundary release: verification now names exactly why a truth went
unchecked, and human-gated work gets its own first-class artifact. Cycle 2
opens here.

### Truth vocabulary restructure
- `COULD_NOT_CHECK(reason)` joins the ladder with a closed reason vocabulary
  (auth-wall | device-needed | build-broken | tool-missing | timeout | other);
  the pass rule is conversion-gated — a phase never passes with an unconverted
  COULD_NOT_CHECK, and conversion is explicit human acknowledgment recorded in
  `accepted` (commits 60ca0b4, d8172e0).
- `HUMAN_NEEDED` narrows to truths a human must attest BY NATURE (visual
  quality, feel); environmental blockage is never HUMAN_NEEDED — the blind
  verifier stays STATIC_ONLY with a note (88653d3).
- verify gains an env-health preflight before the blind spawn, recorded in
  VERIFICATION.md's new Preflight section; an env-failed truth becomes
  COULD_NOT_CHECK immediately, no live attempt burned (e5e6507, d75c4d6);
  plus a nature-vs-circumstance red-flag row and a verified_at rewrap so the
  timestamp rule greps on one line (38a5d0c).

### verify-env: declaration-required
- New `templates/verify-env.md` with two legal shapes — session recipe or
  `none-needed: why`; silence is the only illegal state (1de3e5b, 55e9c98).
- init asks how a verifier gets a live runtime session and gitignores
  `.potion/verify-env.local` so secrets can't be committed (a733198); discuss
  backfills the declaration when absent and surfaces external prerequisites
  as hitl/afk-tagged `gates:` frontmatter (047bde8).
- plan refuses to schedule runtime-proof truths while the declaration is
  missing, routing to it instead (c9b040c). Potion's own repo now carries its
  declaration: none-needed, prompt-pack (6f068b9, ef1ed6e).

### RUNBOOK: human-gated work as a numbered peer of PLAN
- New `templates/RUNBOOK.md` — per-step `done_when` (mechanical cmd+expect or
  human-attest), completion via SUMMARY-NN type: runbook (0194df9).
- plan converts hitl-gated work into RUNBOOK-NN in the phase's shared number
  pool, never an executable PLAN (c9b040c); execute treats runbooks as
  first-class wave units — runs done_when checks, checkpoints on unconfirmed
  steps, never spawns a worker (d97ba8a); brew lists an unconfirmed runbook
  among its human gates so unattended runs stop instead of grinding
  (e7378d5); the SUMMARY template documents the runbook variant (e7378d5).

### Bookkeeping
- Cycle 2 initialized from the field-evidence research: 5 phases; phase 10
  discussed, planned (5 plans, 3 waves), executed, and verified — 15/15
  truths VERIFIED via 5 scratch-fixture dogfood runs with evidence on disk
  (091e58c, 509370d, 625340c, worker summaries be9d399/7ae4252/3ce8773/
  5f214f3/17ceadb, 986b9f2, 1c11ce4).
- README goes version-free — the release badge carries the number (c53f56c).

## 1.4.1 — 2026-07-06

The mischief release: the verifier survived its own red-team.

- Mischief audit (2026-07-06): the verification protocol was red-teamed with
  five classed, seeded defects behind a sealed answer key — clean-grepping
  stub, wired-but-wrong, phantom commit, orphaned artifact, missing artifact.
  Catch rate 5/5 at protocol level (4/5 at the static ladder alone); the
  verifier also flagged the fabricated "verified live" claims unprompted.
  Receipts: `.potion/phases/09-mischief/`.
- verify: `verified_at` is now derived mechanically (`date -Iseconds`), never
  hand-typed. New permanent ratchet: every SKILL.md stays under the ~150-line
  bar (`check-skill-line-bar`).
- docs: README caught up to the 1.x story — brewed-itself claims moved to
  v1.4.0, new "Knowledge that compounds" section (journal → promotion →
  pages → lint), mischief receipts cited from the built-with-itself callout.
  Repo About updated to match. Plus v1.4.0 release bookkeeping.

## 1.4.0 — 2026-07-05

The self-audit release: the knowledge layer now lints itself — cache fixes are
automatic, truth changes are human-gated. This completes the Karpathy-pattern
set: journal (append-only truth) → pages (distilled cache) → lint (the
auditor that keeps them honest).

### Lint — four hunts over the knowledge tree
- New "Lint" section in the learn skill, run over project scope then user
  scope (commit fe6c069): (1) contradictions — semantic judgment of entry
  insights and page syntheses, Claude is the linter; (2) stale claims —
  `files` backpointers gone from disk, page claims superseded by newer
  same-key entries; (3) orphans — page `### {key}` blocks with no live
  journal line; (4) coverage gaps — confidence >= 8 live entries no page
  distills
- Trigger: runs automatically after every Distill, or on demand via
  `/potion:learn lint`
- The safety line — cache-auto, truth-human: cache-side findings (orphans,
  stale page claims, coverage gaps) are fixed by rebuilding the affected
  page whole from the journal; truth-side findings (contradictions, any
  urge to tombstone or reword a journal entry) are NEVER self-resolved
- Parked routing: truth-side findings go to STATE.md `## Parked`, one line,
  both sources cited — the next /potion:discuss tables them
- CORE contract: lint safety line under Learnings, core/CORE.md
  (commit a8f7973)

### Evidence
- Live proof on the real knowledge tree, both scopes: clean baseline lint;
  a transparently seeded cache-side orphan detected by hunt 3 and
  auto-rebuilt away (rebuilt page byte-identical to HEAD); truth journals
  sha1-identical across the entire run — the linter has teeth and a muzzle:
  `.potion/phases/08-lint/evidence/02-lint-transcript.txt` (commit d7b24cb)

## 1.3.0 — 2026-07-05

The distillation release: journals stay ground truth, pages make them readable.

### Distillation pages
- New pages layer in two scopes: project journal distills to
  `.potion/knowledge/` (committed with the repo), user journal to
  `~/.claude/potion/pages/` (outside git) — each with an `index.md` listing
  every page with its one-line scope and entry count
- Pages are a regenerable cache, never ground truth: rebuilt whole from the
  deduped journal, never hand-edited, safe to delete; when a page and the
  journal disagree, the journal wins and the page is due a rebuild
- Source-backed claims: every `### {key}` block cites the journal entry key
  it distills (user scope also cites the source repo) — an uncited claim is
  a defect
- CORE contract: "Distillation pages" subsection under Learnings,
  core/CORE.md (commit 55b4fa7)
- Procedure: new "Distill" section in the learn skill — dedup newest-wins,
  drop tombstones, cluster 2-6 entries per page, regenerate pages whole,
  rewrite index (commit a641ecb)
- Planners prefer synthesis: planning reads pages before raw journal
  fragments when both exist (commit f509289)
- Trigger honesty: automatic distillation fires at compaction (~500 lines),
  which no journal has reached — the trigger is dormant until then. On-demand
  runs via `/potion:learn distill` work today and produced the evidence below.

### Evidence
- First real distillation, both scopes: 9 project entries → 3 pages + index
  in `.potion/knowledge/`; 3 user entries → 1 page + index in
  `~/.claude/potion/pages/`; every citation spot-checked to exactly one
  journal line:
  `.potion/phases/07-distill/evidence/02-distill-transcript.txt`
  (commit 371fc19)

## 1.2.0 — 2026-07-05

The harvest release: no closed phase goes cold with its insights unharvested.

### Phase-close harvest
- `/potion:verify` step 4 gains "Harvest before verdict" (pass verdicts only):
  sweep the phase's SUMMARY Deviations/Concerns, the verifier's
  ladder/panel reasoning in VERIFICATION.md, and any `.potion/debug/` files
  closed during the phase; distill what clears the 5-minute bar into
  `.potion/learnings.jsonl` — max 5 entries, `files` backpointers to the
  source artifact (commit f5e260b)
- Duplicate guard: grep existing keys first, harvest only what fell through
  during the phase, never re-log; zero new entries is a valid outcome, stated
  explicitly
- CORE principle: "Phase-close ingest: a pass verdict triggers a harvest of
  the phase's SUMMARY/VERIFICATION/debug reasoning into learnings" —
  Learnings section, core/CORE.md (commit e3b1438)
- Composes with 1.1.0's promote-up bar: harvested entries ride the normal
  CORE Cross-repo knowledge bar (confidence >= 8, generalizable, loop-born)
  into `~/.claude/potion/knowledge.jsonl`

### Evidence
- The procedure run for real against the cold storage that motivated it —
  01-harden's 42-finding audit reasoning: 9 artifacts swept, duplicates
  skipped, 3 distilled entries appended, 2 promoted up:
  `.potion/phases/06-ingest/evidence/02-retro-ingest-transcript.txt`
  (commit 713dc61)

## 1.1.0 — 2026-07-05

The compounding release: what one repo learns, every repo knows.

### Cross-repo knowledge journal
- New user-scope journal `~/.claude/potion/knowledge.jsonl` — same grammar as
  `.potion/learnings.jsonl` plus a mandatory provenance field:
  `{"source":{"repo":"<repo-name>","key":"<original-key>","ts":"<date>"}}`
- Promotion bar (CORE): confidence >= 8, generalizable beyond the source repo
  (tools, frameworks, protocols — never business logic, secrets, or private
  URLs), and born inside potion's verified loop
- Memory-poisoning guard: external text is never promoted — only loop-born
  entries cross the repo boundary
- Append-only, newest-wins by key; interleaved appends from parallel sessions
  absorbed by that rule; same ~500-line compaction as the repo journal
- `/potion:learn` promotes up when the bar clears ("Promoted: {key}"), creates
  the directory on first use; when in doubt, don't

### Delivery
- Planners grep `~/.claude/potion/knowledge.jsonl` in plan step 2 and cite
  matches as `Prior cross-repo learning: {key} (from {repo})`
- session-start hook surfaces the newest journal entries under a
  "Cross-repo knowledge" header with `(from {repo})` provenance

### Evidence
- Real end-to-end run — genuine promotion, live hook delivery, plan-side
  grep + attribution: `.potion/phases/05-compound/evidence/03-e2e-transcript.txt`

## 1.0.0 — 2026-07-05

The campaign release: potion brewed itself. `.potion/` in this repo is the
live record — design, three phases, two first-cycle pass verdicts so far
(01-harden and 02-empower, both cycle 1, zero gaps). The audits and fixes
below were executed by potion's own loop: workers, blind verifiers, refuter
panels.

### 01-harden — six-lens audit
- 119 agents over 27 files (10 finders per lens, 3-refuter adversarial
  panels, refute-by-default), full coverage, no finders lost
- 60 raw findings → 42 unique; 25 confirmed by the panels; 11 refuted
- 20 behavioral defects fixed across 6 plans / 14 commits; 5 style findings
  accepted with reasons on record. Highlights:
  - Verifier never emits VERIFIED — the orchestrator is the single promotion
    point
  - Ratchet checks take their own `check-{source}` key, so newest-wins dedup
    can no longer shadow a lock
  - init gained a real new-cycle procedure (and PROJECT.md its `## Phases`
    section)
  - Lossless pause↔resume: closed-vocab status captured and restored
  - Gap acceptance is user-only
  - One law canon
  - Install modes that work (skills-dir mode removed)

### 02-empower — six mechanisms, every one citing dogfood evidence (Law 10)
- `evidence/` convention — canonical home for runtime proof artifacts,
  referenced by path from VERIFICATION.md
- Check-runner contract — POSIX sh from repo root, trimmed-stdout vs `exit N`
  semantics; kills the `|| true` hack
- Build-freshness precondition — verify confirms the running app corresponds
  to HEAD before judging behavior
- Learnings delivery — planners grep learnings.jsonl into TECHNICAL NOTES;
  worker digests carry matching entry keys
- Concern→Parked routing — non-gap findings land in STATE.md's Parked list;
  nothing evaporates
- Continuity freshness — any skill that moves position refreshes the
  Session-continuity block

### 03-polish
- README truth-checked against HEAD and given a stranger-ready
  "Quickstart: your first brew"
- This release

## 0.3.0 — 2026-07-03

Loop release, informed by the dogfood-project dogfood (3 phases, emulator-verified
CamScanner clone) — the mechanisms that had to be improvised by hand are now
codified.

### New
- **`/potion:brew`** — the autonomous phase loop: plan → execute → verify →
  gap-cycle until pass or a human gate (CHECKPOINT, human_needed batch,
  cycle-3 escalation, Deferred/locked conflicts, user interrupt). Requires a
  human-locked DISCUSSION.md; re-derives position from disk between stages so
  it survives context compaction.
- **Watchdog** (execute + brew): stalled worker → check disk → nudge once →
  respawn fresh (idempotency makes it safe); one respawn per plan.
- **Hot-loop exception** (verify): expensive environments (emulator/device)
  may run the full gap cycle in one agent's environment session — artifacts
  on disk stay identical to the separated protocol.
- **Quick verification tier** (verify): boot-and-smoke after dependency
  changes on native apps — bundling can't see runtime-only failures.

### Changed
- **Two-tier plan context**: LOCKED product decisions vs TECHNICAL NOTES
  (planner's best API understanding). Typings win over technical notes;
  correcting them is Rule 1, not Rule 4 — workers no longer ship deprecated
  calls out of misplaced obedience (observed twice in dogfood-project).
- execute discovery now requires number-matched SUMMARY (mirrors the verifier).

## 0.2.0 — 2026-07-03

Hardening release after the first dogfood (Cauldron) and a three-lens deep audit
(red-team, skill-craft, gaps/installability).

### Install
- Added `.claude-plugin/marketplace.json` — `/plugin marketplace add` now works on the bare repo
- All cross-file references anchored to `${CLAUDE_PLUGIN_ROOT}` (they previously resolved into the user's project)
- Agents gained frontmatter and now register as spawnable agent types
- plugin.json: repository/homepage fields

### Protocol
- Verify rewritten as a four-step protocol with fixed ownership: deterministic checks (orchestrator) → blind static ladder (spawned potion-verifier) → runtime evidence (orchestrator) → verdict; closed truth vocabulary incl. STATIC_ONLY
- Ship gate: staleness check (`verified_at` vs newest code commit) and durable gap acceptance
- Gap flywheel: cycle counter lives in VERIFICATION.md frontmatter; gap plans continue the phase's numbering
- Workers: idempotency check before task 1 (crash-safe re-execution), index.lock retry rule for parallel waves
- Quick mode: observable predicates (≤1 file, ≤30 lines, one revert) + third-consecutive ratchet
- Deviation Rule 2 now keys off the task's verify command, not "critical"
- Cut the unwired runaway-score arithmetic; 3-strike breaker + flywheel budget remain

### New
- `/potion:investigate` — root-cause debugging with a durable `.potion/debug/` session file (Iron Law: no fix without a reproduced root cause)
- Parked-ideas convention (`## Parked` in STATE.md, read by discuss)
- Phase-list mutability: `NN.5` insertion, init re-runs as a new cycle when all phases complete
- Templates: SUMMARY.md, VERIFICATION.md
- Red-flag tables for plan and worker; CHECKPOINT added to the canonical status table
- session-start hook reads the learnings tail (newest entries) instead of the head

## 0.1.0 — 2026-07-03

Initial release: 9 skills, 2 agents, 1 hook. Distilled from GSD, Superpowers,
and gstack; closed-loop design (Law 11) with ratchet learnings.
