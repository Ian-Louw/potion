#!/usr/bin/env node
// Potion repo-side pre-commit secret mirror.
// Installed into a target repo as .potion/scripts/pre-commit.js by
// scripts/install-repo-hooks.sh and invoked by a .git/hooks/pre-commit shim —
// so the secret protection holds even when no potion plugin is loaded.
//
// Self-contained: node builtins only, no requires from the plugin.
// Scans STAGED content only (pre-commit fires at commit time; what is not
// staged is not being committed). Three legs:
//   (1) secret-shaped patterns over the staged .potion/ diff;
//   (2) values declared in .potion/verify-env.local over the staged
//       repo-wide diff — block messages name the KEY, never the value;
//   (3) a staged path matching verify-env.local itself.
// Block = message on stderr + exit 1. Everything else — not a repo, git
// failures, unreadable files, any internal error — exit 0: fail open,
// instrumentation never traps a commit.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Keep these as regex literals only — never write a matching example
// string anywhere in this file (it gets committed into target repos).
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

const MIN_VALUE_LENGTH = 8;
const LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/;

function block(what, file) {
  process.stderr.write(
    `POTION PRE-COMMIT: blocked — ${what} in ${file}. ` +
      "Secrets never enter commits. " +
      "Human override: git commit --no-verify.\n"
  );
  process.exit(1);
}

function git(args) {
  // Any git failure (not a repo, no HEAD yet) → empty string, fail open.
  try {
    return execSync(`git ${args}`, {
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

// Parse .potion/verify-env.local into [{key, value}] pairs.
// Any read error → [] (fail open).
function loadDeclaredSecrets(repoRoot) {
  let raw = "";
  try {
    raw = fs.readFileSync(
      path.join(repoRoot, ".potion", "verify-env.local"),
      "utf8"
    );
  } catch {
    return [];
  }
  const secrets = [];
  for (const line of raw.split("\n")) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(LINE_RE);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    // Strip one pair of matching surrounding quotes.
    if (
      value.length >= 2 &&
      (value[0] === '"' || value[0] === "'") &&
      value[value.length - 1] === value[0]
    ) {
      value = value.slice(1, -1);
    }
    // False-positive floor: short values are never scrub patterns.
    if (value.length < MIN_VALUE_LENGTH) continue;
    secrets.push({ key, value });
  }
  return secrets;
}

function main() {
  const repoRoot = git("rev-parse --show-toplevel").trim();
  if (!repoRoot) process.exit(0);

  // Leg 3: a staged verify-env.local path is never committable.
  for (const line of git("diff --cached --name-only").split("\n")) {
    const rel = line.trim();
    if (rel && /(^|\/)verify-env\.local$/.test(rel)) {
      block("verify-env.local (file must never be committed)", rel);
    }
  }

  // Leg 1: secret-shaped patterns, staged .potion/ diff only.
  for (const chunk of diffChunks(git('diff --cached -- ".potion/"'))) {
    for (const p of PATTERNS) {
      if (p.re.test(chunk.text)) block(p.name, chunk.file);
    }
  }

  // Leg 2: declared values, staged repo-wide diff. The block message names
  // the KEY, never the value.
  const declared = loadDeclaredSecrets(repoRoot);
  if (declared.length > 0) {
    for (const chunk of diffChunks(git("diff --cached"))) {
      for (const s of declared) {
        if (chunk.text.includes(s.value)) {
          block(
            `declared secret ${s.key} (value from verify-env.local)`,
            chunk.file
          );
        }
      }
    }
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  // process.exit(1) inside block() throws nothing — this catch only sees
  // genuine instrumentation errors. Fail open.
  process.exit(0);
}
