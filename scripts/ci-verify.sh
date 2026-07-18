#!/bin/sh
# ci-verify.sh — generic mechanical verification layer for potion-managed repos.
#
# Usage: sh scripts/ci-verify.sh [learnings-path]
#   learnings-path defaults to .potion/learnings.jsonl
#
# Run from the target repo root. Reads the learnings jsonl, dedups entries
# newest-wins by key, keeps type:"check" entries, and runs each cmd via
# POSIX sh per the CORE.md check-runner contract:
#   - expect "exit N"  -> compare the exit code
#   - otherwise        -> compare trimmed stdout to expect exactly
#     (a nonzero exit with matching stdout is still a MATCH)
#   - command cannot execute at all -> BROKEN (warning, never a failure)
# Output: one `CHECK MATCH|MISMATCH|BROKEN {key}` line per check, then a
# final `RESULT pass|fail matched=N mismatched=N broken=N` line.
# Exit 1 iff at least one check MISMATCHES; BROKEN alone still exits 0.

LEARNINGS="${1:-.potion/learnings.jsonl}"

if [ ! -f "$LEARNINGS" ]; then
  echo "RESULT pass matched=0 mismatched=0 broken=0 (no learnings file)"
  exit 0
fi

node - "$LEARNINGS" <<'EOF'
const fs = require("fs");
const { spawnSync } = require("child_process");

const path = process.argv[2];
const lines = fs.readFileSync(path, "utf8").split("\n");

const entries = new Map(); // newest-wins by key
lines.forEach((line, i) => {
  if (!line.trim()) return;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch (e) {
    process.stderr.write(`WARN unparseable line ${i + 1}\n`);
    return;
  }
  if (obj && obj.key) {
    entries.delete(obj.key); // re-insert so newest keeps insertion order
    entries.set(obj.key, obj);
  }
});

let matched = 0, mismatched = 0, broken = 0;

for (const [key, entry] of entries) {
  if (entry.type !== "check") continue;
  let res;
  try {
    res = spawnSync("sh", ["-c", entry.cmd], { encoding: "utf8" });
  } catch (e) {
    broken++;
    console.log(`CHECK BROKEN ${key} ${String(e.message).split("\n")[0]}`);
    continue;
  }
  if (res.error || res.status === null) {
    broken++;
    const msg = res.error ? String(res.error.message).split("\n")[0] : "no exit status";
    console.log(`CHECK BROKEN ${key} ${msg}`);
    continue;
  }
  const expect = String(entry.expect === undefined ? "" : entry.expect);
  const exitMatch = expect.match(/^exit (\d+)$/);
  let isMatch, gotDesc;
  if (exitMatch) {
    isMatch = res.status === Number(exitMatch[1]);
    gotDesc = `exit ${res.status}`;
  } else {
    const got = (res.stdout || "").trim();
    isMatch = got === expect;
    gotDesc = JSON.stringify(got);
  }
  if (isMatch) {
    matched++;
    console.log(`CHECK MATCH ${key}`);
  } else if (res.status === 127 || res.status === 126) {
    // sh reports 127 (not found) / 126 (not executable): the command
    // could not execute at all -> BROKEN per the check-runner contract.
    broken++;
    console.log(`CHECK BROKEN ${key} command cannot execute (exit ${res.status})`);
  } else {
    mismatched++;
    console.log(`CHECK MISMATCH ${key} expected=${JSON.stringify(expect)} got=${gotDesc}`);
  }
}

const result = mismatched > 0 ? "fail" : "pass";
console.log(`RESULT ${result} matched=${matched} mismatched=${mismatched} broken=${broken}`);
process.exit(mismatched > 0 ? 1 : 0);
EOF
