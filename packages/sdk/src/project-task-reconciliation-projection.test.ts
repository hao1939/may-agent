import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignRunnableBacklogTasks,
  assignTask,
  listRunnableBacklogTaskIds,
  taskTreeConfig,
} from "./index.js";

async function fixture() {
  const appDir = await mkdtemp(
    join(tmpdir(), "may-reconciliation-projection-"),
  );
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    `${JSON.stringify({
      root_task_id: "project",
      tasks: {
        project: {
          id: "project",
          state: "backlog",
          children: ["domain-work", "runtime-health"],
          goal: "Project root",
          outputs: ["tasks/tree.json"],
          acceptance: ["Project advances"],
        },
        "domain-work": {
          id: "domain-work",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "Perform domain work",
          outputs: ["proof.md"],
          acceptance: ["Proof exists"],
        },
        "runtime-health": {
          id: "runtime-health",
          parent_id: "project",
          state: "backlog",
          children: [],
          goal: "Maintain runtime health",
          outputs: ["health.json"],
          acceptance: ["Runtime is healthy"],
          context: {
            reconciliation: {
              mode: "maintain",
              specHash: "stable",
            },
          },
        },
      },
    })}\n`,
    "utf8",
  );
  return taskTreeConfig({
    appDir,
    projectDir: appDir,
    worker: "owner",
    maxConcurrent: 2,
  });
}

describe("reconciliation task projection", () => {
  test("keeps reconciler-owned tasks out of the legacy assignment frontier", async () => {
    const config = await fixture();

    expect(listRunnableBacklogTaskIds(config)).toEqual(["domain-work"]);
    expect(assignRunnableBacklogTasks(config).assignments).toHaveLength(1);
    expect(assignRunnableBacklogTasks(config).assignments).toHaveLength(0);
    expect(() => assignTask(config, { taskId: "runtime-health" })).toThrow(
      "not a worker-executable backlog leaf",
    );
  });
});
