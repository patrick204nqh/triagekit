#!/usr/bin/env node
// Anonymity guardrail. Fails (exit 1) if the tracked tree contains:
//   • any term from an optional denylist (scripts/anon-denylist.txt, gitignored),
//   • a committed credential (ghp_… / github_pat_…),
//   • tracked files that must stay private (triage.config.yml, dist/).
// Structural checks always run, even with no denylist.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const fail = (msg) => { console.error(`✗ anon-lint: ${msg}`); process.exitCode = 1; };

const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n").map((s) => s.trim()).filter(Boolean);

// 1. Files that must never be tracked.
for (const f of tracked) {
  if (f === "triage.config.yml" || f.startsWith("dist/")) {
    fail(`private artifact is tracked: ${f}`);
  }
}

// 2. Optional denylist of real identifiers.
const denyPath = "scripts/anon-denylist.txt";
const denylist = existsSync(denyPath)
  ? readFileSync(denyPath, "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"))
  : [];

// 3. Always-on credential patterns.
const TOKEN_PATTERNS = [/ghp_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{22,}/];

for (const f of tracked) {
  let content;
  try { content = readFileSync(f, "utf8"); } catch { continue; } // skip binary/unreadable
  for (const term of denylist) {
    if (content.includes(term)) fail(`denylisted term "${term}" found in ${f}`);
  }
  for (const re of TOKEN_PATTERNS) {
    if (re.test(content)) fail(`possible committed credential in ${f}`);
  }
}

if (process.exitCode) {
  console.error("\nAnonymity lint failed — see above.");
} else {
  console.log("✓ anon-lint: clean");
}
