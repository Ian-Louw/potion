#!/usr/bin/env node
"use strict";
// Potion doctor — read-only health checks for a potion repo and install.
// Usage: node doctor.js [--repo <path>]   (default repo = cwd)
// Output: one `OK|WARN|FAIL <id> — <detail>` line per finding, then
// `RESULT ok|warn|fail ok=N warn=N fail=N`. Exit 1 iff any FAIL.
// This script never writes, creates or deletes anything and runs no git.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolvePhase } = require("../hooks/phase-slug.js");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const repoFlag = argv.indexOf("--repo");
const REPO = path.resolve(repoFlag !== -1 && argv[repoFlag + 1] ? argv[repoFlag + 1] : process.cwd());
const POTION = path.join(REPO, ".potion");
const STATE_PATH = path.join(POTION, "STATE.md");
const HOME = os.homedir();

const counts = { OK: 0, WARN: 0, FAIL: 0 };
function emit(level, id, detail) {
  counts[level] += 1;
  console.log(`${level} ${id} — ${detail}`);
}
const ok = (id, d) => emit("OK", id, d);
const warn = (id, d) => emit("WARN", id, d);
const fail = (id, d) => emit("FAIL", id, d);

function run(id, fn) {
  try {
    fn();
  } catch (e) {
    warn(id, `check errored: ${e && e.message ? e.message : String(e)}`);
  }
}

const exists = (p) => fs.existsSync(p);
const isDir = (p) => exists(p) && fs.statSync(p).isDirectory();
const read = (p) => fs.readFileSync(p, "utf8");
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let hasPotion = false;
let state = "";
let phaseDir = null; // absolute path of the resolved current phase dir

// 1. potion-dir
run("potion-dir", () => {
  if (exists(STATE_PATH)) {
    hasPotion = true;
    state = read(STATE_PATH);
    ok("potion-dir", ".potion/STATE.md found");
  } else {
    fail("potion-dir", `.potion/STATE.md not found in ${REPO} — not a potion repo (run /potion:init); repo checks skipped`);
  }
});

