#!/usr/bin/env node
import { Command } from "commander";
import { runBuild } from "./build.js";

const program = new Command();
program
  .name("triagekit")
  .command("build")
  .option("-c, --config <path>", "config file", "triage.config.yml")
  .option("--generic", "build a generic dashboard (enter org/repos at runtime; nothing baked in)")
  .action(async (opts) => { await runBuild(opts.config, { generic: !!opts.generic }); });
program.parse();
