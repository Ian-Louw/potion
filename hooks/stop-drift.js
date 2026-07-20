#!/usr/bin/env node
// Potion Stop-hook drift nudge — ONE-SHOT by design.
// If the session is stopping with bookkeeping drift (STATE.md over the
// 60-line cap, or a plan with tagged commits but no SUMMARY), block ONCE
// with the concrete defects on stderr (exit 2). The second stop attempt
// carries stop_hook_active:true and always passes — never trap a session
// on bookkeeping. Any internal error fails open (exit 0).

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const STATE_LINE_CAP = 60;

function main() {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  // The one-shot rule: a previous Stop hook already blocked this stop.
  if (payload && payload.stop_hook_active) process.exit(0);

  const cwd =
    payload && payload.cwd && fs.existsSync(payload.cwd)
      ? payload.cwd
      : process.cwd();

  const statePath = path.join(cwd, ".potion", "STATE.md");
  if (!fs.existsSync(statePath)) process.exit(0); // not a potion project

  const defects = [];

  // Check 1: STATE cap.
  const state = fs.readFileSync(statePath, "utf8");
  const lineCount = state.split("\n").filter((l, i, a) => i < a.length - 1 || l !== "").length;
  if (lineCount > STATE_LINE_CAP) {
    defects.push(`STATE.md is ${lineCount} lines (cap ${STATE_LINE_CAP})`);
  }

  // Check 2: tagged commits without a SUMMARY, for the current phase.
  // Phase line format: `- Phase: NN of M — NN-slug`.
  const phaseMatch = state.match(/^- Phase:.*?(\d+)\s+of\s+\d+\s*[—-]+\s*(\S+)/m);
  if (phaseMatch) {
    const phaseSlug = phaseMatch[2]; // e.g. "11-enforcement"
    const phaseNum = phaseSlug.split("-")[0]; // e.g. "11"
    const phaseDir = path.join(cwd, ".potion", "phases", phaseSlug);
    if (fs.existsSync(phaseDir)) {
      let log = "";
      try {
        log = execSync("git log --oneline -30", {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        log = "";
      }
      for (const entry of fs.readdirSync(phaseDir)) {
        const m = entry.match(/^PLAN-(\d+)\.md$/);
        if (!m) continue;
        const nn = m[1];
        if (fs.existsSync(path.join(phaseDir, `SUMMARY-${nn}.md`))) continue;
        // Loose plan-tag match: `({NN}-{XX}` or `…-{XX})` — warn, never over-claim.
        if (log.includes(`(${phaseNum}-${nn}`) || log.includes(`-${nn})`)) {
          defects.push(`PLAN-${nn} has commits but no SUMMARY-${nn}`);
        }
      }
    }
  }

  // Check 3: completion claim without a verification verdict.
  // Status-line ONLY — Position/Stopped-at prose must never trip this.
  const claimMatch = state.match(/^- Status:\s*(shipped|completed?|done)\s*$/im);
  if (claimMatch) {
    // Derive the slug independently of check 2's strict regex (looser,
    // planTally-style — same shape session-start.js uses). No slug → skip.
    const phaseLine = state.match(/^- Phase:.*$/m);
    const slugMatch = phaseLine && phaseLine[0].match(/\b(\d+(?:\.\d+)?-[a-z0-9-]+)/);
    if (slugMatch) {
      const slug = slugMatch[1];
      const verifPath = path.join(cwd, ".potion", "phases", slug, "VERIFICATION.md");
      let hasVerdict = false;
      if (fs.existsSync(verifPath)) {
        const verif = fs.readFileSync(verifPath, "utf8");
        hasVerdict = /^verdict:\s*"?(pass|gaps|escalated)"?/m.test(verif);
      }
      if (!hasVerdict) {
        defects.push(`STATE claims '${claimMatch[1]}' for phase ${slug} but phases/${slug}/VERIFICATION.md has no verdict — run /potion:verify before claiming completion`);
      }
    }
  }

  if (!defects.length) process.exit(0);

  process.stderr.write(
    "POTION DRIFT: this session is stopping with bookkeeping drift:\n" +
      defects.map((d) => `- ${d}`).join("\n") +
      "\nFix these now, or stop again to proceed anyway.\n"
  );
  process.exit(2);
}

try {
  main();
} catch {
  process.exit(0); // fail open — never trap a session on instrumentation
}
