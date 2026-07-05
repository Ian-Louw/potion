# Potion Philosophy

Eleven laws. Each exists because its absence caused a real, observed failure in
hundreds of Claude Code sessions. If a rule doesn't trace to a failure, it's ceremony.

## 1. The filesystem is the memory

Conversation context is disposable — it gets compacted, cleared, and forgotten.
Disk survives. Everything that matters is written to `.potion/`, and **completion
state is derived from artifact existence**: a plan is done when its SUMMARY exists,
not when a status field says so. Derived state cannot drift.

Corollary: git history is ground truth. A resumed agent's first act is verifying
that the commits it was told about actually exist.

## 2. Plans are prompts

A PLAN.md is not a document that gets transformed into instructions — it IS the
instructions. It is handed verbatim to a fresh agent who has zero context and
questionable taste. The specificity test: *could a different Claude instance execute
this plan without asking a single question?* If not, the plan fails.

Placeholders are plan failures: "TBD", "add appropriate error handling",
"similar to task 3" — all of these mean the planner deferred thinking to the
executor, who is worse positioned to do it.

## 3. Goal-backward beats forward

Forward planning asks "what should we build?" and produces plausible task lists
that miss the point. Goal-backward asks, in order:

1. What must be **TRUE** when this is done? (3–7 user-observable truths)
2. What must **EXIST** for those truths to hold? (specific files, specific contents)
3. What must be **WIRED**? (component → API, API → DB, form → handler)

Key links are where 80% of stubs hide. A component that exists but is never
imported is a prop, not a feature.

## 4. Evidence before claims

**NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

- "Should work now" → run it.
- "I'm confident" → confidence is not evidence.
- "I tested it earlier" → the code changed since then. Test again.
- Agent reports success → not sufficient. The diff and the output are sufficient.

And: **do not trust summaries.** A SUMMARY.md documents what an agent *said* it did.
Verification checks what actually exists, at three levels:
exists → substantive (not a stub) → wired (actually used).

## 5. Context is a budget

Output quality degrades as context fills. Target ~50% usage; past that you're in
degradation mode. Practical consequences:

- 2–3 tasks per plan, never five.
- Orchestrators stay lean (~15% of context); workers get 100% fresh.
- Workers write reports to disk and return ≤15 lines of structured status.
- Fresh agents with explicit state beat resumed agents with stale context.

## 6. User decisions are locked

Discussion output sorts everything into three buckets that all downstream agents
must honor:

- **Decisions** — locked. Re-litigating one is a defect.
- **Claude's Discretion** — genuinely free choices.
- **Deferred** — explicitly out of scope. Sneaking one in is scope creep.

## 7. Calibrated autonomy

Four deviation rules govern what an executor does when reality diverges from plan:

1. Found a bug → auto-fix it.
2. Missing critical functionality (correctness, not features) → auto-add it.
3. Blocked → auto-unblock.
4. Architectural change (new table, new service, new auth approach) → **STOP and ask.**

Rule 4 always wins. Genuinely unsure which rule applies? That's Rule 4.
Every deviation is recorded in the SUMMARY — or the line "None: plan executed
exactly as written."

## 8. Circuit breakers, not willpower

Runaway loops are stopped by numbers, not by good intentions:

- **3 failed fixes** for the same problem → stop. This is not a failed hypothesis;
  it's a wrong architecture. Open a root-cause investigation or talk to the human.
- **3 verify→fix cycles** per phase, counted on disk (sessions clear between
  steps — a budget that lives only in context is no budget).
- **3 consecutive quick tasks** → that's a phase wearing a disguise; stop and
  discuss. Every breaker is a number, because willpower isn't a mechanism.

## 9. Rationalizations are predictable — pre-empt them

The model's failure modes announce themselves as thoughts: "this is too simple to
need a plan", "it's about the spirit, not the ritual", "this is different because…".
Skills counter the *exact* excuses observed in the wild, keyed to internal monologue.
And the spirit clause holds everywhere: **violating the letter of the rules is
violating the spirit of the rules.**

But — pick battles. Discipline is for discipline problems. A one-line fix does not
need a phase. That's what quick mode is for.

## 10. Less is more

- One skill per failure mode; a skill that prevents nothing ships nothing.
- Descriptions say **when** to use a skill, never what it does — summaries become
  shortcuts that agents take instead of reading the skill.
- Shared rules live in exactly one file (core/CORE.md); skills reference it.
- Every installed-but-unused skill taxes every session's context. Prune quarterly:
  under 5 uses, out it goes.

## 11. Close every loop

Potion's phase cycle is a **closed loop**: a bounded goal (must-have truths), an
independent checker (the verifier, who never trusts the producer), durable state
(`.potion/`), and human checkpoints (Rule 4, `human_needed`). Open loops —
exploration without a termination condition — are for discovery only; production
work runs closed. Every autonomous cycle therefore carries all four:

1. A goal condition someone could check mechanically.
2. A verifier independent of the producer, running **deterministic checks first**
   (tests, build, types, lint) — cheap verification is what makes loops viable.
3. An iteration budget. The gap flywheel runs at most 3 cycles before escalating;
   unbounded retry is not persistence, it's a token furnace.
4. A kill switch the human can always reach.

The Operator Test governs all of it: **if the agent cannot prove it is done,
you are not engineering a loop — you are automating drift.**

And the ratchet: when a failure is understood, don't just fix it — ask what else
has the same problem and what prevents recurrence, then promote that prevention
to a permanent check. Each click of the ratchet locks in; nothing regresses.
