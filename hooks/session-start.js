#!/usr/bin/env node
// Potion session-start hook.
// If the cwd is a Potion project, restore position and surface learnings.
// Runs on startup, /clear, AND compaction — disk state survives all three.
// Silent (exit 0, no output) when .potion/ doesn't exist: zero tax on
// non-Potion projects.

const fs = require("fs");
const path = require("path");

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

if (!fs.existsSync(potionDir)) process.exit(0);

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

if (parts.length) {
  // SessionStart hooks: stdout is injected as context for the session.
  console.log(parts.join("\n"));
}
process.exit(0);
