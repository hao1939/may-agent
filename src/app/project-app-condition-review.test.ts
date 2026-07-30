import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTaskState, saveTaskState } from "@may-agent/sdk";
import {
  claimObservedProjectAppTask,
  deferProjectAppTask,
  listRunnableProjectAppTaskIds,
  taskReconciliationConfig,
} from "./project-app-task-reconciler.ts";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `project-app-condition-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(
      {
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null, owner: "app-owner" } },
        resources: {
          "human-request": {
            metadata: { id: "human-request", generation: 1, resourceVersion: 1 },
            spec: {
              parentId: "root",
              outcome: "Finish the requested review",
              acceptance: ["The reviewed result is proven"],
              mode: "achieve",
            },
            status: {
              observedGeneration: 0,
              phase: "pending",
              updatedAt: new Date().toISOString(),
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  return taskReconciliationConfig({
    appDir,
    projectDir: appDir,
    owner: "app-owner",
    maxConcurrent: 1,
  });
}

function claim(config: ReturnType<typeof fixture>) {
  const result = claimObservedProjectAppTask(config, {
    taskId: "human-request",
    appOwner: "app-owner",
    handler: "owner",
    reason: "test",
  });
  if (result.kind !== "claimed") throw new Error(`expected claimed, got ${result.kind}`);
  return result;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("project app Condition review checkpoint", () => {
  it("wakes the same task owner after a declared checkpoint is missed", () => {
    const config = fixture();
    const condition = {
      id: "external-review-finished",
      type: "review.completed",
      subject: "task:external-review",
      expected: "done",
      reviewAfterMs: 60_000,
    };

    deferProjectAppTask(config, claim(config), {
      disposition: "waiting",
      summary: "Waiting for external review proof",
      evidence: ["review:queued"],
      conditions: [condition],
    });

    expect(listRunnableProjectAppTaskIds(config)).toEqual([]);
    expect(
      claimObservedProjectAppTask(config, {
        taskId: "human-request",
        appOwner: "app-owner",
        handler: "owner",
      }).kind,
    ).toBe("waiting");

    const stale = readTaskState(config);
    stale.conditions![condition.id]!.status.observedAt = new Date(Date.now() - 120_000).toISOString();
    saveTaskState(config, stale);

    expect(listRunnableProjectAppTaskIds(config)).toEqual(["human-request"]);
    const review = claim(config);
    expect(readTaskState(config).attempts?.[review.attemptId]?.reason).toBe("condition-review-checkpoint-missed");
    expect(review.trigger).toMatchObject({
      type: "project.task.condition-review.missed",
      data: {
        taskId: "human-request",
        conditionIds: [condition.id],
      },
    });

    deferProjectAppTask(config, review, {
      disposition: "waiting",
      summary: "Checkpoint reviewed; the same external result is still pending",
      evidence: ["review:still-running"],
      conditions: [condition],
    });
    expect(listRunnableProjectAppTaskIds(config)).toEqual([]);
  });
});
