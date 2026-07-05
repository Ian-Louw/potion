# 🧪 Potion

**The magic potion for Claude Code.** A lean project framework distilled from the best of
[GSD](https://github.com/gsd-build/get-shit-done), [Superpowers](https://github.com/obra/superpowers),
and gstack — minus their combined ~1MB of ceremony.

Eleven skills. Two agents. One hook. The filesystem is the memory, plans are
prompts, and nothing is "done" without evidence.

## Why

The three big Claude Code frameworks each got one thing profoundly right:

| Framework | Got right | Got wrong |
|---|---|---|
| **GSD** | Durable state on disk, goal-backward planning, mechanical verification | 27 commands, milestone bureaucracy, 625KB of prompts |
| **Superpowers** | Skill-writing craft: Iron Laws, rationalization counters | Mandatory ceremony on every trivial task |
| **gstack** | Evidence-based verification, circuit breakers, compounding learnings | 48 skills, ~500 duplicated preamble lines in each |

Potion keeps the mechanisms and cuts the mass. Every skill is under ~150 lines.
Shared rules live in **one** core document. Enforcement lives in state files and
verification ladders, not in ALL-CAPS pleading.

## The loop

```
/potion:init        once per project → creates .potion/ (PROJECT.md, STATE.md)
   │
   ▼
/potion:discuss     lock decisions before planning (Decisions / Discretion / Deferred)
   ▼
/potion:plan        goal-backward plan — what must be TRUE, EXIST, and be WIRED
   ▼
/potion:execute     fresh agent per plan, atomic commit per task, 4 deviation rules
   ▼
/potion:verify      trust nothing — exists → substantive → wired, evidence required
   ▼
/potion:ship        tests, changelog cross-check, PR
```

Plus four utilities: `/potion:pause` (save exact position), `/potion:resume`
(restore it), `/potion:learn` (log insights that compound across sessions), and
`/potion:investigate` (root-cause debugging with a durable session file — no
fix without a reproduced root cause).

And the crank, automated: **`/potion:brew`** runs plan → execute → verify →
gap-cycle end-to-end, stopping only at human gates (Rule 4 checkpoints,
human-verify batches, cycle-3 escalation). Decisions stay human — brew refuses
to run without a locked DISCUSSION.md.

## The five laws that matter most

(five of eleven — the full canon with rationale is in [PHILOSOPHY.md](PHILOSOPHY.md))

1. **The filesystem is the memory** (Law 1). Progress is derived from which artifacts exist,
   never from a status field. State can't drift when it's computed from disk.
2. **Plans are prompts** (Law 2). A PLAN.md is executed verbatim by a fresh agent. If a plan
   needs interpreting, it's a bad plan.
3. **Goal-backward beats forward** (Law 3). Don't ask "what should we build?" Ask "what must
   be TRUE when we're done?" — then derive what must exist and what must be wired.
4. **Evidence before claims** (Law 4). "Should work now" is not a state of the world.
   Confidence is not evidence. Run it, read the output, then speak.
5. **Less is more** (Law 10). One skill per failure mode. If a skill doesn't prevent a real,
   observed failure, it doesn't ship.

Full rationale in [PHILOSOPHY.md](PHILOSOPHY.md). Shared rules every skill inherits
are in [core/CORE.md](core/CORE.md).

## Closed loops by design

Potion's phase cycle is a **closed loop** in the loop-engineering sense: a bounded
goal, an independent checker, durable state, and a human checkpoint — with budgets
and kill switches, not vibes:

| Loop layer | Potion mechanism |
|---|---|
| Contract | `must_haves` (truths / artifacts / key links) + locked decisions |
| State | `.potion/` — progress derived from artifacts on disk; strays route to `## Parked`, nothing evaporates; session continuity is rewritten whenever Position moves |
| Checker | blind verifier: deterministic checks first, then exists → substantive → wired; runtime proof lands in `evidence/` and VERIFICATION.md cites it by path; evidence only counts against a fresh build serving HEAD |
| Budgets | 3-strike fix breaker, 3-cycle gap-flywheel cap (counter on disk), quick-task ratchet |
| Human checkpoint | Rule 4 deviations, `human_needed` flags, ship gate |
| Ratchet | pitfalls promote to permanent `check` entries the verifier runs on every pass — each a POSIX-sh command with an exact `expect`, mechanically MATCH / MISMATCH / BROKEN; learnings travel forward too, delivered as keys in every worker's spawn digest |

The Operator Test governs everything: *if the agent cannot prove it is done,
you are not engineering a loop — you are automating drift.*

## Install

```bash
# from GitHub (Claude Code)
/plugin marketplace add Ian-Louw/potion
/plugin install potion@potion
```

Alternative: clone the repo and run `claude --plugin-dir path/to/potion` for a
zero-setup trial. Either way, install the whole plugin — do NOT copy `skills/`
alone into a skills directory: the shared contract in `core/`, the `templates/`,
`hooks/`, and `agents/` are load-bearing and only load through the plugin system.

Only runtime dependency: `node` on PATH (for the session-start hook).

## Quickstart: your first brew

Install the plugin (needs `node` on PATH):

```bash
/plugin marketplace add Ian-Louw/potion
/plugin install potion@potion
```

The toy project: a CLI guess-the-number game in Node — plain `stdin`, no
framework, so every step has a real command to run. Make it a repo (Potion
requires git — commits are its ground truth):

```bash
mkdir guess && cd guess && git init
```

**1. `/potion:init`** — answer a few questions about goals and scope. You get:

```
.potion/
├── PROJECT.md    # goals, key decisions, out-of-scope
└── STATE.md      # position digest — where you are, always current
```

**2. `/potion:discuss`** — lock the decisions before any planning. For the toy:
you decide "stdin interface, no deps" and it lands in DISCUSSION.md under
**Decisions** — from here on it's binding, not a suggestion an agent can drift
past.

**3. `/potion:plan`** — a goal-backward plan appears:

```
.potion/phases/01-core-game/
├── DISCUSSION.md
└── PLAN-01.md
```

The plan's frontmatter is its contract — `must_haves` lists what must be
**TRUE** when done, what must **EXIST** on disk, and what must be **WIRED**
together (the `key_links`).

**4. `/potion:execute`** — a fresh worker reads PLAN-01.md verbatim and runs
it: one atomic commit per task, deviations handled by four fixed rules. When
it finishes, `SUMMARY-01.md` appears next to the plan — the summary's
existence *is* the completion record; there is no status field to drift.

**5. `/potion:verify`** — the four-step protocol: deterministic checks, a
blind static audit (the auditor is told nothing about what the worker
claimed), runtime evidence, verdict. For the toy that means actually playing
a round of guess-the-number and saving the transcript:

```
.potion/phases/01-core-game/
├── PLAN-01.md
├── SUMMARY-01.md
├── VERIFICATION.md            # verdict: pass
└── evidence/
    └── 01-game-transcript.txt
```

`verdict: pass` — that's not the agent's opinion, that's the ladder.

From here, **`/potion:brew`** automates the crank — plan → execute → verify →
gap-cycle in one command, stopping only at human gates. Decisions stay yours:
brew refuses to run without a locked DISCUSSION.md.

## What's in the box

```
potion/
├── core/CORE.md            # shared contract: voice, questions, evidence, statuses
├── skills/                 # init, discuss, plan, execute, verify, ship, brew,
│                           #   pause, resume, learn, investigate
├── agents/                 # potion-worker (executor), potion-verifier (auditor)
├── hooks/                  # session-start: restores position + surfaces learnings
├── templates/              # PROJECT.md, STATE.md, PLAN.md, SUMMARY.md,
│                           #   VERIFICATION.md, continue-here.md
└── PHILOSOPHY.md
```

State lives in your repo at `.potion/`:

```
.potion/
├── PROJECT.md              # goals, locked decisions, out-of-scope (with why)
├── STATE.md                # <60-line digest: position, recent decisions, resume point
├── learnings.jsonl         # append-only insights, newest-wins
├── continue-here.md        # transient pause file (deleted on resume)
└── phases/NN-slug/
    ├── DISCUSSION.md       # Decisions / Claude's Discretion / Deferred
    ├── PLAN-NN.md          # the prompt an executor runs verbatim
    ├── SUMMARY-NN.md       # existence of this file = plan complete
    ├── VERIFICATION.md     # ladder results + structured gaps
    └── evidence/           # runtime proof artifacts, referenced by path from VERIFICATION.md
```

## Credits

Standing on the shoulders of GSD, Superpowers, and gstack. Potion is a distillation,
not a replacement — if you want more machinery, those projects have it.

MIT licensed. Brewed with Claude Code.
