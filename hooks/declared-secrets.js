// Shared loader for values declared in a repo's gitignored
// .potion/verify-env.local. Every declared value (8+ chars) doubles as a
// literal scrub pattern for the commit hook. PLAN-03 adds a leaked-files
// helper to this same module.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const MIN_VALUE_LENGTH = 8;
const LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/;

// Parse <repoRoot>/.potion/verify-env.local into [{key, value}] pairs.
// Any read error → [] (fail open — instrumentation never traps a session).
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

// Which committed-HEAD files contain any declared value?
// Returns [{file, keys}] sorted by file. Values are passed to git grep over
// STDIN (`-f -`), never argv — argv is visible in process listings.
// One `git grep` per secret attributes keys per file (few secrets, git grep
// is index-fast). git grep exits 1 on no match — treated as empty, not
// error. Any unexpected failure → [] (fail open).
function findLeakedFiles(repoRoot, secrets) {
  try {
    const byFile = new Map(); // file → Set<key>
    for (const s of secrets) {
      let out = "";
      try {
        out = execSync("git grep -l -F -f - HEAD", {
          cwd: repoRoot,
          input: s.value,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
          maxBuffer: 16 * 1024 * 1024,
        });
      } catch {
        continue; // exit 1 = no match; any git failure = fail open per secret
      }
      for (const line of out.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        const file = t.replace(/^HEAD:/, "");
        if (!byFile.has(file)) byFile.set(file, new Set());
        byFile.get(file).add(s.key);
      }
    }
    return [...byFile.entries()]
      .map(([file, keys]) => ({ file, keys: [...keys] }))
      .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  } catch {
    return [];
  }
}

module.exports = { loadDeclaredSecrets, findLeakedFiles };
