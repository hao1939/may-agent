#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeWorkloadState } from "../../src/app/composition/initialize-workload-state.js";

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--new-state-dir" || args[2] !== "--plan" || !args[1] || !args[3])
  throw new Error(
    "Usage: bun scripts/operations/initialize-workload-state.ts --new-state-dir <absent-directory> --plan <installation.json>",
  );
const body = readFileSync(resolve(args[3]), "utf8");
if (Buffer.byteLength(body) > 1024 * 1024) throw new Error("Workload initialization plan exceeds 1 MiB");
console.log(JSON.stringify(initializeWorkloadState(resolve(args[1]), JSON.parse(body))));
