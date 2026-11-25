#!/usr/bin/env node
// Potion Stop-hook drift nudge — ONE-SHOT by design.
// If the session is stopping with bookkeeping drift (STATE.md over the
// 60-line cap or the 12000-byte cap, or a plan with tagged commits but no
// SUMMARY), block ONCE with the concrete defects on stderr (exit 2). The
// second stop attempt carries stop_hook_active:true and always passes —
// never trap a session on bookkeeping. Any internal error fails open (exit 0).
//
// Two STATE caps, because either alone is evadable: the line cap by one
// multi-KB line, the byte cap by many short ones.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolvePhase } = require(path.join(__dirname, "phase-slug.js"));

const STATE_LINE_CAP = 60;
const STATE_BYTE_CAP = 12000;

// The current phase's directory slug, shared by checks 2 and 3 — resolved by
// the one shared resolver (hooks/phase-slug.js), which handles the Phase-line
// shapes seen in the field (`NN of M — NN-slug`, `NN-slug`, `NN (slug)`, with
// or without a trailing date). Null → the caller skips its check.
function phaseSlug(state, cwd) {
  const phase = resolvePhase(state, path.join(cwd, ".potion"));
  return phase ? phase.slug : null;
}

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

  // Check 1: STATE caps (lines and bytes).
  const state = fs.readFileSync(statePath, "utf8");
  const lineCount = state.split("\n").filter((l, i, a) => i < a.length - 1 || l !== "").length;
  if (lineCount > STATE_LINE_CAP) {
    defects.push(`STATE.md is ${lineCount} lines (cap ${STATE_LINE_CAP})`);
  }
  const byteCount = Buffer.byteLength(state, "utf8");
  if (byteCount > STATE_BYTE_CAP) {
    defects.push(`STATE.md is ${byteCount} bytes (cap ${STATE_BYTE_CAP})`);
  }

  const slug = phaseSlug(state, cwd); // e.g. "11-enforcement", or null

  // Check 2: tagged commits without a SUMMARY, for the current phase.
  // Only `SUMMARY-NN.md` counts as complete — a `SUMMARY-NN.draft.md` is an
  // unfilled scaffold and deliberately does NOT satisfy this check.
  if (slug) {
    const phaseNum = slug.split("-")[0]; // e.g. "11"
    const phaseDir = path.join(cwd, ".potion", "phases", slug);
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
        // Plan-tag match, anchored to THIS phase: `({slug}-{XX})` (the
        // `feat(02-real-accounts-01):` convention) or a terser `({NN}-{XX})`.
        // Both must carry the phase, and both must close the paren.
        //
        // The previous fallback was a bare `-{XX})`, which carried no phase at
        // all: any earlier phase's `docs(01-tenant-foundation-01): summary`
        // sitting in `git log -30` made a freshly-planned phase 02 report
        // PLAN-01/02/03 as drifting, purely because those numbers had been used
        // before. That is a false positive whose only "fix" — writing the
        // SUMMARY files — silently marks unexecuted plans complete, since
        // /potion:execute derives completion from SUMMARY existence.
        if (
          log.includes(`(${slug}-${nn})`) ||
          log.includes(`(${phaseNum}-${nn})`)
        ) {
          defects.push(`PLAN-${nn} has commits but no SUMMARY-${nn}`);
        }
      }
    }
  }

  // Check 3: completion claim without a verification verdict.
  // Status-line ONLY — Position/Stopped-at prose must never trip this.
  const claimMatch = state.match(/^- Status:\s*(shipped|completed?|done)\s*$/im);
  if (claimMatch) {
    // Same slug as check 2 (phaseSlug). No slug → skip.
    if (slug) {
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
