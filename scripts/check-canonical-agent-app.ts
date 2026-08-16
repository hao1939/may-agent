#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const root = process.cwd();
const projectsRoot = join(root, "projects");
const finalRuntimeGate = process.argv.includes("--final-runtime");
const errors: string[] = [];
const ignoredDirectories = new Set([
  ".git",
  ".state",
  "archive",
  "artifacts",
  "node_modules",
  "workspace",
  "worktrees",
]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (ignoredDirectories.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry)) files.push(path);
  }
  return files;
}

function checkApp(appDir: string): void {
  const id = basename(appDir);
  const manifest = join(appDir, "app.ts");
  if (!existsSync(manifest)) errors.push(`${id}: missing canonical app.ts`);
  if (existsSync(join(appDir, "inbox.ts")))
    errors.push(`${id}: parallel inbox.ts declaration remains`);

  for (const path of sourceFiles(appDir)) {
    const text = readFileSync(path, "utf8");
    const display = relative(root, path);
    if (text.includes("@may-agent/sdk/legacy"))
      errors.push(`${display}: imports the retired legacy SDK`);
    if (/\bdefineProjectApp\b/.test(text))
      errors.push(`${display}: uses retired defineProjectApp`);
  }
}

for (const entry of readdirSync(projectsRoot).sort()) {
  const appDir = join(projectsRoot, entry);
  if (entry.endsWith(".app") && statSync(appDir).isDirectory())
    checkApp(appDir);
}

if (finalRuntimeGate) {
  const configuredRuntimeRoot = process.env.MAY_AGENT_RUNTIME_ROOT;
  if (!configuredRuntimeRoot) {
    errors.push(
      "--final-runtime requires MAY_AGENT_RUNTIME_ROOT pointing to the paired Runtime checkout",
    );
  } else {
    const runtimeRoot = resolve(configuredRuntimeRoot);
    const sdkPackagePath = join(runtimeRoot, "packages", "sdk", "package.json");
    if (!existsSync(sdkPackagePath)) {
      errors.push(`paired Runtime SDK package not found: ${sdkPackagePath}`);
    } else {
      const sdkPackage = JSON.parse(readFileSync(sdkPackagePath, "utf8")) as {
        exports?: Record<string, unknown>;
      };
      if (sdkPackage.exports?.["./legacy"] !== undefined) {
        errors.push("paired Runtime still exports @may-agent/sdk/legacy");
      }
    }

    for (const retiredPath of [
      join(runtimeRoot, "packages", "sdk", "src", "legacy.ts"),
      join(
        runtimeRoot,
        "src",
        "app",
        "loader",
        "legacy-project-app-adapter.ts",
      ),
    ]) {
      if (existsSync(retiredPath))
        errors.push(
          `paired Runtime retains ${relative(runtimeRoot, retiredPath)}`,
        );
    }
  }
}

for (const error of errors) console.error(`ERROR ${error}`);
console.log(
  `Canonical Agent App integrity: ${errors.length} error(s); ${finalRuntimeGate ? "Apps + final Runtime" : "Apps"}`,
);
if (errors.length > 0) process.exitCode = 1;
