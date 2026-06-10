import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type TaskNode = {
  id?: string;
  status?: string;
  priority?: string;
  children?: string[];
};

type TaskTree = {
  active_task_id?: string | null;
  active_task_ids?: string[];
  tasks?: Record<string, TaskNode>;
  updated_at?: string;
};

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tree = JSON.parse(
  readFileSync(join(appDir, "tasks", "tree.json"), "utf-8"),
) as TaskTree;
const tasks = tree.tasks ?? {};
const counts = new Map<string, number>();

for (const task of Object.values(tasks)) {
  const status = task.status ?? "unknown";
  counts.set(status, (counts.get(status) ?? 0) + 1);
}

const childIds = new Set(
  Object.values(tasks).flatMap((task) => task.children ?? []),
);
const roots = Object.keys(tasks)
  .filter((taskId) => !childIds.has(taskId))
  .sort();

console.log(`tasks: ${Object.keys(tasks).length}`);
console.log(`updated: ${tree.updated_at ?? "unknown"}`);
console.log(
  `active: ${(tree.active_task_ids ?? (tree.active_task_id ? [tree.active_task_id] : [])).join(", ") || "none"}`,
);
console.log("status:");
for (const [status, count] of [...counts.entries()].sort((a, b) =>
  a[0].localeCompare(b[0]),
)) {
  console.log(`  ${status}: ${count}`);
}
console.log(`roots: ${roots.length}`);
for (const root of roots.slice(0, 12)) {
  const task = tasks[root];
  console.log(`  - ${root}${task?.status ? ` (${task.status})` : ""}`);
}
