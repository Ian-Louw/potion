---
name: learn
description: Use when something non-obvious was discovered the hard way — a pitfall, a project convention, a tool quirk, a user preference — or when the user says "remember this", "log a learning", "what have we learned", "didn't we fix this before?", "same bug again", or "this bit us last time".
---

# Potion Learn

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`. The compounding loop: what one session learns, every
future session knows.

**Entry contract (must hold in every appended journal line):**
- Grammar: one JSON object per line — `type`, `key`, `insight`,
  `confidence`, `files`, `ts`, optional `"incident":{date,bad,fix}`.
- The bar: would this save 5+ minutes in a future session? No → don't log.
  Don't log what the repo already records (code, git history, CLAUDE.md).
- Key discipline: newest-wins dedup per key — update by appending the same
  key, never editing; a promoted check takes its OWN `check-{source-key}`
  key, never the source pitfall's.
Before finishing, re-read the appended entry against this block; fix in
place, or regenerate it — at most once.

## Logging

Append one line to `.potion/learnings.jsonl`:

```json
{"type":"pitfall","key":"expo-metro-cache","insight":"Metro serves stale bundles after branch switch; always start with --clear","confidence":8,"files":["package.json"],"ts":"2026-07-03"}
```

- `type`: per CORE.md's canonical list (includes `check` and `tombstone`)
- `key`: stable kebab-case id; discipline per the entry contract above (the
  one edit exception, in CORE.md: compaction past ~500 lines).
- `files`: backpointers used for staleness — if those files disappear, the
  learning is suspect.
- `confidence`: 1-10. Raise it (append) when the learning proves out again.
- `incident`: optional — `"incident":{"date":"YYYY-MM-DD","bad":"<exact bad
  output or command>","fix":"<the delta that fixed it>"}`. Rules that carry
  their incident are stickier. Forward-only, plus backfill where the details
  already sit in artifacts.

## Promote up

Promote up: if the entry clears the cross-repo bar (CORE: confidence >= 8,
generalizable, loop-born, nothing repo-private), ALSO append it to
`~/.claude/potion/knowledge.jsonl` with the `source` field filled. Create the
directory on first use. Say 'Promoted: {key}' when you do. When in doubt,
don't — a polluted shared journal is worse than a sparse one.

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

Why `check-{source-key}` gets its own key: dedup and compaction operate per
key with no type scoping — a shared key shadows one entry and compaction
deletes it.

Checks run under CORE's check-runner contract: POSIX sh at repo root;
`exit N` compares exit code, anything else compares trimmed stdout
exactly; nonzero exit with matching stdout is still a MATCH — never
add `|| true`.

`/potion:verify` runs every `check` entry on every pass; a failing one is
reported as a regression. Each click of the ratchet locks in — nothing regresses.
A pitfall that bites twice without earning a check entry is a process failure,
not bad luck.

## Distill

Triggered at compaction, or on demand (`/potion:learn distill`). Procedure:

1. Dedup the journal newest-wins by key; drop tombstoned entries.
2. Cluster the entries into topics (2-6 entries per page typical); slug each
   topic (`git-and-worktrees.md`, `github-rendering.md`).
3. REGENERATE each affected page whole — title, a 2-4 sentence synthesis
   paragraph (the compounding insight, not a list), then one `### {key}`
   block per entry: insight, source citation (key; plus repo for user
   scope), confidence, ts. Never patch a page; rebuild it.
4. Rewrite `index.md`: `- [{topic}]({file}) — {one-line scope} ({N} entries)`.
5. Project journal → `.potion/knowledge/`; user journal → `~/.claude/potion/pages/`.
   Commit project pages with the repo; user pages live outside git.

Pages are cache: when a page and the journal disagree, the journal wins and
the page is due a rebuild.

## Lint

Runs automatically after every Distill, or on demand (`/potion:learn lint`).
Project scope first, then user scope. Four hunts:

1. Contradictions — within each topic, judge entry insights and the page
   synthesis against each other for incompatible assertions. Mechanical greps
   cannot see semantic conflict; you are the linter.
2. Stale claims — entry `files` backpointers that no longer exist on disk;
   page claims citing keys that a newer same-key entry superseded.
3. Orphans — page `### {key}` blocks whose key no longer greps to a live
   (non-tombstoned) journal line.
4. Coverage gaps — confidence >= 8 live entries no page distills.

Actions — the line that may not be crossed:

- Cache-side (orphans, stale page claims, coverage gaps): rebuild the
  affected page(s) whole from the journal — refreshing cache is not editing
  knowledge.
- Truth-side (contradictions; any urge to tombstone or reword a journal
  entry): NEVER self-resolve. Route to STATE.md `## Decision queue` (added +
  expires dates), one line, both sources cited (`lint: X contradicts Y —
  human call`). The next /potion:discuss tables it.

Report as a table: hunt | location | finding | action (rebuilt / routed /
none). Zero findings is a valid outcome — say 'lint clean' explicitly.

## Recall

Reading happens automatically at session start (hook) and in /potion:resume.
When asked "what have we learned": show newest-per-key grouped by type, flag
stale entries (entries whose `files` paths no longer exist on disk) and contradictions (same key, opposing insights),
and offer to prune — pruning appends a `{"type":"tombstone","key":...}` line.

## Exit

Confirm what was logged in one line: `Learned: {key} ({type}, confidence N)`.
