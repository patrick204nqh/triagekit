import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { TriageConfigT } from "../config/schema";
import { configPlugin } from "../vite/config-plugin";
import { TriageConfig } from "../config/schema";

const root = resolve(import.meta.dirname);

let configPath = resolve(root, "../../triage.config.yml");
if (!existsSync(configPath)) {
  configPath = resolve(root, "../../triage.config.example.yml");
}

let config: TriageConfigT;
if (existsSync(configPath)) {
  const raw = parse(readFileSync(configPath, "utf8"));
  config = TriageConfig.parse(raw);
  console.log(`\u2713 dev: loaded config from ${configPath.replace(root + "/../..", ".")}`);
} else {
  config = TriageConfig.parse({ source: "github", views: ["code-security"], branding: { title: "triage\u00b7kit" } });
  console.log("\u2713 dev: no config found, using built-in defaults");
}

export default defineConfig({
  root,
  plugins: [configPlugin(config)],
  server: { port: 5173, open: true },
});
