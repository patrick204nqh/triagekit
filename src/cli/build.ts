import { build as viteBuild } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { renameSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../config/load.js";
import { configPlugin } from "../vite/config-plugin.js";

export async function runBuild(configPath: string) {
  const config = loadConfig(configPath);
  const outDir = resolve(process.cwd(), "dist");
  await viteBuild({
    // The compiled CLI lives at dist-cli/cli/; the runtime source is at src/runtime.
    root: resolve(import.meta.dirname, "../../src/runtime"),
    plugins: [configPlugin(config), viteSingleFile()],
    build: { outDir, emptyOutDir: true },
  });
  // Vite names the single-file output after its html entry (index.html); the
  // shareable artifact is triage.html.
  renameSync(resolve(outDir, "index.html"), resolve(outDir, "triage.html"));
  console.warn(
    `\n⚠  dist/triage.html contains your org ("${config.org}") and repo names.\n` +
    `   Safe to share within your team; do NOT commit it to a public repo.\n` +
    `   No token is embedded — each user pastes their own at runtime.\n`,
  );
}
