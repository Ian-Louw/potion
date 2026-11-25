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
const { resolvePhase } = require(path.join(__dirname, "phase-slug.js"));

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

// Standing-notice throttle: grammar-drift, doc-staleness and
// evidence-staleness show at most once per local calendar day per repo.
// Store shape: { "<abs repo cwd>": { "<notice name>": "YYYY-MM-DD" } }.
// POTION_NOTICES_FILE overrides the path (tests never touch the real file).
function noticesFile() {
  return (
    process.env.POTION_NOTICES_FILE ||
    path.join(os.homedir(), ".claude", "potion", "notices.json")
  );
}

function shouldShow(repo, name) {
  // Never throws. Any read/parse/write error → true (show the notice).
  // Call ONLY when the notice would otherwise print: a true return records
  // today as the last-shown date.
  try {
    // These notices are not position information: on /clear and compaction
    // they are suppressed entirely.
    if (source === "clear" || source === "compact") return false;
    const file = noticesFile();
    const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local
    let store = {};
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        store = parsed;
      }
    } catch {
      /* missing or garbage store → start fresh; the notice shows */
    }
    const entry =
      store[repo] && typeof store[repo] === "object" ? store[repo] : {};
    if (entry[name] === today) return false;
    entry[name] = today;
    store[repo] = entry;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store, null, 2) + "\n");
    return true;
  } catch {
    return true;
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
  // Resolve the phase dir from the "- Phase:" line (shared resolver), then
  // count PLAN-*.md vs SUMMARY-*.md — SUMMARY existence = plan complete.
  try {
    const phase = resolvePhase(stateText, potionDir);
    if (!phase) return null;
    const files = fs.readdirSync(phase.dir);
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
    const phase = state ? resolvePhase(state, potionDir) : null;
    if (phase) {
      const phaseDir = phase.dir;
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

// Doc-staleness scan: consolidation-managed docs declared in
// .potion/docs.json get NOTICED when they age past stale_days or grow past
// cap_lines. Notice-only — /potion:consolidate is the only mutating lane.
// Opt-in: repos without a manifest are silently skipped (M7 offers one).
// Warn-posture: any throw is swallowed — a session is never blocked by
// this leg.
try {
  const manifestRaw = readIfExists(path.join(potionDir, "docs.json"), 65536);
  if (manifestRaw) {
    const manifest = JSON.parse(manifestRaw);
    const docs = Array.isArray(manifest.docs) ? manifest.docs : [];
    const today = Date.now();
    const DAY_MS = 86400000;
    const stale = [];
    for (const d of docs) {
      if (!d || typeof d.path !== "string") continue;
      const abs = path.join(root, d.path);
      if (!fs.existsSync(abs)) {
        stale.push(`${d.path}: listed in .potion/docs.json but missing on disk (manifest rot)`);
        continue;
      }
      const reasons = [];
      const staleDays = Number.isFinite(d.stale_days) ? d.stale_days : 30;
      const lastMs = Date.parse(d.last_consolidated);
      if (!Number.isFinite(lastMs)) {
        reasons.push("no valid last_consolidated date");
      } else {
        const age = Math.floor((today - lastMs) / DAY_MS);
        if (age > staleDays) reasons.push(`${age} days since consolidation (limit ${staleDays})`);
      }
      if (Number.isFinite(d.cap_lines)) {
        // Whole-file read is fine here: managed docs are digests by contract.
        const text = readIfExists(abs, 1048576);
        if (text) {
          // Count like wc -l (stop-drift's convention): a trailing newline
          // does not start a phantom extra line.
          const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
          if (lines > d.cap_lines) reasons.push(`${lines} lines (cap ${d.cap_lines})`);
        }
      }
      if (reasons.length) stale.push(`${d.path}: ${reasons.join(" and ")}`);
    }
    if (stale.length && shouldShow(root, "doc-staleness")) {
      parts.push("\n## POTION DOC STALENESS — consolidation-managed docs have drifted");
      for (const s of stale) parts.push(`- ${s}`);
      parts.push(
        "Run /potion:consolidate — nag only, shown once a day."
      );
    }
  }
} catch {
  /* warn-posture: never block a session over the doc-staleness scan */
}

// Grammar-drift scan (phase 20): repos initialized under older .potion
// grammar get NOTICED, not silently left behind. Cheap fs/string checks
// only — no git calls, no template reads, no home-dir reads. Notice-only:
// this leg never creates, edits, or commits any file; /potion:update is the
// only mutating lane. Warn-posture: any throw is swallowed — a session is
// never blocked by this leg.
try {
  const drift = [];
  if (!fs.existsSync(path.join(potionDir, "verify-env.md"))) {
    drift.push("verify-env.md declaration missing (planners refuse runtime truths)");
  }
  if (
    state &&
    (!/^## Fog$/m.test(state) || !/^## Decision queue$/m.test(state))
  ) {
    drift.push("STATE.md predates the three-bucket grammar (Fog / Decision queue)");
  }
  if (!fs.existsSync(path.join(potionDir, "specs"))) {
    drift.push(".potion/specs/ missing (living specs)");
  }
  const mirrorCjs = fs.existsSync(path.join(potionDir, "scripts", "pre-commit.cjs"));
  const mirrorJs = fs.existsSync(path.join(potionDir, "scripts", "pre-commit.js"));
  if (!mirrorCjs && !mirrorJs) {
    drift.push("repo-side pre-commit mirror not installed");
  } else if (!mirrorCjs) {
    drift.push(
      'repo-side pre-commit mirror is the legacy .js (breaks under "type": "module") — re-run install-repo-hooks.sh'
    );
  }
  if (state && /^## Parked$/m.test(state)) {
    drift.push("legacy ## Parked section awaits interactive triage");
  }
  if (drift.length && shouldShow(root, "grammar-drift")) {
    parts.push(
      "\n## POTION GRAMMAR DRIFT — this repo predates current potion grammar"
    );
    for (const d of drift) {
      parts.push(`- ${d}`);
    }
    parts.push(
      "Run /potion:update to migrate (or /potion:doctor for the full picture) — shown once a day."
    );
  }
} catch {
  /* warn-posture: never block a session over the grammar-drift scan */
}

// Evidence-staleness scan: the newest .potion/research/*field-evidence*.md
// report being over 60 days old gets NOTICED — the improvement loop only
// closes if field evidence keeps being gathered. Repos with no such report
// get nothing. Notice-only. Warn-posture: any throw is swallowed — a
// session is never blocked by this leg.
try {
  const EVIDENCE_STALE_DAYS = 60;
  const evRe = /^(\d{4}-\d{2}-\d{2})-field-evidence.*\.md$/;
  const dates = fs
    .readdirSync(path.join(potionDir, "research"))
    .map((f) => f.match(evRe))
    .filter(Boolean)
    .map((m) => m[1])
    .sort();
  if (dates.length) {
    const newest = dates[dates.length - 1];
    const todayStr = new Date().toLocaleDateString("sv-SE");
    const age = Math.floor(
      (Date.parse(todayStr + "T00:00:00Z") - Date.parse(newest + "T00:00:00Z")) /
        86400000
    );
    if (
      Number.isFinite(age) &&
      age > EVIDENCE_STALE_DAYS &&
      shouldShow(root, "evidence-staleness")
    ) {
      parts.push(
        `\n## POTION EVIDENCE STALENESS — last field-evidence pass was ${newest} (${age} days ago)`
      );
      parts.push("Run /potion:evidence — nag only, shown once a day.");
    }
  }
} catch {
  /* warn-posture: never block a session over the evidence-staleness scan */
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
