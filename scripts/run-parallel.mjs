#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { argv, exit, stdout, stderr } from "node:process";

const repo = resolve(import.meta.dirname, "..");
const tasks = argv.slice(2);

if (!tasks.length) {
  stderr.write("Usage: node run-parallel.mjs <script1> [script2 ...]\n");
  exit(1);
}

const results = [];
let running = tasks.length;

function suffix(code) {
  return code === 0 ? "\u2713" : "\u2717";
}

for (const name of tasks) {
  const start = Date.now();
  const child = spawn("npm run " + name, { cwd: repo, stdio: "inherit", shell: true });
  child.on("close", (code) => {
    const duration = Date.now() - start;
    results.push({ name, code: code ?? 1, duration });
    running--;
    if (running === 0) finish();
  });
}

function finish() {
  const failed = results.filter((r) => r.code !== 0);
  stdout.write("\n\u2500\u2500 Parallel results \u2500\u2500\n");
  for (const r of results) {
    stdout.write(`  ${suffix(r.code)} ${r.name} (${(r.duration / 1000).toFixed(1)}s)\n`);
  }
  if (failed.length) {
    stdout.write(`\n\u2717 ${failed.length} task(s) failed\n`);
    exit(1);
  }
  stdout.write("\n\u2713 all tasks passed\n");
}
