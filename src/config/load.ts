import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";
import { ConfigError } from "../runtime/core/errors.js";
import { TriageConfig, type TriageConfigT } from "./schema.js";

const DEFAULT_PATH = "triage.config.yml";
const EXAMPLE_PATH = "triage.config.example.yml";

export function loadConfig(path: string): TriageConfigT {
  if (!existsSync(path)) {
    if (path === DEFAULT_PATH && existsSync(EXAMPLE_PATH)) {
      console.warn(
        `\n  [info] ${DEFAULT_PATH} not found — using ${EXAMPLE_PATH} as fallback.\n` +
        `         Copy it to ${DEFAULT_PATH} and edit with your real values to customize.\n`,
      );
      path = EXAMPLE_PATH;
    } else {
      throw new ConfigError(
        `config file not found: ${path}\n` +
        `  (copy ${EXAMPLE_PATH} to ${DEFAULT_PATH} or pass --config <path>)`,
      );
    }
  }
  const raw = parse(readFileSync(path, "utf8"));
  return TriageConfig.parse(raw);
}
