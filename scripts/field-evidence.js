#!/usr/bin/env node
// field-evidence.js — mechanical counting for a potion field-evidence pass.
// Read-only: never writes, renames or deletes anything. Prints markdown to stdout.
//
//   node field-evidence.js --root <dir> [--root <dir>…] [--transcripts <dir>]
//                          [--since YYYY-MM-DD] [--depth N]
//
// Never throws: anything that fails to read is listed under "## Could not read".
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SKIP_DIRS = new Set(['node_modules', '.git']);
const WORKTREE_RE = /-wt-\d+$/;
const PLAN_RE = /^PLAN-\d+\.md$/;
const RUNBOOK_RE = /^RUNBOOK-\d+\.md$/;
const SUMMARY_RE = /^SUMMARY-\d+\.md$/;
const DRAFT_RE = /^SUMMARY-\d+\.draft\.md$/;
const WORKFLOW_RE = /potion|worker|subagent|worktree|scrub|summary|verif|stop.hook|checkpoint|runbook/i;
const METRIC_FIELDS = ['workers', 'max_wave_width', 'respawns', 'gate_stops', 'gaps', 'refusals', 'minutes'];

const TYPED_RE = /<command-name>\/([\w:-]+)/g;
const SKILL_CALL_RE = /"skill":"potion:(\w+)"/g;
const REFUSAL_TEXT = 'Subagents should return findings as text';
const STOP_BLOCK_TEXT = 'POTION DRIFT:';
const SIDECHAIN_TEXT = '"isSidechain":true';
const USER_LINE_TEXT = '"type":"user"';
const BARE_CONTINUE_RE = /"content":"\s*(?:go|continue|proceed|go on)\s*[.!?]*\s*"/i;
const TIMESTAMP_RE = /"timestamp":"([^"]+)"/;

const unreadable = []; // { where, why }

function couldNotRead(where, err) {
  unreadable.push({ where, why: (err && (err.code || err.message)) || 'unknown error' });
}

function parseArgs(argv) {
  const opts = { roots: [], transcripts: null, since: null, depth: 3, problems: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : null);
    if (a === '--root') {
      const v = next();
      if (v) opts.roots.push(v); else opts.problems.push('--root needs a directory');
    } else if (a === '--transcripts') {
      const v = next();
      if (v) opts.transcripts = v; else opts.problems.push('--transcripts needs a directory');
    } else if (a === '--since') {
      const v = next();
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) opts.since = v;
      else opts.problems.push('--since needs YYYY-MM-DD (ignored)');
    } else if (a === '--depth') {
      const v = next();
      const n = Number(v);
      if (v !== null && Number.isInteger(n) && n >= 0) opts.depth = n;
      else opts.problems.push('--depth needs a non-negative integer (default 3 used)');
    } else {
      opts.problems.push('unknown argument ignored: ' + a);
    }
  }
  return opts;
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    couldNotRead(dir, e);
    return null;
  }
}

function nonEmptyLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
  } catch (e) {
    couldNotRead(file, e);
    return null;
  }
}

// ---------- repo discovery ----------

