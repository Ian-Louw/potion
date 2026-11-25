#!/usr/bin/env node
'use strict';
// Mechanical check of a phase's wave grammar. Read-only: never writes.
//
//   node wave-check.js <phase-dir>
//
// Reads every PLAN-NN.md and RUNBOOK-NN.md in the directory and parses ONLY
// these frontmatter keys: plan, wave, depends_on, files_modified, resources.
// Body text is never read for meaning. The number in the FILE NAME is the
// unit's id in every case (execute keys completion on file names). A unit
// with a matching SUMMARY-NN.md is complete: still a valid dependency target,
// but never judged, and excluded from the exclusivity checks and from wave
// widths (it will not run again).
//
// A unit still to run that cannot be read is MALFORMED and fails the check:
// a frontmatter that never closes (or does not open the file), a missing or
// non-positive-integer wave, a `plan:` that disagrees with the file name, two
// files claiming one number (PLAN-01 and RUNBOOK-01, or PLAN-1 and PLAN-01),
// or a PLAN-/RUNBOOK- file whose name is not <NN>.md (PLAN-04b.md would never
// run). A unit with no readable wave is left out of waves and exclusivity.
//
// files_modified entries are compared after normalisation (backslashes to
// `/`, `.` segments dropped, `x/..` resolved, `//` collapsed, trailing `/`
// stripped, case ignored); a directory entry overlaps every path under it.
//
// Output lines:
//   WAVE <n> width=<count> plans=<NN,NN,…>
//   CONFLICT file <path> — PLAN-<a> and PLAN-<b> (wave <n>)
//   CONFLICT resource <name> — PLAN-<a> and PLAN-<b> (wave <n>)
//   BADWAVE PLAN-<a> — wave <w>, must be at least <e> (after its unfinished dependencies)
//   MISSINGDEP PLAN-<a> — depends on <NN>, no such plan or runbook
//   MALFORMED <file> — <reason>
//   SERIAL — <k> of <m> waves have width 1          (informational)
//   RESULT ok|fail conflicts=<n> badwave=<n> missingdep=<n> malformed=<n>
// A runbook is named RUNBOOK-<NN> in messages. CONFLICT file prints the
// first unit's spelling of the path.
//
// Exit 1 iff any CONFLICT, BADWAVE, MISSINGDEP or MALFORMED; 0 otherwise; 2
// when the directory or a plan file cannot be opened at all.

const fs = require('fs');
const path = require('path');

const LIST_KEYS = ['depends_on', 'files_modified', 'resources'];

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

// Strip a trailing YAML comment (` # …`) that sits outside quotes.
function stripComment(s) {
  let quote = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i);
    }
  }
  return s;
}

// Items of an inline list, given the text AFTER the opening `[`.
// Returns { items, closed } — closed is false when no `]` was reached.
function scanInline(text) {
  const items = [];
  let cur = '';
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ',') {
      items.push(cur);
      cur = '';
    } else if (c === ']') {
      items.push(cur);
      return { items: clean(items), closed: true };
    } else {
      cur += c;
    }
  }
  items.push(cur);
  return { items: clean(items), closed: false };
}

function clean(items) {
  return items.map(unquote).filter((s) => s !== '');
}

// The lines between an opening `---` (the first non-empty line) and the next
// `---` line; null when the frontmatter does not open the file or never closes.
function frontmatterLines(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  if (start >= lines.length || lines[start].trim() !== '---') return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(start + 1, i);
  }
  return null;
}

