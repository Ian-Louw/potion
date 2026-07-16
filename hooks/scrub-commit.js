#!/usr/bin/env node
// Potion PreToolUse secret scrubber.
// Blocks `git commit` when uncommitted .potion/ content carries a
// secret-shaped string, or when a verify-env.local path would be committed.
// Deliberate block = exit 2 with the reason on stderr (fed back to Claude).
// Everything else — parse errors, non-Bash tools, non-commit commands,
// non-repo cwd, git failures — fails OPEN with exit 0. No agent-usable
// bypass: the override is the human committing manually.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PATTERNS = [
  { name: "openai-style key (sk-…)", re: /sk-[A-Za-z0-9_-]{16,}/ },
  { name: "supabase key (sbp_…)", re: /sbp_[A-Za-z0-9]{16,}/ },
  { name: "AWS access key (AKIA…)", re: /AKIA[0-9A-Z]{16}/ },
  { name: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "JWT",
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
];

function block(patternName, file) {
  process.stderr.write(
    `POTION SCRUB: blocked — ${patternName} in ${file}. ` +
      "Secrets never enter .potion/ commits. If this is a false positive, " +
      "the human can commit manually.\n"
  );
  process.exit(2);
}

function git(args, cwd) {
  // Any git failure (not a repo, no HEAD yet) → empty string, fail open.
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

// Split unified diff output into { file, text } chunks for attribution.
function diffChunks(diffText) {
  const chunks = [];
  const parts = diffText.split(/^diff --git /m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const m = part.match(/^\+\+\+ b\/(.+)$/m);
    const file = m ? m[1] : "(unknown file in diff)";
    chunks.push({ file, text: part });
  }
  return chunks;
}

function scanChunk(chunk) {
  if (/(^|\/)verify-env\.local$/.test(chunk.file)) {
    block("verify-env.local (file must never be committed)", chunk.file);
  }
  for (const p of PATTERNS) {
    if (p.re.test(chunk.text)) block(p.name, chunk.file);
  }
}

function main() {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    process.exit(0);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  if (!payload || payload.tool_name !== "Bash") process.exit(0);
  const command =
    (payload.tool_input && payload.tool_input.command) || "";
  if (!/\bgit\b[\s\S]*\bcommit\b/.test(command)) process.exit(0);

  const cwd =
    payload.cwd && fs.existsSync(payload.cwd) ? payload.cwd : process.cwd();

  // (a) staged, (b) unstaged-vs-HEAD — covers `git add X && git commit`
  // compound commands where nothing is staged when the hook fires.
  for (const args of [
    'diff --cached -- ".potion/"',
    'diff HEAD -- ".potion/"',
  ]) {
    for (const chunk of diffChunks(git(args, cwd))) scanChunk(chunk);
  }

  // (c) untracked .potion files — read each one directly.
  const untracked = git(
    'ls-files --others --exclude-standard -- ".potion/"',
    cwd
  );
  for (const line of untracked.split("\n")) {
    const rel = line.trim();
    if (!rel) continue;
    if (/(^|\/)verify-env\.local$/.test(rel)) {
      block("verify-env.local (file must never be committed)", rel);
    }
    let content = "";
    try {
      content = fs.readFileSync(path.join(cwd, rel), "utf8");
    } catch {
      continue;
    }
    for (const p of PATTERNS) {
      if (p.re.test(content)) block(p.name, rel);
    }
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  // process.exit(2) inside block() throws nothing — this catch only sees
  // genuine instrumentation errors. Fail open.
  process.exit(0);
}
