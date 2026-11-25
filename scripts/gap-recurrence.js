#!/usr/bin/env node
'use strict';
// Has a gap from the previous verify cycle come back?
//
//   node gap-recurrence.js <phase-dir>        (cwd anywhere inside the repo)
//
// Reads <phase-dir>/VERIFICATION.md frontmatter (`cycle:`, `verdict:`, and
// each `truth:` under `gaps:`), finds the newest committed version of that
// file whose `cycle:` is exactly current-1, and compares the gap truths.
//
// A gap item may be written at any indentation (column 0 included), with its
// truth plain, single- or double-quoted, as a block scalar (`truth: >-` or
// `|`, the more-indented lines joined into one string), or as a one-line
// flow map (`- {truth: "…", status: …}`).
//
// Output:
//   CYCLE <n>
//   RECURRING <truth>     a gap whose normalised text was a gap last cycle
//   NEW <truth>           every other current gap
//   RESULT recurring=<k> new=<m>
// Nothing to compare (no VERIFICATION.md, cycle 1, verdict not gaps, no
// previous version found) → `RESULT recurring=0 new=<m> (nothing to compare)`.
//
// Exit 0 whenever it ran; exit 2 (message on stderr) when the directory does
// not exist or is not inside a git repository. Read-only: never writes.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FILE = 'VERIFICATION.md';
const MAX_COMMITS = 30;

function die(msg) {
  process.stderr.write('gap-recurrence: ' + msg + '\n');
  process.exit(2);
}

function git(dir, args) {
  return execFileSync('git', ['-C', dir].concat(args), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 16 * 1024 * 1024,
  });
}

// The lines between the opening `---` and the next `---`; [] when absent.
function frontmatter(text) {
  const all = text.replace(/^﻿/, '').split(/\r?\n/);
  if (all.length === 0 || all[0].trim() !== '---') return [];
  const out = [];
  for (let i = 1; i < all.length; i++) {
    if (all[i].trim() === '---') return out;
    out.push(all[i]);
  }
  return [];
}

