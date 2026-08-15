#!/usr/bin/env bun

import { readdirSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const appDir = resolve(import.meta.dir, "..");
const requestedOutDir = process.argv[2] ?? ".state/bundle";
const outDir = resolve(appDir, requestedOutDir);
const allowedOutDirs = new Set([
  resolve(appDir, ".state/bundle"),
  resolve(appDir, ".state/syntax-check"),
]);

if (!allowedOutDirs.has(outDir)) {
  throw new Error(
    `Bundle output must be .state/bundle or .state/syntax-check, received ${requestedOutDir}`,
  );
}

function workflowEntrypoints(agent: "app-ops" | "owner"): string[] {
  const directory = join(appDir, "agents", agent, "workflows");
  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => join(directory, entry.name))
    .sort();
}

const entrypoints = [
  join(appDir, "app.ts"),
  ...workflowEntrypoints("app-ops"),
  ...workflowEntrypoints("owner"),
  join(appDir, "watchers", "workspace-integrity.ts"),
];

rmSync(outDir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints,
  outdir: outDir,
  target: "bun",
  format: "esm",
  external: ["@may-agent/sdk"],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(
  `[bundle] Built ${entrypoints.length} canonical entrypoints into ${relative(appDir, outDir)}.`,
);
