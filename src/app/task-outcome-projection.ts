import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskOutcomePage, TaskOutcomeProjection, TaskOutcomeView, TaskView } from "@may-agent/sdk/app";

const ACTIVE_STATUSES = new Set<TaskView["status"]>(["pending", "running", "waiting", "attention"]);

export type TaskOutcomeManifest = {
  version: 1;
  groups: Array<{ id: string; outcome: string; taskIds: string[] }>;
};

function validateManifest(value: unknown): TaskOutcomeManifest {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) {
    throw new Error("Task outcome projection manifest must have version 1");
  }
  const groups = (value as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) throw new Error("Task outcome projection manifest requires groups");
  const seenGroups = new Set<string>();
  const seenTasks = new Set<string>();
  const normalized = groups.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Task outcome projection group must be an object");
    const { id, outcome, taskIds } = raw as { id?: unknown; outcome?: unknown; taskIds?: unknown };
    if (typeof id !== "string" || !id.trim()) throw new Error("Task outcome projection group requires id");
    if (typeof outcome !== "string" || !outcome.trim())
      throw new Error(`Task outcome projection group ${id} requires outcome`);
    if (!Array.isArray(taskIds) || taskIds.length === 0 || !taskIds.every((item) => typeof item === "string" && item))
      throw new Error(`Task outcome projection group ${id} requires non-empty taskIds`);
    if (seenGroups.has(id)) throw new Error(`Duplicate Task outcome projection group ${id}`);
    seenGroups.add(id);
    for (const taskId of taskIds) {
      if (seenTasks.has(taskId)) throw new Error(`Task ${taskId} appears in more than one outcome group`);
      seenTasks.add(taskId);
    }
    return { id, outcome, taskIds: [...taskIds].sort() };
  });
  return { version: 1, groups: normalized.sort((a, b) => a.id.localeCompare(b.id)) };
}

export function readTaskOutcomeManifest(appDir: string): TaskOutcomeManifest | null {
  const path = join(appDir, "tasks", "outcome-projection.json");
  if (!existsSync(path)) return null;
  return validateManifest(JSON.parse(readFileSync(path, "utf8")));
}

function aggregateStatus(members: TaskView[]): TaskView["status"] {
  for (const status of ["attention", "running", "waiting", "pending", "done"] as const) {
    if (members.some((member) => member.status === status)) return status;
  }
  return "done";
}

/** Pure, additive shadow projection. Every source Task is retained verbatim in exactly one outcome. */
export function projectTaskOutcomes(
  tasks: TaskView[],
  manifest: TaskOutcomeManifest | null,
  projection: TaskOutcomeProjection = {},
): TaskOutcomePage {
  const includeDone = projection.includeDone === true;
  const source = tasks.filter((task) => includeDone || ACTIVE_STATUSES.has(task.status)).sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(source.map((task) => [task.id, task]));
  const assigned = new Set<string>();
  const outcomes: TaskOutcomeView[] = [];
  for (const group of manifest?.groups ?? []) {
    const members = group.taskIds.flatMap((taskId) => {
      const task = byId.get(taskId);
      if (!task) return [];
      assigned.add(taskId);
      return [structuredClone(task)];
    });
    if (members.length === 0) continue;
    outcomes.push({
      id: group.id,
      outcome: group.outcome,
      status: aggregateStatus(members),
      memberCount: members.length,
      memberTaskIds: members.map((member) => member.id),
      members,
    });
  }
  for (const task of source) {
    if (assigned.has(task.id)) continue;
    outcomes.push({
      id: `legacy:${task.id}`,
      outcome: task.outcome,
      status: task.status,
      memberCount: 1,
      memberTaskIds: [task.id],
      members: [structuredClone(task)],
      ungrouped: true,
    });
  }
  outcomes.sort((a, b) => a.id.localeCompare(b.id));
  return {
    projection: "outcomes",
    manifestVersion: manifest?.version ?? null,
    sourceCount: source.length,
    outcomeCount: outcomes.length,
    outcomes,
  };
}
