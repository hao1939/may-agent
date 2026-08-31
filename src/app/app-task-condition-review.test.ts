import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appTaskTestContext } from "./app-task-test-support.js";
import { readTaskSnapshot } from "./app-task-store.js";
import { claimObservedAppTask, deferAppTask, listRunnableAppTaskIds } from "./app-task-reconciler.ts";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `app-task-condition-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
  return appTaskTestContext({
    appDir,
    agent: "app-owner",
    maxConcurrent: 1,
    databasePath: join(root, "host.sqlite"),
  });
}

function claim(config: ReturnType<typeof fixture>) {
  const result = claimObservedAppTask(config, {
    taskId: "human-request",
    appAgent: "app-owner",
    handler: "agent",
    reason: "test",
  });
  if (result.kind !== "claimed") throw new Error(`expected claimed, got ${result.kind}`);
  return result;
}

function makeConditionReviewDue(config: ReturnType<typeof fixture>, conditionId: string): void {
  const tree = config.resourceStore.readTaskContext({ taskIds: ["human-request"] });
  const resource = tree.resources?.["human-request"];
  const condition = tree.conditions?.[conditionId];
  if (!resource || !condition) throw new Error("expected resource-backed Condition fixture");
  condition.status.observedAt = new Date(Date.now() - 120_000).toISOString();
  condition.metadata.resourceVersion += 1;
  expect(
    config.resourceStore.commit({
      fences: [
        {
          taskId: resource.metadata.id,
          resourceVersion: resource.metadata.resourceVersion,
          generation: resource.metadata.generation,
        },
      ],
      conditions: [condition],
    }),
  ).toBe(true);
  expect(config.resourceStore.setRecoveryState(resource.metadata.id, { nextCheckAt: Date.now() - 1 })).toBe(true);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("App task Condition review checkpoint", () => {
  it("wakes the same task owner after a declared checkpoint is missed", () => {
    const config = fixture();
    const condition = {
      id: "external-review-finished",
      type: "review.completed",
      subject: "task:external-review",
      expected: "done",
      owner: "app:external-review",
      reviewAfterMs: 60_000,
    };

    deferAppTask(config, claim(config), {
      disposition: "waiting",
      summary: "Waiting for external review proof",
      evidence: ["review:queued"],
      conditions: [condition],
    });

    expect(listRunnableAppTaskIds(config)).toEqual([]);
    expect(
      claimObservedAppTask(config, {
        taskId: "human-request",
        appAgent: "app-owner",
        handler: "agent",
      }).kind,
    ).toBe("waiting");

    makeConditionReviewDue(config, condition.id);

    expect(listRunnableAppTaskIds(config)).toEqual(["human-request"]);
    const review = claim(config);
    expect(readTaskSnapshot(config).attempts?.[review.attemptId]?.reason).toBe("condition-review-checkpoint-missed");
    expect(review.trigger).toMatchObject({
      type: "project.task.condition-review.missed",
      data: {
        taskId: "human-request",
        conditionIds: [condition.id],
      },
    });

    deferAppTask(config, review, {
      disposition: "waiting",
      summary: "Checkpoint reviewed; the same external result is still pending",
      evidence: ["review:still-running"],
      conditions: [condition],
    });
    expect(listRunnableAppTaskIds(config)).toEqual([]);
  });

  it("keeps an unchanged checkpoint recoverable after repeated owner reviews", () => {
    const config = fixture();
    const condition = {
      id: "external-review-finished",
      type: "review.completed",
      subject: "task:external-review",
      expected: "done",
      owner: "app:external-review",
      reviewAfterMs: 60_000,
    };

    deferAppTask(config, claim(config), {
      disposition: "waiting",
      summary: "Waiting for external review proof",
      evidence: ["review:queued"],
      conditions: [condition],
    });

    for (let reviewAttempt = 1; reviewAttempt <= 3; reviewAttempt += 1) {
      makeConditionReviewDue(config, condition.id);

      const review = claim(config);
      expect(review.trigger).toMatchObject({
        type: "project.task.condition-review.missed",
        data: {
          conditionIds: [condition.id],
          reviewAttempt,
          finalReview: reviewAttempt === 3,
        },
      });
      deferAppTask(config, review, {
        disposition: "waiting",
        summary: "The same external result is still pending",
        evidence: [`review:unchanged:${reviewAttempt}`],
        conditions: [condition],
      });
    }

    const state = readTaskSnapshot(config);
    expect(state.conditions?.[condition.id]?.spec.reviewAfterMs).toBe(60_000);
    expect(listRunnableAppTaskIds(config)).toEqual([]);
    expect(config.resourceStore.nextDueAt()).not.toBeNull();
  });

  it("replaces an obsolete recovery date with the declared review checkpoint", () => {
    const config = fixture();
    const store = config.resourceStore;

    deferAppTask(config, claim(config), {
      disposition: "waiting",
      summary: "Waiting for an approval event",
      evidence: ["approval:unchanged"],
      conditions: [
        {
          id: "approval-submitted",
          type: "approval.submitted",
          subject: "approval:may-ground-truth",
          expected: { field: "status", equals: "submitted" },
          owner: "human:operator",
          reviewAfterMs: 60_000,
        },
      ],
    });
    store.setRecoveryState("human-request", {
      ready: false,
      changed: false,
      nextCheckAt: Date.now() - 1,
    });
    expect(store.listRecoveryCandidates().items.map(({ taskId }) => taskId)).toContain("human-request");

    expect(
      claimObservedAppTask(config, {
        taskId: "human-request",
        appAgent: "app-owner",
        handler: "agent",
      }),
    ).toMatchObject({ kind: "waiting", conditionIds: ["approval-submitted"] });
    expect(store.listRecoveryCandidates().items.map(({ taskId }) => taskId)).not.toContain("human-request");
    expect(store.nextDueAt()).toBeGreaterThan(Date.now());
    store.close();
  });
});
