#!/usr/bin/env node
// Potion session-start hook.
// If the cwd is a Potion project, restore position and surface learnings.
// Runs on startup, /clear, AND compaction — disk state survives all three.
// Silent (exit 0, no output) when .potion/ doesn't exist: zero tax on
// non-Potion projects.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { loadDeclaredSecrets, findLeakedFiles } = require(path.join(
  __dirname,
  "declared-secrets.js"
));
const { loadEscalations } = require(path.join(__dirname, "escalations.js"));

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

// Staleness beacon (phase 18): two-signal staleness (abandonment vs
// potion-bypassed), stale-Position (F-24), and expired-gate scan.
// Warn-posture: any throw is swallowed, the section is skipped — a session
// is never blocked by this leg.
try {
  const STALE_DAYS = 3;
  const DAY = 86400;
  const gitTs = (pathspec) => {
    try {
      const out = execSync(
        "git log -1 --format=%ct" + (pathspec ? " -- " + pathspec : ""),
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      ).trim();
      const n = parseInt(out, 10);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };
  const now = Date.now() / 1000;
  const daysOld = (ts) => Math.floor((now - ts) / DAY);
  const dateOf = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
  const lastRepo = gitTs("");
  const lastPotion = gitTs('".potion/"');
  const statusM = state ? state.match(/^- Status:\s*([a-z]+)/m) : null;
  const status = statusM ? statusM[1] : null;
  const motion =
    status === "executing" || status === "verifying" || status === "planning";
  const offer =
    "Offer pause-or-resume now: /potion:resume to pick the work back up, or /potion:pause to record the stall honestly.";

  let beacon = null; // lines of whichever staleness signal fired
  if (motion && lastRepo !== null && now - lastRepo >= STALE_DAYS * DAY) {
    // Signal 1 (abandonment): motion claimed, no commits at all.
    beacon = [
      "\n## POTION STALENESS BEACON — motion claimed, none observed",
      `STATE says '${status}' but the last commit is ${daysOld(lastRepo)} days old (${dateOf(lastRepo)}).`,
    ];
  } else if (
    motion &&
    lastRepo !== null &&
    now - lastRepo < STALE_DAYS * DAY &&
    lastPotion !== null &&
    now - lastPotion >= STALE_DAYS * DAY
  ) {
    // Signal 2 (bypass): repo moves, .potion/ doesn't.
    beacon = [
      "\n## POTION STALENESS BEACON — potion is being bypassed",
      `Repo commits continue but .potion/ was last touched ${daysOld(lastPotion)} days ago (${dateOf(lastPotion)}).`,
    ];
  }

  // F-24: STATE's Last activity date lagging the actual last commit.
  let lagLine = null;
  if (state && lastRepo !== null) {
    const la = state.match(/^- Last activity:\s*(\d{4}-\d{2}-\d{2})/m);
    if (la) {
      const stateMs = Date.parse(la[1]);
      if (
        Number.isFinite(stateMs) &&
        lastRepo * 1000 - stateMs >= STALE_DAYS * DAY * 1000
      ) {
        lagLine = `STATE's Last activity (${la[1]}) lags the last commit (${dateOf(lastRepo)}) — Position is stale; update STATE.md.`;
      }
    }
  }

  if (beacon) {
    if (lagLine) beacon.push(lagLine);
    beacon.push(offer);
    parts.push(...beacon);
  } else if (lagLine) {
    parts.push("\n## POTION STALENESS BEACON — Position is stale", lagLine);
  }

  // Expired-gate scan (current phase only): DISCUSSION.md gate entries +
  // RUNBOOK-*.md frontmatter. A RUNBOOK-NN with SUMMARY-NN.md is cleared —
  // skipped, and same-named DISCUSSION gates are suppressed too.
  try {
    const today = new Date().toISOString().slice(0, 10);
    // \n excluded: the same regex runs over multi-line RUNBOOK frontmatter,
    // where an unbounded class would capture past the gate line's end.
    const gateRe = /gate:\s*"?([^",}\n]+)"?/;
    const expRe = /expires:\s*"?(\d{4}-\d{2}-\d{2})/;
    const phaseLine = state ? state.match(/^- Phase:.*$/m) : null;
    const slug = phaseLine
      ? phaseLine[0].match(/\b(\d+(?:\.\d+)?-[a-z0-9-]+)/)
      : null;
    if (slug) {
      const phaseDir = path.join(potionDir, "phases", slug[1]);
      const files = fs.readdirSync(phaseDir);
      const cleared = new Set(); // gate names resolved by a runbook SUMMARY
      const expired = []; // { name, date, src }
      for (const f of files) {
        const m = f.match(/^RUNBOOK-(\d+)\.md$/);
        if (!m) continue;
        const text = readIfExists(path.join(phaseDir, f));
        if (!text) continue;
        // Frontmatter = text between the first `---` line and the next.
        const lines = text.split("\n");
        const i = lines.findIndex((l) => l.trim() === "---");
        const j = i >= 0 ? lines.findIndex((l, k) => k > i && l.trim() === "---") : -1;
        const fm = j > i && i >= 0 ? lines.slice(i + 1, j).join("\n") : "";
        const g = fm.match(gateRe);
        if (!g) continue;
        const name = g[1].trim();
        if (files.includes(`SUMMARY-${m[1]}.md`)) {
          cleared.add(name); // gate resolved; nagging is a defect
          continue;
        }
        const e = fm.match(expRe);
        if (e && e[1] < today) expired.push({ name, date: e[1], src: f });
      }
      const disc = readIfExists(path.join(phaseDir, "DISCUSSION.md"));
      if (disc) {
        for (const line of disc.split("\n")) {
          const g = line.match(gateRe);
          if (!g) continue;
          const name = g[1].trim();
          if (cleared.has(name)) continue;
          const e = line.match(expRe);
          // No parseable expires date → old grammar, skip silently.
          if (e && e[1] < today)
            expired.push({ name, date: e[1], src: "DISCUSSION.md" });
        }
      }
      if (expired.length) {
        parts.push("\n## POTION EXPIRED GATE — decide, renew, or abandon");
        for (const g of expired) {
          parts.push(`- ${g.name}: expired ${g.date} (${g.src})`);
        }
        parts.push(
          "Handle at /potion:resume or /potion:discuss — renewal is one conscious line (bump expires)."
        );
      }
    }
  } catch {
    /* warn-posture: never block a session over the gate scan */
  }
} catch {
  /* warn-posture: never block a session over the staleness beacon */
}

// Expired/inert-grant scan (phase 19): standing escalations in
// .potion/escalations.md whose expires date has passed, or that lack the
// mandatory expires date entirely (inert — the approve hook never matches
// them). Warn-posture: any throw is swallowed, the section is skipped — a
// session is never blocked by this leg.
try {
  const entries = loadEscalations(root);
  const today = new Date().toISOString().slice(0, 10);
  const expired = entries.filter((e) => e.expires !== null && e.expires < today);
  const inert = entries.filter((e) => e.expires === null);
  if (expired.length || inert.length) {
    parts.push("\n## POTION EXPIRED ESCALATION — decide, renew, or abandon");
    for (const e of expired) {
      parts.push(`- ${e.name}: expired ${e.expires} (.potion/escalations.md)`);
    }
    for (const e of inert) {
      parts.push(`- ${e.name}: missing mandatory expires — grant is inert until dated`);
    }
    parts.push(
      "Renewal is one conscious line — bump expires in .potion/escalations.md."
    );
  }
} catch {
  /* warn-posture: never block a session over the escalation scan */
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
