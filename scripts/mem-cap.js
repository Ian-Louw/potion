#!/usr/bin/env node
'use strict';
// mem-cap.js — how many workers a wave may run at once on this machine, from
// the memory that is free right now. Read-only; always exits 0.
//
//   node mem-cap.js [--free-gb <number>]
//
// Prints `CAP <n> (free <x> GB)` with n from 1 to 6. When n is below 6 a
// second line `WORKER-RULE <text>` follows, for the orchestrator to pass to
// every worker of the wave.
//
// Why: the six-worker cap counted agents, not memory. First field run,
// 2026-11-26, 16 GB machine with a Docker stack: four workers each running a
// test suite took free memory to 0.9 GB and the run was killed; one worker
// running jest held over 1 GB; two workers at 4 GB free completed.
// Rule: keep 1.5 GB in reserve, allow one worker per 1.25 GB above that.
const os = require('os');

const RESERVE_GB = 1.5;
const PER_WORKER_GB = 1.25;
const MAX = 6;

function freeGb() {
  const i = process.argv.indexOf('--free-gb');
  if (i !== -1) {
    const v = Number(process.argv[i + 1]);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  let bytes;
  try {
    // availableMemory counts reclaimable cache as free (Linux MemAvailable);
    // os.freemem does not, and would understate it there.
    bytes = typeof process.availableMemory === 'function' ? process.availableMemory() : os.freemem();
  } catch (e) {
    bytes = os.freemem();
  }
  return bytes / (1024 * 1024 * 1024);
}

function cap(free) {
  const n = Math.floor((free - RESERVE_GB) / PER_WORKER_GB);
  return Math.max(1, Math.min(MAX, n));
}

const free = freeGb();
const n = cap(free);
process.stdout.write('CAP ' + n + ' (free ' + free.toFixed(1) + ' GB)\n');
if (n < MAX) {
  process.stdout.write('WORKER-RULE memory is short: run one test command at a time, limit a test runner to 2 processes, leave no watcher or server running\n');
}
process.exit(0);
