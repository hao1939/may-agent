#!/usr/bin/env bun
import { resolve } from "node:path";
import {
  activateTaskResourceCutover,
  inspectTaskResourceCutover,
  pauseTaskResourceCutover,
} from "../src/app/app-task-resource-cutover.js";
import { projectRuntimePaths } from "../src/app/app-task-runtime-state.js";
import type { TaskStateConfig } from "../src/app/app-task-store.js";

type Command = "inspect" | "pause" | "activate";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredOption(name: string): string {
  const value = option(name)?.trim();
  if (!value) throw new Error(`Missing required ${name}`);
  return value;
}

function config(appDir: string): TaskStateConfig {
  const paths = projectRuntimePaths(appDir);
  return {
    appDir,
    projectDir: appDir,
    statePath: paths.taskStatePath,
    journalPath: paths.journalPath,
    worker: "task-resource-cutover",
    maxConcurrent: 1,
  };
}

function usage(): never {
  throw new Error(
    [
      "Usage:",
      "  bun scripts/cutover-task-resources.ts inspect --app-dir PATH --persist-dir PATH",
      "  bun scripts/cutover-task-resources.ts pause --app-dir PATH --persist-dir PATH --reason TEXT",
      "  bun scripts/cutover-task-resources.ts activate --app-dir PATH --persist-dir PATH --expected-revision SHA256 --confirm-daemon-stopped [--resume]",
      "",
      "Activation is deliberately offline. Pause first, wait for runningAttemptIds to become empty, stop the daemon, inspect again, then activate with the exact reviewed revision.",
    ].join("\n"),
  );
}

export function runTaskResourceCutoverCli(): void {
  const command = process.argv[2] as Command | undefined;
  if (command !== "inspect" && command !== "pause" && command !== "activate") usage();
  const appDir = resolve(requiredOption("--app-dir"));
  const persistDir = resolve(requiredOption("--persist-dir"));
  const taskConfig = config(appDir);
  const result =
    command === "inspect"
      ? inspectTaskResourceCutover(taskConfig, persistDir)
      : command === "pause"
        ? pauseTaskResourceCutover(taskConfig, persistDir, requiredOption("--reason"))
        : activateTaskResourceCutover({
            config: taskConfig,
            persistDir,
            expectedSourceRevision: requiredOption("--expected-revision"),
            daemonStopped: process.argv.includes("--confirm-daemon-stopped") ? true : usage(),
            resume: process.argv.includes("--resume"),
          });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.main) {
  try {
    runTaskResourceCutoverCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
