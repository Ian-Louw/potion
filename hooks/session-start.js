#!/usr/bin/env node
// Potion session-start hook.
// If the cwd is a Potion project, restore position and surface learnings.
// Runs on startup, /clear, AND compaction — disk state survives all three.
// Silent (exit 0, no output) when .potion/ doesn't exist: zero tax on
// non-Potion projects.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadDeclaredSecrets, findLeakedFiles } = require(path.join(
  __dirname,
  "declared-secrets.js"
));

const root = process.cwd();
const potionDir = path.join(root, ".potion");

function readIfExists(p, maxBytes = 8192) {
  try {
    const stat = fs.statSync(p);
    if (!stat.isFile()) return null;
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(Math.min(stat.size, maxBytes));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

function readTail(p, maxBytes = 262144) {
  // Append-only + newest-wins means the TAIL holds the truth — reading the
  // head would silently drop the newest entries once the file outgrows maxBytes.
  try {
    const stat = fs.statSync(p);
    if (!stat.isFile()) return null;
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    let text = buf.toString("utf8");
    if (start > 0) text = text.slice(text.indexOf("\n") + 1); // drop partial first line
    return text;
  } catch {
    return null;
  }
}

function topLearnings(jsonlPath, n = 3) {
  const raw = readTail(jsonlPath);
  if (!raw) return [];
  const byKey = new Map(); // newest-wins per key
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj.key) byKey.set(obj.key, obj); // later lines overwrite
    } catch {
      /* skip malformed lines */
    }
  }
  return [...byKey.values()]
    .filter((l) => l.type !== "tombstone")
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, n);
}

function readStdinSource() {
  // Hook payloads arrive on stdin as JSON with a `source` field:
  // "startup" | "clear" | "compact". Defensive: any failure → null.
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")).source || null;
  } catch {
    return null;
  }
}

function positionSection(stateText) {
  // The "## Position" section verbatim, up to the next H2.
  // No /m flag: `$` must mean end-of-string, or the lazy capture stops at
  // the first line boundary and returns empty.
  const m = stateText.match(/\n## Position\n([\s\S]*?)(?=\n## |$)/);
  return m ? m[1].trim() : null;
}

function planTally(stateText) {
  // Derive the phase dir from the "- Phase:" line's slug, then count
  // PLAN-*.md vs SUMMARY-*.md — SUMMARY existence = plan complete.
  try {
    const phaseLine = stateText.match(/^- Phase:.*$/m);
    if (!phaseLine) return null;
    const slug = phaseLine[0].match(/\b(\d+(?:\.\d+)?-[a-z0-9-]+)/);
    if (!slug) return null;
    const dir = path.join(potionDir, "phases", slug[1]);
    const files = fs.readdirSync(dir);
    const total = files.filter((f) => /^PLAN-\d+\.md$/.test(f)).length;
    const done = files.filter((f) => /^SUMMARY-\d+\.md$/.test(f)).length;
    return `Plans: ${done} of ${total} complete (SUMMARY existence)`;
  } catch {
    return null;
  }
}

if (!fs.existsSync(potionDir)) process.exit(0);

const source = readStdinSource();
const parts = [];

const state = readIfExists(path.join(potionDir, "STATE.md"));
if (state) {
  parts.push("## Potion project detected — position restored from .potion/STATE.md\n");
  parts.push(state.trim());
}

if (fs.existsSync(path.join(potionDir, "continue-here.md"))) {
  parts.push(
    "\n**A pause checkpoint exists** (.potion/continue-here.md). " +
      "If the user wants to continue this project, use /potion:resume — " +
      "do not re-plan or summarize from memory."
  );
}

const learnings = topLearnings(path.join(potionDir, "learnings.jsonl"));
if (learnings.length) {
  parts.push("\n## Prior learnings (top by confidence — apply and announce when relevant)");
  for (const l of learnings) {
    parts.push(`- [${l.type}] ${l.key}: ${l.insight} (confidence ${l.confidence || "?"})`);
  }
}

const userJournal = path.join(os.homedir(), ".claude", "potion", "knowledge.jsonl");
if (fs.existsSync(userJournal)) {
  const raw = readTail(userJournal);
  if (raw) {
    const byKey = new Map(); // newest-wins per key; re-set moves key to newest position
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj.key) {
          byKey.delete(obj.key); // so later duplicates rank as newest
          byKey.set(obj.key, obj);
        }
      } catch {
        /* skip malformed lines */
      }
    }
    const newest = [...byKey.values()]
      .filter((l) => l.type !== "tombstone")
      .slice(-3)
      .reverse();
    if (newest.length) {
      parts.push("\n## Cross-repo knowledge (newest)");
      for (const l of newest) {
        const repo = (l.source && l.source.repo) || "?";
        const insight = String(l.insight || "").slice(0, 100);
        parts.push(`up: ${l.key} (from ${repo}): ${insight}`);
      }
    }
  }
}

// Retro-scan: declared values already sitting in committed HEAD (standing
// leaks). Warn loudly with file + KEY names — never values. Warn-posture:
// any failure is swallowed, a session is never blocked by this leg.
try {
  const secrets = loadDeclaredSecrets(root);
  if (secrets.length) {
    const leaked = findLeakedFiles(root, secrets);
    if (leaked.length) {
      parts.push(
        "\n## POTION SECRET RETRO-SCAN — standing leak in committed HEAD"
      );
      for (const l of leaked) {
        parts.push(`- ${l.file}: ${l.keys.join(", ")}`);
      }
      parts.push(
        "Record this as a blocker in .potion/STATE.md ## Blockers now " +
          "(file list + KEY names, never values)."
      );
      parts.push(
        "Until these files are cleaned (value replaced by a KEY-name " +
          "reference), commits touching them are blocked by the scrubber. " +
          "Clean them, then this warning disappears."
      );
    }
  }
} catch {
  /* warn-posture: never block a session over the retro-scan */
}

if (source === "compact" && state) {
  // Post-compaction re-grounding: mechanical digest from disk, because the
  // compaction summary may have dropped or distorted mid-phase state.
  try {
    parts.push("\n## Post-compaction re-grounding (mechanical, trust this over the summary)");
    const pos = positionSection(state);
    if (pos) parts.push(pos);
    const tally = planTally(state);
    if (tally) parts.push(tally);
    parts.push(
      "First act: re-read .potion/STATE.md — the compaction summary may " +
        "have dropped or distorted mid-phase state."
    );
  } catch {
    /* warn-posture: never block a session over the digest */
  }
}

if (parts.length) {
  // SessionStart hooks: stdout is injected as context for the session.
  console.log(parts.join("\n"));
}
process.exit(0);
