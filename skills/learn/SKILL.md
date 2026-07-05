---
name: learn
description: Use when something non-obvious was discovered the hard way — a pitfall, a project convention, a tool quirk, a user preference — or when the user says "remember this", "log a learning", "what have we learned", "didn't we fix this before?", "same bug again", or "this bit us last time".
---

# Potion Learn

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. The compounding loop: what one session learns, every
future session knows.

## The bar

Would knowing this save 5+ minutes in a future session? No → don't log it.
Also don't log what the repo already records (code structure, git history,
CLAUDE.md content).

## Logging

Append one line to `.potion/learnings.jsonl`:

```json
{"type":"pitfall","key":"expo-metro-cache","insight":"Metro serves stale bundles after branch switch; always start with --clear","confidence":8,"files":["package.json"],"ts":"2026-07-03"}
```

- `type`: per CORE.md's canonical list (includes `check` and `tombstone`)
- `key`: stable kebab-case id. **Dedup is newest-wins by key** — to update or
  correct a learning, append a new line with the same key. Never edit the file
  (one exception, in CORE.md: compaction past ~500 lines).
- `files`: backpointers used for staleness — if those files disappear, the
  learning is suspect.
- `confidence`: 1-10. Raise it (append) when the learning proves out again.

## The ratchet — pitfalls become permanent checks

Logging a `pitfall` is half the job. Before moving on, ask three questions:

1. **Why did this happen?** (root cause, not symptom)
2. **What else has the same problem?** (blast radius — grep for siblings now)
3. **What prevents it from happening again?**

If the prevention is mechanically checkable — a command that fails or a grep that
matches when the pitfall recurs — promote it by appending a `check` entry:

```json
{"type":"check","key":"check-expo-metro-cache","insight":"stale bundle after branch switch","cmd":"grep -q '\\-\\-clear' package.json","expect":"match","ts":"2026-07-03"}
```

A promoted check takes its OWN key, conventionally `check-{source-key}` —
never reuse the source pitfall's key, because newest-wins dedup and compaction
operate per key with no type scoping: a shared key shadows one entry and
compaction deletes it.

Checks run under CORE's check-runner contract: POSIX sh at repo root;
`exit N` compares exit code, anything else compares trimmed stdout
exactly; nonzero exit with matching stdout is still a MATCH — never
add `|| true`.

`/potion:verify` runs every `check` entry on every pass; a failing one is
reported as a regression. Each click of the ratchet locks in — nothing regresses.
A pitfall that bites twice without earning a check entry is a process failure,
not bad luck.

## Recall

Reading happens automatically at session start (hook) and in /potion:resume.
When asked "what have we learned": show newest-per-key grouped by type, flag
stale entries (entries whose `files` paths no longer exist on disk) and contradictions (same key, opposing insights),
and offer to prune — pruning appends a `{"type":"tombstone","key":...}` line.

## Exit

Confirm what was logged in one line: `Learned: {key} ({type}, confidence N)`.
