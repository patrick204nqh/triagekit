import { build as viteBuild } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../config/load.js";
import type { TriageConfigT } from "../config/schema.js";
import { configPlugin } from "../vite/config-plugin.js";
import { buildCspMeta, SOURCE_CONNECT_SRC, SOURCE_IMG_SRC } from "../vite/csp-plugin.js";

// Generic build: no scope baked in. The user supplies scope + token at runtime,
// so the artifact is safe to share/commit publicly.
const GENERIC_CONFIG: TriageConfigT = {
  source: "github",
  views: ["security-alerts"],
  branding: { title: "triage·kit" },
};

export interface BuildOptions { generic?: boolean; }

export async function runBuild(configPath: string, opts: BuildOptions = {}) {
  const config = opts.generic ? GENERIC_CONFIG : loadConfig(configPath);
  const outDir = resolve(process.cwd(), "dist");
  // Resolve the optional user logic-hooks module relative to the config file.
  const hookPath = !opts.generic && config.logicHooks
    ? resolve(dirname(resolve(configPath)), config.logicHooks)
    : undefined;
  await viteBuild({
    // The compiled CLI lives at dist-cli/cli/; the runtime source is at src/runtime.
    root: resolve(import.meta.dirname, "../../src/runtime"),
    plugins: [configPlugin(config, hookPath), viteSingleFile()],
    build: { outDir, emptyOutDir: true },
  });
  // Vite names the single-file output after its html entry (index.html); the
  // shareable artifact is triage.html.
  const outFile = resolve(outDir, "triage.html");
  renameSync(resolve(outDir, "index.html"), outFile);

  // Inject a strict, hash-based CSP computed over the final inlined HTML. connect-src
  // origins come from the configured provider (mirrors the adapter's connectSrc).
  const connectSrc = SOURCE_CONNECT_SRC[config.source] ?? [];
  const imgSrc = SOURCE_IMG_SRC[config.source] ?? [];
  const withCsp = buildCspMeta(readFileSync(outFile, "utf8"), connectSrc, imgSrc);
  writeFileSync(outFile, withCsp);

  if (opts.generic) {
    console.warn(
      `\n[ok] dist/triage.html is a generic dashboard — no scope baked in.\n` +
      `   Safe to share or commit publicly. Each user enters their scope and their\n` +
      `   own token at runtime; no credential is ever embedded.\n`,
    );
  } else {
    console.warn(
      `\n[warning] dist/triage.html bakes in your configured scope (e.g. repo names).\n` +
      `   Safe to share within your team; do NOT commit it to a public repo.\n` +
      `   No token is embedded — each user pastes their own at runtime.\n`,
    );
  }
}
