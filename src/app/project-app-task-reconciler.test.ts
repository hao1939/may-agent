import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTaskTree } from "@may-agent/sdk";
import {
  claimProjectAppTask,
  completeProjectAppTask,
  markProjectAppTaskAttention,
  taskReconciliationConfig,
} from "./project-app-task-reconciler.ts";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `task-reconciler-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(
      {
        root_task_id: "root",
        tasks: {
          root: {
            id: "root",
            state: "backlog",
            owner: "branch-owner",
            children: ["operations"],
          },
          operations: {
            id: "operations",
            parent_id: "root",
            state: "backlog",
            children: [],
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  const config = taskReconciliationConfig({
    appDir,
    projectDir: appDir,
    owner: "app-owner",
    maxConcurrent: 3,
  });
  return { root, appDir, config };
}

function intent(mode: "achieve" | "maintain" = "achieve") {
  return {
    id: mode === "achieve" ? "evaluate:session-1" : "pipeline-monitor",
    parentId: "operations",
    outcome: mode === "achieve" ? "Evaluate session 1" : "Keep the pipeline observable",
    acceptance: ["The workflow returns evidence"],
    mode,
    workflow: "known-workflow",
    input: { sessionId: "session-1" },
  } as const;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("project app task reconciler state", () => {
  it("inherits ownership, claims one attempt, and deduplicates concurrent wakes", () => {
    const { config } = fixture();
    const first = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(first).toMatchObject({ kind: "claimed", owner: "branch-owner", generation: 1 });

    const duplicate = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(duplicate).toMatchObject({ kind: "busy", taskId: "evaluate:session-1" });

    const tree = readTaskTree(config);
    expect(tree.tasks["evaluate:session-1"]).toMatchObject({
      state: "active",
      owner: "branch-owner",
      workflow: "known-workflow",
      revision: 1,
    });
    expect(tree.active_task_ids).toContain("evaluate:session-1");
  });

  it("absorbs achieved work into a minimal tombstone and deduplicates redelivery", () => {
    const { config, appDir } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeProjectAppTask(config, claim, { summary: "session evaluated" })).toBe("applied");
    const tree = readTaskTree(config);
    expect(tree.tasks[claim.taskId]).toBeUndefined();
    expect(tree.tasks.operations.children).not.toContain(claim.taskId);
    expect(tree.completions?.[claim.taskId]).toMatchObject({
      generation: 1,
      handler: "workflow:known-workflow",
      summary: "session evaluated",
    });

    expect(
      claimProjectAppTask(config, {
        intent: { ...intent(), input: { sessionId: "session-1", redeliveredAt: "later" } },
        appOwner: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", taskId: claim.taskId, generation: 1 });
    expect(readFileSync(join(appDir, "tasks", "seed.json"), "utf8")).not.toContain("evaluate:session-1");
  });

  it("keeps converged maintain tasks live for the next event", () => {
    const { config } = fixture();
    const claim = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeProjectAppTask(config, claim, { summary: "pipeline healthy" })).toBe("applied");
    const task = readTaskTree(config).tasks[claim.taskId];
    expect(task).toMatchObject({ state: "backlog", reconcile_mode: "maintain", summary: "pipeline healthy" });
    expect((task.trace?.reconciliation as Record<string, unknown>)?.phase).toBe("converged");

    const next = claimProjectAppTask(config, {
      intent: intent("maintain"),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(next).toMatchObject({ kind: "claimed", generation: claim.generation });
  });

  it("rejects stale results after a fallback attempt takes ownership", () => {
    const { config } = fixture();
    const primary = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (primary.kind !== "claimed") throw new Error("expected primary claim");
    expect(
      markProjectAppTaskAttention(config, primary, {
        summary: "workflow could not classify the task",
        reason: "needs-owner",
      }),
    ).toBe("applied");

    const fallback = claimProjectAppTask(config, {
      intent: intent(),
      appOwner: "app-owner",
      handler: "owner:branch-owner",
      reason: "workflow-fallback",
    });
    if (fallback.kind !== "claimed") throw new Error("expected fallback claim");
    expect(completeProjectAppTask(config, primary, { summary: "late primary result" })).toBe("stale");
    expect(completeProjectAppTask(config, fallback, { summary: "owner handled exception" })).toBe("applied");
  });
});
