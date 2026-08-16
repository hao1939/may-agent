#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const runtimeRoot = resolve(import.meta.dir, "..");
const appsRoot = process.env.MAY_AGENT_VERIFY_APPS_ROOT?.trim()
  ? resolve(process.env.MAY_AGENT_VERIFY_APPS_ROOT)
  : undefined;
const errors: string[] = [];
const ignoredDirectories = new Set([".git", ".state", "archive", "artifacts", "bundle", "node_modules", "worktrees"]);
const sourcePattern = /\.(?:ts|tsx|js|mjs|cjs)$/;

const retiredSdkSpecifier = ["@may-agent/sdk", "legacy"].join("/");
const retiredFactory = ["define", "Project", "App"].join("");
const retiredAdapter = ["adapt", "Legacy", "Project", "App"].join("");
const retiredProvenance = ["legacy", "project", "app"].join("-");
const retiredActionInput = ["legacy", "action"].join("-");

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (ignoredDirectories.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (sourcePattern.test(entry)) files.push(path);
  }
  return files;
}

function rejectRetiredAuthoring(path: string, displayRoot: string): void {
  const text = readFileSync(path, "utf8");
  const display = relative(displayRoot, path);
  for (const [needle, label] of [
    [retiredSdkSpecifier, "retired SDK import or resolver"],
    [retiredFactory, "retired ProjectApp factory"],
    [retiredAdapter, "retired declaration adapter"],
    [retiredProvenance, "retired loader provenance"],
    [retiredActionInput, "retired action input"],
  ] as const) {
    if (text.includes(needle)) errors.push(`${display}: contains ${label}`);
  }
}

const sdkPackagePath = join(runtimeRoot, "packages", "sdk", "package.json");
const sdkPackage = JSON.parse(readFileSync(sdkPackagePath, "utf8")) as { exports?: Record<string, unknown> };
if (sdkPackage.exports?.["./legacy"] !== undefined)
  errors.push("packages/sdk/package.json exports the retired SDK entry point");

for (const retiredPath of [
  join(runtimeRoot, "packages", "sdk", "src", "legacy.ts"),
  join(runtimeRoot, "src", "app", "loader", "legacy-project-app-adapter.ts"),
]) {
  if (existsSync(retiredPath)) errors.push(`${relative(runtimeRoot, retiredPath)} still exists`);
}

for (const dir of [
  join(runtimeRoot, "packages", "sdk", "src"),
  join(runtimeRoot, "src", "app"),
  join(runtimeRoot, "src", "lib"),
]) {
  for (const path of sourceFiles(dir)) rejectRetiredAuthoring(path, runtimeRoot);
}

if (appsRoot) {
  if (!existsSync(appsRoot)) {
    errors.push(`configured Apps root does not exist: ${appsRoot}`);
  } else {
    for (const entry of readdirSync(appsRoot).sort()) {
      const appDir = join(appsRoot, entry);
      if (!entry.endsWith(".app") || !statSync(appDir).isDirectory()) continue;
      if (!existsSync(join(appDir, "app.ts")) && !existsSync(join(appDir, "app.js"))) {
        errors.push(`${basename(appDir)}: missing canonical App declaration`);
      }
      for (const path of sourceFiles(appDir)) rejectRetiredAuthoring(path, appsRoot);
    }
  }
}

for (const error of errors) console.error(`ERROR ${error}`);
console.log(`Canonical App boundary: ${errors.length} error(s); Runtime${appsRoot ? " + Apps" : ""}`);
if (errors.length > 0) process.exitCode = 1;
