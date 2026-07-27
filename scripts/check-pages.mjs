#!/usr/bin/env node
// Verifies that site/app/index.html matches a fresh generic build.
// Does NOT rebuild — caller must run `build:pages` first.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(import.meta.dirname, "..");
const artifact = "site/app/index.html";

export function assertPagesInSync(changed) {
  if (changed) {
    throw new Error(
      `✗ pages-sync: ${artifact} is stale — commit the freshly generated result`,
    );
  }
}

export function checkPages() {
  const comparison = spawnSync("git", ["diff", "--quiet", "--", artifact], { cwd: repo, stdio: "inherit" });
  if (comparison.error) throw comparison.error;
  assertPagesInSync(comparison.status !== 0);
  console.log(`✓ pages-sync: ${artifact} matches a fresh generic build`);
}

const isMain =
  process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    checkPages();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
