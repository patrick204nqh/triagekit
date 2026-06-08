#!/usr/bin/env node
// Tarball smoke test: pack the package, install the .tgz into a clean temp dir,
// run `triagekit build --generic`, and assert the output is a self-contained file.
// This catches missing runtime files (src/runtime/**) and mis-scoped dependencies
// (vite must be a runtime dep). Exits non-zero on any failure.
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const fail = (m) => { console.error(`✗ pack-smoke: ${m}`); process.exit(1); };
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

// 1. Build the CLI and pack.
console.log("• building CLI + packing…");
run("npm run build:cli", repo);
const packOut = run("npm pack --silent", repo).trim().split("\n").pop().trim();
const tgz = resolve(repo, packOut);
if (!existsSync(tgz)) fail(`npm pack produced no tarball (got "${packOut}")`);

const tmp = mkdtempSync(join(tmpdir(), "triagekit-smoke-"));
try {
  // 2. Install the tarball into a clean project (no workspace hoisting).
  console.log(`• installing ${packOut} into ${tmp}…`);
  run("npm init -y", tmp);
  run(`npm install "${tgz}"`, tmp);

  // 3. Run the installed binary.
  console.log("• running `triagekit build --generic`…");
  run("npx triagekit build --generic", tmp);

  // 4. Assert output exists and is self-contained.
  const out = join(tmp, "dist", "triage.html");
  if (!existsSync(out)) fail(`expected ${out} — build produced nothing`);
  const html = readFileSync(out, "utf8");
  if (/src="http/.test(html)) fail("built HTML references an external script — single-file invariant broken");
  if (html.length < 1000) fail(`built HTML suspiciously small (${html.length} bytes)`);
  console.log(`✓ pack-smoke: clean install builds a self-contained dashboard (${html.length} bytes)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(tgz, { force: true });
}
