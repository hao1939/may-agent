#!/usr/bin/env bun
/**
 * migrate-project-workflow.mjs
 *
 * Forks shared/workflows/project.ts into projects/<id>/workflows/<id>-iteration.ts,
 * renames its exported `name` to `<id>-iteration`, rewrites relative imports to
 * point at /app/shared/* from the new deeper location, and updates the project's
 * project.md `workflow:` field.
 *
 * Usage:
 *   bun scripts/migrate-project-workflow.mjs <project-id> [--dry-run]
 *
 * Idempotent: if the target file already exists, exits cleanly with a notice.
 *
 * Background: Phase 5/6 of the shared/workflows dissolution. Each project owns
 * its own workflow fork so platform-wide iteration freedom isn't bottlenecked
 * on a single shared file.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const SHARED_SEED = join(REPO_ROOT, "scripts/seeds/project-iteration-seed.ts");

function fail(msg) {
  console.error(`migrate-project-workflow: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const projectId = args.find((a) => !a.startsWith("--"));

if (!projectId) {
  fail("usage: bun scripts/migrate-project-workflow.mjs <project-id> [--dry-run]");
}

const projectDir = join(REPO_ROOT, "projects", projectId);
const projectMd = join(projectDir, "project.md");
const workflowsDir = join(projectDir, "workflows");
const workflowName = `${projectId}-iteration`;
const workflowFile = join(workflowsDir, `${workflowName}.ts`);

if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
  fail(`project dir not found: ${projectDir}`);
}
if (!existsSync(projectMd)) {
  fail(`project.md not found: ${projectMd}`);
}
if (!existsSync(SHARED_SEED)) {
  fail(`seed file not found: ${SHARED_SEED} (already deleted?)`);
}

if (existsSync(workflowFile)) {
  console.log(`[skip] ${workflowFile} already exists — already migrated`);
  process.exit(0);
}

// 1. Read seed and rewrite for new location.
let src = readFileSync(SHARED_SEED, "utf8");

// Imports relative to shared/workflows/ -> rewrite for projects/<id>/workflows/
// Note: validate-on-create lives at shared/hooks/ and the seed already encodes
// the projects/<id>/workflows/-relative path; no rewrite needed for it.
const importRewrites = [
  ['from "../agent-sdk.ts"', 'from "../../../shared/agent-sdk.ts"'],
  ['from "../lib/project-health.js"', 'from "../../../shared/lib/project-health.js"'],
];

for (const [from, to] of importRewrites) {
  if (!src.includes(from)) {
    fail(`seed missing expected import '${from}' — schema drift, aborting`);
  }
  src = src.replace(from, to);
}

// Rename the workflow's `name` export.
const nameNeedle = 'export const name: string = "project";';
if (!src.includes(nameNeedle)) {
  fail(`seed missing expected name export '${nameNeedle}' — schema drift`);
}
src = src.replace(nameNeedle, `export const name: string = "${workflowName}";`);

// 2. Update project.md `workflow:` field.
let md = readFileSync(projectMd, "utf8");
const wfLineRegex = /^workflow:\s*\S+\s*$/m;
if (!wfLineRegex.test(md)) {
  fail(`project.md has no 'workflow:' line — aborting (file: ${projectMd})`);
}
const newMd = md.replace(wfLineRegex, `workflow: ${workflowName}`);

// 3. Apply.
if (dryRun) {
  console.log(`[dry-run] would create ${workflowFile} (${src.length} bytes)`);
  console.log(`[dry-run] would set workflow: ${workflowName} in ${projectMd}`);
  process.exit(0);
}

mkdirSync(workflowsDir, { recursive: true });
writeFileSync(workflowFile, src);
writeFileSync(projectMd, newMd);

console.log(`[ok] forked seed -> ${workflowFile}`);
console.log(`[ok] set workflow: ${workflowName} in ${projectMd}`);