function discover(root, maxDepth, found, seen) {
  const walk = (dir, depth) => {
    if (isFile(path.join(dir, '.potion', 'STATE.md'))) {
      const key = dir.toLowerCase();
      if (!seen.has(key)) { seen.add(key); found.push(dir); }
      return; // a repo is a leaf: never descend into it
    }
    if (depth >= maxDepth) return;
    const entries = listDir(dir);
    if (!entries) return;
    for (const e of entries) {
      let isDir = false;
      try { isDir = e.isDirectory(); } catch (err) { isDir = false; }
      if (!isDir) continue;
      if (SKIP_DIRS.has(e.name) || WORKTREE_RE.test(e.name)) continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
}

// ---------- per repo ----------

function scanRepo(dir) {
  const repo = {
    name: path.basename(dir), dir, phases: [], plans: 0, runbooks: 0, summaries: 0,
    drafts: 0, verifications: 0, learnings: 0, metricsLines: 0, hasMetrics: false,
    learningEntries: [], metricRecords: [], badLearningLines: 0, badMetricLines: 0,
  };
  const phasesDir = path.join(dir, '.potion', 'phases');
  if (fs.existsSync(phasesDir)) {
    const entries = listDir(phasesDir) || [];
    for (const e of entries) {
      let isDir = false;
      try { isDir = e.isDirectory(); } catch (err) { isDir = false; }
      if (!isDir) continue;
      const files = (listDir(path.join(phasesDir, e.name)) || []).map((f) => f.name);
      const phase = {
        name: e.name,
        plans: files.filter((f) => PLAN_RE.test(f)).length,
        runbooks: files.filter((f) => RUNBOOK_RE.test(f)).length,
        summaries: files.filter((f) => SUMMARY_RE.test(f)).length,
        drafts: files.filter((f) => DRAFT_RE.test(f)).length,
        discussion: files.includes('DISCUSSION.md'),
        verification: files.includes('VERIFICATION.md'),
      };
      repo.phases.push(phase);
      repo.plans += phase.plans;
      repo.runbooks += phase.runbooks;
      repo.summaries += phase.summaries;
      repo.drafts += phase.drafts;
      if (phase.verification) repo.verifications += 1;
    }
    repo.phases.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  const learningsFile = path.join(dir, '.potion', 'learnings.jsonl');
  if (fs.existsSync(learningsFile)) {
    const lines = nonEmptyLines(learningsFile) || [];
    repo.learnings = lines.length;
    for (const l of lines) {
      try {
        const obj = JSON.parse(l);
        if (obj && typeof obj === 'object') repo.learningEntries.push(obj);
        else repo.badLearningLines += 1;
      } catch (e) { repo.badLearningLines += 1; }
    }
  }

  const metricsFile = path.join(dir, '.potion', 'metrics.jsonl');
  if (fs.existsSync(metricsFile)) {
    repo.hasMetrics = true;
    const lines = nonEmptyLines(metricsFile) || [];
    repo.metricsLines = lines.length;
    for (const l of lines) {
      try {
        const obj = JSON.parse(l);
        if (obj && typeof obj === 'object') repo.metricRecords.push(obj);
        else repo.badMetricLines += 1;
      } catch (e) { repo.badMetricLines += 1; }
    }
  }
  return repo;
}

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// ---------- transcripts ----------

function newCounts() {
  return {
    files: 0, typed: {}, typedTotal: 0, skillCalls: {}, skillCallTotal: 0, clear: 0,
    clearThenPotion: 0, refusals: 0, stopBlocks: 0, bareContinues: 0,
  };
}

function bump(map, key) { map[key] = (map[key] || 0) + 1; }

async function scanTranscriptFile(file, since, c) {
  let lastTypedWasClear = false; // per file
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.indexOf(SIDECHAIN_TEXT) !== -1) continue;
    // api-request-blob lines replay the whole conversation so far: every
    // earlier command, refusal and hook block reappears in each one. Counting
    // them doubled typed commands and nearly tripled stop blocks in the field.
    if (line.startsWith('{"type":"api-request-blob"')) continue;
    if (since) {
      const ts = TIMESTAMP_RE.exec(line);
      if (ts && ts[1].slice(0, 10) < since) continue;
    }
    if (line.indexOf('<command-name>/') !== -1) {
      TYPED_RE.lastIndex = 0;
      let m;
      while ((m = TYPED_RE.exec(line)) !== null) {
        const name = m[1];
        if (name === 'clear') {
          c.clear += 1;
          lastTypedWasClear = true;
        } else {
          const p = /^potion:(\w+)$/.exec(name);
          if (p) {
            bump(c.typed, p[1]);
            c.typedTotal += 1;
            if (lastTypedWasClear) c.clearThenPotion += 1;
          }
          lastTypedWasClear = false;
        }
      }
    }
    if (line.indexOf('"skill":"potion:') !== -1) {
      SKILL_CALL_RE.lastIndex = 0;
      let m;
      while ((m = SKILL_CALL_RE.exec(line)) !== null) {
        bump(c.skillCalls, m[1]);
        c.skillCallTotal += 1;
      }
    }
    if (line.indexOf(REFUSAL_TEXT) !== -1) c.refusals += 1;
    // Each block is logged twice: once as the feedback line and once as a
    // stop_hook_summary system line. Count the feedback line only.
    if (line.indexOf(STOP_BLOCK_TEXT) !== -1 &&
        line.indexOf('"subtype":"stop_hook_summary"') === -1) c.stopBlocks += 1;
    if (line.indexOf(USER_LINE_TEXT) !== -1 && BARE_CONTINUE_RE.test(line)) c.bareContinues += 1;
  }
}

async function scanTranscripts(dir, since) {
  const projects = [];
  const entries = listDir(dir);
  if (!entries) return projects;
  for (const e of entries) {
    let isDir = false;
    try { isDir = e.isDirectory(); } catch (err) { isDir = false; }
    if (!isDir) continue;
    const projDir = path.join(dir, e.name);
    const files = (listDir(projDir) || []).filter((f) => {
      try { return f.isFile() && f.name.endsWith('.jsonl'); } catch (err) { return false; }
    });
    const c = newCounts();
    for (const f of files) {
      const file = path.join(projDir, f.name);
      try {
        await scanTranscriptFile(file, since, c);
        c.files += 1;
      } catch (err) {
        couldNotRead(file, err);
      }
    }
    projects.push({ name: e.name, counts: c });
  }
  projects.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return projects;
}

// ---------- report ----------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const out = [];
  const p = (s) => out.push(s === undefined ? '' : s);

  const repoDirs = [];
  const seen = new Set();
  for (const r of opts.roots) {
    const abs = path.resolve(r);
    let ok = false;
    try { ok = fs.statSync(abs).isDirectory(); } catch (e) { couldNotRead(abs, e); }
    if (ok) discover(abs, opts.depth, repoDirs, seen);
  }
  const repos = [];
  for (const d of repoDirs) {
    try { repos.push(scanRepo(d)); } catch (e) { couldNotRead(d, e); }
  }
  repos.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  p('# Potion field evidence — raw counts');
  p();
  p('- roots: ' + (opts.roots.length ? opts.roots.map((r) => '`' + path.resolve(r) + '`').join(', ') : '(none given)'));
  p('- depth: ' + opts.depth);
  p('- since: ' + (opts.since || '(all time)'));
  p('- transcripts: ' + (opts.transcripts ? '`' + path.resolve(opts.transcripts) + '`' : '(not given)'));
  p('- repos found: ' + repos.length);
  p();

  p('## Repos');
  p();
  if (!repos.length) {
    p('No directory containing `.potion/STATE.md` was found.');
  } else {
    p('| repo | phases | plans | runbooks | summaries | drafts | verifications | learnings | metrics lines |');
    p('|---|---|---|---|---|---|---|---|---|');
    for (const r of repos) {
      p('| ' + [r.name, r.phases.length, r.plans, r.runbooks, r.summaries, r.drafts,
        r.verifications, r.learnings, r.metricsLines].join(' | ') + ' |');
    }
  }
  p();

  p('## Skipped steps');
  p();
  const skipped = [];
  for (const r of repos) {
    for (const ph of r.phases) {
      const work = ph.plans + ph.runbooks;
      if (ph.discussion && work === 0) {
        skipped.push('- ' + r.name + ': ' + ph.name + ' — discussed, never planned');
      }
      if (work > ph.summaries) {
        skipped.push('- ' + r.name + ': ' + ph.name + ' — plans ahead of summaries (' + work +
          ' plans/runbooks, ' + ph.summaries + ' summaries)');
      }
      if (ph.summaries >= 1 && ph.summaries >= work && !ph.verification) {
        skipped.push('- ' + r.name + ': ' + ph.name + ' — no verification');
      }
    }
  }
  if (skipped.length) skipped.forEach((s) => p(s)); else p('None found.');
  p();

  const metricRepos = repos.filter((r) => r.hasMetrics);
  if (metricRepos.length) {
    p('## Metrics');
    p();
    const stages = {};
    for (const r of metricRepos) {
      for (const rec of r.metricRecords) {
        if (opts.since && typeof rec.ts === 'string' && rec.ts.slice(0, 10) < opts.since) continue;
        const stage = typeof rec.stage === 'string' && rec.stage ? rec.stage : '(no stage)';
        const s = stages[stage] || (stages[stage] = { records: 0, fields: {} });
        s.records += 1;
        for (const f of METRIC_FIELDS) {
          if (typeof rec[f] === 'number' && Number.isFinite(rec[f])) {
            (s.fields[f] || (s.fields[f] = [])).push(rec[f]);
          }
        }
      }
    }
    const names = Object.keys(stages).sort();
    if (!names.length) {
      p('No metrics records in range.');
    } else {
      p('| stage | records | field | n | median | max |');
      p('|---|---|---|---|---|---|');
      for (const n of names) {
        const s = stages[n];
        const fields = METRIC_FIELDS.filter((f) => s.fields[f]);
        if (!fields.length) p('| ' + n + ' | ' + s.records + ' | (no numeric fields) | 0 | - | - |');
        for (const f of fields) {
          const v = s.fields[f];
          p('| ' + [n, s.records, f, v.length, fmt(median(v)), fmt(Math.max.apply(null, v))].join(' | ') + ' |');
        }
      }
    }
    p();
  }

  p('## Workflow learnings');
  p();
  const keyStats = {};
  let workflowCount = 0;
  for (const r of repos) {
    for (const e of r.learningEntries) {
      const key = typeof e.key === 'string' ? e.key : '';
      const insight = typeof e.insight === 'string' ? e.insight : '';
      if (!WORKFLOW_RE.test(key) && !WORKFLOW_RE.test(insight)) continue;
      workflowCount += 1;
      const k = key || '(no key)';
      const st = keyStats[k] || (keyStats[k] = { entries: 0, repos: new Set() });
      st.entries += 1;
      st.repos.add(r.name);
    }
  }
  p('Entries whose key or insight matches the workflow pattern: ' + workflowCount);
  p();
  const topKeys = Object.keys(keyStats).sort((a, b) =>
    keyStats[b].entries - keyStats[a].entries || keyStats[b].repos.size - keyStats[a].repos.size ||
    (a < b ? -1 : a > b ? 1 : 0)).slice(0, 15);
  if (topKeys.length) {
    p('| key | entries | repos |');
    p('|---|---|---|');
    for (const k of topKeys) p('| ' + k + ' | ' + keyStats[k].entries + ' | ' + keyStats[k].repos.size + ' |');
    p();
  }

  let transcriptProjects = null;
  if (opts.transcripts) {
    const tdir = path.resolve(opts.transcripts);
    p('## Transcripts (line-pattern counts — may include duplicates)');
    p();
    transcriptProjects = await scanTranscripts(tdir, opts.since);
    const t = newCounts();
    for (const pr of transcriptProjects) {
      const c = pr.counts;
      t.files += c.files; t.typedTotal += c.typedTotal; t.skillCallTotal += c.skillCallTotal;
      t.clear += c.clear; t.clearThenPotion += c.clearThenPotion; t.refusals += c.refusals;
      t.stopBlocks += c.stopBlocks; t.bareContinues += c.bareContinues;
      for (const k of Object.keys(c.typed)) t.typed[k] = (t.typed[k] || 0) + c.typed[k];
      for (const k of Object.keys(c.skillCalls)) t.skillCalls[k] = (t.skillCalls[k] || 0) + c.skillCalls[k];
    }
    p('Sidechain lines are skipped. Totals:');
    p();
    p('- projects: ' + transcriptProjects.length);
    p('- files: ' + t.files);
    p('- typed potion commands: ' + t.typedTotal);
    for (const k of Object.keys(t.typed).sort()) p('- typed /potion:' + k + ': ' + t.typed[k]);
    p('- skill-tool potion calls: ' + t.skillCallTotal);
    for (const k of Object.keys(t.skillCalls).sort()) p('- skill-tool potion:' + k + ': ' + t.skillCalls[k]);
    p('- /clear: ' + t.clear);
    p('- /clear then potion: ' + t.clearThenPotion);
    p('- SUMMARY write refusals: ' + t.refusals);
    p('- stop-drift blocks: ' + t.stopBlocks);
    p('- bare continues: ' + t.bareContinues);
    p();
    if (transcriptProjects.length) {
      p('| project | files | typed potion | skill-tool potion | /clear | /clear then potion | refusals | stop blocks | bare continues |');
      p('|---|---|---|---|---|---|---|---|---|');
      for (const pr of transcriptProjects) {
        const c = pr.counts;
        p('| ' + [pr.name, c.files, c.typedTotal, c.skillCallTotal, c.clear, c.clearThenPotion,
          c.refusals, c.stopBlocks, c.bareContinues].join(' | ') + ' |');
      }
      p();
    }
  }

  if (unreadable.length) {
    p('## Could not read');
    p();
    for (const u of unreadable) p('- `' + u.where + '` — ' + u.why);
    p();
  }

  p('## Limits');
  p();
  if (!opts.roots.length) p('- No --root given: no repos were scanned.');
  const noMetrics = repos.filter((r) => !r.hasMetrics);
  p('- Repos with no `.potion/metrics.jsonl` (stage metrics not measured): ' + noMetrics.length + ' of ' +
    repos.length + (noMetrics.length ? ' — ' + noMetrics.map((r) => r.name).join(', ') : ''));
  const badLearn = repos.reduce((n, r) => n + r.badLearningLines, 0);
  const badMetric = repos.reduce((n, r) => n + r.badMetricLines, 0);
  p('- Unparseable JSONL lines skipped: ' + badLearn + ' learnings, ' + badMetric + ' metrics.');
  if (!opts.transcripts) {
    p('- No --transcripts given: command invocations, /clear sequences, refusals and stop blocks were not measured.');
  } else {
    p('- Transcript counts are raw line-pattern matches: quoted or replayed text counts again, sidechain ' +
      'lines are skipped, lines without a timestamp are always counted, and bare continues are best effort.');
  }
  p('- Unreadable files or directories: ' + unreadable.length + (unreadable.length ? ' (see "Could not read")' : ''));
  p('- Worker worktrees (`-wt-NN`), `node_modules` and `.git` are never entered; a repo deeper than --depth ' +
    opts.depth + ' is not seen.');
  p('- Counts say what exists on disk, not why: a phase with plans ahead of summaries may simply be in progress.');
  for (const pr of opts.problems) p('- Argument problem: ' + pr);

  process.stdout.write(out.join('\n') + '\n');
}

main().catch((e) => {
  process.stdout.write('# Potion field evidence — raw counts\n\n## Could not read\n\n- report generation failed — ' +
    ((e && e.message) || 'unknown error') + '\n');
});
