#!/usr/bin/env node
import { Command } from "commander";
import { runBuild } from "./build.js";

const program = new Command();
program
  .name("triagekit")
  .command("build")
  .option("-c, --config <path>", "config file", "triage.config.yml")
  .action(async (opts) => { await runBuild(opts.config); });
program.parse();
