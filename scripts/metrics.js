#!/usr/bin/env node
'use strict';
// Append-only stage metrics recorder.
//   node scripts/metrics.js record --stage <execute|verify|brew|plan>
//        [--phase <NN-slug>] [--repo <path>] [--key value]...
// Appends exactly one JSON line to .potion/metrics.jsonl. Never fails the
// calling stage: any error prints `metrics: skipped (<reason>)` to stderr and
// the process still exits 0.
//
//   node scripts/metrics.js report [--phase <NN-slug>] [--repo <path>]
// Read-only. Prints what the phase used, summed from its metrics lines:
// `USAGE <phase>` then one `  <label>: <value>` line each for plans, workers,
// agents (when a brew line recorded --agents), waves, verify cycles,
// respawns, gate stops and time. No lines for the phase → `USAGE <phase>`
// and `  no metrics recorded`.

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
        if (m) return m[1].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
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

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

// What a phase used, summed from its lines in metrics.jsonl.
function report(potionDir, phase) {
  const out = ['USAGE ' + (phase || '(phase not resolved)')];
  let rows = [];
  try {
    rows = fs.readFileSync(path.join(potionDir, 'metrics.jsonl'), 'utf8')
      .split(/\r?\n/)
      .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter((r) => r && typeof r === 'object' && (!phase || r.phase === phase));
  } catch (_) {
    rows = [];
  }
  if (!rows.length) {
    out.push('  no metrics recorded');
    return out;
  }
  const of = (stage) => rows.filter((r) => r.stage === stage);
  const sum = (list, key) => list.reduce((n, r) => n + num(r[key]), 0);
  const exec = of('execute');
  const verify = of('verify');
  const brew = of('brew');
  const last = rows[rows.length - 1];
  const lastVerify = verify[verify.length - 1];
  const lastBrew = brew[brew.length - 1];

  if (last.plans !== undefined) {
    // A runbook gets a SUMMARY too, so summaries are counted against plans
    // plus runbooks (field run 2026-11-26 printed "6 of 5 complete").
    const rb = num(last.runbooks);
    out.push('  ' + (rb ? 'plans and runbooks' : 'plans') + ': ' + num(last.summaries) + ' of ' +
      (num(last.plans) + rb) + ' complete' + (rb ? ' (' + rb + ' runbook' + (rb === 1 ? '' : 's') + ')' : ''));
  }
  out.push('  workers spawned: ' + sum(exec, 'workers'));
  if (lastBrew && lastBrew.agents !== undefined) out.push('  agents spawned (all kinds): ' + sum(brew, 'agents'));
  const width = exec.reduce((n, r) => Math.max(n, num(r.max_wave_width)), 0);
  out.push('  waves: ' + sum(exec, 'waves') + (width ? ', widest ' + width : ''));
  out.push('  verify cycles: ' + verify.length +
    (lastVerify && lastVerify.verdict ? ', verdict ' + lastVerify.verdict : ''));
  const overload = sum(exec, 'overload_respawns');
  out.push('  respawns: ' + (sum(exec, 'respawns') + sum(brew, 'respawns')) +
    (overload ? ' (plus ' + overload + ' after an overload)' : ''));
  out.push('  gate stops: ' + (sum(exec, 'gate_stops') + sum(brew, 'gate_stops')));
  const span = Math.round((Date.parse(last.ts) - Date.parse(rows[0].ts)) / 60000);
  if (lastBrew && lastBrew.minutes !== undefined) {
    out.push('  time: ' + sum(brew, 'minutes') + ' min in brew');
  } else if (isFinite(span)) {
    out.push('  time: ' + span + ' min from first to last recorded stage');
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'report') {
    let repo = process.cwd();
    let phase;
    for (const [key, value] of args.flags) {
      if (key === 'repo' && typeof value === 'string') repo = value;
      if (key === 'phase' && typeof value === 'string') phase = value;
    }
    const potionDir = path.join(path.resolve(repo), '.potion');
    if (!phase) phase = derivePhase(potionDir);
    process.stdout.write(report(potionDir, phase).join('\n') + '\n');
    return;
  }
  if (args.command !== 'record') {
    throw new Error('usage: metrics.js record --stage <stage> [--phase <NN-slug>] [--key value]... | metrics.js report [--phase <NN-slug>]');
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
