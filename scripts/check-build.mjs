#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(import.meta.dirname, "..");
const output = resolve(repo, "dist/triage.html");

export function assertSelfContainedHtml(html) {
  const externalAsset =
    /<script\b[^>]*\bsrc\s*=/i.test(html)
    || /<link\b[^>]*\brel=["'](?:stylesheet|modulepreload)["']/i.test(html);
  if (externalAsset) {
    throw new Error(
      "✗ build-smoke: built HTML references a runtime asset — single-file invariant broken",
    );
  }
}

export function assertSingleArtifact(entries) {
  if (entries.length !== 1 || entries[0] !== "triage.html") {
    throw new Error(
      "✗ build-smoke: expected exactly dist/triage.html — single-file invariant broken",
    );
  }
}

export function checkBuild() {
  execFileSync(
    process.execPath,
    [
      resolve(repo, "dist-cli/cli/index.js"),
      "build",
      "-c",
      resolve(repo, "triage.config.example.yml"),
    ],
    { cwd: repo, stdio: "inherit" },
  );
  assertSingleArtifact(readdirSync(resolve(repo, "dist")));
  let html;
  try {
    html = readFileSync(output, "utf8");
  } catch {
    throw new Error(`✗ build-smoke: expected ${output} — build produced nothing`);
  }
  assertSelfContainedHtml(html);
  console.log("✓ build-smoke: dist/triage.html is self-contained");
}

const isMain =
  process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    checkBuild();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
