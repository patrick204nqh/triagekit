#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { runBuild } from "./build.js";

const usage = "Usage: triagekit build [-c <path> | --config <path>] [--generic]";

export function parseCliArguments(args: string[]) {
  const [command, ...options] = args;
  if (command !== "build") throw new Error(usage);
  try {
    return parseArgs({
      args: options,
      options: {
        config: { type: "string", short: "c", default: "triage.config.yml" },
        generic: { type: "boolean", default: false },
      },
      strict: true,
    }).values;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\n${usage}`);
  }
}

if (
  process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    const values = parseCliArguments(process.argv.slice(2));
    await runBuild(values.config, { generic: values.generic });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
