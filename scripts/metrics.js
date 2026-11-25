#!/usr/bin/env node
'use strict';
// Append-only stage metrics recorder.
//   node scripts/metrics.js record --stage <execute|verify|brew|plan>
//        [--phase <NN-slug>] [--repo <path>] [--key value]...
// Appends exactly one JSON line to .potion/metrics.jsonl. Never fails the
// calling stage: any error prints `metrics: skipped (<reason>)` to stderr and
// the process still exits 0.

const fs = require('fs');
const path = require('path');
const { resolvePhase } = require('../hooks/phase-slug.js');

const NOTE_MAX = 200;

function parseArgs(argv) {
  const out = { command: null, flags: [] };
  let i = 0;
  if (argv.length && !argv[0].startsWith('--')) {
    out.command = argv[0];
    i = 1;
  }
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { i += 1; continue; }
    let key = arg.slice(2);
    let value;
    const eq = key.indexOf('=');
    if (eq !== -1) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
      i += 1;
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      value = argv[i + 1];
      i += 2;
    } else {
      value = true;
      i += 1;
    }
    if (key) out.flags.push([key, value]);
  }
  return out;
}

function coerce(value) {
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

// Phase from STATE.md's `- Phase:` line, via the one shared resolver (the same
// one the hooks and doctor use). Null → the line is written without `phase`.
function derivePhase(potionDir) {
  let state;
  try {
    state = fs.readFileSync(path.join(potionDir, 'STATE.md'), 'utf8');
  } catch (_) {
    return null;
  }
  const phase = resolvePhase(state, potionDir);
  return phase ? phase.slug : null;
}

function deriveFromDisk(potionDir, phase) {
  const derived = {};
  const dir = path.join(potionDir, 'phases', phase);
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (_) {
    return derived;
  }
  const count = (re) => names.filter((n) => re.test(n)).length;
  derived.plans = count(/^PLAN-\d+\.md$/);
  derived.runbooks = count(/^RUNBOOK-\d+\.md$/);
  derived.summaries = count(/^SUMMARY-\d+\.md$/);
  derived.drafts = count(/^SUMMARY-\d+\.draft\.md$/);
  try {
    const text = fs.readFileSync(path.join(dir, 'VERIFICATION.md'), 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const lines = (fm ? fm[1] : text).split(/\r?\n/);
    const field = (name) => {
      const re = new RegExp('^' + name + ':\\s*(.+?)\\s*$');
      for (const l of lines) {
        const m = l.match(re);
        if (m) return m[1].replace(/^["']|["']$/g, '');
      }
      return undefined;
    };
    const cycle = field('cycle');
    const verdict = field('verdict');
    if (cycle !== undefined) derived.cycle = coerce(cycle);
    if (verdict !== undefined) derived.verdict = verdict;
  } catch (_) {
    // no VERIFICATION.md — omit cycle and verdict
  }
  return derived;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== 'record') {
    throw new Error('usage: metrics.js record --stage <stage> [--phase <NN-slug>] [--key value]...');
  }

  let repo = process.cwd();
  let stage;
  let phase;
  const passThrough = [];
  for (const [key, value] of args.flags) {
    if (key === 'repo') { if (typeof value === 'string') repo = value; continue; }
    if (key === 'stage') { if (typeof value === 'string') stage = value; continue; }
    if (key === 'phase') { if (typeof value === 'string') phase = value; continue; }
    passThrough.push([key, value]);
  }

  const potionDir = path.join(path.resolve(repo), '.potion');
  let isDir = false;
  try {
    isDir = fs.statSync(potionDir).isDirectory();
  } catch (_) {
    isDir = false;
  }
  if (!isDir) return; // not a potion repo — silent no-op

  if (!stage) throw new Error('missing --stage');

  // ts is always machine-derived — never accept one from the caller.
  const record = { ts: new Date().toISOString(), stage };
  if (!phase) phase = derivePhase(potionDir);
  if (phase) {
    record.phase = phase;
    Object.assign(record, deriveFromDisk(potionDir, phase));
  }
  for (const [key, value] of passThrough) {
    const name = key.replace(/-/g, '_');
    if (name === 'ts' || name === 'stage' || name === 'phase') continue;
    record[name] = name === 'note' ? String(value).slice(0, NOTE_MAX) : coerce(value);
  }

  const line = JSON.stringify(record);
  fs.appendFileSync(path.join(potionDir, 'metrics.jsonl'), line + '\n');
  process.stdout.write(line + '\n');
}

try {
  main();
} catch (err) {
  const reason = err && err.message ? err.message : String(err);
  process.stderr.write('metrics: skipped (' + reason + ')\n');
}
process.exitCode = 0;
