import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";
import { TriageConfig, type TriageConfigT } from "./schema";

export function loadConfig(path: string): TriageConfigT {
  if (!existsSync(path)) {
    throw new Error(`config file not found: ${path} (copy triage.config.example.yml to triage.config.yml)`);
  }
  const raw = parse(readFileSync(path, "utf8"));
  return TriageConfig.parse(raw);
}
