import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(appDir, "..", "aks-rp-e2e"),
);
const summary = summarizeTaskTree(
  taskTreeConfig({
    appDir,
    projectDir,
    worker: process.env.WORKER ?? "aks-explorer",
    maxConcurrent: Number(process.env.MAX_CONCURRENT ?? 1),
  }),
);

console.log(`tasks: ${summary.total}`);
console.log(`leaf tasks: ${summary.leaf_total}`);
console.log(`updated: ${summary.updated_at ?? "unknown"}`);
console.log(`active: ${summary.frontier.active.join(", ") || "none"}`);
console.log("leaf state:");
for (const [state, count] of Object.entries(summary.counts).sort((a, b) =>
  a[0].localeCompare(b[0]),
))
  console.log(`  ${state}: ${count}`);
console.log("tree state:");
for (const [state, count] of Object.entries(summary.tree_counts).sort((a, b) =>
  a[0].localeCompare(b[0]),
))
  console.log(`  ${state}: ${count}`);
console.log(`runnable: ${summary.frontier.runnable.join(", ") || "none"}`);
console.log(`review: ${summary.frontier.review.join(", ") || "none"}`);
console.log(`roots: ${summary.roots.length}`);
for (const root of summary.roots.slice(0, 12)) console.log(`  - ${root}`);