// wave is the positive integer, or null with waveError saying why not.
function parseFrontmatter(text) {
  const lines = frontmatterLines(text);
  const fm = lines || [];
  const out = {
    closed: lines !== null,
    plan: '',
    wave: null,
    waveError: 'wave is missing',
    depends_on: [],
    files_modified: [],
    resources: [],
  };
  for (let i = 0; i < fm.length; i++) {
    const m = /^([A-Za-z_]+)\s*:(.*)$/.exec(fm[i]);
    if (!m) continue;
    const key = m[1];
    const rest = m[2];
    if (key === 'plan') {
      out.plan = unquote(stripComment(rest));
    } else if (key === 'wave') {
      const raw = unquote(stripComment(rest));
      if (/^\d+$/.test(raw) && parseInt(raw, 10) > 0) {
        out.wave = parseInt(raw, 10);
        out.waveError = '';
      } else {
        out.wave = null;
        out.waveError = raw === '' ? 'wave is missing' : 'wave is not a positive integer';
      }
    } else if (LIST_KEYS.indexOf(key) !== -1) {
      const open = rest.indexOf('[');
      const scalar = stripComment(rest).trim();
      if (open !== -1 && scalar[0] === '[') {
        let body = rest.slice(open + 1);
        let scan = scanInline(body);
        while (!scan.closed && i + 1 < fm.length) {
          i++;
          body += ',' + stripComment(fm[i]);
          scan = scanInline(body);
        }
        out[key] = scan.items;
      } else if (scalar !== '') {
        out[key] = clean([scalar]);
      } else {
        const items = [];
        while (i + 1 < fm.length) {
          const b = /^\s*-\s+(.*)$/.exec(fm[i + 1]);
          if (!b) break;
          items.push(stripComment(b[1]));
          i++;
        }
        out[key] = clean(items);
      }
    }
  }
  return out;
}

// "1" and "01" name the same unit.
function normId(s) {
  const t = String(s).trim();
  return /^\d+$/.test(t) ? String(parseInt(t, 10)).padStart(2, '0') : t;
}

function uniq(list) {
  return list.filter((v, i) => list.indexOf(v) === i);
}

// The form two files_modified entries are compared in. '' is the repo root.
function normPath(s) {
  const t = s.trim().replace(/\\/g, '/');
  const segs = [];
  t.split('/').forEach((p) => {
    if (p === '' || p === '.') return;
    if (p === '..' && segs.length && segs[segs.length - 1] !== '..') segs.pop();
    else segs.push(p);
  });
  return ((t[0] === '/' ? '/' : '') + segs.join('/')).toLowerCase();
}

