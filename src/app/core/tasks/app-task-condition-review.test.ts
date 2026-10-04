import { afterEach, describe, expect, it, setSystemTime, spyOn } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appTaskTestContext } from "./app-task-test-support.js";
import { readTaskSnapshot } from "./app-task-store.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import {
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  listRunnableAppTaskIds,
  recordAppTaskTrigger,
} from "./app-task-reconciler.ts";

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

afterEach(() => {
  setSystemTime();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("App task Condition recovery and explicit review", () => {
  it("keeps a legacy observed report quiet after reopen but admits a newer revision once", () => {
    const config = fixture();
    try {
      const id = "app-request:sample";
      deferAppTask(config, claim(config), {
        disposition: "waiting", summary: "Await the sample",
        conditions: [{ id, type: "app.dependency.updated", subject: "id:sample",
          expected: { field: "status", equals: "done" }, owner: "app:sample", reviewAfterMs: 60_000 }],
      });
      const feedback = (reportRevision?: number) => ({ type: "app.dependency.updated", data: {
        id: "sample", kind: "app", status: "blocked", summary: "Access is missing",
        ...(reportRevision === undefined ? {} : { reportRevision }),
      } });
      const wake = [{ conditionId: id, taskId: "human-request" }];
      expect(trackAppTaskConditionEventForTasks(config, feedback(), ["human-request"])).toEqual(wake);
      deferAppTask(config, claim(config), { disposition: "waiting", summary: "Still awaiting the sample" });
      expect(readTaskSnapshot(config).conditions?.[id]?.status.observed).toMatchObject({ state: "blocked" });
      config.resourceStore.close();
      config.resourceStore = AppTaskResourceStore.openStandalone(join(config.appDir, "../..", "host.sqlite"), "sample");
      expect(trackAppTaskConditionEventForTasks(config, feedback(1), ["human-request"])).toEqual([]);
      expect(trackAppTaskConditionEventForTasks(config, feedback(2), ["human-request"])).toEqual(wake);
      deferAppTask(config, claim(config), { disposition: "waiting", summary: "Reviewed the new report" });
      for (const revision of [1, 2])
        expect(trackAppTaskConditionEventForTasks(config, feedback(revision), ["human-request"])).toEqual([]);
      expect(readTaskSnapshot(config).conditions?.[id]?.status).toMatchObject({ state: "false", observed: { reportRevision: 2 } });
    } finally {
      config.resourceStore.close();
    }
  });

  it.each(["redeclared", "retained", "without-legacy-interval"])("preserves independent %s waits and observations across input and restart", (route) => {
    const config = fixture();
    const conditions = [
      {
        id: "pipeline",
        type: "pipeline-run.state",
        subject: "pipeline-run:42",
        expected: "completed",
        owner: "app:ci",
        reviewAfterMs: 60_000,
      },
      {
        id: "decision",
        type: "project.task.reconciled",
        subject: "task:decision",
        expected: "done",
        owner: "app:review",
        reviewAfterMs: 120_000,
      },
    ];
    const wait = { disposition: "waiting" as const, summary: "Still waiting for both facts", conditions };
    const unchangedWait = route === "redeclared"
      ? wait
      : route === "without-legacy-interval"
        ? { ...wait, conditions: conditions.map(({ reviewAfterMs: _legacyInterval, ...condition }) => condition) }
        : { disposition: "waiting" as const, summary: wait.summary };
    deferAppTask(config, claim(config), wait);
    const before = readTaskSnapshot(config).conditions;
    const update = { type: "sample.unexpected-update", eventId: 401, data: { revision: 2 } };
    expect(recordAppTaskTrigger(config, "human-request", update)).toEqual({ kind: "recorded" });
    // Redelivery while pending is one input, not another obligation.
    expect(recordAppTaskTrigger(config, "human-request", update)).toEqual({ kind: "recorded" });
    config.resourceStore.close();
    config.resourceStore = AppTaskResourceStore.openStandalone(join(config.appDir, "../..", "host.sqlite"), "sample");
    try {
      expect(listRunnableAppTaskIds(config)).toEqual(["human-request"]);
      const first = claim(config);
      expect(first.events.map(({ event }) => event.eventId)).toEqual([401]);
      expect(readTaskSnapshot(config).conditions).toEqual(before);

      const newer = { ...update, eventId: 402, data: { revision: 3 } };
      recordAppTaskTrigger(config, "human-request", newer);
      expect(
        claimObservedAppTask(config, { taskId: "human-request", appAgent: "app-owner", handler: "agent" }).kind,
      ).toBe("busy");
      deferAppTask(config, first, unchangedWait);
      expect(readTaskSnapshot(config).conditions).toEqual(before);
      const second = claim(config);
      expect(second.events.map(({ event }) => event.eventId)).toEqual([402]);
      deferAppTask(config, second, unchangedWait);
      expect(listRunnableAppTaskIds(config)).toEqual([]);

      // Observation-only broadcasts are not exact Task input and match neither wait.
      expect(
        trackAppTaskConditionEventForTasks(config, { type: "sample.unrelated-broadcast" }, ["human-request"]),
      ).toEqual([]);
      expect(listRunnableAppTaskIds(config)).toEqual([]);
      const pipeline = { type: "pipeline-run.state", eventId: 403, pipelineRunId: "42", state: "completed" };
      expect(trackAppTaskConditionEventForTasks(config, pipeline, ["human-request"])).toMatchObject([
        { conditionId: "pipeline" },
      ]);
      const third = claim(config);
      expect(third.events.map(({ event }) => event.eventId)).toEqual([403]);
      expect(readTaskSnapshot(config).resources["human-request"].status.conditionIds).toEqual(["pipeline", "decision"]);
      deferAppTask(config, third, route === "redeclared" ? { ...wait, conditions: [conditions[1]] } : unchangedWait);
      expect(readTaskSnapshot(config).resources["human-request"].status.conditionIds).toEqual(["decision"]);
      expect(readTaskSnapshot(config).conditions?.decision).toEqual(before?.decision);
      const decision = { type: "project.task.reconciled", eventId: 404, taskId: "decision", state: "converged" };
      expect(trackAppTaskConditionEventForTasks(config, decision, ["human-request"])).toMatchObject([
        { conditionId: "decision" },
      ]);
      expect(trackAppTaskConditionEventForTasks(config, decision, ["human-request"])).toEqual([]);
      const fourth = claim(config);
      expect(fourth.events.map(({ event }) => event.eventId)).toEqual([404]);
      expect(readTaskSnapshot(config).resources["human-request"].status.conditionIds).toEqual(["decision"]);
      completeAppTask(config, fourth, { summary: "Both facts verified", facts: ["pipeline:42", "decision:done"] });
      expect(readTaskSnapshot(config).resources["human-request"].status.conditionIds).toEqual([]);
    } finally {
      config.resourceStore.close();
    }
  });

  it("does not acknowledge a newer wake admitted after the waiting snapshot was read", () => {
    const config = fixture();
    const store = config.resourceStore;
    deferAppTask(config, claim(config), {
      disposition: "waiting",
      summary: "Wait for external review",
      facts: [],
      conditions: [
        {
          id: "external-review",
          type: "review.completed",
          subject: "task:review",
          expected: "done",
          owner: "human",
          reviewAfterMs: 60_000,
        },
      ],
    });
    const readContext = store.readTaskContext.bind(store);
    const read = spyOn(store, "readTaskContext").mockImplementationOnce((...args) => {
      const snapshot = readContext(...args);
      // Deterministically interleave a second writer between read and acknowledgment.
      recordAppTaskTrigger(config, "human-request", {
        type: "review.updated",
        data: { revision: 2 },
      });
      return snapshot;
    });
    try {
      expect(
        claimObservedAppTask(config, {
          taskId: "human-request",
          appAgent: "app-owner",
          handler: "agent",
        }).kind,
      ).toBe("waiting");
      expect(store.listRecoveryCandidates().items).toContainEqual(
        expect.objectContaining({ taskId: "human-request", ready: true }),
      );
      expect(claim(config).trigger).toMatchObject({ type: "review.updated" });
    } finally {
      read.mockRestore();
      store.close();
    }
  });

  it("rearms mechanical recovery when duplicate claims find the Task waiting", () => {
    const config = fixture();
    const store = config.resourceStore;
    try {
      deferAppTask(config, claim(config), {
        disposition: "waiting",
        summary: "Wait for an exact capability or its fallback review",
        facts: [],
        conditions: [
          {
            id: "capability-ready",
            type: "credential.state",
            subject: "credential:pilot",
            expected: { field: "state", equals: "ready" },
            owner: "human",
            reviewAfterMs: 60_000,
          },
        ],
      });
      const due = store.nextDueAt();
      expect(due).toBeGreaterThan(Date.now());
      for (let index = 0; index < 3; index += 1) {
        expect(
          claimObservedAppTask(config, {
            taskId: "human-request",
            appAgent: "app-owner",
            handler: "agent",
          }),
        ).toMatchObject({ kind: "waiting", conditionIds: ["capability-ready"] });
        expect(store.nextDueAt()).toBeGreaterThanOrEqual(due!);
      }
      expect(Object.keys(readTaskSnapshot(config).attempts ?? {})).toHaveLength(1);
      expect(store.listRecoveryCandidates(store.nextDueAt()! + 1).items.map(({ taskId }) => taskId)).toContain("human-request");
    } finally {
      store.close();
    }
  });

  it.each([false, true])(
    "keeps new and legacy waits quiet across recovery checks and restart (legacy: %j)",
    (legacy) => {
      const config = fixture();
      const startedAt = Date.now();
      const condition = {
        id: "approval",
        type: "approval.submitted",
        subject: "approval:draft",
        expected: { field: "decision", equals: "approved" },
        owner: "human:reviewer",
        ...(legacy ? { reviewAfterMs: 60_000 } : {}),
      };
      try {
        deferAppTask(config, claim(config), {
          disposition: "waiting",
          summary: "Await approval",
          conditions: [condition],
        });
        const before = readTaskSnapshot(config);
        // Old persisted indexes may still say the Condition review is due.
        config.resourceStore.setRecoveryState("human-request", { nextCheckAt: startedAt - 1 });
        for (let cycle = 1; cycle <= 5; cycle++) {
          setSystemTime(startedAt + cycle * 600_000);
          expect(config.resourceStore.listRecoveryCandidates().items.map((row) => row.taskId)).toContain(
            "human-request",
          );
          expect(listRunnableAppTaskIds(config)).toEqual([]);
          expect(
            claimObservedAppTask(config, { taskId: "human-request", appAgent: "app-owner", handler: "agent" }).kind,
          ).toBe("waiting");
          expect(config.resourceStore.nextDueAt()).toBeGreaterThan(Date.now());
          const after = readTaskSnapshot(config);
          expect(after.attempts).toEqual(before.attempts);
          expect(after.conditions).toEqual(before.conditions);
          expect(after.resources).toEqual(before.resources);
          if (cycle === 2) {
            config.resourceStore.close();
            config.resourceStore = AppTaskResourceStore.openStandalone(
              join(config.appDir, "../..", "host.sqlite"),
              "sample",
            );
          }
        }
        expect(
          trackAppTaskConditionEventForTasks(
            config,
            {
              type: "approval.submitted",
              eventId: 501,
              data: { approval: "draft", decision: "approved" },
            },
            ["human-request"],
          ),
        ).toHaveLength(1);
        expect(claim(config).events.map(({ event }) => event.eventId)).toEqual([501]);
      } finally {
        config.resourceStore.close();
      }
    },
  );

  it("runs one explicitly chosen review without renewing it or changing independent waits", () => {
    const config = fixture();
    const startedAt = Date.now();
    const reviewAt = startedAt + 600_000;
    try {
      deferAppTask(config, claim(config), {
        disposition: "waiting",
        summary: "Reconsider the stalled review once",
        reviewAt,
        conditions: [
          {
            id: "approval",
            type: "approval.submitted",
            subject: "approval:draft",
            expected: true,
            owner: "human:reviewer",
            reviewAfterMs: 60_000,
          },
        ],
      });
      const conditions = readTaskSnapshot(config).conditions;
      setSystemTime(startedAt + 300_001);
      expect(
        claimObservedAppTask(config, { taskId: "human-request", appAgent: "app-owner", handler: "agent" }).kind,
      ).toBe("waiting");
      expect(config.resourceStore.nextDueAt()).toBe(reviewAt);
      setSystemTime(reviewAt + 1);
      expect(listRunnableAppTaskIds(config)).toEqual(["human-request"]);
      const review = claim(config);
      expect(review.trigger?.type).toBe("project.task.review-at.reached");
      deferAppTask(config, review, { disposition: "waiting", summary: "Wait for the actual decision" });
      setSystemTime(reviewAt + 3_600_000);
      expect(listRunnableAppTaskIds(config)).toEqual([]);
      expect(
        claimObservedAppTask(config, { taskId: "human-request", appAgent: "app-owner", handler: "agent" }).kind,
      ).toBe("waiting");
      expect(readTaskSnapshot(config).conditions).toEqual(conditions);
      expect(Object.keys(readTaskSnapshot(config).attempts ?? {})).toHaveLength(2);
    } finally {
      config.resourceStore.close();
    }
  });

  it("replaces an obsolete recovery date with the declared review checkpoint", () => {
    const config = fixture();
    const store = config.resourceStore;

    deferAppTask(config, claim(config), {
      disposition: "waiting",
      summary: "Waiting for an approval event",
      facts: ["approval:unchanged"],
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