// 2. plugin-version
run("plugin-version", () => {
  const source = JSON.parse(read(path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"))).version;
  const recordPath = path.join(HOME, ".claude", "plugins", "installed_plugins.json");
  let plugins;
  try {
    plugins = JSON.parse(read(recordPath)).plugins;
  } catch (e) {
    plugins = null;
  }
  if (!plugins || typeof plugins !== "object") {
    warn("plugin-version", `could not read install record (source is ${source})`);
    return;
  }
  const entries = [];
  for (const key of Object.keys(plugins)) {
    if (!key.startsWith("potion@")) continue;
    const list = Array.isArray(plugins[key]) ? plugins[key] : [plugins[key]];
    for (const e of list) if (e && typeof e.version === "string") entries.push({ key, version: e.version });
  }
  if (entries.length === 0) {
    warn("plugin-version", `could not read install record — no potion@ entry with a version (source is ${source})`);
    return;
  }
  let differs = false;
  for (const e of entries) {
    if (e.version !== source) {
      differs = true;
      warn("plugin-version", `install record says ${e.version}, source is ${source} — reinstall or update the plugin to refresh the record`);
    }
  }
  if (!differs) ok("plugin-version", `install record and source agree on ${source}`);
});

// 3. hooks-registered
run("hooks-registered", () => {
  const hooksPath = path.join(PLUGIN_ROOT, "hooks", "hooks.json");
  let parsed;
  try {
    parsed = JSON.parse(read(hooksPath));
  } catch (e) {
    fail("hooks-registered", `hooks/hooks.json missing or unparseable: ${e.message}`);
    return;
  }
  const events = parsed && parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {};
  const names = Object.keys(events);
  const missing = [];
  let commands = 0;
  for (const name of names) {
    for (const group of Array.isArray(events[name]) ? events[name] : []) {
      for (const h of Array.isArray(group && group.hooks) ? group.hooks : []) {
        if (!h || typeof h.command !== "string") continue;
        commands += 1;
        const re = /\$\{CLAUDE_PLUGIN_ROOT\}([^"'\s]*)/g;
        let m;
        while ((m = re.exec(h.command)) !== null) {
          const rel = m[1].replace(/^[\\/]+/, "");
          if (rel && !exists(path.join(PLUGIN_ROOT, rel))) missing.push(`${name}: ${rel}`);
        }
      }
    }
  }
  if (missing.length > 0) {
    fail("hooks-registered", `hook file missing — ${missing.join("; ")}`);
  } else if (names.length === 0) {
    warn("hooks-registered", "hooks/hooks.json registers no events");
  } else {
    ok("hooks-registered", `${commands} command(s), all files present; events: ${names.join(", ")}`);
  }
});

if (hasPotion) {
  // 4. state-caps
  run("state-caps", () => {
    const bytes = fs.statSync(STATE_PATH).size;
    const lines = (state.match(/\n/g) || []).length;
    if (lines > 60 || bytes > 12000) {
      warn("state-caps", `STATE.md is ${lines} lines / ${bytes} bytes (caps: 60 lines, 12000 bytes)`);
    } else {
      ok("state-caps", `STATE.md is ${lines} lines / ${bytes} bytes`);
    }
  });

  // 5. state-phase
  run("state-phase", () => {
    const unresolved =
      "hooks cannot resolve the current phase — stop-drift's SUMMARY check and the compaction digest are inactive here";
    const lineMatch = state.match(/^- Phase:.*$/m);
    if (!lineMatch) {
      warn("state-phase", `${unresolved} (no "- Phase:" line)`);
      return;
    }
    const line = lineMatch[0];
    // Same resolver the hooks and metrics use — doctor can never disagree.
    const phase = resolvePhase(state, POTION);
    if (phase) {
      phaseDir = phase.dir;
      ok("state-phase", `resolves to .potion/phases/${phase.slug}/`);
      return;
    }
    warn("state-phase", `${unresolved} (line: "${line.trim().slice(0, 80)}")`);
  });

  // 6. grammar
  run("grammar", () => {
    const problems = [];
    if (!exists(path.join(POTION, "verify-env.md"))) problems.push("missing .potion/verify-env.md");
    if (!isDir(path.join(POTION, "specs"))) problems.push("missing .potion/specs/");
    if (!/^## Fog\s*$/m.test(state)) problems.push('missing "## Fog" heading in STATE.md');
    if (!/^## Decision queue\s*$/m.test(state)) problems.push('missing "## Decision queue" heading in STATE.md');
    if (/^## Parked\b/m.test(state)) problems.push('legacy "## Parked" heading present in STATE.md');
    if (problems.length === 0) ok("grammar", "verify-env.md, specs/, Fog and Decision queue present; no Parked");
    for (const p of problems) warn("grammar", p);
  });

  // 7. repo-mirror
  run("repo-mirror", () => {
    const cjs = exists(path.join(POTION, "scripts", "pre-commit.cjs"));
    const js = exists(path.join(POTION, "scripts", "pre-commit.js"));
    if (cjs) ok("repo-mirror", ".potion/scripts/pre-commit.cjs installed");
    else if (js) warn("repo-mirror", 'legacy .potion/scripts/pre-commit.js only — breaks under "type": "module"');
    else warn("repo-mirror", "not installed — no .potion/scripts/pre-commit.cjs");
  });

  // 8. escalations
  run("escalations", () => {
    const p = path.join(POTION, "escalations.md");
    if (!exists(p)) {
      ok("escalations", "no escalations file");
      return;
    }
    const now = today();
    const expired = read(p)
      .split(/\r?\n/)
      .filter((l) => {
        const m = l.match(/expires:\s*(\d{4}-\d{2}-\d{2})/);
        return m && m[1] < now;
      }).length;
    if (expired > 0) warn("escalations", `${expired} escalation(s) expired before ${now}`);
    else ok("escalations", "no expired escalations");
  });

  // 9. phase-artifacts
  run("phase-artifacts", () => {
    if (!phaseDir) {
      ok("phase-artifacts", "skipped — current phase not resolved (see state-phase)");
      return;
    }
    const files = fs.readdirSync(phaseDir);
    const nums = (re) => files.map((f) => f.match(re)).filter(Boolean).map((m) => m[1]);
    const plans = nums(/^PLAN-(.+)\.md$/);
    const runbooks = nums(/^RUNBOOK-(.+)\.md$/);
    const drafts = nums(/^SUMMARY-(.+)\.draft\.md$/);
    const summaries = files
      .filter((f) => /^SUMMARY-.+\.md$/.test(f) && !/\.draft\.md$/.test(f))
      .map((f) => f.match(/^SUMMARY-(.+)\.md$/)[1]);
    let verdict = "none";
    if (files.includes("VERIFICATION.md")) {
      const m = read(path.join(phaseDir, "VERIFICATION.md")).match(/^verdict:\s*(.+)$/m);
      verdict = m ? m[1].trim() : "no verdict line";
    }
    const detail = `${path.basename(phaseDir)}: PLAN=${plans.length} RUNBOOK=${runbooks.length} SUMMARY=${summaries.length} drafts=${drafts.length} VERIFICATION=${verdict}`;
    const stale = drafts.filter((n) => summaries.includes(n));
    const orphans = summaries.filter((n) => !plans.includes(n) && !runbooks.includes(n));
    if (stale.length === 0 && orphans.length === 0) ok("phase-artifacts", detail);
    if (stale.length > 0) warn("phase-artifacts", `${detail}; stale draft beside a finished SUMMARY: ${stale.join(", ")}`);
    if (orphans.length > 0) warn("phase-artifacts", `${detail}; SUMMARY with no matching PLAN: ${orphans.join(", ")}`);
  });

  // 10. decision-queue
  run("decision-queue", () => {
    const start = state.search(/^## Decision queue\s*$/m);
    if (start === -1) {
      ok("decision-queue", "no Decision queue section (see grammar)");
      return;
    }
    const rest = state.slice(start).split(/\r?\n/).slice(1);
    const end = rest.findIndex((l) => /^## /.test(l));
    const section = end === -1 ? rest : rest.slice(0, end);
    const now = today();
    const expired = section.filter((l) => {
      const m = l.match(/expires\s+(\d{4}-\d{2}-\d{2})/);
      return m && m[1] < now;
    }).length;
    if (expired > 0) warn("decision-queue", `${expired} entr${expired === 1 ? "y" : "ies"} expired before ${now}`);
    else ok("decision-queue", "no expired entries");
  });
}

// 11 + 12. permission-mode, advisor — only these two values leave the settings file.
let settings = null;
let settingsNote = "no ~/.claude/settings.json";
try {
  const p = path.join(HOME, ".claude", "settings.json");
  if (exists(p)) settings = JSON.parse(read(p));
} catch (e) {
  settingsNote = "~/.claude/settings.json unparseable";
}

run("permission-mode", () => {
  if (!settings) {
    if (settingsNote.includes("unparseable")) warn("permission-mode", settingsNote);
    else ok("permission-mode", `${settingsNote} — default mode`);
    return;
  }
  const mode = settings.permissions && settings.permissions.defaultMode;
  if (mode === "bypassPermissions") {
    warn("permission-mode", "bypassPermissions — auto mode's classifier blocks agent loops started in bypass mode");
  } else {
    ok("permission-mode", typeof mode === "string" ? mode : "defaultMode unset");
  }
});

run("advisor", () => {
  const model = settings && settings.advisorModel;
  if (typeof model === "string" && model) ok("advisor", model);
  else ok("advisor", "not configured (optional; /advisor enables it)");
});

// 13. metrics
if (hasPotion) {
  run("metrics", () => {
    const p = path.join(POTION, "metrics.jsonl");
    if (!exists(p)) {
      ok("metrics", "no metrics yet");
      return;
    }
    const lines = read(p).split(/\r?\n/).filter((l) => l.trim());
    let ts = "unknown";
    try {
      const last = JSON.parse(lines[lines.length - 1]);
      if (last && last.ts) ts = String(last.ts);
    } catch (e) {
      ts = "unparseable last line";
    }
    ok("metrics", `${lines.length} line(s), last ts ${ts}`);
  });
}

const result = counts.FAIL > 0 ? "fail" : counts.WARN > 0 ? "warn" : "ok";
console.log(`RESULT ${result} ok=${counts.OK} warn=${counts.WARN} fail=${counts.FAIL}`);
process.exitCode = counts.FAIL > 0 ? 1 : 0;
