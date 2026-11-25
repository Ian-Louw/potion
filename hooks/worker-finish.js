#!/usr/bin/env node
// Potion SubagentStop guard for potion-worker — ONE-SHOT, FAIL-OPEN.
//
// A worker that stops with a DONE-type status while its SUMMARY draft still
// holds template placeholders is told so ITSELF, once, with the draft path.
// (Before this hook the missing-SUMMARY nag landed on the orchestrator's Stop
// hook instead, which absorbed it over and over on the worker's behalf.)
//
// One-shot: the retry stop carries stop_hook_active:true and always passes.
// Fail-open: any parse error, missing field, unreadable file or thrown
// exception exits 0 with no output — instrumentation never traps a worker.
//
// Blocking uses the JSON decision on stdout (`{"decision":"block","reason"}`
// with exit 0), NOT exit 2. The JSON form is the documented way to keep a
// subagent running and deliver `reason` to it as its next instruction; where
// exit-2 stderr is routed on SubagentStop is not confirmed, so it is not
// relied on here.

const fs = require("fs");
const path = require("path");

const WORKER_TYPE = "potion:potion-worker";
const TRANSCRIPT_HEAD_BYTES = 262144;

// The plan path as it appears in the worker's transcript (its prompt names
// it). The transcript is JSON, so Windows backslashes arrive doubled; each
// separator is therefore `/`, `\` or `\\`.
const PLAN_RE =
  /([A-Za-z]:)?[^\s"']*(?:[\\/]|\\\\)\.potion(?:[\\/]|\\\\)phases(?:[\\/]|\\\\)[^\\/\s"']+(?:[\\/]|\\\\)PLAN-(\d+)\.md/;

const UNFILLED_MARKERS = ["{2-4 sentences", "{hash}", "{Anything the verifier"];

function readHead(file, max) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(max);
    const n = fs.readSync(fd, buf, 0, max, 0);
    return buf.toString("utf8", 0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function main() {
  // 1. Parse; honour the one-shot rule; only potion-worker is guarded.
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  if (!payload || typeof payload !== "object") process.exit(0);
  if (payload.stop_hook_active) process.exit(0);
  if (payload.agent_type !== WORKER_TYPE) process.exit(0);

  // 2. Find the plan this worker was pointed at.
  if (!payload.agent_transcript_path) process.exit(0);
  const head = readHead(payload.agent_transcript_path, TRANSCRIPT_HEAD_BYTES);
  const m = head.match(PLAN_RE);
  if (!m) process.exit(0);
  const nn = m[2];
  const planPath = path.resolve(
    payload.cwd || process.cwd(),
    m[0].replace(/\\\\/g, "/").replace(/\\/g, "/")
  );
  const phaseDir = path.dirname(planPath);

  // 3. Only an existing draft with no final SUMMARY is of interest.
  const draft = path.join(phaseDir, `SUMMARY-${nn}.draft.md`);
  if (fs.existsSync(path.join(phaseDir, `SUMMARY-${nn}.md`))) process.exit(0);
  if (!fs.existsSync(draft)) process.exit(0);

  // 4. These returns legitimately leave the draft unfilled.
  const last = String(payload.last_assistant_message || "");
  if (/\b(CHECKPOINT|BLOCKED|NEEDS_CONTEXT)\b/.test(last)) process.exit(0);

  // 5. Block once if any template placeholder survives.
  const body = fs.readFileSync(draft, "utf8");
  if (!UNFILLED_MARKERS.some((marker) => body.includes(marker))) process.exit(0);

  const shown = draft.replace(/\\/g, "/");
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        `POTION: your SUMMARY draft is not filled: ${shown}. Read it, replace ` +
        "every placeholder with the Edit tool (never Write), make the metadata " +
        "commit, then return your status. If the plan is not actually finished, " +
        "return CHECKPOINT or BLOCKED instead.",
    }) + "\n"
  );
  process.exit(0);
}

try {
  main();
} catch {
  process.exit(0); // fail open — never trap a worker on instrumentation
}
