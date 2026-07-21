// PermissionRequest hook — the escalation lane's approve gate.
// Contract: may approve ONLY an exact match of a human-granted registry
// entry in .potion/escalations.md (trimmed full-string equality, unexpired,
// wrapper file present); every other path is no-decision fall-through
// (exit 0, no stdout); never denies, never exits nonzero. Any internal
// error → silent exit 0 — the hook can never approve on error and never
// blocks the request path.

const fs = require("fs");
const path = require("path");
const { loadEscalations } = require("./escalations.js");

function main() {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return;
  }
  if (!payload || payload.tool_name !== "Bash") return;

  const cwd =
    payload.cwd && fs.existsSync(payload.cwd) ? payload.cwd : process.cwd();
  const cmd = ((payload.tool_input && payload.tool_input.command) || "").trim();
  if (!cmd) return;

  const today = new Date().toISOString().slice(0, 10);
  const entries = loadEscalations(cwd);
  const granted = entries.some(
    (entry) =>
      entry.command === cmd &&
      entry.expires !== null &&
      entry.expires >= today &&
      entry.wrapper !== null &&
      fs.existsSync(path.join(cwd, entry.wrapper))
  );
  if (!granted) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: { behavior: "allow", updatedInput: payload.tool_input },
      },
    })
  );
}

try {
  main();
} catch {
  // fail open — no decision, never nonzero
}
process.exit(0);