// Same path, or one is a directory holding the other (the prefix must end at
// a path separator: src/a.js does not overlap src/ab.js).
function overlaps(a, b) {
  if (a === b || a === '' || b === '') return true;
  if (a === '/' || b === '/') return a[0] === b[0];
  return b.indexOf(a + '/') === 0 || a.indexOf(b + '/') === 0;
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('usage: node wave-check.js <phase-dir>\n');
    return 2;
  }
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    process.stderr.write('wave-check: cannot read directory ' + dir + ' (' + e.code + ')\n');
    return 2;
  }
  names.sort();

  const complete = {};
  names.forEach((n) => {
    const s = /^SUMMARY-(\d+)\.md$/.exec(n);
    if (s) complete[normId(s[1])] = true;
  });

  const units = [];
  const strays = [];
  for (const n of names) {
    const m = /^(PLAN|RUNBOOK)-(\d+)\.md$/.exec(n);
    if (!m) {
      if (/^(PLAN|RUNBOOK)-.*\.md$/.test(n)) strays.push(n);
      continue;
    }
    let text;
    try {
      text = fs.readFileSync(path.join(dir, n), 'utf8');
    } catch (e) {
      process.stderr.write('wave-check: cannot read ' + n + ' (' + e.code + ')\n');
      return 2;
    }
    const fm = parseFrontmatter(text);
    const id = normId(m[2]);
    const reasons = [];
    if (!fm.closed) {
      reasons.push('frontmatter is not closed');
    } else {
      if (fm.wave === null) reasons.push(fm.waveError);
      if (fm.plan !== '' && normId(fm.plan) !== id) {
        reasons.push('file name says ' + id + ' but plan: says ' + fm.plan);
      }
    }
    const files = [];
    const seenFile = {};
    fm.files_modified.forEach((f) => {
      const key = normPath(f);
      if (seenFile[key]) return;
      seenFile[key] = true;
      files.push({ shown: f.trim().replace(/\\/g, '/'), key: key });
    });
    units.push({
      id: id,
      file: n,
      label: m[1] + '-' + id,
      wave: fm.wave,
      deps: uniq(fm.depends_on.map(normId)),
      files: files,
      resources: fm.resources.map((r) => r.trim()),
      complete: complete[id] === true,
      reasons: reasons,
    });
  }
  units.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const byId = {};
  units.forEach((u) => {
    if (byId[u.id]) u.reasons.push('number ' + u.id + ' is also claimed by ' + byId[u.id].file);
    else byId[u.id] = u;
  });

  const out = [];
  let conflicts = 0;
  let badwave = 0;
  let missingdep = 0;
  let malformed = 0;

  // Units still to run. A completed unit is history and is never judged.
  const live = units.filter((u) => !u.complete);

  // Wave widths and exclusivity — units still to run whose wave could be read.
  const sched = live.filter((u) => u.wave !== null);
  const waves = {};
  sched.forEach((u) => {
    (waves[u.wave] = waves[u.wave] || []).push(u);
  });
  const waveNums = Object.keys(waves)
    .map(Number)
    .sort((a, b) => a - b);
  waveNums.forEach((w) => {
    out.push('WAVE ' + w + ' width=' + waves[w].length + ' plans=' + waves[w].map((u) => u.id).join(','));
  });

  // Exclusivity — pairs of incomplete same-wave units.
  waveNums.forEach((w) => {
    const group = waves[w];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const tail = ' — ' + a.label + ' and ' + b.label + ' (wave ' + w + ')';
        a.files.forEach((f) => {
          if (b.files.some((g) => overlaps(f.key, g.key))) {
            out.push('CONFLICT file ' + f.shown + tail);
            conflicts++;
          }
        });
        const bRes = b.resources.map((r) => r.toLowerCase());
        const seen = {};
        a.resources.forEach((r) => {
          const k = r.toLowerCase();
          if (seen[k]) return;
          seen[k] = true;
          if (bRes.indexOf(k) !== -1) {
            out.push('CONFLICT resource ' + r + tail);
            conflicts++;
          }
        });
      }
    }
  });

  // Wave grammar and dependency targets — units that will still run. A
  // completed unit is history: it is never re-judged (a phase with an old
  // misnumbered plan must not block its own gap cycle), and as a dependency
  // it constrains nothing, because it has already run. What matters for
  // correctness is that a unit runs AFTER every dependency still to run;
  // a later wave than strictly needed is legal (gap plans are numbered by
  // cycle) — the SERIAL line is the hint about lost parallelism.
  live.forEach((u) => {
    let max = 0;
    u.deps.forEach((d) => {
      const t = byId[d];
      if (!t) {
        out.push('MISSINGDEP ' + u.label + ' — depends on ' + d + ', no such plan or runbook');
        missingdep++;
      } else if (!t.complete && t.wave !== null && t.wave > max) {
        max = t.wave;
      }
    });
    if (u.wave !== null && u.wave <= max) {
      out.push('BADWAVE ' + u.label + ' — wave ' + u.wave + ', must be at least ' + (max + 1) + ' (after its unfinished dependencies)');
      badwave++;
    }
  });

  // What could not be read — a unit the checker did not understand must
  // never pass as ok.
  live.forEach((u) => {
    u.reasons.forEach((r) => {
      out.push('MALFORMED ' + u.file + ' — ' + r);
      malformed++;
    });
  });
  strays.forEach((n) => {
    out.push('MALFORMED ' + n + ' — file name is not ' + n.split('-')[0] + '-<NN>.md, it would never run');
    malformed++;
  });

  const serial = waveNums.filter((w) => waves[w].length === 1).length;
  if (sched.length >= 3 && serial * 2 > waveNums.length) {
    out.push('SERIAL — ' + serial + ' of ' + waveNums.length + ' waves have width 1');
  }

  const failed = conflicts + badwave + missingdep + malformed > 0;
  out.push(
    'RESULT ' + (failed ? 'fail' : 'ok') + ' conflicts=' + conflicts + ' badwave=' + badwave +
      ' missingdep=' + missingdep + ' malformed=' + malformed
  );
  process.stdout.write(out.join('\n') + '\n');
  return failed ? 1 : 0;
}

process.exitCode = main();
