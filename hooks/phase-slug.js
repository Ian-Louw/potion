// The single current-phase resolver. stop-drift, session-start, metrics and
// doctor all resolve the phase through this function, so they always agree.
//
// Rule: A number at the very start of the Phase value, or else the first
// slug-shaped token if it is an existing directory; never a number from the
// middle of the line.
//
// resolvePhase(stateText, potionDir) → { slug, num, dir } or null.
//   1. take the first `- Phase:` line; none → null. `value` is the text after
//      `- Phase:`;
//   2. list the subdirectories of {potionDir}/phases (any error → none);
//   3. blank out, in order: ISO dates, slash/dot dates, clock times;
//   4. `lead` = a number at the very start of the blanked value (`23-x` gives
//      23, `1.5 (x)` gives 1.5, `1e3` and `v2` give nothing);
//   5. `slug` = the FIRST slug-shaped token (`NN-slug`) in the blanked value,
//      kept only if it is exactly an existing directory; a later token is
//      never tried;
//   6. numbers compare as text: leading zeros of the integer part stripped,
//      any `.frac` kept as written. A directory's number is its name before
//      the first `-`;
//   7. with a `lead`: `slug` wins when its number equals `lead`; otherwise the
//      directories whose number equals `lead` — exactly one resolves, zero or
//      several → null;
//   8. without a `lead`: `slug` if there is one, else null — callers skip
//      their phase-dependent work.
// Never throws.

const fs = require("fs");
const path = require("path");

// Textual number normalisation: `02` → `2`, `01.5` → `1.5`, `0` → `0`.
function normNum(s) {
  const dot = s.indexOf(".");
  const int = dot === -1 ? s : s.slice(0, dot);
  const frac = dot === -1 ? "" : s.slice(dot);
  return int.replace(/^0+(?=\d)/, "") + frac;
}

function dirNum(name) {
  const i = name.indexOf("-");
  return i === -1 ? name : name.slice(0, i);
}

function resolvePhase(stateText, potionDir) {
  try {
    const lineMatch = String(stateText).match(/^- Phase:.*$/m);
    if (!lineMatch) return null;
    const line = lineMatch[0].replace(/\r$/, "");
    const value = line.slice("- Phase:".length);

    const phasesDir = path.join(potionDir, "phases");
    let dirs;
    try {
      dirs = fs
        .readdirSync(phasesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      dirs = [];
    }

    const found = (slug) => ({
      slug,
      num: slug.split("-")[0],
      dir: path.resolve(phasesDir, slug),
    });

    // Date/time spans are blanked so their digits are never tokens: ISO
    // dates, then slash/dot dates, then clock times — in that order.
    const blank = (s) => " ".repeat(s.length);
    const blanked = value
      .replace(/\d{4}-\d{2}-\d{2}/g, blank)
      .replace(/\d{1,4}[/.]\d{1,2}[/.]\d{1,4}/g, blank)
      .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, blank);

    const leadMatch = blanked.match(/^\s*(\d+(?:\.\d+)?)(?![A-Za-z0-9_.])/);
    // "Very start" is judged on the ORIGINAL value: a number that only looks
    // leading because a date or time before it was blanked does not count
    // (`2026-11-20 4 plans left — 23 (x)` must not resolve to phase 04).
    const leadAt = leadMatch ? leadMatch[0].length - leadMatch[1].length : -1;
    const lead =
      leadMatch && value.slice(0, leadAt).trim() === ""
        ? leadMatch[1]
        : undefined;

    // Only the FIRST slug-shaped token is considered.
    const slugMatch = blanked.match(
      /(?<![A-Za-z0-9_.-])(\d+(?:\.\d+)?-[a-z0-9-]+)/
    );
    const slug =
      slugMatch && dirs.includes(slugMatch[1]) ? slugMatch[1] : undefined;

    if (lead !== undefined) {
      const want = normNum(lead);
      if (slug !== undefined && normNum(dirNum(slug)) === want) {
        return found(slug);
      }
      const hits = dirs.filter((d) => normNum(dirNum(d)) === want);
      return hits.length === 1 ? found(hits[0]) : null;
    }

    return slug !== undefined ? found(slug) : null;
  } catch {
    return null;
  }
}

module.exports = { resolvePhase };