// A YAML scalar as written after `key:` → its text, quotes and any trailing
// `# comment` removed.
function scalar(raw) {
  const s = raw.trim();
  if (s[0] === '"') {
    let out = '';
    for (let i = 1; i < s.length; i++) {
      if (s[i] === '\\' && i + 1 < s.length) { out += s[++i]; continue; }
      if (s[i] === '"') return out;
      out += s[i];
    }
    return out;
  }
  if (s[0] === "'") {
    let out = '';
    for (let i = 1; i < s.length; i++) {
      if (s[i] === "'") {
        if (s[i + 1] === "'") { out += "'"; i++; continue; }
        return out;
      }
      out += s[i];
    }
    return out;
  }
  return s.replace(/\s+#.*$/, '').trim();
}

// The `truth` value of a one-line flow map, given the text after its `{`;
// '' when it has none. Commas and colons inside quotes are not separators.
function flowTruth(text) {
  const parts = [];
  let cur = '';
  let quote = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"' && i + 1 < text.length) cur += text[++i];
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === '{' || c === '[') {
      depth++;
      cur += c;
    } else if (c === '}' || c === ']') {
      if (depth === 0) break;
      depth--;
      cur += c;
    } else if (c === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  for (const part of parts) {
    const m = /^\s*(?:truth|"truth"|'truth')\s*:(.*)$/.exec(part);
    if (m) return scalar(m[1]);
  }
  return '';
}

function indentOf(line) {
  return /^\s*/.exec(line)[0].length;
}

// → { cycle: number|null, verdict: string, gaps: [truth, ...] }
function parse(text) {
  const fm = frontmatter(text);
  let cycle = null;
  let verdict = '';
  const gaps = [];
  let inGaps = false;
  for (let i = 0; i < fm.length; i++) {
    const line = fm[i];
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (/^[^\s-]/.test(line)) {
      // a top-level key ends any list we were in
      inGaps = /^gaps\s*:/.test(line);
      const c = /^cycle:\s*["']?(\d+)/.exec(line);
      if (c) cycle = parseInt(c[1], 10);
      const v = /^verdict:(.*)$/.exec(line);
      if (v) verdict = scalar(v[1]);
      continue;
    }
    if (!inGaps) continue;
    // a list item or a key inside one, at any indentation including column 0
    const m = /^(\s*)(-\s+)?(.*)$/.exec(line);
    const rest = m[3];
    let truth = '';
    if (m[2] && rest[0] === '{') {
      truth = flowTruth(rest.slice(1));
    } else {
      const t = /^truth\s*:(.*)$/.exec(rest);
      if (!t) continue;
      if (/^\s*[>|][+-]?\d?[+-]?\s*(#.*)?$/.test(t[1])) {
        // block scalar: the following more-indented lines are the value
        const keyCol = m[1].length + (m[2] ? m[2].length : 0);
        const parts = [];
        while (i + 1 < fm.length && (fm[i + 1].trim() === '' || indentOf(fm[i + 1]) > keyCol)) {
          i++;
          if (fm[i].trim() !== '') parts.push(fm[i].trim());
        }
        truth = parts.join(' ');
      } else {
        truth = scalar(t[1]);
      }
    }
    if (truth) gaps.push(truth);
  }
  return { cycle, verdict, gaps };
}

function normalise(truth) {
  return truth
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.,;:!?…]+$/, '');
}

// Newest committed version of the file whose cycle is `want`; null if none
// within MAX_COMMITS commits.
function previousVersion(dir, want) {
  let hashes;
  try {
    hashes = git(dir, ['log', '--format=%H', '-n', String(MAX_COMMITS), '--', FILE])
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (e) {
    return null;
  }
  for (const hash of hashes) {
    let text;
    try {
      text = git(dir, ['show', hash + ':./' + FILE]);
    } catch (e) {
      continue; // the file was absent in that commit
    }
    const parsed = parse(text);
    if (parsed.cycle === want) return parsed;
  }
  return null;
}

function main() {
  const arg = process.argv[2];
  if (!arg) die('usage: node gap-recurrence.js <phase-dir>');
  const dir = path.resolve(arg);

  let stat = null;
  try { stat = fs.statSync(dir); } catch (e) { /* handled below */ }
  if (!stat || !stat.isDirectory()) die('not a directory: ' + arg);

  try {
    git(dir, ['rev-parse', '--show-toplevel']);
  } catch (e) {
    die('not inside a git repository: ' + arg);
  }

  const out = [];
  const nothing = (gaps) => {
    for (const g of gaps) out.push('NEW ' + g);
    out.push('RESULT recurring=0 new=' + gaps.length + ' (nothing to compare)');
    process.stdout.write(out.join('\n') + '\n');
    process.exit(0);
  };

  let text;
  try {
    text = fs.readFileSync(path.join(dir, FILE), 'utf8');
  } catch (e) {
    nothing([]);
  }

  const cur = parse(text);
  if (cur.cycle !== null) out.push('CYCLE ' + cur.cycle);
  if (cur.cycle === null || cur.cycle <= 1 || cur.verdict !== 'gaps') nothing(cur.gaps);

  const prev = previousVersion(dir, cur.cycle - 1);
  if (!prev) nothing(cur.gaps);

  const seen = new Set(prev.gaps.map(normalise));
  let recurring = 0;
  let fresh = 0;
  for (const g of cur.gaps) {
    if (seen.has(normalise(g))) {
      recurring++;
      out.push('RECURRING ' + g);
    } else {
      fresh++;
      out.push('NEW ' + g);
    }
  }
  out.push('RESULT recurring=' + recurring + ' new=' + fresh);
  process.stdout.write(out.join('\n') + '\n');
  process.exit(0);
}

main();
