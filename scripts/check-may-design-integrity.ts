#!/usr/bin/env bun
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const designDir = join(root, "projects", "may-agent.app", "docs", "2a-design");
const errors: string[] = [];
const warnings: string[] = [];

for (const name of readdirSync(designDir).filter((entry) => entry.endsWith(".md")).sort()) {
  const path = join(designDir, name);
  const text = readFileSync(path, "utf8");
  if (!/^\*\*Design status:\*\*/m.test(text)) errors.push(`${name}: missing standardized Design status`);
  if (!/^\*\*Implementation status:\*\*/m.test(text)) errors.push(`${name}: missing standardized Implementation status`);
  if (!/(tracker|historical)/i.test(text.slice(0, 500)) && /Last verified:[^\n]*\d{4}-\d{2}-\d{2}/i.test(text)) {
    warnings.push(`${name}: replace dated live census with a stable contract or generated evidence link`);
  }
}

const allowedRootEntries = new Set([
  ".agents", ".claude", ".codex", ".copilot", ".git", ".gitignore", ".initialized", ".state",
  "CONVENTIONS.md", "README.md", "agents", "bun.lock", "bunfig.toml", "contracts", "gym",
  "node_modules", "package.json", "packages", "projects", "scripts", "shared", "sources", "tsconfig.json", "ui",
]);
for (const entry of readdirSync(root).sort()) {
  if (!allowedRootEntries.has(entry)) warnings.push(`root layout: unclassified entry ${entry}`);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
console.log(`May design integrity: ${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length > 0) process.exitCode = 1;
