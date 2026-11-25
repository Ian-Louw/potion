#!/usr/bin/env node
// Potion PreCompact hook — prints the disk-derived position so a long run
// survives compaction: phase, plan tally and verification state. Plain text
// on stdout, under 2000 chars. Silent outside a potion repo. Any internal
// error → exit 0; it never exits 2 (must not block compaction).

const fs = require("fs");
const path = require("path");
const { resolvePhase } = require(path.join(__dirname, "phase-slug.js"));

const MAX_CHARS = 1990;

function main() {
  let payload = null;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    payload = null;
  }
  const cwd =
    payload &&
    typeof payload.cwd === "string" &&
    payload.cwd &&
    fs.existsSync(payload.cwd)
      ? payload.cwd
      : process.cwd();

  const potionDir = path.join(cwd, ".potion");
  let state;
  try {
    state = fs.readFileSync(path.join(potionDir, "STATE.md"), "utf8");
  } catch {
    return; // not a potion repo — silent
  }

  const phase = resolvePhase(state, potionDir);

  let plans = 0,
    summaries = 0,
    drafts = 0,
    runbooks = 0;
  let verification = "none";
  if (phase) {
    let names = [];
    try {
      names = fs.readdirSync(phase.dir);
    } catch {
      names = [];
    }
    for (const n of names) {
      if (/^PLAN-\d+\.md$/.test(n)) plans += 1;
      else if (/^SUMMARY-\d+\.md$/.test(n)) summaries += 1;
      else if (/^SUMMARY-\d+\.draft\.md$/.test(n)) drafts += 1;
      else if (/^RUNBOOK-\d+\.md$/.test(n)) runbooks += 1;
    }
    try {
      const text = fs.readFileSync(path.join(phase.dir, "VERIFICATION.md"), "utf8");
      const cycle = text.match(/^cycle:\s*"?([^"\r\n]+?)"?\s*$/m);
      const verdict = text.match(/^verdict:\s*"?([^"\r\n]+?)"?\s*$/m);
      verification = `cycle ${cycle ? cycle[1] : "?"}, verdict ${verdict ? verdict[1] : "?"}`;
    } catch {
      verification = "none";
    }
  }

  const out = [
    "POTION POSITION (derived from disk at compaction — trust this over memory)",
    `Phase: ${phase ? phase.slug : "unresolved"}`,
    `Plans: ${summaries} of ${plans} complete; drafts: ${drafts}; runbooks: ${runbooks}`,
    `Verification: ${verification}`,
    "Next: re-read .potion/STATE.md and the phase directory before acting.",
  ].join("\n");
  process.stdout.write(out.slice(0, MAX_CHARS) + "\n");
}

try {
  main();
} catch {
  // fail open — never block compaction
}
process.exitCode = 0;
