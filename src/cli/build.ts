import { build as viteBuild } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../config/load.js";
import { configPlugin } from "../vite/config-plugin.js";
import { buildCspMeta, PROVIDER_CONNECT_SRC } from "../vite/csp-plugin.js";

export async function runBuild(configPath: string) {
  const config = loadConfig(configPath);
  const outDir = resolve(process.cwd(), "dist");
  // Resolve the optional user logic-hooks module relative to the config file.
  const hookPath = config.logicHooks
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
  const connectSrc = PROVIDER_CONNECT_SRC[config.provider] ?? [];
  const withCsp = buildCspMeta(readFileSync(outFile, "utf8"), connectSrc);
  writeFileSync(outFile, withCsp);

  console.warn(
    `\n⚠  dist/triage.html contains your org ("${config.org}") and repo names.\n` +
    `   Safe to share within your team; do NOT commit it to a public repo.\n` +
    `   No token is embedded — each user pastes their own at runtime.\n`,
  );
}
