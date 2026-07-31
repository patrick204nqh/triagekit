#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runBuild } from "./build.js";

const usage = "Usage: triagekit build [-c <path> | --config <path>] [--generic]";
const [command, ...args] = process.argv.slice(2);

try {
  if (command !== "build") throw new Error(usage);
  const { values } = parseArgs({
    args,
    options: {
      config: { type: "string", short: "c", default: "triage.config.yml" },
      generic: { type: "boolean", default: false },
    },
    strict: true,
  });
  await runBuild(values.config, { generic: values.generic });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
