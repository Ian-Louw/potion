---
name: consolidate
description: Use when a repo's living docs have drifted from reality — when the user says "consolidate the docs", "compress BUGS.md", "the docs are stale", "tombstone this file", "bring the docs to current truth", or when a POTION DOC STALENESS notice appears at session start. Operates only on files listed in .potion/docs.json.
---

# Potion Consolidate

Inherit `${CLAUDE_PLUGIN_ROOT}/core/CORE.md`.

Docs rot in a known way: closed work stays verbose, open lists fragment
across files, and "current" instructions quietly become the wrong way to do
things. This lane compresses history, corrects drift, and keeps one doctrine:
**history lives in git hashes, open work lives in exactly one file, and
nothing is deleted before it is rescued.** The manifest
(`.potion/docs.json`) is the contract — each entry's `role` says what the
file is FOR, and the rewrite must land the file inside that role.

Scope: an argument names one manifest file; no argument means every entry
the staleness rules flag (over `stale_days` since `last_consolidated`, or
over `cap_lines`). A file not in the manifest is out of scope — offer to add
it (human confirms role/caps) rather than consolidating it ad hoc.

## Steps

1. **Ground truth first.** Read the target doc IN FULL, then verify its
   claims against live sources before moving a word: git log, the other
   manifest docs, and executable evidence — run `learnings.jsonl`
   `cmd`/`expect` ratchets it cites, grep migrations/functions for "done"
   claims, check referenced files still exist. Done when: every open,
   blocked, or "still broken" claim in the doc is classified as verified-
   done, verified-open, unverifiable-human, or wrong.
2. **Classify every item.** Verified-done → compress to an archive one-liner.
   Still open → keep, and point it at the entry's `open_list` doc — open
   work lives in exactly ONE file; duplicates elsewhere become pointers.
   Superseded or wrong → correct it, or tombstone the whole file when
   nothing living remains. Durable lesson → promote to the repo's
   pitfalls/decisions ledger (or `learnings.jsonl` via /potion:learn).
   **Unverifiable-human items STAY OPEN and are flagged** — inventing status
   for console/credential work is this lane's cardinal sin (same truth-side
   human gate as Lint). Done when: no item lacks a disposition.
3. **Rescue before deleting.** Anything recorded nowhere else — a gate, a
   credential fact, a warning — moves INTO a living doc first, in the same
   commit series, before the old text is cut. Done when: a reader of only
   the living docs loses nothing a reader of the old doc had.
4. **Rewrite to the manifest role.** One role per doc, cross-linked, no
   duplicated open items. A fully superseded doc becomes a ~15-line
   tombstone mapping its sections to their living homes. Every rewritten
   file's header names the git hash that holds the verbose version (the
   commit being replaced — resolve it BEFORE committing). Respect standing
   caps (STATE.md's 60-line stop-drift cap; `cap_lines` here). Done when:
   the file reads as current truth and its history pointer resolves.
5. **Bookkeeping.** Set the entry's `last_consolidated` to today in
   `.potion/docs.json` (include this in the file's commit). Done when: a
   re-run of the staleness rules no longer flags the file.
6. **Commit per file, honoring the mode.** Manual (default): commit
   `docs(<area>): consolidate <file> …` and push per the repo's norm.
   Automated/scheduled mode (when the invoker says so): commit to
   `potion/consolidate-<date>` and report — never push a rewrite to the
   default branch unattended. Done when: every touched file is committed
   and nothing consolidation-related is left dirty.
7. **Exit report.** One table: file · before/after lines · items rescued
   (named) · history hash. Plus a one-line list of human-owned items left
   open. Done when: the report is on screen.

## Emission contract

Before exiting, re-read against this list; fix in place, at most once:
- every consolidated file's header carries a resolvable history hash;
- `.potion/docs.json` dates bumped for exactly the files touched;
- no open item exists in two files (pointers don't count);
- rescued items named in the report, each with its new home;
- all commits landed; working tree clean of consolidation changes.

## Red flags

| Thought | Reality |
|---|---|
| "It's probably done by now" | Verify or leave it open and flagged. A wrong "done" erases real work. |
| "This detail is old, delete it" | Old ≠ recorded elsewhere. Rescue first, cut second. |
| "I'll merge these two docs while I'm here" | Roles come from the manifest and the human. Propose, don't restructure. |
| "The history hash can be added later" | A rewrite without its pointer orphans the archive. Resolve it now. |
| "This file isn't in the manifest but clearly needs it" | Offer to add it — human confirms role and caps. Never consolidate off-manifest. |
| "Shorter is better everywhere" | A living runbook needs correctness, not compression. Fix the stale step, keep the recipe. |
