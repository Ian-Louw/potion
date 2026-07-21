// Shared loader for the standing escalation registry at
// <repoRoot>/.potion/escalations.md. One grant per line, gate-style inline
// map, line-oriented parse (no YAML lib):
//   - {escalation: "<name>", wrapper: "<repo path>", command: "<exact form>", granted_by: "<who>", added: YYYY-MM-DD, expires: YYYY-MM-DD}
// Fail-open posture: any read error → [] — instrumentation never traps a
// session, and an empty registry simply means the permission wall holds.

const fs = require("fs");
const path = require("path");

// Every negated class excludes \n — a class without it swallows following
// lines (learning: regex-class-must-exclude-newline).
const NAME_RE = /escalation:\s*"?([^",}\n]+)"?/;
const WRAPPER_RE = /wrapper:\s*"?([^",}\n]+)"?/;
const COMMAND_RE = /command:\s*"([^"\n]+)"/;
const GRANTED_BY_RE = /granted_by:\s*"?([^",}\n]+)"?/;
const ADDED_RE = /added:\s*"?(\d{4}-\d{2}-\d{2})/;
const EXPIRES_RE = /expires:\s*"?(\d{4}-\d{2}-\d{2})/;

// Parse <repoRoot>/.potion/escalations.md into
// [{name, wrapper, command, grantedBy, added, expires}].
// Lines without an escalation name are skipped; entries without a command
// are skipped entirely; other absent fields come back null (PLAN-02's scan
// surfaces null expires — the permission hook never approves them).
function loadEscalations(repoRoot) {
  let raw = "";
  try {
    raw = fs.readFileSync(
      path.join(repoRoot, ".potion", "escalations.md"),
      "utf8"
    );
  } catch {
    return [];
  }

  const entries = [];
  for (const line of raw.split("\n")) {
    const nameM = line.match(NAME_RE);
    if (!nameM) continue;
    const commandM = line.match(COMMAND_RE);
    if (!commandM) continue;
    const wrapperM = line.match(WRAPPER_RE);
    const grantedByM = line.match(GRANTED_BY_RE);
    const addedM = line.match(ADDED_RE);
    const expiresM = line.match(EXPIRES_RE);
    entries.push({
      name: nameM[1].trim(),
      wrapper: wrapperM ? wrapperM[1].trim() : null,
      command: commandM[1],
      grantedBy: grantedByM ? grantedByM[1].trim() : null,
      added: addedM ? addedM[1] : null,
      expires: expiresM ? expiresM[1] : null,
    });
  }
  return entries;
}

module.exports = { loadEscalations };
