import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskIntent as AppTaskIntent } from "@may-agent/sdk";
import { cacheTaskSnapshots, readTaskSnapshot, type AppTaskContext } from "./app-task-store.js";
import { AppTaskResourceStore, type AppTaskResourceMutation } from "../state/app-task-resource-store.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import { listRuntimeTaskViews, readRuntimeTaskView } from "../reads/app-read.js";
import { matchingAppTaskConditionTaskIds, trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.ts";
import { AppTaskQueue } from "./queue.js";
import {
  associateAppTaskSession,
  assertAppTaskEffectFresh,
  cancelAppTask,
  stopAppTask,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask as deferCanonicalAppTask,
  failAppTaskAttempt,
  markAppTaskAttention,
  observeAppTaskIntent,
  listRunnableAppTaskQueueEntries,
  listRunnableAppTaskIds,
  isAppTaskConverged,
  readAppTaskIntent,
  readAppTaskChildContext,
  readAppTaskLiveSnapshot,
  readPendingAppTaskTrigger,
  readAppTaskTrigger,
  recordAppTaskTrigger,
  appTaskQueueEntries,
  AppTaskActionStaleError,
  repairPreviousRuntimeRecoveryAttention,
  repairUnadmittedAppDependencyWaits,
  repairRunningAppTasksWithoutAttempt,
  recoverableAppTaskAttempts,
  expiredAgentSessionAppTaskAttempt,
  terminalAgentSessionAppTaskClaim,
  releaseInterruptedAppTaskAttempt,
  releaseLateTerminalWorkflowAppTaskAttempt,
  releaseTerminalSessionExpiredAppTaskAttempt,
  releaseStaleAppTaskResult,
  retryFailedAppTask,
  recordAppTaskAttemptSession,
  recordAppTaskAttemptWorkspace,
  renewAppTaskAttemptLease,
} from "./app-task-reconciler.ts";

const roots: string[] = [];
const stores: AppTaskResourceStore[] = [];

describe("durable execution retry allowance", () => {
  function setup(mode: "achieve" | "maintain" = "achieve") {
    const { config } = fixture();
    const intent: AppTaskIntent = {
      id: "work/retry",
      parentId: "operations",
      outcome: "Deliver the verified result",
      acceptance: ["Verified result"],
      mode,
    };
    observeAppTaskIntent(config, { appAgent: "app-owner", intent });
    const claim = () => {
      const result = claimObservedAppTask(config, { taskId: intent.id, appAgent: "app-owner", handler: "agent" });
      if (result.kind !== "claimed") throw new Error(`expected claimed, got ${result.kind}`);
      return result;
    };
    return { config, intent, claim };
  }

  it("counts each execution failure once and does not charge stale-result fencing", () => {
    const { config, intent, claim } = setup();
    const first = claim();
    expect(failAppTaskAttempt(config, first, "Execution failed").status).toBe("retrying");
    expect(failAppTaskAttempt(config, first, "Duplicate callback").status).toBe("superseded");
    expect(config.resourceStore.readTask(intent.id)!.status.executionFailures).toBe(1);
    // Enough stale releases to exceed the retained context history. They do
    // not consume or reset the allowance and cannot hide the earlier failure.
    for (let index = 0; index < 18; index += 1) {
      expect(releaseStaleAppTaskResult(config, claim()).status).toBe("released");
    }
    expect(config.resourceStore.readTask(intent.id)!.status.executionFailures).toBe(1);
    for (let index = 0; index < 3; index += 1) failAppTaskAttempt(config, claim(), "Still fails");
    expect(config.resourceStore.readTask(intent.id)!.status).toMatchObject({
      phase: "attention",
      executionFailures: 4,
    });
  });

  it("preserves newer input and refuses late failures after a spec change or cancellation", () => {
    const { config, intent, claim } = setup();
    const first = claim();
    recordAppTaskTrigger(config, intent.id, { type: "sample.feedback", eventId: 10, data: {} });
    expect(failAppTaskAttempt(config, first, "Failed with new input pending").status).toBe("retrying");
    const next = claim();
    expect(next.events.map((entry) => entry.event.eventId)).toContain(10);
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, input: { revision: 2 } } });
    expect(failAppTaskAttempt(config, next, "Late failure").status).toBe("superseded");
    expect(config.resourceStore.readTask(intent.id)!.status.executionFailures ?? 0).toBe(0);
    const revised = claim();
    const resource = config.resourceStore.readTask(intent.id)!;
    cancelAppTask(config, {
      appId: "sample",
      taskId: intent.id,
      expectedGeneration: resource.metadata.generation,
      expectedResourceVersion: resource.metadata.resourceVersion,
      reason: "Stop this work",
    });
    expect(failAppTaskAttempt(config, revised, "Failure after cancel").status).toBe("superseded");
  });

  it("keeps execution-failure attention durable even when new input arrives during failure", () => {
    const { config, intent, claim } = setup();
    for (let index = 0; index < 4; index += 1) {
      const current = claim();
      recordAppTaskTrigger(config, intent.id, { type: "sample.feedback", eventId: index + 1, data: {} });
      markAppTaskAttention(config, current, { reason: "HandlerExecutionFailed", summary: "Failed execution" });
    }
    expect(config.resourceStore.readTask(intent.id)!.status).toMatchObject({
      phase: "attention",
      executionFailures: 4,
    });
    expect(config.resourceStore.readTask(intent.id)!.status.summary).toContain("Explicitly retry");
    // The synthetic initial trigger and all later facts remain available.
    expect(config.resourceStore.readTrigger(intent.id)?.events?.map((entry) => entry.event.eventId)).toEqual([
      undefined,
      1,
      2,
      3,
      4,
    ]);
    expect(config.resourceStore.listRecoveryCandidates().items.map((item) => item.taskId)).not.toContain(intent.id);
  });

  it("does not cap a long-running Task making accepted progress", () => {
    const { config, intent, claim } = setup("maintain");
    for (let cycle = 0; cycle < 20; cycle += 1) {
      recordAppTaskTrigger(config, intent.id, { type: "sample.cycle", eventId: cycle + 1, data: {} });
      failAppTaskAttempt(config, claim(), "Transient failure");
      completeAppTask(config, claim(), { summary: `Verified checkpoint ${cycle}`, evidence: ["test:verified"] });
      expect(config.resourceStore.readTask(intent.id)!.status.executionFailures ?? 0).toBe(0);
    }
    expect(config.resourceStore.readTask(intent.id)!.metadata.generation).toBe(1);
  });

  it("resets the allowance for an accepted wait and an explicitly revised execution spec", () => {
    const { config, intent, claim } = setup();
    failAppTaskAttempt(config, claim(), "Transient failure");
    const waiting = claim();
    deferAppTask(config, waiting, {
      disposition: "waiting",
      summary: "Useful work done; wait for exact evidence",
      conditions: [{ id: "ready", type: "sample.ready", subject: "resource:sample", expected: true }],
    });
    expect(config.resourceStore.readTask(intent.id)!.status.executionFailures ?? 0).toBe(0);
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, input: { revision: 2 } } });
    for (let index = 0; index < 4; index += 1) failAppTaskAttempt(config, claim(), "Repeated failure");
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, input: { revision: 3 } } });
    expect(claim().generation).toBe(3);
  });

  it("wakes its existing parent on exhaustion and allows an explicit unblock", () => {
    const { config, intent, claim } = setup();
    observeAppTaskIntent(config, {
      appAgent: "app-owner",
      intent: { ...intent, id: "parent", mode: "maintain" },
    });
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, parentId: "parent" } });
    for (let index = 0; index < 3; index += 1) failAppTaskAttempt(config, claim(), "Repeated failure");
    expect(failAppTaskAttempt(config, claim(), "Fourth failure")).toMatchObject({
      status: "attention",
      parentTaskId: "parent",
    });
    const parent = claimObservedAppTask(config, { taskId: "parent", appAgent: "app-owner", handler: "agent" });
    if (parent.kind !== "claimed") throw new Error("expected parent review");
    expect(parent.events.some((entry) => JSON.stringify(entry.event).includes("Fourth failure"))).toBe(true);
    const child = config.resourceStore.readTask(intent.id)!;
    completeAppTask(config, parent, {
      summary: "Reviewed and repaired the failure",
      evidence: ["test:repair"],
      actions: [
        {
          kind: "unblock-task",
          taskId: intent.id,
          expectedGeneration: child.metadata.generation,
          expectedResourceVersion: child.metadata.resourceVersion,
          reason: "Repair verified; retry",
        },
      ],
    });
    expect(claim().generation).toBe(1);
  });
});

describe("App-owned non-success stop", () => {
  const decision = {
    summary: "Optional feature is not feasible",
    result: { partial: "Feasibility findings" },
    evidence: ["analysis:feasibility"],
  };
  function setup(mode: "achieve" | "maintain" = "achieve") {
    const { config } = fixture();
    const intent: AppTaskIntent = {
      id: "work/optional",
      parentId: "operations",
      outcome: "Build optional feature",
      acceptance: ["Feature works"],
      mode,
    };
    observeAppTaskIntent(config, { appAgent: "app-owner", intent });
    const claim = claimObservedAppTask(config, { taskId: intent.id, appAgent: "app-owner", handler: "agent" });
    if (claim.kind !== "claimed") throw new Error("expected claimed Task");
    return { config, intent, claim };
  }

  it("persists attribution, partial work and the parent decision wake without success", () => {
    const { config, intent, claim } = setup();
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, id: "parent", mode: "maintain" } });
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, parentId: "parent" } });
    expect(stopAppTask(config, claim, decision)).toMatchObject({ status: "applied", parentTaskId: "parent" });
    expect(config.resourceStore.readCancellation(intent.id)).toMatchObject({
      decidedBy: { kind: "app", agent: claim.agent, attemptId: claim.attemptId },
      reason: decision.summary,
      evidence: decision.evidence,
      result: decision.result,
    });
    expect(readRuntimeTaskView({ taskStateConfig: config }, intent.id)).toMatchObject({
      status: "attention",
      result: decision.result,
      evidence: decision.evidence,
      summary: expect.stringContaining("outcome not achieved"),
    });
    expect(config.resourceStore.readReceipt(intent.id)).toBeNull();
    expect(isAppTaskConverged(config, intent.id, claim.generation)).toBe(false);
    expect(() =>
      observeAppTaskIntent(config, {
        appAgent: "app-owner",
        intent: { ...intent, input: { revised: true } },
      }),
    ).toThrow("cancelled task");
    expect(config.resourceStore.readTask(intent.id)).toMatchObject({
      metadata: { generation: 1 },
      status: { summary: expect.stringContaining("outcome not achieved") },
    });
    observeAppTaskIntent(config, {
      appAgent: "app-owner",
      intent: { ...intent, id: "dependent", dependsOn: [intent.id] },
    });
    expect(
      claimObservedAppTask(config, { taskId: "dependent", appAgent: "app-owner", handler: "agent" }),
    ).toMatchObject({
      kind: "waiting",
      dependencyIds: [intent.id],
    });
    const parent = claimObservedAppTask(config, { taskId: "parent", appAgent: "app-owner", handler: "agent" });
    if (parent.kind !== "claimed") throw new Error("expected parent review");
    expect(JSON.stringify(parent.events)).toContain("outcome not achieved");
    for (const kind of ["close-task", "unblock-task"] as const) {
      expect(() =>
        completeAppTask(config, parent, {
          summary: "Invalid reclassification",
          evidence: ["test:decision"],
          actions: [{ kind, taskId: intent.id, expectedGeneration: 1, summary: "Done", reason: "Retry" }],
        }),
      ).toThrow("cancelled task");
    }
    recordAppTaskTrigger(config, intent.id, { type: "sample.wake", eventId: 77 });
    expect(claimObservedAppTask(config, { taskId: intent.id, appAgent: "app-owner", handler: "agent" }).kind).toBe(
      "completed",
    );
    expect(completeAppTask(config, claim, { summary: "Late success", evidence: [] }).status).toBe("stale");
    expect(stopAppTask(config, claim, decision).status).toBe("stale");
    expect(config.resourceStore.readReceipt(intent.id)).toBeNull();
  });

  it("rejects retry after an exhausted Task is cancelled without relabelling its terminal state", () => {
    const { config, intent, claim } = setup();
    let attempt = claim;
    for (let index = 0; index < 4; index += 1) {
      failAppTaskAttempt(config, attempt, "Repeated execution failure");
      if (index < 3) {
        const next = claimObservedAppTask(config, { taskId: intent.id, appAgent: "app-owner", handler: "agent" });
        if (next.kind !== "claimed") throw new Error("expected bounded retry");
        attempt = next;
      }
    }
    const failed = config.resourceStore.readTask(intent.id)!;
    expect(failed.status.executionFailures).toBe(4);
    cancelAppTask(config, {
      appId: "sample",
      taskId: intent.id,
      expectedGeneration: failed.metadata.generation,
      expectedResourceVersion: failed.metadata.resourceVersion,
      reason: "Do not pursue this failed work",
    });
    const cancelled = config.resourceStore.readTask(intent.id)!;
    const before = readTaskSnapshot(config);
    expect(() =>
      retryFailedAppTask(config, {
        appId: "sample",
        taskId: intent.id,
        expectedGeneration: cancelled.metadata.generation,
        expectedResourceVersion: cancelled.metadata.resourceVersion,
        controlKey: "retry-cancelled",
      }),
    ).toThrow("cancelled task");
    expect(readTaskSnapshot(config)).toEqual(before);
    expect(config.resourceStore.readControlReceipt("retry-cancelled")).toBeNull();
    expect(readRuntimeTaskView({ taskStateConfig: config }, intent.id)).toMatchObject({
      status: "attention",
      summary: expect.stringContaining("Cancelled by human"),
    });
    expect(config.resourceStore.listRecoveryCandidates().items.map((item) => item.taskId)).not.toContain(intent.id);
  });

  it.each(["maintain", "children", "evidence", "new-input", "revision"])("refuses an unsafe stop: %s", (reason) => {
    const { config, intent, claim } = setup(reason === "maintain" ? "maintain" : "achieve");
    if (reason === "children")
      observeAppTaskIntent(config, {
        appAgent: "app-owner",
        intent: {
          ...intent,
          id: "child",
          parentId: intent.id,
        },
      });
    if (reason === "new-input") recordAppTaskTrigger(config, intent.id, { type: "sample.feedback", eventId: 11 });
    if (reason === "revision")
      observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, input: { revision: 2 } } });
    if (reason === "revision") expect(stopAppTask(config, claim, decision).status).toBe("stale");
    else
      expect(() =>
        stopAppTask(config, claim, { ...decision, ...(reason === "evidence" ? { evidence: [] } : {}) }),
      ).toThrow();
    expect(config.resourceStore.readCancellation(intent.id)).toBeNull();
    expect(config.resourceStore.readReceipt(intent.id)).toBeNull();
    if (reason === "new-input") expect(readTaskSnapshot(config).taskTriggers?.[intent.id]?.events).toHaveLength(1);
  });

  it("rolls back the terminal state and parent wake if cancellation storage fails", () => {
    const { config, intent, claim } = setup();
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, id: "parent", mode: "maintain" } });
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, parentId: "parent" } });
    const before = readTaskSnapshot(config);
    config.resourceStore.db.exec(
      "CREATE TRIGGER reject_stop BEFORE INSERT ON app_task_cancellations BEGIN SELECT RAISE(ABORT, 'stop write rejected'); END",
    );
    expect(() => stopAppTask(config, claim, decision)).toThrow("stop write rejected");
    expect(readTaskSnapshot(config)).toEqual(before);
    expect(config.resourceStore.readCancellation(intent.id)).toBeNull();
  });

  for (const relation of ["create", "reparent"] as const) {
    it.each(["child-first", "stop-first"])(`fences ${relation} against App stop across connections: %s`, (order) => {
      const base = setup();
      const path = join(base.config.appDir, "stop-race.sqlite");
      const store = AppTaskResourceStore.openStandalone(path, "sample");
      store.bootstrapSnapshot(readTaskSnapshot(base.config), "race");
      const peer = AppTaskResourceStore.openStandalone(path, "sample");
      stores.push(store, peer);
      const config = { ...base.config, resourceStore: store };
      const other = { ...base.config, resourceStore: peer };
      const child = { ...base.intent, id: "racing-child", parentId: "operations" };
      if (relation === "reparent") observeAppTaskIntent(other, { appAgent: "app-owner", intent: child });
      const addChild = () =>
        observeAppTaskIntent(other, {
          appAgent: "app-owner",
          intent: { ...child, parentId: base.intent.id },
        });
      const stop = () => stopAppTask(config, base.claim, decision);
      const intercepted = order === "child-first" ? store : peer;
      const commit = intercepted.commit.bind(intercepted);
      intercepted.commit = (mutation) => {
        intercepted.commit = commit;
        if (order === "child-first") addChild();
        else expect(stop().status).toBe("applied");
        return commit(mutation);
      };
      try {
        expect(order === "child-first" ? stop : addChild).toThrow();
      } finally {
        intercepted.commit = commit;
      }
      expect(store.isCancelled(base.intent.id)).toBe(order === "stop-first");
      expect(peer.readTask(child.id)?.spec.parentId).toBe(
        order === "child-first" ? base.intent.id : relation === "reparent" ? "operations" : undefined,
      );
      expect(store.readReceipt(base.intent.id)).toBeNull();
    });
  }

  it("does not cascade human parent cancellation into existing child revisions", () => {
    const { config, intent } = setup();
    const child = { ...intent, id: "existing-child", parentId: intent.id };
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: child });
    const parent = config.resourceStore.readTask(intent.id)!;
    cancelAppTask(config, {
      appId: "sample",
      taskId: intent.id,
      expectedGeneration: parent.metadata.generation,
      expectedResourceVersion: parent.metadata.resourceVersion,
      reason: "Stop only this parent",
    });
    expect(
      observeAppTaskIntent(config, {
        appAgent: "app-owner",
        intent: { ...child, input: { revision: 2 } },
      }).kind,
    ).toBe("observed");
    expect(config.resourceStore.isCancelled(child.id)).toBe(false);
    const claim = claimObservedAppTask(config, { taskId: child.id, appAgent: "app-owner", handler: "agent" });
    if (claim.kind !== "claimed") throw new Error("expected existing child to continue");
    expect(
      completeAppTask(config, claim, { summary: "Existing work finished", evidence: ["test:verified"] }).status,
    ).toBe("applied");
    expect(config.resourceStore.readTrigger(intent.id)).toBeNull();
    expect(() =>
      observeAppTaskIntent(config, {
        appAgent: "app-owner",
        intent: { ...child, id: "new-child" },
      }),
    ).toThrow("cancelled parent");
  });

  it.each(["converged", "stopped"])("lets the parent decide %s after its child stops", (state) => {
    const { config, intent, claim } = setup();
    observeAppTaskIntent(config, {
      appAgent: "app-owner",
      intent: {
        ...intent,
        id: "parent",
        outcome: "Assess the optional feature",
        acceptance: ["Report the feasibility finding"],
      },
    });
    observeAppTaskIntent(config, { appAgent: "app-owner", intent: { ...intent, parentId: "parent" } });
    stopAppTask(config, claim, decision);
    const parent = claimObservedAppTask(config, { taskId: "parent", appAgent: "app-owner", handler: "agent" });
    if (parent.kind !== "claimed") throw new Error("expected parent review");
    expect(readAppTaskChildContext(config, "parent")).toMatchObject({
      live: [],
      completed: [],
      cancelled: [{ taskId: intent.id, summary: expect.stringContaining("outcome not achieved") }],
    });
    expect(() =>
      deferAppTask(config, parent, { summary: "Wait on terminal child", disposition: "waiting", evidence: [] }),
    ).toThrow();
    const result =
      state === "stopped"
        ? stopAppTask(config, parent, decision)
        : completeAppTask(config, parent, {
            summary: "The assessment is complete; implementation was not feasible",
            evidence: decision.evidence,
          });
    expect(result.status).toBe("applied");
    expect(config.resourceStore.readReceipt(intent.id)).toBeNull();
    expect(config.resourceStore.isCancelled(intent.id)).toBe(true);
    expect(isAppTaskConverged(config, "parent")).toBe(state === "converged");
  });
});

/** Most reconciler fixtures exercise mechanics, so give their external waits explicit test ownership. */
function deferAppTask(...args: Parameters<typeof deferCanonicalAppTask>): ReturnType<typeof deferCanonicalAppTask> {
  const [config, claim, input] = args;
  return deferCanonicalAppTask(config, claim, {
    ...input,
    conditions: input.conditions?.map((condition) => ({
      ...condition,
      owner: condition.owner ?? "app:test-external",
      reviewAfterMs: condition.reviewAfterMs ?? 60_000,
    })),
  });
}

function trackAppTaskConditionEvent(config: AppTaskContext, event: Record<string, unknown>) {
  return trackAppTaskConditionEventForTasks(config, event, matchingAppTaskConditionTaskIds(config, event));
}

function fixture(operationsOwner?: string) {
  const root = join(tmpdir(), `task-reconciler-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(
      {
        root_task_id: "root",
        groups: {
          root: {
            id: "root",
            parent_id: null,
            owner: "branch-owner",
          },
          operations: {
            id: "operations",
            parent_id: "root",
            ...(operationsOwner ? { owner: operationsOwner } : {}),
          },
        },
        resources: {
          "categorized-task": {
            metadata: {
              id: "categorized-task",
              generation: 1,
              resourceVersion: 1,
            },
            spec: {
              parentId: "operations",
              outcome: "Categorized bounded work",
              acceptance: ["The categorized work converges"],
              mode: "achieve",
              category: "domain",
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
  const config = appTaskTestContext({
    appDir,
    agent: "app-owner",
    maxConcurrent: 3,
    // These are reconciliation rules, not disk/restart tests. Keep real SQLite
    // transactions and fences without paying for a fresh WAL file per case.
    databasePath: ":memory:",
  });
  stores.push(config.resourceStore);
  return { root, appDir, config, store: config.resourceStore };
}

function mutateAttemptFixture(
  config: AppTaskContext,
  taskId: string,
  attemptId: string,
  mutate: (attempt: NonNullable<ReturnType<typeof readTaskSnapshot>["attempts"]>[string]) => void,
): void {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  const attempt = tree.attempts?.[attemptId];
  if (!resource || !attempt) throw new Error("expected resource-backed attempt fixture");
  mutate(attempt);
  attempt.metadata.resourceVersion += 1;
  expect(
    config.resourceStore.commit({
      fences: [
        {
          taskId,
          resourceVersion: resource.metadata.resourceVersion,
          generation: resource.metadata.generation,
          currentAttemptId: attemptId,
        },
      ],
      attempts: [attempt],
    }),
  ).toBe(true);
}

function mutateTaskResourceFixture(
  config: AppTaskContext,
  taskId: string,
  mutate: (
    resource: NonNullable<ReturnType<typeof readTaskSnapshot>["resources"]>[string],
    trigger: NonNullable<ReturnType<typeof readTaskSnapshot>["taskTriggers"]>[string] | undefined,
  ) => void,
  ready = true,
): void {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  if (!resource) throw new Error(`expected resource-backed fixture ${taskId}`);
  const trigger = tree.taskTriggers?.[taskId];
  const expectedResourceVersion = resource.metadata.resourceVersion;
  mutate(resource, trigger);
  resource.metadata.resourceVersion += 1;
  if (trigger) trigger.resourceVersion += 1;
  expect(
    config.resourceStore.commit({
      fences: [{ taskId, resourceVersion: expectedResourceVersion }],
      tasks: [{ resource, trigger, ready }],
    }),
  ).toBe(true);
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

import { buildRecoveredSessionHandoff } from "../../adapters/executors/session-recovery.js";

function declareAndClaimTask(
  config: AppTaskContext,
  input: {
    intent: AppTaskIntent;
    appAgent: string;
    handler: string;
    reason?: string;
    trigger?: Record<string, unknown>;
    isAgentRunnable?: (agent: string) => boolean;
    recoverSessionHandoff?: Parameters<typeof claimObservedAppTask>[1]["recoverSessionHandoff"];
  },
) {
  const observed = observeAppTaskIntent(config, {
    intent: input.intent,
    appAgent: input.appAgent,
    trigger: input.trigger,
  });
  if (observed.kind === "completed") return observed;
  return claimObservedAppTask(config, {
    taskId: observed.taskId,
    appAgent: input.appAgent,
    handler: input.handler,
    reason: input.reason,
    isAgentRunnable: input.isAgentRunnable,
    recoverSessionHandoff: input.recoverSessionHandoff,
  });
}

function reclaimInterruptedSession(
  state: ReturnType<typeof fixture>,
  sessionId: string,
  transcript: unknown[],
  checkpoint?: Record<string, unknown>,
) {
  const { root } = state;
  const { config } = state;
  const claim = declareAndClaimTask(config, {
    intent: intent(),
    appAgent: "app-owner",
    handler: "workflow:known-workflow",
  });
  if (claim.kind !== "claimed") throw new Error("expected initial claim");
  expect(recordAppTaskAttemptSession(config, claim, sessionId)).toBe(true);

  const sessionPath = join(root, ".state", "sessions", sessionId);
  mkdirSync(sessionPath, { recursive: true });
  writeFileSync(join(sessionPath, "meta.json"), `${JSON.stringify({ error: "previous runtime interrupted" })}\n`);
  writeFileSync(join(sessionPath, "result.json"), `${JSON.stringify({ status: "interrupted" })}\n`);
  writeFileSync(join(sessionPath, "session.jsonl"), transcript.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  if (checkpoint) {
    const checkpointDir = join(root, ".state", "checkpoints");
    mkdirSync(checkpointDir, { recursive: true });
    writeFileSync(join(checkpointDir, `${sessionId}.jsonl`), `${JSON.stringify(checkpoint)}\n`);
  }

  mutateAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
    attempt.runtimeId = "previous-runtime";
  });
  const [recovery] = recoverableAppTaskAttempts(config, Date.now(), false, [claim.taskId]);
  expect(releaseInterruptedAppTaskAttempt(config, recovery, "previous runtime stopped").released).toBe(true);

  const reclaimed = declareAndClaimTask(config, {
    intent: intent(),
    appAgent: "app-owner",
    handler: "workflow:known-workflow",
    reason: `attempt-recovery:${claim.taskId}`,
    recoverSessionHandoff: (attempt) => buildRecoveredSessionHandoff(join(root, ".state"), attempt),
  });
  if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");
  return { reclaimed, sessionPath };
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("App task reconciler state", () => {
  it("fences a fresh canonical attempt before its first Agent session", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const attempt = readTaskSnapshot(config).attempts?.[claim.attemptId];
    expect(attempt).toMatchObject({
      state: "running",
      runtimeId: expect.any(String),
      lease: {
        id: expect.any(String),
        version: 1,
        runtimeId: expect.any(String),
      },
    });
    expect(attempt?.sessionId).toBeUndefined();
    expect(attempt?.lease?.sessionId).toBeUndefined();
    expect(Date.parse(attempt?.lease?.expiresAt ?? "")).toBeGreaterThan(Date.now());
  });

  it("writes only attempts changed by a reconciliation", () => {
    const state = fixture();
    const { config, store } = state;
    const first = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    expect(releaseStaleAppTaskResult(config, first).status).toBe("released");

    const second = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");

    let committed: AppTaskResourceMutation | undefined;
    const commit = store.commit.bind(store);
    store.commit = (mutation) => {
      committed = mutation;
      return commit(mutation);
    };

    expect(completeAppTask(config, second, { summary: "completed after retry" }).status).toBe("applied");
    expect(committed?.attempts?.map((attempt) => attempt.metadata.id)).toEqual([second.attemptId]);
    expect(committed?.receipts?.map((receipt) => receipt.metadata.id)).toEqual([second.taskId]);
  });

  it("fences an unchanged parent without rewriting it", () => {
    const state = fixture();
    const { config, store } = state;
    const parent = { ...intent("maintain"), id: "work/parent" };
    observeAppTaskIntent(config, { intent: parent, appAgent: "app-owner" });
    const child = { ...intent("achieve"), id: "work/child", parentId: parent.id };
    const claim = declareAndClaimTask(config, {
      intent: child,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    let committed: AppTaskResourceMutation | undefined;
    const commit = store.commit.bind(store);
    store.commit = (mutation) => {
      committed = mutation;
      return commit(mutation);
    };

    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting for the exact session",
        conditions: [
          {
            id: "bounded-parent-write-condition",
            type: "session.end",
            subject: "session:s_bounded_parent_write",
            expected: "done",
          },
        ],
      }).status,
    ).toBe("applied");
    expect(committed?.fences.map((fence) => fence.taskId)).toEqual(expect.arrayContaining([claim.taskId, parent.id]));
    expect(committed?.tasks?.map((write) => write.resource.metadata.id)).toEqual([claim.taskId]);
    expect(committed?.deleteReceiptIds).toBeUndefined();
  });

  it("renews only the current bounded workflow attempt lease", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const resourceConfig = state.config;

    const before = resourceConfig.resourceStore.readTaskContext({ taskIds: [claim.taskId] }).attempts?.[
      claim.attemptId
    ];
    const renewalAt = Date.parse(before?.lease?.lastActivityAt ?? "") + 500;
    expect(renewAppTaskAttemptLease(resourceConfig, claim, renewalAt)).toBe(true);

    const renewed = resourceConfig.resourceStore.readTaskContext({ taskIds: [claim.taskId] }).attempts?.[
      claim.attemptId
    ];
    expect(renewed?.lease).toMatchObject({
      id: before?.lease?.id,
      version: 2,
      runtimeId: before?.runtimeId,
      lastActivityAt: new Date(renewalAt).toISOString(),
    });
    expect(Date.parse(renewed?.lease?.expiresAt ?? "")).toBeGreaterThan(Date.parse(before?.lease?.expiresAt ?? ""));

    const staleClaim = { ...claim, attemptId: `${claim.attemptId}-stale` };
    expect(renewAppTaskAttemptLease(resourceConfig, staleClaim, renewalAt)).toBe(false);
  });

  it("keeps an achieve task live when its handler revises the same task generation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const result = completeAppTask(config, claim, {
      summary: "Bound the newly observed cleanup proof",
      evidence: ["cleanup-proof:resource-group-absent"],
      actions: [
        {
          kind: "update-task",
          taskId: claim.taskId,
          expectedGeneration: claim.generation,
          workflow: "known-workflow",
          input: {
            sessionId: "session-1",
            cleanupProof: "resource-group-absent",
          },
        },
      ],
    });

    expect(result).toMatchObject({
      status: "applied",
      actionsApplied: [`updated ${claim.taskId}`],
      dependentTaskIds: [claim.taskId],
      taskContinues: true,
    });
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      metadata: { generation: claim.generation + 1 },
      spec: {
        workflow: "known-workflow",
        input: {
          sessionId: "session-1",
          cleanupProof: "resource-group-absent",
        },
      },
      status: { phase: "pending" },
    });
    expect(tree.attempts?.[claim.attemptId]?.state).toBe("completed");
    expect(tree.receipts?.[claim.taskId]).toBeUndefined();
  });

  it("keeps a maintain task pending when a durable wake arrives during its attempt", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      recordAppTaskTrigger(config, claim.taskId, {
        type: "sample.continue",
        reason: "bounded-stage-complete",
      }),
    ).toEqual({ kind: "recorded" });

    expect(
      completeAppTask(config, claim, {
        summary: "Checkpointed one bounded stage",
        evidence: ["checkpoint:stage-1"],
      }),
    ).toMatchObject({
      status: "applied",
      dependentTaskIds: [claim.taskId],
      taskContinues: true,
    });
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]?.status.phase).toBe("pending");
    expect(tree.taskTriggers?.[claim.taskId]?.event).toMatchObject({
      type: "sample.continue",
    });
    expect(tree.attempts?.[claim.attemptId]?.state).toBe("completed");
  });

  it("keeps an achieve task live until events that arrived during the attempt are reconciled", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:worker",
      trigger: { type: "sample.requested", eventId: 100 },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      recordAppTaskTrigger(config, claim.taskId, {
        type: "sample.corrected",
        eventId: 101,
        data: { correction: "use the revised evidence" },
      }),
    ).toEqual({ kind: "recorded" });

    expect(
      completeAppTask(config, claim, {
        summary: "Satisfied the outcome observed before the correction",
        evidence: ["result:initial"],
      }),
    ).toMatchObject({
      status: "applied",
      dependentTaskIds: [claim.taskId],
      taskContinues: true,
    });

    const tree = readTaskSnapshot(config);
    expect(tree.receipts?.[claim.taskId]).toBeUndefined();
    expect(tree.resources?.[claim.taskId]?.status.phase).toBe("pending");
    const next = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "workflow:worker",
      reason: "event",
    });
    expect(next).toMatchObject({
      kind: "claimed",
      events: [
        {
          event: {
            type: "sample.corrected",
            eventId: 101,
          },
        },
      ],
      eventsTruncated: false,
    });
  });

  it("consumes only live events incorporated into the accepted result", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "executor:reviewer",
      trigger: { type: "sample.requested", eventId: 100 },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    recordAppTaskTrigger(config, claim.taskId, { type: "sample.corrected", eventId: 101 });
    recordAppTaskTrigger(config, claim.taskId, { type: "sample.follow-up", eventId: 102 });

    expect(
      completeAppTask(config, claim, {
        summary: "Incorporated the correction but not the later follow-up",
        evidence: ["event:101"],
        acceptedLiveEventIds: [101],
      }),
    ).toMatchObject({ status: "applied", taskContinues: true });
    expect(readTaskSnapshot(config).taskTriggers?.[claim.taskId]?.events?.map((entry) => entry.event.eventId)).toEqual([
      102,
    ]);
  });

  it.each(["waiting", "converged"] as const)("keeps %s result and actions atomic across unaccepted input", (state) => {
    const fixtureState = fixture();
    const { config } = fixtureState;
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "executor:reviewer",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    recordAppTaskTrigger(config, claim.taskId, {
      type: "sample.corrected",
      eventId: 101,
      data: { state: "corrected" },
    });
    const action = {
      kind: "create-task" as const,
      id: "work/from-stale-result",
      parentId: claim.taskId,
      outcome: "Act on the latest correction",
      acceptance: ["The correction is handled"],
      mode: "achieve" as const,
      outputs: [],
    };

    const output = {
      summary: "Act on the older snapshot", evidence: ["snapshot:old"],
      result: { inventory: [action.id] }, actions: [action],
    };
    expect(() => state === "waiting"
      ? deferAppTask(config, claim, { ...output, disposition: "waiting" })
      : completeAppTask(config, claim, output)
    ).toThrow("newer Task evidence is pending");
    expect(readTaskSnapshot(config).resources?.[action.id]).toBeUndefined();
    expect(readTaskSnapshot(config).resources?.[claim.taskId]?.status.result).toBeUndefined();
    expect(readTaskSnapshot(config).attempts?.[claim.attemptId]?.state).toBe("running");
    expect(readTaskSnapshot(config).taskTriggers?.[claim.taskId]?.events?.map((row) => row.event.eventId)).toEqual([101]);

    expect(
      completeAppTask(config, claim, {
        summary: "Act on the accepted correction",
        evidence: ["event:101"],
        actions: [action],
        acceptedLiveEventIds: [101],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: [`created ${action.id}`] });
  });

  it.each(["converged", "attention"] as const)("preserves open waits and %s findings for reevaluation", (state) => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"), appAgent: "app-owner", handler: "workflow:worker",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    const condition = { id: "run:42", type: "sample.run.done", subject: "run:42", expected: "done" };
    deferAppTask(config, first, { disposition: "waiting", summary: "Run 42 is live", conditions: [condition] });
    recordAppTaskTrigger(config, first.taskId, { type: "sample.review.changed", eventId: 100 });
    const claim = claimObservedAppTask(config, {
      taskId: first.taskId, appAgent: "app-owner", handler: "workflow:worker", reason: "event",
    });
    if (claim.kind !== "claimed") throw new Error("expected resumed claim");
    recordAppTaskTrigger(config, claim.taskId, { type: "sample.corrected", eventId: 101 });
    recordAppTaskTrigger(config, claim.taskId, { type: "sample.follow-up", eventId: 102 });
    const output = { summary: "Cleanup failed at head abc", result: { runId: 42, cleanup: "failed" },
      evidence: ["artifact:42"], acceptedLiveEventIds: [101] };
    expect(state === "attention"
      ? markAppTaskAttention(config, claim, { ...output, reason: "handler-blocked" })
      : completeAppTask(config, claim, output)
    ).toMatchObject({ status: "applied", taskContinues: true });
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]?.status).toMatchObject({
      phase: "pending", result: output.result, evidence: output.evidence, conditionIds: [condition.id],
    });
    expect(tree.attempts?.[claim.attemptId]?.state).toBe(state === "attention" ? "failed" : "completed");
    expect(tree.conditions?.[condition.id]?.spec.subject).toBe("run:42");
    expect(tree.taskTriggers?.[claim.taskId]?.events?.map((row) => row.event.eventId)).toEqual([102]);
    expect(tree.receipts?.[claim.taskId]).toBeUndefined();
    expect(listRunnableAppTaskIds(config, "app-owner")).toContain(claim.taskId);
    expect(completeAppTask(config, claim, { summary: "Late overwrite", result: { runId: 0 } }).status).toBe("stale");
    expect(config.resourceStore.readTask(claim.taskId)?.status.result).toEqual(output.result);
  });

  it.each(["waiting", "converged"] as const)("admits %s parent actions across a newer clock wake", (state) => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
      trigger: { type: "project.task.tick", eventId: 100 },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskTrigger(config, claim.taskId, { type: "project.task.tick", eventId: 101 });
    expect(() => assertAppTaskEffectFresh(config, claim)).not.toThrow();
    const result = {
      summary: "Admit useful independent child work",
      evidence: ["inventory:current"],
      actions: [{
        kind: "create-task" as const,
        id: "work/next-child",
        parentId: claim.taskId,
        mode: "achieve" as const,
        outcome: "Process the next item",
        acceptance: ["Exact proof"],
        outputs: [],
      }],
    };
    const applied = state === "waiting"
      ? deferAppTask(config, claim, { ...result, disposition: "waiting" })
      : completeAppTask(config, claim, result);
    expect(applied).toMatchObject({ status: "applied", actionsApplied: ["created work/next-child"] });
    expect(config.resourceStore.readTask("work/next-child")).not.toBeNull();
    // Both results retain the latest wake for the next pass without discarding
    // an accepted child action or treating time alone as conflicting evidence.
    expect(config.resourceStore.readTrigger(claim.taskId)?.events?.map((row) => row.event.eventId)).toEqual(
      [101],
    );
  });

  it("releases a rejected parent from current state while preserving new human input", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
      trigger: { type: "project.task.tick", eventId: 100 },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskTrigger(config, claim.taskId, {
      type: "project.comment.created", eventId: 101, data: { content: "Change scope before admitting more work" },
    });
    recordAppTaskTrigger(config, claim.taskId, { type: "project.task.tick", eventId: 102 });
    expect(() => assertAppTaskEffectFresh(config, claim)).toThrow("newer Task evidence is pending");
    expect(config.resourceStore.readTask(claim.taskId)!.metadata.resourceVersion).toBeGreaterThan(claim.resourceVersion);
    expect(releaseStaleAppTaskResult(config, claim)).toEqual({ status: "released", taskId: claim.taskId });
    const next = claimObservedAppTask(config, {
      taskId: claim.taskId, appAgent: "app-owner", handler: "workflow:worker", reason: "current-evidence",
    });
    if (next.kind !== "claimed") throw new Error("expected current claim");
    expect(next.events.map((row) => row.event.eventId)).toEqual([101, 102]);
    expect(releaseStaleAppTaskResult(config, claim).status).toBe("superseded");
    expect(config.resourceStore.readTask(claim.taskId)!.status.currentAttemptId).toBe(next.attemptId);
  });

  it("still fences a newer mutation arriving during stale-attempt release", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const store = config.resourceStore;
    const commit = store.commit.bind(store);
    let injected = false;
    store.commit = (mutation) => {
      if (!injected) {
        injected = true;
        recordAppTaskTrigger(config, claim.taskId, {
          type: "project.comment.created", eventId: 101, data: { content: "Preserve concurrent input" },
        });
      }
      return commit(mutation);
    };
    try {
      expect(() => releaseStaleAppTaskResult(config, claim)).toThrow("stale fence");
    } finally {
      store.commit = commit;
    }
    expect(store.readTask(claim.taskId)!.status.currentAttemptId).toBe(claim.attemptId);
    expect(store.readTrigger(claim.taskId)?.event.eventId).toBe(101);
    expect(releaseStaleAppTaskResult(config, claim).status).toBe("released");
    expect(store.readTrigger(claim.taskId)?.event.eventId).toBe(101);
  });

  it("coalesces pending ticks without losing feedback or updates arriving during a pass", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskTrigger(config, first.taskId, { type: "project.task.tick", eventId: 1 });
    recordAppTaskTrigger(config, first.taskId, {
      type: "project.comment.created",
      eventId: 2,
      data: { content: "Review this" },
    });
    for (let id = 3; id <= 100; id++)
      recordAppTaskTrigger(config, first.taskId, { type: "project.task.tick", eventId: id });
    const beforeReplay = config.resourceStore.readTask(first.taskId)!.metadata.resourceVersion;
    recordAppTaskTrigger(config, first.taskId, { type: "project.task.tick", eventId: 50 });
    expect(config.resourceStore.readTask(first.taskId)!.metadata.resourceVersion).toBe(beforeReplay);
    expect(config.resourceStore.readTrigger(first.taskId)?.events?.map((item) => item.event.eventId)).toEqual([2, 100]);
    expect(completeAppTask(config, first, { summary: "Read initial state" }).taskContinues).toBe(true);
    const second = claimObservedAppTask(config, {
      taskId: first.taskId,
      appAgent: "app-owner",
      handler: "workflow:worker",
      reason: "event",
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");
    expect(second.events.map((item) => item.event.eventId)).toEqual([2, 100]);
    recordAppTaskTrigger(config, first.taskId, { type: "project.task.tick", eventId: 101 });
    expect(completeAppTask(config, second, { summary: "Read through wake 100" }).taskContinues).toBe(true);
    expect(config.resourceStore.readTrigger(first.taskId)?.events?.map((item) => item.event.eventId)).toEqual([101]);
  });

  it("claims an ordered bounded event prefix without losing the remaining wakes", () => {
    const state = fixture();
    const { config } = state;
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    for (let index = 1; index <= 35; index += 1) {
      expect(
        recordAppTaskTrigger(config, first.taskId, {
          type: "sample.observed",
          eventId: index,
          data: { index },
        }),
      ).toEqual({ kind: "recorded" });
    }
    expect(completeAppTask(config, first, { summary: "Observed the initial state" }).taskContinues).toBe(true);

    const second = claimObservedAppTask(config, {
      taskId: first.taskId,
      appAgent: "app-owner",
      handler: "workflow:worker",
      reason: "event",
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");
    expect(second.events.map((entry) => entry.event.eventId)).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    expect(second.eventsTruncated).toBe(true);
    expect(readTaskSnapshot(config).taskTriggers?.[first.taskId]?.events?.map((entry) => entry.event.eventId)).toEqual([
      33, 34, 35,
    ]);
  });

  it("rejects self-updates even when alone or mixed with other actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "No effective correction",
        evidence: ["reviewed-current-input"],
        actions: [
          {
            kind: "update-task",
            taskId: claim.taskId,
            expectedGeneration: claim.generation,
            input: { sessionId: "session-1" },
          },
        ],
      }),
    ).toThrow("assignment changes belong to its assigning owner");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "Mixed correction",
        evidence: ["reviewed-current-input"],
        actions: [
          {
            kind: "update-task",
            taskId: claim.taskId,
            expectedGeneration: claim.generation,
            input: { sessionId: "session-2" },
          },
          {
            kind: "create-task",
            id: "unrelated-followup",
            parentId: "operations",
            outcome: "Do unrelated work",
            mode: "achieve",
            outputs: [],
            acceptance: ["The unrelated work completes"],
          },
        ],
      }),
    ).toThrow("assignment changes belong to its assigning owner");
  });

  it("carries observed workspace lineage from the attempt into its completion receipt", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const workspace = {
      kind: "task-worktree" as const,
      path: "/tmp/worktrees/example",
      baseRef: "origin/dev",
      baseCommit: "a".repeat(40),
      branch: "task/example",
      headCommit: "b".repeat(40),
      disposition: "branch-retained" as const,
    };
    const resourceConfig = state.config;

    expect(recordAppTaskAttemptWorkspace(resourceConfig, claim, workspace)).toBe(true);
    expect(completeAppTask(resourceConfig, claim, { summary: "completed in isolated workspace" }).status).toBe(
      "applied",
    );
    expect(
      resourceConfig.resourceStore.readTaskContext({ taskIds: [claim.taskId] }).receipts?.[claim.taskId]?.workspace,
    ).toEqual(workspace);
  });
  it("rejects a missing or completed parent instead of creating an orphan", () => {
    const state = fixture();
    const { config } = state;

    expect(() =>
      observeAppTaskIntent(config, {
        intent: {
          ...intent(),
          id: "work/orphan",
          parentId: "already-absorbed-parent",
        },
        appAgent: "app-owner",
      }),
    ).toThrow("parent does not exist in the live graph");

    expect(readAppTaskIntent(config, "work/orphan")).toBeNull();
  });

  it("selects a registered executor without creating a second Task lifecycle", () => {
    const { config } = fixture();
    const cliIntent: AppTaskIntent = {
      ...intent(),
      id: "work/codex",
      workflow: undefined,
      executor: "codex",
    };
    observeAppTaskIntent(config, { intent: cliIntent, appAgent: "app-owner" });

    expect(
      claimObservedAppTask(config, {
        taskId: cliIntent.id,
        appAgent: "app-owner",
        handler: "auto",
      }),
    ).toMatchObject({ kind: "claimed", handler: "executor:codex" });
  });

  it("accepts canonical Task agent selection and retains it in Host state", () => {
    const state = fixture();
    const { config } = state;
    const agentIntent: AppTaskIntent = {
      ...intent(),
      id: "work/managed-agent",
      agent: "specialist",
      workflow: undefined,
      executor: "agent",
    };
    observeAppTaskIntent(config, { intent: agentIntent, appAgent: "app-owner" });

    expect(readAppTaskIntent(config, agentIntent.id)).toMatchObject({ owner: "specialist" });

    expect(
      claimObservedAppTask(config, {
        taskId: agentIntent.id,
        appAgent: "app-owner",
        handler: "auto",
      }),
    ).toMatchObject({ kind: "claimed", agent: "specialist", handler: "agent:specialist" });
  });

  it("rejects conflicting or empty Task agent selection before persistence", () => {
    const state = fixture();
    const { config } = state;
    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: "work/conflict", agent: "one", owner: "two" },
        appAgent: "app-owner",
      }),
    ).toThrow("conflicting agent and legacy owner");
    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: "work/empty-agent", agent: " " },
        appAgent: "app-owner",
      }),
    ).toThrow("agent must be a non-empty string");
    expect(readAppTaskIntent(config, "work/conflict")).toBeNull();
    expect(readAppTaskIntent(config, "work/empty-agent")).toBeNull();
  });

  it("rejects ambiguous workflow and executor intent", () => {
    const { config } = fixture();
    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: "work/ambiguous", executor: "claude" },
        appAgent: "app-owner",
      }),
    ).toThrow("cannot configure both workflow and executor");
  });

  it("prioritizes retained handoff input while unavailable workflows wait for backoff", () => {
    const state = fixture();
    const { config } = state;
    const attentionIntent = {
      ...intent(),
      id: "work/attention",
      outcome: "Needs owner review",
    };
    const waitingIntent = {
      ...intent(),
      id: "work/waiting",
      outcome: "Waits for evidence",
    };
    const pendingIntent = {
      ...intent(),
      id: "work/pending",
      outcome: "Ready work",
    };
    const unavailableIntent = {
      ...intent(),
      id: "work/unavailable",
      outcome: "Run only after the workflow binding is repaired",
      workflow: "missing-workflow",
    };

    observeAppTaskIntent(config, { intent: attentionIntent, appAgent: "app-owner" });
    const attentionClaim = claimObservedAppTask(config, {
      taskId: attentionIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (attentionClaim.kind !== "claimed") throw new Error("expected attention claim");
    markAppTaskAttention(config, attentionClaim, {
      summary: "owner must decide",
      reason: "needs-agent",
    });

    observeAppTaskIntent(config, { intent: unavailableIntent, appAgent: "app-owner" });
    const unavailableClaim = claimObservedAppTask(config, {
      taskId: unavailableIntent.id,
      appAgent: "app-owner",
      handler: "workflow:missing-workflow",
      reason: "task-controller",
    });
    if (unavailableClaim.kind !== "claimed") throw new Error("expected unavailable claim");
    markAppTaskAttention(config, unavailableClaim, {
      summary: "workflow is not installed",
      reason: "HandlerUnavailable",
    });

    observeAppTaskIntent(config, { intent: waitingIntent, appAgent: "app-owner" });
    const waitingClaim = claimObservedAppTask(config, {
      taskId: waitingIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (waitingClaim.kind !== "claimed") throw new Error("expected waiting claim");
    deferAppTask(config, waitingClaim, {
      disposition: "waiting",
      summary: "waiting for evidence",
      conditions: [
        {
          id: "evidence-window",
          type: "session.end",
          subject: "session:s_evidence",
          expected: "done",
        },
      ],
    });

    observeAppTaskIntent(config, { intent: pendingIntent, appAgent: "app-owner" });
    const maintainClaim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (maintainClaim.kind !== "claimed") throw new Error("expected maintain claim");
    completeAppTask(config, maintainClaim, { summary: "monitor converged" });

    expect(listRunnableAppTaskIds(config)).toEqual(["work/attention", "categorized-task", "work/pending"]);


    observeAppTaskIntent(config, {
      intent: attentionIntent,
      appAgent: "app-owner",
      trigger: { type: "manual.wake", data: { reason: "fresh owner evidence" } },
    });
    expect(listRunnableAppTaskIds(config)).toEqual(["work/attention", "categorized-task", "work/pending"]);

    trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "s_evidence",
      status: "done",
    });
    expect(listRunnableAppTaskIds(config)).toEqual([
      "work/waiting",
      "work/attention",
      "categorized-task",
      "work/pending",
    ]);

    expect(config.resourceStore.readTask("work/unavailable")?.status.executionRetryAt).toBeGreaterThan(Date.now());

  });

  it("separates desired-state observation from attempt claiming", () => {
    const state = fixture();
    const { config } = state;
    expect(
      observeAppTaskIntent(config, {
        intent: intent("maintain"),
        appAgent: "app-owner",
        trigger: { type: "pipeline.changed", data: { project: "sample" } },
      }),
    ).toMatchObject({ kind: "observed", taskId: "pipeline-monitor", generation: 1, changed: true });

    const observedTree = readTaskSnapshot(config);
    expect(observedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { id: "pipeline-monitor", generation: 1, resourceVersion: 1 },
      spec: { outcome: "Keep the pipeline observable", mode: "maintain" },
      status: { observedGeneration: 0, phase: "pending" },
    });
    expect(readAppTaskIntent(config, "pipeline-monitor")).toEqual(intent("maintain"));

    const claim = claimObservedAppTask(config, {
      taskId: "pipeline-monitor",
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "queue",
    });
    expect(claim).toMatchObject({ kind: "claimed", taskId: "pipeline-monitor", generation: 1 });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const claimedTree = readTaskSnapshot(config);
    expect(claimedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: { phase: "running", currentAttemptId: claim.attemptId },
    });
    expect(claimedTree.attempts?.[claim.attemptId]).toMatchObject({
      metadata: { id: claim.attemptId, resourceVersion: 1 },
      taskId: "pipeline-monitor",
      taskGeneration: 1,
      state: "running",
      handler: "workflow:known-workflow",
    });
    expect(claimedTree.attempts?.[claim.attemptId]).toMatchObject({
      reason: "queue",
      events: [{ event: { type: "pipeline.changed" } }],
    });
    expect(claimedTree.attempts?.[claim.attemptId]?.trigger).toBeUndefined();
  });

  it("reads exact live intent and completion state without confusing an older receipt", () => {
    const { config } = fixture();
    const original = intent();
    const claim = declareAndClaimTask(config, {
      intent: original,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(completeAppTask(config, claim, { summary: "original goal completed" }).status).toBe("applied");
    expect(isAppTaskConverged(config, original.id, 1)).toBe(true);

    const revised = { ...original, outcome: "Evaluate revised session 1" };
    expect(observeAppTaskIntent(config, { intent: revised, appAgent: "app-owner" })).toMatchObject({
      kind: "observed",
      generation: 2,
    });

    expect(readAppTaskIntent(config, original.id)?.outcome).toBe(revised.outcome);
    expect(isAppTaskConverged(config, original.id)).toBe(false);
    expect(isAppTaskConverged(config, original.id, 1)).toBe(false);
    expect(readRuntimeTaskView({ taskStateConfig: config }, original.id)).toMatchObject({
      generation: 2,
      status: "pending",
      outcome: revised.outcome,
    });
    expect(listRuntimeTaskViews({ taskStateConfig: config }, { status: ["pending"] }).items).toContainEqual(
      expect.objectContaining({ id: original.id, generation: 2, status: "pending" }),
    );
    expect(listRuntimeTaskViews({ taskStateConfig: config }, { status: ["done"] }).items).not.toContainEqual(
      expect.objectContaining({ id: original.id }),
    );

    const revisedClaim = claimObservedAppTask(config, {
      taskId: original.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (revisedClaim.kind !== "claimed") throw new Error("expected revised claim");
    expect(completeAppTask(config, revisedClaim, { summary: "revised goal completed" }).status).toBe("applied");
    expect(config.resourceStore.readReceipt(original.id)).toMatchObject({
      metadata: { generation: 2 },
      outcome: revised.outcome,
      summary: "revised goal completed",
    });
    expect(readRuntimeTaskView({ taskStateConfig: config }, original.id)).toMatchObject({
      generation: 2,
      status: "done",
      outcome: revised.outcome,
    });
    expect(observeAppTaskIntent(config, { intent: revised, appAgent: "app-owner" })).toMatchObject({
      kind: "completed",
      generation: 2,
    });
    expect(listRunnableAppTaskIds(config)).not.toContain(original.id);
  });

  it("orders runnable tasks by priority, then task ID when ready times tie", () => {
    const state = fixture();
    const { config } = state;
    // Fast inserts can share a millisecond. Pin the tie instead of assuming
    // creation order implies distinct ready times; older-ready ordering is tested below.
    const readyAt = new Date(Date.now() - 1_000).toISOString();
    mutateTaskResourceFixture(config, "categorized-task", (resource) => {
      resource.status.updatedAt = readyAt;
    });
    for (const [id, priority] of [
      ["work/p2", "P2"],
      ["work/p0-z", "P0"],
      ["work/p1", "P1"],
      ["work/p0-a", "P0"],
    ] as const) {
      observeAppTaskIntent(config, {
        intent: { ...intent("achieve"), id, priority },
        appAgent: "app-owner",
      });
      mutateTaskResourceFixture(config, id, (resource) => {
        resource.status.updatedAt = readyAt;
      });
    }

    expect(listRunnableAppTaskIds(config)).toEqual([
      "work/p0-a",
      "work/p0-z",
      "work/p1",
      "categorized-task",
      "work/p2",
    ]);
  });

  it("prefers older ready work over newer peers within the same priority", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/a-newer", priority: "P2" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/z-older", priority: "P2" },
      appAgent: "app-owner",
    });

    mutateTaskResourceFixture(config, "work/a-newer", (resource) => {
      resource.status.updatedAt = "2026-07-25T10:00:00.000Z";
    });
    mutateTaskResourceFixture(config, "work/z-older", (resource) => {
      resource.status.updatedAt = "2026-07-25T09:00:00.000Z";
    });

    const runnable = listRunnableAppTaskIds(config);
    expect(runnable.indexOf("work/z-older")).toBeLessThan(runnable.indexOf("work/a-newer"));
  });

  it("ages ready work toward P1 without erasing the explicit P0 boundary", () => {
    const state = fixture();
    const { config } = state;
    for (const [id, priority] of [
      ["work/fresh-p0", "P0"],
      ["work/aged-p1", "P1"],
      ["work/aged-p2", "P2"],
      ["work/aged-p3", "P3"],
      ["work/fresh-p1", "P1"],
    ] as const) {
      observeAppTaskIntent(config, {
        intent: { ...intent("achieve"), id, priority },
        appAgent: "app-owner",
      });
    }

    const nowMs = Date.now();
    for (const [id, ageMinutes] of [
      ["work/aged-p1", 5],
      ["work/aged-p2", 10],
      ["work/aged-p3", 15],
    ] as const) {
      mutateTaskResourceFixture(config, id, (resource) => {
        resource.status.updatedAt = new Date(nowMs - ageMinutes * 60_000 - 1_000).toISOString();
      });
    }

    const entries = listRunnableAppTaskQueueEntries(config);
    expect(entries.filter((entry) => entry.taskId.startsWith("work/aged-"))).toEqual([
      { taskId: "work/aged-p3", options: { priority: "P1", lane: "normal" } },
      { taskId: "work/aged-p2", options: { priority: "P1", lane: "normal" } },
      { taskId: "work/aged-p1", options: { priority: "P1", lane: "normal" } },
    ]);
    expect(entries.find((entry) => entry.taskId === "work/fresh-p1")?.options.priority).toBe("P1");
  });

  it("uses persisted age when enqueuing selected task IDs", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/aged-p2", priority: "P2" },
      appAgent: "app-owner",
    });
    mutateTaskResourceFixture(config, "work/aged-p2", (resource) => {
      resource.status.updatedAt = new Date(Date.now() - 10 * 60_000 - 1_000).toISOString();
    });

    expect(appTaskQueueEntries(state.config, ["work/aged-p2"])).toEqual([
      { taskId: "work/aged-p2", options: { priority: "P1", lane: "normal" } },
    ]);
  });

  it("ages triggered work from when it became ready instead of its old waiting status", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/fresh-trigger-p2", priority: "P2" },
      appAgent: "app-owner",
      trigger: { type: "repo.ref.changed", data: { ref: "origin/dev" } },
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/aged-trigger-p2", priority: "P2" },
      appAgent: "app-owner",
      trigger: { type: "repo.ref.changed", data: { ref: "origin/dev" } },
    });

    const oldStatus = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const oldTrigger = new Date(Date.now() - 10 * 60_000 - 1_000).toISOString();
    for (const id of ["work/fresh-trigger-p2", "work/aged-trigger-p2"]) {
      mutateTaskResourceFixture(config, id, (resource, trigger) => {
        resource.status.updatedAt = oldStatus;
        if (id === "work/aged-trigger-p2") {
          if (!trigger) throw new Error("expected persisted trigger");
          trigger.observedAt = oldTrigger;
        }
      });
    }

    const entries = listRunnableAppTaskQueueEntries(config);
    expect(entries.find((entry) => entry.taskId === "work/fresh-trigger-p2")).toEqual({
      taskId: "work/fresh-trigger-p2",
      options: { priority: "P2", lane: "normal" },
    });
    expect(entries.find((entry) => entry.taskId === "work/aged-trigger-p2")).toEqual({
      taskId: "work/aged-trigger-p2",
      options: { priority: "P1", lane: "normal" },
    });
  });

  it("schedules an unresolved direct project comment before autonomous priority backlog", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/autonomous-p0", priority: "P0" },
      appAgent: "app-owner",
      trigger: {
        type: "pipeline-run.state",
        data: { runId: "99", status: "completed", result: "succeeded" },
      },
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review", priority: "P1" },
      appAgent: "app-owner",
      trigger: {
        type: "project.comment.created",
        eventId: 42,
        source: "human",
        data: { comment: "Review current project direction" },
      },
    });

    expect(listRunnableAppTaskIds(config).slice(0, 2)).toEqual(["runtime/owner-review", "work/autonomous-p0"]);
    const entries = listRunnableAppTaskQueueEntries(config).slice(0, 2);
    expect(entries).toEqual([
      { taskId: "runtime/owner-review", options: { priority: "P0", lane: "human" } },
      { taskId: "work/autonomous-p0", options: { priority: "P0", lane: "normal" } },
    ]);
    const queue = new AppTaskQueue(1);
    for (const entry of entries) queue.enqueue(entry.taskId, entry.options);
    expect(queue.take()).toBe("runtime/owner-review");
  });

  it("keeps an unresolved human task control ahead of a later automated wake", () => {
    const state = fixture();
    const { config } = state;
    const ownerReview = { ...intent("maintain"), id: "runtime/owner-review", priority: "P1" as const };
    const humanComment = {
      type: "project.comment.created",
      eventId: 5157130,
      source: "human",
      data: { comment: "Finish all 79 source lanes and all 82 mapped specs" },
    };

    observeAppTaskIntent(config, {
      intent: ownerReview,
      appAgent: "app-owner",
      trigger: humanComment,
    });
    recordAppTaskTrigger(config, ownerReview.id, {
      type: "metric.breach",
      eventId: 5157466,
      source: "runtime-metrics",
      reason: "master-validation-product-issue",
      data: { specId: "spec.network-isolated.byo-acr-outbound-none" },
    });

    expect(readAppTaskTrigger(config, ownerReview.id)).toEqual(humanComment);
    expect(appTaskQueueEntries(config, [ownerReview.id])).toEqual([
      { taskId: ownerReview.id, options: { priority: "P0", lane: "human" } },
    ]);
    expect(listRunnableAppTaskIds(config)[0]).toBe(ownerReview.id);
  });

  it("retains trusted human scheduling origin on the admitted task resource", () => {
    const state = fixture();
    const { config } = state;
    const humanTask = { ...intent("achieve"), id: "conversation/request-42", priority: "P0" as const };
    observeAppTaskIntent(config, {
      intent: humanTask,
      appAgent: "app-owner",
      trigger: {
        type: "app.task.requested",
        source: "human",
        data: {
          request: { id: "request-42", source: { kind: "human", id: "message-42" } },
        },
      },
    });

    expect(readTaskSnapshot(config).resources?.[humanTask.id]?.status.lane).toBe("human");
    expect(appTaskQueueEntries(state.config, [humanTask.id])).toEqual([
      {
        taskId: humanTask.id,
        options: { priority: "P0", lane: "human" },
      },
    ]);
  });

  it("schedules untriggered P0 before triggered P2 (priority over trigger presence)", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/new-p0", priority: "P0" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/live-result-p2", priority: "P2" },
      appAgent: "app-owner",
      trigger: {
        type: "pipeline-run.state",
        data: { runId: "42", status: "completed", result: "succeeded" },
      },
    });

    expect(listRunnableAppTaskIds(config).slice(0, 2)).toEqual(["work/new-p0", "work/live-result-p2"]);
    expect(listRunnableAppTaskQueueEntries(config).slice(0, 2)).toEqual([
      {
        taskId: "work/new-p0",
        options: { priority: "P0", lane: "normal" },
      },
      {
        taskId: "work/live-result-p2",
        options: { priority: "P2", lane: "normal" },
      },
    ]);
  });

  it("uses trigger as tiebreak within same priority", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/untriggered-p1", priority: "P1" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/triggered-p1", priority: "P1" },
      appAgent: "app-owner",
      trigger: {
        type: "repo.ref.changed",
        data: { ref: "origin/dev" },
      },
    });

    const ids = listRunnableAppTaskIds(config);
    const triggeredIdx = ids.indexOf("work/triggered-p1");
    const untriggeredIdx = ids.indexOf("work/untriggered-p1");
    expect(triggeredIdx).toBeLessThan(untriggeredIdx);
  });

  it("P0 untriggered beats stream of triggered P1s (priority inversion regression)", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "ops/critical-p0", priority: "P0" },
      appAgent: "app-owner",
    });
    for (let i = 0; i < 5; i++) {
      observeAppTaskIntent(config, {
        intent: { ...intent("achieve"), id: `work/triggered-p1-${i}`, priority: "P1" },
        appAgent: "app-owner",
        trigger: {
          type: "repo.ref.changed",
          data: { ref: `origin/cleanup-${i}` },
        },
      });
    }
    // Also add a direct comment task to confirm it still wins over everything
    observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), id: "runtime/comment-task", priority: "P1" },
      appAgent: "app-owner",
      trigger: {
        type: "project.comment.created",
        data: { comment: "Please review" },
      },
    });

    const ids = listRunnableAppTaskIds(config);
    // Direct comment wins first
    expect(ids[0]).toBe("runtime/comment-task");
    // P0 is next, before all triggered P1s
    expect(ids[1]).toBe("ops/critical-p0");
    // All triggered P1s come after
    for (let i = 0; i < 5; i++) {
      expect(ids.indexOf(`work/triggered-p1-${i}`)).toBeGreaterThan(1);
    }
  });

  it("keeps triggered work behind unresolved dependencies during passive resync", () => {
    const state = fixture();
    const { config } = state;
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/dependency" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: {
        ...intent("achieve"),
        id: "work/dependent",
        dependsOn: ["work/dependency"],
      },
      appAgent: "app-owner",
      trigger: { type: "pipeline.completed", data: { runId: "42" } },
    });

    expect(listRunnableAppTaskIds(config)).toContain("work/dependency");
    expect(listRunnableAppTaskIds(config)).not.toContain("work/dependent");
    expect(readAppTaskTrigger(config, "work/dependent")).toEqual({
      type: "pipeline.completed",
      data: { runId: "42" },
    });
  });

  it("persists the exact Condition observation as the next attempt trigger", () => {
    const state = fixture();
    const { config } = state;
    const waitingIntent = {
      ...intent(),
      id: "work/condition-trigger",
      outcome: "Continue after the exact session observation",
      category: "domain",
    };
    observeAppTaskIntent(config, { intent: waitingIntent, appAgent: "app-owner" });
    const first = claimObservedAppTask(config, {
      taskId: waitingIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected initial claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for session",
      conditions: [
        {
          id: "session-terminal:s_condition",
          type: "session.end",
          subject: "session:s_condition",
          expected: "done",
        },
      ],
    });

    const event = {
      type: "session.end",
      sessionId: "s_condition",
      status: "done",
      evidence: "session completed cleanly",
    };
    const [wake] = trackAppTaskConditionEvent(config, event);
    expect(wake?.taskId).toBe(waitingIntent.id);

    expect(readAppTaskTrigger(config, waitingIntent.id)).toEqual(event);
    expect(appTaskQueueEntries(config, [waitingIntent.id])).toEqual([
      {
        taskId: waitingIntent.id,
        options: { priority: "P0", lane: "normal" },
      },
    ]);
    expect(readAppTaskIntent(config, waitingIntent.id)?.category).toBe("domain");
    const resumed = claimObservedAppTask(config, {
      taskId: waitingIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    expect(resumed.intent.category).toBe("domain");
    expect(resumed.trigger).toEqual(event);
    const persistedAttempt = readTaskSnapshot(config).attempts?.[resumed.attemptId];
    expect(persistedAttempt?.events?.[0]?.event).toEqual(event);
    expect(persistedAttempt?.trigger).toBeUndefined();
  });

  it("preflights Condition routes without mutation and admits only selected exact tasks", () => {
    const state = fixture();
    const { config } = state;
    for (const taskId of ["work/first", "work/second"]) {
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: taskId },
        appAgent: "app-owner",
      });
      const claim = claimObservedAppTask(config, {
        taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (claim.kind !== "claimed") throw new Error(`expected claim for ${taskId}`);
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting for shared observation",
        conditions: [
          {
            id: `shared-ready:${taskId}`,
            type: "provider.state",
            subject: "provider:shared",
            expected: "ready",
          },
        ],
      });
    }
    const event = { type: "provider.state", provider: "shared", state: "ready" };

    expect(matchingAppTaskConditionTaskIds(config, event)).toEqual(["work/first", "work/second"]);
    expect(readAppTaskTrigger(config, "work/first")).toBeUndefined();
    expect(readAppTaskTrigger(config, "work/second")).toBeUndefined();
    expect(matchingAppTaskConditionTaskIds(config, event, ["work/first"])).toEqual(["work/first"]);

    expect(trackAppTaskConditionEventForTasks(config, event, ["work/first"])).toEqual([
      { conditionId: "shared-ready:work/first", taskId: "work/first" },
    ]);
    expect(readAppTaskTrigger(config, "work/first")).toEqual(event);
    expect(readAppTaskTrigger(config, "work/second")).toBeUndefined();
    expect(readTaskSnapshot(config).conditions?.["shared-ready:work/second"]).toMatchObject({
      status: { state: "unknown" },
    });
  });

  it("claims the current canonical spec after a stale reader observed an older version", () => {
    const state = fixture();
    const { config } = state;
    const original = intent("maintain");
    observeAppTaskIntent(config, { intent: original, appAgent: "app-owner" });
    const staleCopy = readAppTaskIntent(config, original.id);
    if (!staleCopy) throw new Error("expected original intent");

    const current = {
      ...original,
      outcome: "Keep the current pipeline and its newer contract observable",
      acceptance: ["The newer contract is observed"],
    };
    observeAppTaskIntent(config, { intent: current, appAgent: "app-owner" });
    expect(recordAppTaskTrigger(config, original.id, { type: "pipeline.changed", revision: 2 })).toEqual({
      kind: "recorded",
    });

    const claim = claimObservedAppTask(config, {
      taskId: original.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected current claim");
    expect(claim.intent.outcome).toBe(current.outcome);
    expect(claim.intent.outcome).not.toBe(staleCopy.outcome);
    expect(claim.generation).toBe(2);
    expect(claim.trigger).toEqual({ type: "pipeline.changed", revision: 2 });
  });

  it("preserves an explicit retry over lower-priority task wakes", () => {
    const state = fixture();
    const { config } = state;
    const monitor = intent("maintain");
    observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
    });
    const retry = {
      type: "gym.improvement.requested",
      source: "web-ui",
      reason: "retry-candidate-verification",
      candidateFingerprint: "sha256:candidate",
    };
    expect(recordAppTaskTrigger(config, monitor.id, retry)).toEqual({
      kind: "recorded",
    });

    recordAppTaskTrigger(config, monitor.id, {
      type: "metric.breach",
      source: "agent:tech-lead",
      metricId: "may.failure-rate",
    });
    recordAppTaskTrigger(config, monitor.id, {
      type: "gym.improvement.requested",
      source: "agent:app-owner",
      params: { reason: "curriculum-continue" },
    });

    expect(readAppTaskTrigger(config, monitor.id)).toEqual(retry);
  });

  it("returns trigger snapshots that cannot mutate a long-lived cached task tree", () => {
    const f = fixture();
    const { config } = f;
    cacheTaskSnapshots(config);
    const monitor = intent("maintain");
    observeAppTaskIntent(config, { intent: monitor, appAgent: "app-owner" });
    recordAppTaskTrigger(config, monitor.id, {
      type: "metric.breach",
      data: { metricId: "may.failure-rate" },
    });

    const trigger = readAppTaskTrigger(config, monitor.id);
    const pending = readPendingAppTaskTrigger(config, monitor.id);
    if (!trigger || !pending) throw new Error("expected trigger snapshots");
    (trigger.data as Record<string, unknown>).metricId = "mutated-trigger";
    (pending.data as Record<string, unknown>).metricId = "mutated-pending";

    expect(readAppTaskTrigger(config, monitor.id)).toEqual({
      type: "metric.breach",
      data: { metricId: "may.failure-rate" },
    });
    expect(readPendingAppTaskTrigger(config, monitor.id)).toEqual({
      type: "metric.breach",
      data: { metricId: "may.failure-rate" },
    });
  });

  it("keeps passive checks asleep but reconsiders a waiting task for fresh routed input", () => {
    const { config } = fixture();
    const monitor = intent("maintain");

    observeAppTaskIntent(config, { intent: monitor, appAgent: "app-owner" });
    const firstClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, firstClaim, {
      disposition: "waiting",
      summary: "waiting for old condition",
      conditions: [
        {
          id: "external-run-finished",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });

    expect(
      claimObservedAppTask(config, {
        taskId: monitor.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "passive-resync",
      }),
    ).toMatchObject({
      kind: "waiting",
      conditionIds: ["external-run-finished"],
    });

    const trigger = {
      type: "project.task.tick",
      data: {
        project: "sample",
        taskId: monitor.id,
        action: "spec-loop",
      },
    };
    observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      trigger,
    });

    const secondClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(secondClaim).toMatchObject({ kind: "claimed", taskId: monitor.id });
    if (secondClaim.kind !== "claimed") throw new Error("expected second claim");

    const persistedAttempt = readTaskSnapshot(config).attempts?.[secondClaim.attemptId];
    expect(persistedAttempt).toMatchObject({
      state: "running",
      events: [{ event: trigger }],
    });
    expect(persistedAttempt?.trigger).toBeUndefined();
    expect(readTaskSnapshot(config).resources[monitor.id].status.conditionIds).toEqual(["external-run-finished"]);
  });

  it("wakes a waiting task for explicit human task control", () => {
    const { config } = fixture();
    const monitor = intent("maintain");

    observeAppTaskIntent(config, { intent: monitor, appAgent: "app-owner" });
    const firstClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, firstClaim, {
      disposition: "waiting",
      summary: "waiting for an older external condition",
      conditions: [
        {
          id: "older-external-run-finished",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });

    const comment = {
      type: "project.comment.created",
      eventId: 42,
      data: { project: "sample", comment: "Verify the missing live proof" },
    };
    observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      trigger: comment,
    });

    const ownerClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(ownerClaim).toMatchObject({ kind: "claimed", taskId: monitor.id, trigger: comment });
    expect(readTaskSnapshot(config).resources[monitor.id].status.conditionIds).toEqual(["older-external-run-finished"]);
  });

  it.each(["app.input.requested", "app.task.requested"])(
    "reconsiders a waiting task for fresh %s input without deleting its condition",
    (type) => {
      const { config } = fixture();
      const monitor = intent("maintain");

      observeAppTaskIntent(config, { intent: monitor, appAgent: "app-owner" });
      const firstClaim = claimObservedAppTask(config, {
        taskId: monitor.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (firstClaim.kind !== "claimed") throw new Error("expected first claim");

      deferAppTask(config, firstClaim, {
        disposition: "waiting",
        summary: "waiting for an earlier decision",
        conditions: [
          {
            id: "earlier-decision",
            type: "project.approval.resolved",
            subject: "approval:old",
            expected: "approved",
          },
        ],
      });

      const inputEvent = {
        type,
        eventId: 43,
        data: { appId: "sample", input: { kind: "feedback", data: { message: "The wait is no longer valid" } } },
      };
      observeAppTaskIntent(config, {
        intent: monitor,
        appAgent: "app-owner",
        trigger: inputEvent,
      });

      const claim = claimObservedAppTask(config, {
        taskId: monitor.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      expect(claim).toMatchObject({ kind: "claimed", taskId: monitor.id, trigger: inputEvent });
      expect(readTaskSnapshot(config).resources[monitor.id].status.conditionIds).toEqual(["earlier-decision"]);
    },
  );

  it("invalidates an old attempt when desired state changes generation", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");

    const changed = observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), input: { sessionId: "session-2" } },
      appAgent: "app-owner",
    });
    expect(changed).toMatchObject({ kind: "observed", generation: 2, changed: true });
    const changedTree = readTaskSnapshot(config);
    expect(changedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { generation: 2, resourceVersion: 3 },
      status: { phase: "pending" },
    });
    expect(changedTree.attempts?.[first.attemptId]).toMatchObject({
      state: "interrupted",
      summary: "Task specification changed while the attempt was active",
    });
    expect(completeAppTask(config, first, { summary: "late generation one result" }).status).toBe("stale");
  });

  it("detaches prior-generation Conditions and triggers when desired state changes", () => {
    const state = fixture();
    const { config } = state;
    const monitor = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: monitor,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for the prior generation",
      conditions: [
        {
          id: "prior-generation-run",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });
    expect(
      recordAppTaskTrigger(config, monitor.id, {
        type: "prior-generation.trigger",
        data: { overrideWait: true },
      }),
    ).toEqual({ kind: "recorded" });

    expect(
      observeAppTaskIntent(config, {
        intent: { ...monitor, input: { sessionId: "session-2" } },
        appAgent: "app-owner",
      }),
    ).toMatchObject({ kind: "observed", generation: 2, changed: true });

    const changedTree = readTaskSnapshot(config);
    expect(changedTree.resources?.[monitor.id]).toMatchObject({
      metadata: { generation: 2 },
      status: { phase: "pending" },
    });
    expect(changedTree.resources?.[monitor.id]?.status.conditionIds ?? []).toEqual([]);
    expect(changedTree.conditions?.["prior-generation-run"]).toBeUndefined();
    expect(changedTree.taskTriggers?.[monitor.id]).toBeUndefined();
    expect(listRunnableAppTaskIds(config)).toContain(monitor.id);
  });

  it("claims generation drift before honoring a stale waiting Condition", () => {
    const state = fixture();
    const { config } = state;
    const monitor = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: monitor,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for a stale observation",
      conditions: [
        {
          id: "stale-run",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });
    mutateTaskResourceFixture(config, monitor.id, (resource) => {
      resource.metadata.generation = 2;
    });

    expect(listRunnableAppTaskIds(config)).toContain(monitor.id);
    const claim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "passive-resync",
    });
    expect(claim).toMatchObject({ kind: "claimed", taskId: monitor.id, generation: 2 });
    const claimedTree = readTaskSnapshot(config);
    expect(claimedTree.conditions?.["stale-run"]).toBeUndefined();
    expect(claimedTree.resources?.[monitor.id]?.status.conditionIds ?? []).toEqual([]);
  });

  it("keeps an active generation when only containment, category, or priority changes", () => {
    const { config } = fixture();
    const original = { ...intent("maintain"), category: "monitor", priority: "P2" as const };
    const claim = declareAndClaimTask(config, {
      intent: original,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const observed = observeAppTaskIntent(config, {
      intent: { ...original, parentId: "root", category: "operations", priority: "P0" },
      appAgent: "app-owner",
    });
    expect(observed).toEqual({ kind: "observed", taskId: claim.taskId, generation: 1, changed: true });

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      metadata: { generation: 1, resourceVersion: claim.resourceVersion + 1 },
      spec: { parentId: "root", category: "operations", priority: "P0" },
      status: { phase: "running", currentAttemptId: claim.attemptId },
    });
    expect(tree.resources?.[claim.taskId]?.spec.parentId).toBe("root");
    expect(completeAppTask(config, claim, { summary: "same execution completed" }).status).toBe("applied");
  });

  it("advances generation when a parent move changes the effective agent", () => {
    const { config } = fixture("operations-owner");
    const original = { ...intent("maintain"), parentId: "operations" };
    const claim = declareAndClaimTask(config, {
      intent: original,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(claim.agent).toBe("operations-owner");

    const observed = observeAppTaskIntent(config, {
      intent: { ...original, parentId: "root" },
      appAgent: "app-owner",
    });
    expect(observed).toMatchObject({ kind: "observed", generation: 2, changed: true });
    expect(readTaskSnapshot(config).attempts?.[claim.attemptId]).toMatchObject({ state: "interrupted" });
  });

  it("inherits agent selection, claims one attempt, and deduplicates concurrent wakes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(first).toMatchObject({ kind: "claimed", agent: "branch-owner", generation: 1 });

    const duplicate = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(duplicate).toMatchObject({ kind: "busy", taskId: "evaluate:session-1" });

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.["evaluate:session-1"]).toMatchObject({
      metadata: { generation: 1 },
      spec: { workflow: "known-workflow" },
      status: { phase: "running" },
    });
    expect(first.agent).toBe("branch-owner");
  });

  it("moves an unresolved agent to attention before claiming an attempt", () => {
    const { config } = fixture();
    const result = declareAndClaimTask(config, {
      intent: { ...intent(), owner: "human" },
      appAgent: "app-owner",
      handler: "auto",
      trigger: { type: "project.comment.created", data: { comment: "Please retry" } },
      isAgentRunnable: (agent) => agent !== "human",
    });

    expect(result).toMatchObject({
      kind: "attention",
      summary: "Resolved agent human is not a runnable agent",
    });
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.["evaluate:session-1"]).toMatchObject({
      status: {
        phase: "attention",
        summary: "Resolved agent human is not a runnable agent",
      },
    });
    expect(tree.resources?.["evaluate:session-1"].status.currentAttemptId).toBeUndefined();
    expect(tree.taskTriggers?.["evaluate:session-1"]).toBeUndefined();
    expect(Object.values(tree.attempts ?? {}).filter((attempt) => attempt.taskId === "evaluate:session-1")).toEqual([]);
  });

  it("absorbs achieved work into a completion receipt and deduplicates redelivery", () => {
    const { config, appDir } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeAppTask(config, claim, {
        summary: "session evaluated",
        response: "The session meets the requested quality bar.",
      }).status,
    ).toBe("applied");
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]).toBeUndefined();
    expect(tree.receipts?.[claim.taskId]).toMatchObject({
      metadata: { id: claim.taskId, generation: 1, resourceVersion: 1 },
      handler: "workflow:known-workflow",
      summary: "session evaluated",
      response: "The session meets the requested quality bar.",
      outcome: "Evaluate session 1",
      workflow: "known-workflow",
      evidence: [],
      acceptanceBasis: { method: "workflow-contract", evidence: [] },
      failureFingerprints: [],
    });
    expect(tree.attempts?.[claim.attemptId]).toMatchObject({
      state: "completed",
      summary: "session evaluated",
    });

    expect(
      declareAndClaimTask(config, {
        intent: intent(),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", taskId: claim.taskId, generation: 1 });
    expect(readFileSync(join(appDir, "tasks", "seed.json"), "utf8")).not.toContain("evaluate:session-1");
  });

  it("keeps explicitly closed maintain work terminal under repeated observer admission", () => {
    const { config } = fixture();
    const standing = intent("maintain");
    observeAppTaskIntent(config, { intent: standing, appAgent: "app-owner" });
    const staleResource = config.resourceStore.readTask(standing.id);
    if (!staleResource) throw new Error("expected standing resource");
    const controller = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (controller.kind !== "claimed") throw new Error("expected controller claim");
    expect(
      completeAppTask(config, controller, {
        summary: "Stopped the standing work",
        evidence: ["The exact standing task was explicitly selected for closure"],
        actions: [{ kind: "close-task", taskId: standing.id, expectedGeneration: 1, summary: "Explicitly stopped" }],
      }).status,
    ).toBe("applied");
    const receipt = config.resourceStore.readReceipt(standing.id);
    const attemptCount = Object.keys(readTaskSnapshot(config).attempts ?? {}).length;

    for (let index = 0; index < 3; index += 1) {
      expect(
        observeAppTaskIntent(config, {
          intent: standing,
          appAgent: "app-owner",
          trigger: { eventId: index + 100, type: "pipeline.observed" },
        }),
      ).toMatchObject({ kind: "completed", taskId: standing.id, generation: 1 });
      expect(listRunnableAppTaskIds(config)).not.toContain(standing.id);
      expect(config.resourceStore.listRecoveryCandidates().items.map((item) => item.taskId)).not.toContain(standing.id);
    }
    expect(config.resourceStore.readTask(standing.id)).toBeNull();
    expect(config.resourceStore.readReceipt(standing.id)).toEqual(receipt);
    expect(Object.keys(readTaskSnapshot(config).attempts ?? {})).toHaveLength(attemptCount);

    expect(
      config.resourceStore.commit({
        fences: [],
        expectMissingTaskIds: [standing.id],
        tasks: [{ resource: staleResource, ready: true }],
      }),
    ).toBe(true);
    expect(
      claimObservedAppTask(config, {
        taskId: standing.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", generation: 1 });
    expect(config.resourceStore.readTask(standing.id)).toBeNull();
    expect(config.resourceStore.readReceipt(standing.id)).toEqual(receipt);

    expect(
      observeAppTaskIntent(config, {
        intent: { ...standing, outcome: "Observe a newly authorized pipeline contract" },
        appAgent: "app-owner",
      }),
    ).toMatchObject({ kind: "observed", generation: 2 });
    expect(readRuntimeTaskView({ taskStateConfig: config }, standing.id)).toMatchObject({
      generation: 2,
      status: "pending",
    });
  });

  it("prunes a stale live duplicate when a matching achieve receipt already exists", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, claim, { summary: "session evaluated" });

    const staleResource = {
      metadata: { id: taskIntent.id, generation: claim.generation, resourceVersion: 2 },
      spec: {
        parentId: taskIntent.parentId,
        outcome: taskIntent.outcome,
        acceptance: [...taskIntent.acceptance],
        mode: taskIntent.mode,
        owner: "branch-owner",
        workflow: taskIntent.workflow,
        outputs: [...(taskIntent.outputs ?? [])],
      },
      status: {
        observedGeneration: claim.generation,
        phase: "attention",
        updatedAt: "2026-07-20T00:00:00.000Z",
        summary: "stale duplicate attention",
        conditionIds: [],
      },
    };
    expect(
      config.resourceStore.commit({
        fences: [],
        expectMissingTaskIds: [taskIntent.id],
        tasks: [{ resource: staleResource, ready: false }],
      }),
    ).toBe(true);

    expect(
      observeAppTaskIntent(config, {
        intent: taskIntent,
        appAgent: "app-owner",
      }),
    ).toMatchObject({ kind: "completed", taskId: taskIntent.id, generation: claim.generation });

    const repaired = readTaskSnapshot(config);
    expect(repaired.resources?.[taskIntent.id]).toBeUndefined();
    expect(repaired.receipts?.[taskIntent.id]).toBeDefined();
  });

  it("does not orphan live children while pruning a stale receipt duplicate", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, claim, { summary: "session evaluated" });

    const staleParent = {
      metadata: { id: taskIntent.id, generation: claim.generation, resourceVersion: 2 },
      spec: {
        parentId: taskIntent.parentId,
        outcome: taskIntent.outcome,
        acceptance: [...taskIntent.acceptance],
        mode: taskIntent.mode,
        owner: "branch-owner",
        workflow: taskIntent.workflow,
        outputs: [...(taskIntent.outputs ?? [])],
      },
      status: {
        observedGeneration: claim.generation,
        phase: "attention",
        updatedAt: "2026-07-20T00:00:00.000Z",
        summary: "stale duplicate attention",
        conditionIds: [],
      },
    };
    const liveChild = {
      metadata: { id: "work/live-child", generation: 1, resourceVersion: 1 },
      spec: {
        parentId: taskIntent.id,
        outcome: "Finish live child work",
        acceptance: ["Live child work is complete"],
        mode: "achieve",
        owner: "branch-owner",
        outputs: [],
      },
      status: {
        observedGeneration: 0,
        phase: "pending",
        updatedAt: "2026-07-20T00:00:00.000Z",
        summary: "Live child is still pending",
        conditionIds: [],
      },
    };
    expect(
      config.resourceStore.commit({
        fences: [],
        expectMissingTaskIds: [taskIntent.id, liveChild.metadata.id],
        tasks: [
          { resource: staleParent, ready: false },
          { resource: liveChild, ready: true },
        ],
      }),
    ).toBe(true);

    expect(() =>
      observeAppTaskIntent(config, {
        intent: taskIntent,
        appAgent: "app-owner",
      }),
    ).toThrow("cannot be pruned while it has live children: work/live-child");

    const preserved = readTaskSnapshot(config);
    expect(preserved.resources?.[taskIntent.id]).toBeDefined();
    expect(preserved.resources?.["work/live-child"]?.spec.parentId).toBe(taskIntent.id);
  });

  it("allows cancellation of revised work while retaining the historical receipt", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, { intent: intent(), appAgent: "app-owner", handler: "agent" });
    if (first.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, first, { summary: "original work completed" });
    const receipt = config.resourceStore.readReceipt(first.taskId);
    observeAppTaskIntent(config, {
      intent: { ...intent(), outcome: "Newly requested work" },
      appAgent: "app-owner",
    });
    const task = config.resourceStore.readTask(first.taskId)!;
    expect(task.metadata.generation).toBe(2);
    expect(
      cancelAppTask(config, {
        appId: "sample",
        taskId: first.taskId,
        expectedGeneration: 2,
        expectedResourceVersion: task.metadata.resourceVersion,
        reason: "No longer needed",
      }).applied,
    ).toBeTrue();
    expect(config.resourceStore.readReceipt(first.taskId)).toEqual(receipt);
    expect(config.resourceStore.readCancellation(first.taskId)?.generation).toBe(2);
    expect(listRunnableAppTaskIds(config)).not.toContain(first.taskId);
  });

  it("creates a new achieve generation when a completed task specification changes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, first, { summary: "first shape completed" });

    expect(
      declareAndClaimTask(config, {
        intent: {
          ...intent(),
          outcome: "Evaluate session 1 with the revised policy",
        },
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "claimed", generation: 2 });
  });

  it("retains minimal completion receipts needed for durable deduplication", () => {
    const { config } = fixture();
    const tree = readTaskSnapshot(config);
    tree.receipts = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => {
        const id = `completed-${index}`;
        return [
          id,
          {
            metadata: { id, generation: 1, resourceVersion: 1 },
            specHash: `hash-${index}`,
            parentId: "operations",
            outcome: `Completed outcome ${index}`,
            acceptance: ["Completed"],
            owner: "app-owner",
            handler: "agent:app-owner",
            summary: "Completed",
            evidence: [],
            acceptanceBasis: { method: "agent-judgment", evidence: [] },
            failureFingerprints: [],
            completedAt: new Date(index).toISOString(),
          },
        ];
      }),
    );
    const fence = tree.resources?.["categorized-task"];
    if (!fence) throw new Error("expected receipt fixture fence");
    expect(
      config.resourceStore.commit({
        fences: [{ taskId: fence.metadata.id, resourceVersion: fence.metadata.resourceVersion }],
        receipts: Object.values(tree.receipts ?? {}),
      }),
    ).toBe(true);

    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, claim, { summary: "new completion" });

    const completed = readTaskSnapshot(config);
    expect(Object.keys(completed.receipts ?? {})).toHaveLength(1_002);
    expect(completed.receipts?.["completed-0"]).toBeTruthy();
    expect(completed.receipts?.[claim.taskId]).toBeTruthy();
  });

  it("keeps reconciliation child history small and decision-ready", () => {
    const f = fixture();
    const { config } = f;
    const tree = readTaskSnapshot(config);
    const longText = "x".repeat(700);
    tree.receipts = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const id = `child-${index}`;
        return [
          id,
          {
            metadata: { id, generation: 1, resourceVersion: 1 },
            specHash: `hash-${index}`,
            parentId: "pipeline-monitor",
            outcome: longText,
            acceptance: ["Completed"],
            owner: "app-owner",
            handler: "agent:app-owner",
            summary: longText,
            evidence: Array.from({ length: 6 }, () => longText),
            acceptanceBasis: { method: "agent-judgment", evidence: [] },
            failureFingerprints: [],
            completedAt: new Date(index).toISOString(),
          },
        ];
      }),
    );
    const fence = tree.resources?.["categorized-task"];
    if (!fence) throw new Error("expected child-context fixture fence");
    expect(
      config.resourceStore.commit({
        fences: [{ taskId: fence.metadata.id, resourceVersion: fence.metadata.resourceVersion }],
        receipts: Object.values(tree.receipts ?? {}),
      }),
    ).toBe(true);

    const resource = f;
    const context = readAppTaskChildContext(resource.config, "pipeline-monitor");

    expect(context.completed).toHaveLength(8);
    expect(context.completed.map(({ taskId }) => taskId)).toEqual([
      "child-11",
      "child-10",
      "child-9",
      "child-8",
      "child-7",
      "child-6",
      "child-5",
      "child-4",
    ]);
    expect(context.completed[0]?.outcome.length).toBeLessThanOrEqual(512);
    expect(context.completed[0]?.summary.length).toBeLessThanOrEqual(512);
    expect(context.completed[0]?.evidence).toHaveLength(4);
    expect(context.completed[0]?.evidence[0]?.length).toBeLessThanOrEqual(512);
  });

  it("keeps child readiness aware of running tasks outside the parent graph", () => {
    const { config } = fixture();
    config.maxConcurrent = 1;
    const running = {
      ...intent(),
      id: "unrelated-running-task",
      outcome: "Keep unrelated work running",
    };
    const claim = declareAndClaimTask(config, {
      intent: running,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    observeAppTaskIntent(config, {
      intent: {
        ...intent(),
        id: "parent-task",
        outcome: "Coordinate child work",
      },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: {
        ...intent(),
        id: "pending-child-task",
        parentId: "parent-task",
        outcome: "Complete the child work",
      },
      appAgent: "app-owner",
    });

    const context = readAppTaskChildContext(config, "parent-task");

    expect(context.live).toHaveLength(1);
    expect(context.live[0]).toMatchObject({
      taskId: "pending-child-task",
      readiness: { state: "capacity-blocked", relatedTaskIds: [] },
    });
  });

  it("supplies a bounded App-wide live snapshot without the reviewing task", () => {
    const f = fixture();
    const { config } = f;
    observeAppTaskIntent(config, {
      intent: {
        id: "old-indexed-task",
        parentId: "operations",
        outcome: "Keep one older indexed task visible",
        acceptance: ["The indexed task remains represented"],
        mode: "achieve",
        owner: "app-owner",
      },
      appAgent: "app-owner",
    });
    for (let index = 0; index < 65; index += 1) {
      observeAppTaskIntent(config, {
        intent: {
          id: `snapshot-task-${String(index).padStart(2, "0")}`,
          parentId: index === 0 ? "categorized-task" : "operations",
          outcome: `Review snapshot task ${index}`,
          acceptance: [`The task converges ${"a".repeat(2_000)}`],
          mode: "achieve",
          owner: "app-owner",
          priority: index === 0 ? "P0" : "P2",
          category: index === 0 ? "focus_plan" : "domain",
          input: { index, exactPrivateDetail: `private-${index}-${"x".repeat(4_000)}` },
        },
        appAgent: "app-owner",
      });
    }

    const resource = f;
    const snapshot = readAppTaskLiveSnapshot(resource.config, "snapshot-task-64");

    expect(snapshot.truncated).toBe(true);
    expect(snapshot.live).toHaveLength(64);
    expect(snapshot.live.some(({ taskId }) => taskId === "snapshot-task-64")).toBe(false);
    expect(snapshot.live.some(({ taskId }) => taskId === "categorized-task")).toBe(false);
    expect(snapshot.live.find(({ taskId }) => taskId === "snapshot-task-00")).toMatchObject({
      category: "focus_plan",
      priority: "P0",
      readiness: { state: "ready", relatedTaskIds: [] },
    });
    expect(JSON.stringify(snapshot)).not.toContain("exactPrivateDetail");
    expect(Buffer.byteLength(JSON.stringify(snapshot), "utf8")).toBeLessThan(40_000);
  });

  it("keeps bounded live snapshot readiness aware of older running tasks", () => {
    const { config } = fixture();
    config.maxConcurrent = 1;
    observeAppTaskIntent(config, {
      intent: {
        id: "older-running-task",
        parentId: "operations",
        outcome: "Keep one older task running",
        acceptance: ["The running task completes"],
        mode: "achieve",
        owner: "app-owner",
      },
      appAgent: "app-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "older-running-task",
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim.kind).toBe("claimed");
    mutateTaskResourceFixture(config, "older-running-task", (resource) => {
      resource.status.updatedAt = "2000-01-01T00:00:00.000Z";
    });

    for (let index = 0; index < 66; index += 1) {
      observeAppTaskIntent(config, {
        intent: {
          id: `newer-pending-task-${String(index).padStart(2, "0")}`,
          parentId: "operations",
          outcome: `Review newer task ${index}`,
          acceptance: ["The newer task converges"],
          mode: "achieve",
          owner: "app-owner",
        },
        appAgent: "app-owner",
      });
    }

    const snapshot = readAppTaskLiveSnapshot(config, "newer-pending-task-65");

    expect(snapshot.truncated).toBe(true);
    expect(snapshot.live).toHaveLength(64);
    expect(snapshot.live.some(({ taskId }) => taskId === "older-running-task")).toBe(false);
    expect(snapshot.live.every(({ readiness }) => readiness.state === "capacity-blocked")).toBe(true);
  });

  it("commits a receipt and identifies dependents in the same absorption transaction", () => {
    const { config } = fixture();
    const dependency = intent();
    const dependent = {
      ...intent("maintain"),
      id: "dependent-monitor",
      outcome: "Run after evaluation completes",
      dependsOn: [dependency.id],
    };
    observeAppTaskIntent(config, {
      intent: dependent,
      appAgent: "app-owner",
    });
    expect(
      claimObservedAppTask(config, {
        taskId: dependent.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({
      kind: "waiting",
      dependencyIds: [dependency.id],
    });

    const dependencyClaim = declareAndClaimTask(config, {
      intent: dependency,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (dependencyClaim.kind !== "claimed") throw new Error("expected dependency claim");
    expect(
      completeAppTask(config, dependencyClaim, {
        summary: "evaluation absorbed",
        evidence: ["artifact:evaluation.json"],
      }),
    ).toMatchObject({
      status: "applied",
      dependentTaskIds: [dependent.id],
    });
    expect(readTaskSnapshot(config).receipts?.[dependency.id]).toMatchObject({
      evidence: ["artifact:evaluation.json"],
      outcome: dependency.outcome,
    });
    expect(
      claimObservedAppTask(config, {
        taskId: dependent.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "claimed", taskId: dependent.id });
  });

  it("keeps active parent rollups out of the executable projection", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    completeAppTask(config, claim, { summary: "session evaluated" });

    const completed = readTaskSnapshot(config);
    expect(Object.values(completed.resources ?? {}).filter((resource) => resource.status.phase === "running")).toEqual(
      [],
    );
  });

  it("consumes the exact completing child through its matching receipt without retrying the stale parent", () => {
    const state = fixture();
    const { config } = state;
    const taskIntent = intent();
    const completedClaim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (completedClaim.kind !== "claimed") throw new Error("expected claim");
    const completedResource = readTaskSnapshot(config).resources?.[taskIntent.id];
    if (!completedResource) throw new Error("expected running resource");
    const completedSpec = structuredClone(completedResource.spec);
    completeAppTask(config, completedClaim, { summary: "session evaluated" });

    const stale = readTaskSnapshot(config);
    const receipt = stale.receipts?.[taskIntent.id];
    if (!receipt) throw new Error("expected completion receipt");
    stale.resources = {
      ...(stale.resources ?? {}),
      [taskIntent.id]: {
        metadata: { id: taskIntent.id, generation: receipt.metadata.generation, resourceVersion: 3 },
        spec: completedSpec,
        status: {
          observedGeneration: receipt.metadata.generation,
          phase: "running",
          currentAttemptId: "r_duplicate_current",
          updatedAt: "2026-07-20T00:00:00.000Z",
          conditionIds: [],
        },
      },
    };
    stale.attempts = {
      ...(stale.attempts ?? {}),
      r_duplicate_current: {
        metadata: { id: "r_duplicate_current", resourceVersion: 1 },
        taskId: taskIntent.id,
        taskGeneration: receipt.metadata.generation,
        specHash: receipt.specHash,
        owner: receipt.owner,
        handler: receipt.handler,
        runtimeId: "previous-runtime",
        sessionId: "s_1786376881309_240",
        state: "running",
        startedAt: "2026-07-20T00:00:00.000Z",
      },
      r_duplicate_lineage: {
        metadata: { id: "r_duplicate_lineage", resourceVersion: 1 },
        taskId: taskIntent.id,
        taskGeneration: receipt.metadata.generation,
        specHash: receipt.specHash,
        owner: receipt.owner,
        handler: receipt.handler,
        runtimeId: "previous-runtime",
        sessionId: "s_1786376766268_235",
        state: "running",
        startedAt: "2026-07-19T23:59:00.000Z",
      },
    };
    const attemptIdsBefore = Object.keys(stale.attempts);
    expect(
      config.resourceStore.commit({
        fences: [],
        expectMissingTaskIds: [taskIntent.id],
        tasks: [{ resource: stale.resources![taskIntent.id], ready: false }],
        attempts: Object.values(stale.attempts ?? {}).filter((attempt) => attempt.taskId === taskIntent.id),
      }),
    ).toBe(true);
    const resourceConfig = state.config;

    expect(recoverableAppTaskAttempts(resourceConfig, Date.now(), false, [taskIntent.id])).toEqual([]);

    const retired = resourceConfig.resourceStore.readSnapshot();
    expect(retired.receipts?.[taskIntent.id]).toEqual(receipt);
    expect(Object.keys(retired.attempts ?? {})).toEqual(expect.arrayContaining(attemptIdsBefore));
    expect(Object.keys(retired.attempts ?? {})).toHaveLength(attemptIdsBefore.length);
    for (const [attemptId, sessionId] of [
      ["r_duplicate_current", "s_1786376881309_240"],
      ["r_duplicate_lineage", "s_1786376766268_235"],
    ]) {
      expect(retired.attempts?.[attemptId]).toMatchObject({
        state: "interrupted",
        failureReason: "matching-completion-receipt",
        sessionId,
      });
    }
    expect(retired.resources?.[taskIntent.id]).toBeUndefined();
  });

  it("keeps changed completion generations and specifications recoverable", () => {
    for (const variant of ["generation", "specification"] as const) {
      const state = fixture();
      const { config } = state;
      const taskIntent = intent();
      const completedClaim = declareAndClaimTask(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (completedClaim.kind !== "claimed") throw new Error("expected claim");
      completeAppTask(config, completedClaim, { summary: "session evaluated" });

      const tree = readTaskSnapshot(config);
      const receipt = tree.receipts?.[taskIntent.id];
      if (!receipt) throw new Error("expected completion receipt");
      const generation = variant === "generation" ? receipt.metadata.generation + 1 : receipt.metadata.generation;
      tree.resources = {
        ...(tree.resources ?? {}),
        [taskIntent.id]: {
          metadata: { id: taskIntent.id, generation, resourceVersion: 1 },
          spec: {
            parentId: taskIntent.parentId,
            outcome: variant === "specification" ? `${taskIntent.outcome} revised` : taskIntent.outcome,
            acceptance: [...taskIntent.acceptance],
            mode: "achieve",
            owner: receipt.owner,
            workflow: taskIntent.workflow,
            outputs: [...(taskIntent.outputs ?? [])],
          },
          status: {
            observedGeneration: generation,
            phase: "running",
            currentAttemptId: `r_changed_${variant}`,
            updatedAt: "2026-07-20T00:00:00.000Z",
            conditionIds: [],
          },
        },
      };
      tree.attempts = {
        ...(tree.attempts ?? {}),
        [`r_changed_${variant}`]: {
          metadata: { id: `r_changed_${variant}`, resourceVersion: 1 },
          taskId: taskIntent.id,
          taskGeneration: generation,
          specHash: variant,
          owner: receipt.owner,
          handler: receipt.handler,
          runtimeId: "previous-runtime",
          state: "running",
          startedAt: "2026-07-20T00:00:00.000Z",
        },
      };
      expect(
        config.resourceStore.commit({
          fences: [],
          expectMissingTaskIds: [taskIntent.id],
          tasks: [{ resource: tree.resources![taskIntent.id], ready: false }],
          attempts: [tree.attempts![`r_changed_${variant}`]],
        }),
      ).toBe(true);
      const resourceConfig = state.config;

      expect(recoverableAppTaskAttempts(resourceConfig, Date.now(), false, [taskIntent.id])).toEqual([
        expect.objectContaining({ taskId: taskIntent.id, intent: expect.objectContaining({ id: taskIntent.id }) }),
      ]);
    }
  });

  it("recovers a receipted checkpoint from an interrupted session transcript when checkpoint JSONL is absent", () => {
    const state = fixture();
    const { root } = state;
    const sessionId = "s_1786381127581_184";
    const artifactPaths = ["/app/projects/may-agent/report.json", "/app/projects/may-agent/verification.log"];
    const { reclaimed, sessionPath } = reclaimInterruptedSession(state, sessionId, [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "checkpoint-recovery",
            name: "checkpoint",
            arguments: {
              summary: "Fallback implementation complete; deterministic acceptance tests remain.",
              data: {
                next_step: "run focused tests and typecheck",
                artifact_paths: artifactPaths,
              },
            },
          },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "checkpoint-recovery",
        toolName: "checkpoint",
        isError: false,
        content: [{ type: "text", text: "Checkpoint saved (step 1)." }],
      },
    ]);

    expect(existsSync(join(root, ".state", "checkpoints", `${sessionId}.jsonl`))).toBe(false);
    expect(reclaimed.handoff).toMatchObject({ reason: "recovered-session" });
    expect(reclaimed.handoff?.evidence).toEqual(
      expect.arrayContaining([
        `Recovered interrupted workflow:known-workflow session path: ${sessionPath}`,
        `Recovered interrupted workflow:known-workflow session artifact: ${join(sessionPath, "result.json")}`,
        `Recovered interrupted workflow:known-workflow session transcript: ${join(sessionPath, "session.jsonl")}`,
        expect.stringContaining("summary=Fallback implementation complete; deterministic acceptance tests remain."),
        expect.stringContaining(
          `data=${JSON.stringify({ artifact_paths: artifactPaths, next_step: "run focused tests and typecheck" })}`,
        ),
      ]),
    );
  });

  it("prefers a file-backed checkpoint over a successful transcript checkpoint", () => {
    const state = fixture();
    const { root } = state;
    const sessionId = "session-file-checkpoint-precedence";
    const fileCheckpoint = {
      sessionId,
      agentName: "dev",
      step: 4,
      summary: "File-backed checkpoint wins",
      data: { source: "checkpoint-jsonl", artifact_paths: ["/tmp/file-backed.txt"] },
      timestamp: 1_786_381_127_581,
    };
    const { reclaimed } = reclaimInterruptedSession(
      state,
      sessionId,
      [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "checkpoint-transcript",
              name: "checkpoint",
              arguments: { summary: "Transcript checkpoint loses", data: { source: "transcript" } },
            },
          ],
        },
        { role: "toolResult", toolCallId: "checkpoint-transcript", toolName: "checkpoint", isError: false },
      ],
      fileCheckpoint,
    );

    const checkpointEvidence = reclaimed.handoff?.evidence.find((entry) =>
      entry.startsWith("Recovered latest durable checkpoint:"),
    );
    expect(checkpointEvidence).toContain(
      `Recovered latest durable checkpoint: ${join(root, ".state", "checkpoints", `${sessionId}.jsonl`)}`,
    );
    expect(checkpointEvidence).toContain("step=4 summary=File-backed checkpoint wins");
    expect(checkpointEvidence).toContain(
      'data={"artifact_paths":["/tmp/file-backed.txt"],"source":"checkpoint-jsonl"}',
    );
    expect(checkpointEvidence).not.toContain("Transcript checkpoint loses");
  });

  it("reports checkpoint absence without a file or matching successful transcript receipt", () => {
    for (const [sessionId, transcript] of [
      [
        "session-checkpoint-no-receipt",
        [
          {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "checkpoint-unreceipted",
                name: "checkpoint",
                arguments: { summary: "Unreceipted checkpoint", data: { source: "transcript" } },
              },
            ],
          },
        ],
      ],
      [
        "session-checkpoint-error-receipt",
        [
          {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "checkpoint-error",
                name: "checkpoint",
                arguments: { summary: "Failed checkpoint", data: { source: "transcript" } },
              },
            ],
          },
          { role: "toolResult", toolCallId: "checkpoint-error", toolName: "checkpoint", isError: true },
        ],
      ],
    ] as const) {
      const state = fixture();
      const { reclaimed, sessionPath } = reclaimInterruptedSession(state, sessionId, [...transcript]);
      expect(reclaimed.handoff?.evidence).toContain(
        `Recovered durable checkpoint: absent for session ${sessionId}; no matching successful checkpoint receipt in ${join(sessionPath, "session.jsonl")}`,
      );
      expect(reclaimed.handoff?.evidence.join("\n")).not.toContain("Unreceipted checkpoint");
      expect(reclaimed.handoff?.evidence.join("\n")).not.toContain("Failed checkpoint");
    }
  });

  it("consumes a terminal direct-agent result exactly once even while its lease is fresh", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "terminal-agent-session");

    const before = readTaskSnapshot(config);
    expect(Date.parse(before.attempts![claim.attemptId].lease!.expiresAt)).toBeGreaterThan(Date.now());
    const recovered = terminalAgentSessionAppTaskClaim(config, claim.taskId, "terminal-agent-session");
    expect(recovered).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      attemptId: claim.attemptId,
      handler: "agent:branch-owner",
    });
    if (!recovered) throw new Error("expected terminal agent claim");

    expect(
      deferAppTask(config, recovered, {
        disposition: "waiting",
        summary: "terminal result requires one bounded child",
        evidence: ["session:terminal-agent-session"],
        actions: [
          {
            kind: "create-task",
            id: "terminal-result-child",
            parentId: claim.taskId,
            outcome: "Finish terminal result follow-up",
            acceptance: ["Follow-up converges"],
            mode: "achieve",
            outputs: [],
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["created terminal-result-child"] });
    expect(terminalAgentSessionAppTaskClaim(config, claim.taskId, "terminal-agent-session")).toBeNull();
    expect(config.resourceStore.readTaskContext({ taskIds: [claim.taskId] })).toMatchObject({
      attempts: { [claim.attemptId]: { state: "completed", sessionId: "terminal-agent-session" } },
      resources: {
        [claim.taskId]: { status: { phase: "waiting" } },
        "terminal-result-child": { spec: { parentId: claim.taskId } },
      },
    });
    expect(
      Object.keys(config.resourceStore.readTaskContext({ taskIds: [claim.taskId] }).resources ?? {}).filter(
        (id) => id === "terminal-result-child",
      ),
    ).toHaveLength(1);
  });

  it("releases only the exact expired agent attempt after its session is terminal", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "terminal-agent-session");

    mutateAttemptFixture(config, claim.taskId, claim.attemptId, (current) => {
      if (!current.lease) throw new Error("expected leased attempt");
      current.lease.expiresAt = "2026-08-15T23:57:29.078Z";
    });
    const expired = readTaskSnapshot(config);
    const resource = expired.resources?.[claim.taskId];
    const attempt = expired.attempts?.[claim.attemptId];
    if (!resource || !attempt?.lease) throw new Error("expected leased attempt");
    const recovery = {
      taskId: claim.taskId,
      intent: claim.intent,
      taskGeneration: resource.metadata.generation,
      taskResourceVersion: resource.metadata.resourceVersion,
      attemptId: attempt.metadata.id,
      attemptResourceVersion: attempt.metadata.resourceVersion,
      leaseId: attempt.lease.id,
      leaseVersion: attempt.lease.version,
      legacyLeaseLess: false as const,
      sessionId: "terminal-agent-session",
      terminalStatus: "done" as const,
    };

    expect(
      releaseTerminalSessionExpiredAppTaskAttempt(
        config,
        recovery,
        "Fresh lease must preserve ownership",
        Date.parse("2026-08-15T23:00:00.000Z"),
      ),
    ).toEqual({ released: false, sessionIds: [] });
    expect(
      releaseTerminalSessionExpiredAppTaskAttempt(
        config,
        recovery,
        "Synchronous caller disappeared during rollback",
        Date.parse("2026-08-16T01:00:00.000Z"),
      ),
    ).toEqual({ released: true, sessionIds: ["terminal-agent-session"] });
    expect(config.resourceStore.readTaskContext({ taskIds: [claim.taskId] })).toMatchObject({
      resources: { [claim.taskId]: { status: { phase: "pending", observedGeneration: 0 } } },
      attempts: {
        [claim.attemptId]: {
          state: "interrupted",
          sessionId: "terminal-agent-session",
          failureReason: "terminal-agent-session-expired-lease-requeued",
        },
      },
    });
  });

  it("never releases a healthy live agent session or a stale fenced observation", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "live-agent-session");
    mutateAttemptFixture(config, claim.taskId, claim.attemptId, (current) => {
      if (!current.lease) throw new Error("expected leased attempt");
      current.lease.expiresAt = "2020-01-01T00:00:00.000Z";
    });
    const tree = readTaskSnapshot(config);
    const resource = tree.resources?.[claim.taskId];
    const attempt = tree.attempts?.[claim.attemptId];
    if (!resource || !attempt?.lease) throw new Error("expected leased attempt");
    const recovery = {
      taskId: claim.taskId,
      intent: claim.intent,
      taskGeneration: resource.metadata.generation,
      taskResourceVersion: resource.metadata.resourceVersion,
      attemptId: attempt.metadata.id,
      attemptResourceVersion: attempt.metadata.resourceVersion,
      leaseId: attempt.lease.id,
      leaseVersion: attempt.lease.version,
      legacyLeaseLess: false as const,
      sessionId: "live-agent-session",
      terminalStatus: "done" as const,
    };
    const activeAt = Date.now();
    const activity = { sessionId: "live-agent-session", lastActivityAt: activeAt - 1_000 };
    expect(expiredAgentSessionAppTaskAttempt(config, claim.taskId, activeAt, activity)).toBeNull();
    expect(
      expiredAgentSessionAppTaskAttempt(config, claim.taskId, activeAt, {
        sessionId: "unrelated-session",
        lastActivityAt: activeAt,
      }),
    ).toMatchObject({ taskId: claim.taskId, sessionId: "live-agent-session" });
    expect(
      releaseTerminalSessionExpiredAppTaskAttempt(
        config,
        recovery,
        "recent session activity must preserve ownership",
        activeAt,
        activity,
      ),
    ).toEqual({ released: false, sessionIds: [] });
    expect(
      releaseTerminalSessionExpiredAppTaskAttempt(
        config,
        { ...recovery, attemptResourceVersion: recovery.attemptResourceVersion + 1 },
        "stale fence must fail",
        Date.now(),
      ),
    ).toEqual({ released: false, sessionIds: [] });
    expect(
      config.resourceStore.readTaskContext({ taskIds: [claim.taskId] }).resources?.[claim.taskId].status.phase,
    ).toBe("running");
  });

  it("requeues the same task when a late workflow result reaches its still-running attempt", () => {
    const state = fixture();
    const { config } = state;
    const trigger = {
      type: "project.task.tick",
      data: { project: "sample", taskId: "maintain" },
    };
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger,
    });
    if (claim.kind !== "claimed") throw new Error("expected workflow claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-resumed-after-restart")).toBe(true);
    expect(
      releaseLateTerminalWorkflowAppTaskAttempt(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "session-resumed-after-restart",
        "Late terminal result cannot reattach to restart-interrupted workflow workflow-run-1",
      ),
    ).toEqual({ released: true, taskId: claim.taskId });

    const released = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    expect(released.resources?.[claim.taskId].status).toMatchObject({
      phase: "pending",
      observedGeneration: claim.generation - 1,
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(released.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "late-terminal-workflow-result-requeued",
      sessionId: "session-resumed-after-restart",
    });
    expect(readAppTaskTrigger(config, claim.taskId)).toEqual(trigger);
    expect(
      releaseLateTerminalWorkflowAppTaskAttempt(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "session-resumed-after-restart",
        "duplicate terminal delivery",
      ),
    ).toEqual({ released: false, taskId: claim.taskId });
  });

  it("recovers an interrupted attempt only from a previous runtime trigger", () => {
    const currentState = fixture();
    const current = declareAndClaimTask(currentState.config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (current.kind !== "claimed") throw new Error("expected claim");
    expect(
      recoverableAppTaskAttempts(currentState.config, Date.now(), false, [
        current.taskId,
      ]),
    ).toEqual([]);

    const state = fixture();
    const { config } = state;
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    mutateAttemptFixture(config, first.taskId, first.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
    });
    const resourceConfig = state.config;

    const [recovery] = recoverableAppTaskAttempts(resourceConfig, Date.now(), false, [first.taskId]);
    expect(recovery).toMatchObject({
      taskId: first.taskId,
      intent: { id: first.taskId },
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });

    const reclaimed = declareAndClaimTask(resourceConfig, {
      intent: recovery.intent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: recovery.trigger,
      reason: `attempt-recovery:${first.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: first.taskId,
      generation: first.generation,
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaim");
    expect(reclaimed.attemptId).not.toBe(first.attemptId);
    const recovered = resourceConfig.resourceStore.readTaskContext({ taskIds: [first.taskId] });
    expect(recovered.attempts?.[first.attemptId]).toMatchObject({ state: "interrupted" });
    expect(recovered.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: `attempt-recovery:${first.taskId}`,
      events: [{ event: { type: "session.end" } }],
    });
    expect(recovered.attempts?.[reclaimed.attemptId]?.trigger).toBeUndefined();
  });

  it("claims a previous-runtime attempt with a persisted trigger during ordinary resync", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (first.kind !== "claimed") throw new Error("expected claim");

    mutateAttemptFixture(config, first.taskId, first.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
    });

    const resync = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(resync).toMatchObject({
      kind: "claimed",
      taskId: first.taskId,
      generation: first.generation,
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (resync.kind !== "claimed") throw new Error("expected reclaim");
    expect(resync.attemptId).not.toBe(first.attemptId);

    const tree = readTaskSnapshot(config);
    expect(tree.attempts?.[first.attemptId]).toMatchObject({
      runtimeId: "previous-runtime",
      state: "interrupted",
    });
    expect(tree.attempts?.[resync.attemptId]).toMatchObject({
      runtimeId: expect.any(String),
      state: "running",
      reason: "task-controller",
      events: [
        {
          event: {
            type: "session.end",
            data: { project: "sample", sessionId: "session-1" },
          },
        },
      ],
    });
    expect(tree.attempts?.[resync.attemptId]?.trigger).toBeUndefined();
    expect(tree.resources?.[first.taskId].status).toMatchObject({
      phase: "running",
      currentAttemptId: resync.attemptId,
    });
  });

  it("returns superseded agent-session ids when reclaiming a previous-runtime attempt", () => {
    const state = fixture();
    const { config } = state;
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, first, "session-old")).toBe(true);

    mutateAttemptFixture(config, first.taskId, first.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
    });

    const reclaimed = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: `attempt-recovery:${first.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      supersededSessionIds: ["session-old"],
    });
  });

  it("associates workflow sessions with the current attempt and rejects stale generations", () => {
    const state = fixture();
    const { config } = state;
    const original = intent();
    const claim = declareAndClaimTask(config, {
      intent: original,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      associateAppTaskSession(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "nested-workflow-session",
      ),
    ).toEqual({ status: "recorded", taskId: claim.taskId });
    const associated = readTaskSnapshot(config).attempts?.[claim.attemptId];
    expect(associated?.sessionId).toBe("nested-workflow-session");
    const associatedVersion = associated?.metadata.resourceVersion;
    expect(recordAppTaskAttemptSession(config, claim, "nested-workflow-session")).toBe(true);
    expect(readTaskSnapshot(config).attempts?.[claim.attemptId].metadata.resourceVersion).toBe(associatedVersion);

    const revised: AppTaskIntent = {
      ...original,
      outcome: "Evaluate the revised session contract",
    };
    expect(
      observeAppTaskIntent(config, {
        intent: revised,
        appAgent: "app-owner",
      }),
    ).toMatchObject({
      kind: "observed",
      generation: claim.generation + 1,
      supersededSessionIds: ["nested-workflow-session"],
    });
    expect(
      associateAppTaskSession(config, { taskId: claim.taskId, generation: claim.generation }, "late-stale-session"),
    ).toEqual({ status: "superseded", taskId: claim.taskId });
    expect(associateAppTaskSession(config, { taskId: "missing-task", generation: 1 }, "missing-session")).toEqual({
      status: "missing",
      taskId: "missing-task",
    });
  });

  it("returns orphaned agent-session ids when requeueing a previous-runtime attempt without a trigger", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-old")).toBe(true);

    mutateAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
      delete attempt.trigger;
    });

    const [recovery] = recoverableAppTaskAttempts(config, Date.now(), false, [claim.taskId]);
    expect(recovery.taskId).toBe(claim.taskId);
    expect(recovery.trigger).toBeUndefined();
    expect(releaseInterruptedAppTaskAttempt(config, recovery, "trigger packet was not persisted")).toEqual({
      released: true,
      sessionIds: ["session-old"],
    });

    const released = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    expect(released.resources?.[claim.taskId]).toMatchObject({
      status: { phase: "pending" },
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
  });

  it("requeues running tasks whose current attempt record is missing", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const orphaned = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const resource = orphaned.resources?.[claim.taskId];
    if (!resource) throw new Error("expected running resource");
    expect(
      config.resourceStore.commit({
        fences: [
          {
            taskId: claim.taskId,
            resourceVersion: resource.metadata.resourceVersion,
            generation: resource.metadata.generation,
            currentAttemptId: claim.attemptId,
          },
        ],
        deleteAttemptIds: [claim.attemptId],
      }),
    ).toBe(true);
    expect(config.resourceStore.setRecoveryState(claim.taskId, { ready: true, changed: true })).toBe(true);

    expect(listRunnableAppTaskIds(config)).toContain(claim.taskId);
    expect(repairRunningAppTasksWithoutAttempt(config, [claim.taskId])).toEqual([
      expect.objectContaining({
        taskId: claim.taskId,
        disposition: "requeued",
      }),
    ]);

    const released = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    expect(released.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "pending",
      },
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(listRunnableAppTaskIds(config)).toContain(claim.taskId);
  });

  it("requeues an orphaned App dependency wait and leaves admitted waits alone", () => {
    const state = fixture();
    const { config } = state;
    const makeWaiting = (taskId: string, requestId: string) => {
      const taskIntent = { ...intent(), id: taskId };
      const claim = declareAndClaimTask(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        handler: "agent:app-owner",
      });
      if (claim.kind !== "claimed") throw new Error("expected claim");
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: `waiting for ${requestId}`,
        conditions: [
          {
            id: `app-request:${requestId}`,
            type: "app.dependency.completed",
            subject: `id:${requestId}`,
            expected: { field: "status", equals: "done" },
          },
        ],
      });
    };
    makeWaiting("work/orphaned", "missing-request");
    makeWaiting("work/admitted", "accepted-request");
    const resourceConfig = state.config;
    const candidateTaskIds = ["work/orphaned", "work/admitted"];

    expect(
      repairUnadmittedAppDependencyWaits(
        resourceConfig,
        (requestId) => requestId === "accepted-request",
        candidateTaskIds,
      ),
    ).toEqual([expect.objectContaining({ taskId: "work/orphaned", disposition: "requeued" })]);

    const repaired = resourceConfig.resourceStore.readTaskContext({ taskIds: candidateTaskIds });
    expect(repaired.resources?.["work/orphaned"]?.status).toMatchObject({
      phase: "pending",
      conditionIds: [],
      summary: "App dependency request missing-request was not admitted; retrying the same Task from current evidence",
    });
    expect(repaired.conditions?.["app-request:missing-request"]).toBeUndefined();
    expect(repaired.resources?.["work/admitted"]?.status).toMatchObject({
      phase: "waiting",
      conditionIds: ["app-request:accepted-request"],
    });
    expect(
      repairUnadmittedAppDependencyWaits(
        resourceConfig,
        (requestId) => requestId === "accepted-request",
        candidateTaskIds,
      ),
    ).toEqual([]);
  });

  it("claims running tasks whose current attempt record is missing", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const orphaned = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const orphanedResource = orphaned.resources?.[claim.taskId];
    if (!orphanedResource) throw new Error("expected orphaned-claim resource");
    expect(
      config.resourceStore.commit({
        fences: [
          {
            taskId: claim.taskId,
            resourceVersion: orphanedResource.metadata.resourceVersion,
            generation: orphanedResource.metadata.generation,
            currentAttemptId: claim.attemptId,
          },
        ],
        deleteAttemptIds: [claim.attemptId],
      }),
    ).toBe(true);

    const reclaimed = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "test-reclaim",
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      generation: claim.generation,
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");
    expect(reclaimed.attemptId).not.toBe(claim.attemptId);
    expect(readTaskSnapshot(config).attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: "test-reclaim",
    });
  });

  it("persists a synthetic controller trigger so task-controller attempts survive restart", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim).toMatchObject({
      kind: "claimed",
      trigger: {
        type: "project.task.tick",
        source: "app-task:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    mutateAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
    });
    const interruptedResourceConfig = state.config;

    const [recovery] = recoverableAppTaskAttempts(interruptedResourceConfig, Date.now(), false, [claim.taskId]);
    expect(recovery).toMatchObject({
      taskId: claim.taskId,
      trigger: {
        type: "project.task.tick",
        source: "app-task:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });

    expect(releaseInterruptedAppTaskAttempt(interruptedResourceConfig, recovery, "previous runtime stopped")).toEqual({
      released: true,
      sessionIds: [],
    });
    const pending = interruptedResourceConfig.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    expect(pending.resources?.[claim.taskId].status).toMatchObject({
      phase: "pending",
    });
    expect(pending.resources?.[claim.taskId].status.summary).toBeUndefined();
    expect(pending.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(pending.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "previous-runtime-attempt-requeued",
    });
    expect(pending.taskTriggers?.[claim.taskId]?.event).toMatchObject({
      type: "project.task.tick",
      source: "app-task:sample:task-controller",
      target: { project: "sample", taskId: "evaluate:session-1" },
      reason: "task-controller",
    });
    expect(listRunnableAppTaskIds(interruptedResourceConfig)).toContain(claim.taskId);

    const reclaimed = declareAndClaimTask(interruptedResourceConfig, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: `attempt-recovery:${claim.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      generation: claim.generation,
      trigger: {
        type: "project.task.tick",
        source: "app-task:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");

    const released = interruptedResourceConfig.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    expect(released.resources?.[claim.taskId]?.status.phase).toBe("running");
    expect(released.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
    });
    expect(released.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: `attempt-recovery:${claim.taskId}`,
      events: [
        {
          event: {
            type: "project.task.tick",
            source: "app-task:sample:task-controller",
            target: { project: "sample", taskId: "evaluate:session-1" },
            reason: "task-controller",
          },
        },
      ],
    });
    expect(released.attempts?.[reclaimed.attemptId]?.trigger).toBeUndefined();
  });

  it.each([
    "restart",
    "claim-recovery",
    "missing-attempt",
    "missing-attempt-scan",
    "late-terminal",
    "expired-session",
    "legacy-attention",
  ])("preserves accepted waits when %s replaces an attempt of the same generation", (kind) => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    const conditions = [
      { id: "ci", type: "pipeline-run.state", subject: "pipeline-run:42", expected: "completed" },
      { id: "review", type: "project.task.reconciled", subject: "task:review", expected: "done" },
    ];
    deferAppTask(config, first, { disposition: "waiting", summary: "Both facts are outstanding", conditions });
    const accepted = readTaskSnapshot(config).conditions;
    recordAppTaskTrigger(config, first.taskId, { type: "sample.updated", eventId: 101 });
    const running = claimObservedAppTask(config, {
      taskId: first.taskId,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (running.kind !== "claimed") throw new Error("expected running claim");
    recordAppTaskAttemptSession(config, running, "interrupted-session");
    recordAppTaskTrigger(config, first.taskId, { type: "sample.updated", eventId: 102 });
    if (kind === "restart" || kind === "claim-recovery") {
      mutateAttemptFixture(config, first.taskId, running.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
      });
      if (kind === "restart") {
        const [recovery] = recoverableAppTaskAttempts(config, Date.now(), true, [first.taskId]);
        expect(releaseInterruptedAppTaskAttempt(config, recovery, "Runtime replaced").released).toBe(true);
      }
    } else if (kind.startsWith("missing-attempt")) {
      mutateAttemptFixture(config, first.taskId, running.attemptId, (attempt) => {
        attempt.state = "interrupted";
      });
      if (kind === "missing-attempt-scan")
        expect(repairRunningAppTasksWithoutAttempt(config, [first.taskId])).toHaveLength(1);
    } else if (kind === "legacy-attention") {
      mutateAttemptFixture(config, first.taskId, running.attemptId, (attempt) => {
        attempt.state = "interrupted";
        attempt.failureReason = "previous-runtime-attempt-not-recoverable";
      });
      mutateTaskResourceFixture(config, first.taskId, (resource) => {
        resource.status.phase = "attention";
        resource.status.currentAttemptId = undefined;
      });
      expect(repairPreviousRuntimeRecoveryAttention(config, [first.taskId])).toHaveLength(1);
    } else if (kind === "late-terminal") {
      expect(
        releaseLateTerminalWorkflowAppTaskAttempt(
          config,
          { taskId: first.taskId, generation: running.generation },
          "interrupted-session",
          "Workflow stack lost",
        ).released,
      ).toBe(true);
    } else {
      mutateAttemptFixture(config, first.taskId, running.attemptId, (attempt) => {
        attempt.lease!.expiresAt = "2000-01-01T00:00:00.000Z";
      });
      const expired = expiredAgentSessionAppTaskAttempt(config, first.taskId);
      if (!expired) throw new Error("expected expired attempt");
      expect(
        releaseTerminalSessionExpiredAppTaskAttempt(
          config,
          { ...expired, sessionId: "interrupted-session", terminalStatus: "done" },
          "Caller lost",
        ).released,
      ).toBe(true);
    }
    const replacement = claimObservedAppTask(config, {
      taskId: first.taskId,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    expect(replacement.kind).toBe("claimed");
    if (replacement.kind !== "claimed") throw new Error("expected replacement claim");
    expect(replacement.generation).toBe(running.generation);
    expect(replacement.events.map(({ event }) => event.eventId)).toContain(102);
    expect(readTaskSnapshot(config).conditions).toEqual(accepted);
    expect(readTaskSnapshot(config).resources[first.taskId].status.conditionIds).toEqual(["ci", "review"]);
    expect(completeAppTask(config, running, { summary: "Stale result" }).status).toBe("stale");
    deferAppTask(config, replacement, { disposition: "waiting", summary: "Still outstanding", conditions });
    expect(readTaskSnapshot(config).conditions).toEqual(accepted);
    expect(
      trackAppTaskConditionEvent(config, { type: "pipeline-run.state", pipelineRunId: "42", state: "completed" }),
    ).toMatchObject([{ taskId: first.taskId, conditionId: "ci" }]);
  });

  it("atomically fences an interrupted orphan claim and accepts exactly one later wake (events 5446564 and 5446878)", () => {
    const fixtureState = fixture();
    const { root } = fixtureState;
    const { config } = fixtureState;
    const taskIntent = { ...intent("maintain"), id: "ops/orphan-claim-fence" };
    const oldClaim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (oldClaim.kind !== "claimed") throw new Error("expected old claim");
    expect(recordAppTaskAttemptSession(config, oldClaim, "r_1_f85fb905-old-session")).toBe(true);

    const checkpointDir = join(root, "configured-state", "checkpoints");
    mkdirSync(checkpointDir, { recursive: true });
    writeFileSync(
      join(checkpointDir, "r_1_f85fb905-old-session.jsonl"),
      `${JSON.stringify({
        sessionId: "r_1_f85fb905-old-session",
        agentName: "app-owner",
        step: 1,
        timestamp: 1_786_564_000_000,
        summary: "Event 5446564 interrupted the old owner after acceptance-critical evidence",
        data: { next_step: "replacement owner decides the unchanged generation" },
      })}\n`,
    );
    mutateAttemptFixture(config, oldClaim.taskId, oldClaim.attemptId, (attempt) => {
      attempt.runtimeId = "runtime-before-event-5446564";
    });
    const [recovery] = recoverableAppTaskAttempts(config, Date.now(), false, [oldClaim.taskId]);

    expect(releaseInterruptedAppTaskAttempt(config, recovery, "restart event 5446564")).toEqual({
      released: true,
      sessionIds: ["r_1_f85fb905-old-session"],
    });
    const replacement = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "restart-event:5446564",
      recoverSessionHandoff: (attempt) => buildRecoveredSessionHandoff(join(root, "configured-state"), attempt),
    });
    if (replacement.kind !== "claimed") throw new Error("expected replacement claim");
    expect(replacement.generation).toBe(oldClaim.generation);
    expect(replacement.handoff?.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Event 5446564 interrupted the old owner after acceptance-critical evidence"),
        expect.stringContaining('data={"next_step":"replacement owner decides the unchanged generation"}'),
      ]),
    );

    expect(completeAppTask(config, oldClaim, { summary: "late old disposition" }).status).toBe("stale");
    expect(
      claimObservedAppTask(config, {
        taskId: replacement.taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "duplicate-reclaim",
      }),
    ).toMatchObject({ kind: "busy", attemptId: replacement.attemptId });
    expect(completeAppTask(config, replacement, { summary: "replacement disposition accepted" }).status).toBe(
      "applied",
    );

    const laterWake = {
      type: "project.task.tick",
      eventId: 5446878,
      source: "app-task:sample:task-controller",
      target: { project: "sample", taskId: taskIntent.id },
      reason: "explicit-later-wake",
    };
    expect(
      observeAppTaskIntent(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        trigger: laterWake,
      }),
    ).toMatchObject({ kind: "observed", generation: replacement.generation, changed: false });
    const fresh = claimObservedAppTask(config, {
      taskId: taskIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "event:5446878",
    });
    if (fresh.kind !== "claimed") throw new Error("expected exactly one fresh reconciliation");
    expect(fresh.trigger).toEqual(laterWake);
    expect(fresh.attemptId).not.toBe(replacement.attemptId);
    expect(
      claimObservedAppTask(config, {
        taskId: taskIntent.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "duplicate-event:5446878",
      }),
    ).toMatchObject({ kind: "busy", attemptId: fresh.attemptId });

    const finalState = config.resourceStore.readTaskContext({ taskIds: [taskIntent.id] });
    const acceptedAttempts = Object.values(finalState.attempts ?? {}).filter(
      (attempt) => attempt.taskId === taskIntent.id && attempt.state === "completed",
    );
    const runningAttempts = Object.values(finalState.attempts ?? {}).filter(
      (attempt) => attempt.taskId === taskIntent.id && attempt.state === "running",
    );
    expect(acceptedAttempts).toHaveLength(1);
    expect(acceptedAttempts[0].metadata.id).toBe(replacement.attemptId);
    expect(runningAttempts).toHaveLength(1);
    expect(runningAttempts[0].metadata.id).toBe(fresh.attemptId);
  });

  it("repairs existing previous-runtime attention records on startup", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    mutateAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
      attempt.state = "interrupted";
      attempt.failureReason = "previous-runtime-attempt-not-recoverable";
    });
    mutateTaskResourceFixture(
      config,
      claim.taskId,
      (resource) => {
        resource.status = {
          ...resource.status,
          phase: "attention",
          observedGeneration: claim.generation,
          currentAttemptId: undefined,
          summary: `old attention ${claim.taskId}`,
        };
      },
      false,
    );

    const resourceConfig = state.config;
    expect(repairPreviousRuntimeRecoveryAttention(resourceConfig, [claim.taskId])).toMatchObject([
      { taskId: "evaluate:session-1", disposition: "requeued" },
    ]);

    const repaired = resourceConfig.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    expect(repaired.resources?.["evaluate:session-1"]).toMatchObject({
      status: { phase: "pending", observedGeneration: claim.generation },
    });
    expect(
      claimObservedAppTask(resourceConfig, {
        taskId: claim.taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }).kind,
    ).toBe("claimed");
  });

  it("keeps converged maintain tasks live for the next event", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeAppTask(config, claim, { summary: "pipeline healthy" }).status).toBe("applied");
    const convergedTree = readTaskSnapshot(config);
    expect(convergedTree.resources?.[claim.taskId]).toMatchObject({
      spec: { mode: "maintain" },
      status: {
        observedGeneration: claim.generation,
        observedAttemptId: claim.attemptId,
        phase: "converged",
        summary: "pipeline healthy",
      },
    });
    expect(convergedTree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(convergedTree.attempts?.[claim.attemptId]).toMatchObject({ state: "completed" });

    expect(
      claimObservedAppTask(config, {
        taskId: claim.taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", generation: claim.generation });

    const next = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: { type: "pipeline.changed", revision: 2 },
    });
    expect(next).toMatchObject({ kind: "claimed", generation: claim.generation });
  });

  it("wakes a maintain task once per canonical App admission", () => {
    const state = fixture();
    const { config } = state;
    const monitor = intent("maintain");
    const trigger = (key: string) => ({
      type: "app.task.requested",
      source: "app-inbox:sample",
      idempotencyKey: key,
      data: { taskId: monitor.id, idempotencyKey: key },
    });

    const first = observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      admissionKey: "app-request-1",
      trigger: trigger("app-request-1"),
    });
    expect(first).toMatchObject({ kind: "observed", taskId: monitor.id });
    const firstClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");
    expect(firstClaim.trigger).toEqual(trigger("app-request-1"));
    completeAppTask(config, firstClaim, { summary: "first scheduled review complete" });

    const duplicate = observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      admissionKey: "app-request-1",
      trigger: trigger("app-request-1"),
    });
    expect(duplicate).toMatchObject({
      kind: "observed",
      taskId: monitor.id,
      generation: firstClaim.generation,
      changed: false,
    });
    expect(readAppTaskTrigger(config, monitor.id)).toBeUndefined();
    expect(
      claimObservedAppTask(config, {
        taskId: monitor.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", generation: firstClaim.generation });

    const second = observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      admissionKey: "app-request-2",
      trigger: trigger("app-request-2"),
    });
    expect(second).toMatchObject({
      kind: "observed",
      taskId: monitor.id,
      generation: firstClaim.generation,
      changed: false,
    });
    const secondClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(secondClaim).toMatchObject({
      kind: "claimed",
      generation: firstClaim.generation,
      trigger: trigger("app-request-2"),
    });

    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...monitor, outcome: "Different desired work" },
        appAgent: "app-owner",
        admissionKey: "app-request-2",
        trigger: trigger("app-request-2"),
      }),
    ).toThrow("was already used for different desired work");
  });

  it("replays a queued maintain trigger after the older attempt completes", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review" },
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review" },
      appAgent: "app-owner",
      trigger: {
        type: "project.comment.created",
        data: { comment: "Please review the new approval packet" },
      },
    });

    expect(listRunnableAppTaskIds(config)).not.toContain("runtime/owner-review");

    const completed = completeAppTask(config, claim, {
      summary: "current review complete",
    });
    expect(completed).toMatchObject({
      status: "applied",
      dependentTaskIds: ["runtime/owner-review"],
    });
    expect(readAppTaskTrigger(config, "runtime/owner-review")).toEqual({
      type: "project.comment.created",
      data: { comment: "Please review the new approval packet" },
    });

    const replay = claimObservedAppTask(config, {
      taskId: "runtime/owner-review",
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    expect(replay).toMatchObject({
      kind: "claimed",
      taskId: "runtime/owner-review",
      generation: claim.generation,
      trigger: {
        type: "project.comment.created",
        data: { comment: "Please review the new approval packet" },
      },
    });
  });

  it("preserves a queued project comment through child completion and interrupted-attempt recovery", () => {
    const state = fixture();
    const { config } = state;
    const parentIntent = {
      ...intent("maintain"),
      id: "runtime/owner-review",
    } as const;
    const childIntent = {
      id: "runtime/owner-review/domain-fix",
      parentId: parentIntent.id,
      outcome: "Finish the bounded domain fix",
      acceptance: ["The domain fix has exact evidence"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const parentClaim = declareAndClaimTask(config, {
      intent: parentIntent,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (parentClaim.kind !== "claimed") throw new Error("expected parent claim");

    const commentTrigger = {
      type: "project.comment.created",
      eventId: 4425120,
      data: { comment: "Re-evaluate the existing normalization leaf" },
    };
    observeAppTaskIntent(config, {
      intent: parentIntent,
      appAgent: "app-owner",
      trigger: commentTrigger,
    });

    const childClaim = declareAndClaimTask(config, {
      intent: childIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (childClaim.kind !== "claimed") throw new Error("expected child claim");
    expect(
      completeAppTask(config, childClaim, {
        summary: "bounded domain fix completed",
        evidence: ["proof:domain-fix"],
      }),
    ).toMatchObject({ status: "applied", dependentTaskIds: [parentIntent.id] });
    expect(readAppTaskTrigger(config, parentIntent.id)).toEqual(commentTrigger);

    const interruptedTree = config.resourceStore.readTaskContext({ taskIds: [parentIntent.id] });
    const currentAttemptId = interruptedTree.resources?.[parentIntent.id]?.status.currentAttemptId;
    if (!currentAttemptId) throw new Error("expected current parent attempt");
    mutateAttemptFixture(config, parentIntent.id, currentAttemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
    });
    const [recovery] = recoverableAppTaskAttempts(config, Date.now(), false, [parentIntent.id]);

    expect(releaseInterruptedAppTaskAttempt(config, recovery, "Process restarted")).toMatchObject({
      released: true,
    });
    expect(readAppTaskTrigger(config, parentIntent.id)).toEqual(commentTrigger);

    const recoveredClaim = claimObservedAppTask(config, {
      taskId: parentIntent.id,
      appAgent: "app-owner",
      handler: "agent:app-owner",
      reason: `attempt-recovery:${parentIntent.id}`,
    });
    expect(recoveredClaim).toMatchObject({
      kind: "claimed",
      taskId: parentIntent.id,
      trigger: commentTrigger,
    });
  });

  it("rejects absorbing an achieve parent that still has live children", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "normalize-frontier",
      parentId: "operations",
      outcome: "Normalize the remaining frontier",
      acceptance: ["The frontier is empty or every remainder has exact disposition"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const childIntent = {
      id: "normalize-frontier/spec-a",
      parentId: parentIntent.id,
      outcome: "Normalize spec A",
      acceptance: ["Spec A has exact live proof or exact blocker"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;

    observeAppTaskIntent(config, {
      intent: parentIntent,
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: childIntent,
      appAgent: "app-owner",
    });
    const claim = declareAndClaimTask(config, {
      intent: parentIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "parent has no direct mutation to make",
      }),
    ).toThrow("cannot converge while it has live children");
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[parentIntent.id]?.status.phase).toBe("running");
    expect(tree.receipts?.[parentIntent.id]).toBeUndefined();
    expect(tree.resources?.[childIntent.id]).toBeDefined();
  });

  it("rejects closing another task that still has live children", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "parent-with-live-child",
      parentId: "operations",
      outcome: "Finish a parent only after its child",
      acceptance: ["Every child is absorbed first"],
      mode: "achieve",
    } as const;
    const childIntent = {
      id: "parent-with-live-child/child",
      parentId: parentIntent.id,
      outcome: "Finish the child",
      acceptance: ["The child is complete"],
      mode: "achieve",
    } as const;
    observeAppTaskIntent(config, { intent: parentIntent, appAgent: "app-owner" });
    observeAppTaskIntent(config, { intent: childIntent, appAgent: "app-owner" });

    const carrier = claimObservedAppTask(config, {
      taskId: "categorized-task",
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    expect(() =>
      completeAppTask(config, carrier, {
        summary: "Attempted parent closure",
        evidence: ["review:parent-closure"],
        actions: [
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Parent complete",
          },
        ],
      }),
    ).toThrow("cannot absorb parent-with-live-child while it has live children");

    const rejectedTree = readTaskSnapshot(config);
    expect(rejectedTree.resources?.[parentIntent.id]).toBeTruthy();
    expect(rejectedTree.receipts?.[parentIntent.id]).toBeUndefined();
    expect(rejectedTree.resources?.[childIntent.id]).toBeTruthy();

    expect(
      completeAppTask(config, carrier, {
        summary: "Closed the current bottom-most descendant",
        evidence: ["review:bottom-most-child"],
        actions: [
          {
            kind: "close-task",
            taskId: childIntent.id,
            expectedGeneration: 1,
            summary: "Bottom-most child complete",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: [`closed ${childIntent.id}`],
    });

    const afterChild = readTaskSnapshot(config);
    expect(afterChild.resources?.[childIntent.id]).toBeUndefined();
    expect(afterChild.receipts?.[childIntent.id]).toBeDefined();
    expect(afterChild.resources?.[parentIntent.id]).toBeTruthy();
    expect(afterChild.receipts?.[parentIntent.id]).toBeUndefined();

    const upwardCarrierIntent = {
      id: "close-upward-carrier",
      parentId: "operations",
      outcome: "Reconcile the next ancestor transition",
      acceptance: ["Only the now-leaf ancestor is closed"],
      mode: "achieve",
    } as const;
    const upwardCarrier = declareAndClaimTask(config, {
      intent: upwardCarrierIntent,
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (upwardCarrier.kind !== "claimed") {
      throw new Error("expected upward carrier claim");
    }
    expect(
      completeAppTask(config, upwardCarrier, {
        summary: "Reconciled the ancestor after its child",
        evidence: ["review:ancestor-now-leaf"],
        actions: [
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Ancestor complete after child transition",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: [`closed ${parentIntent.id}`],
    });

    const reconciledTree = readTaskSnapshot(config);
    expect(reconciledTree.resources?.[parentIntent.id]).toBeUndefined();
    expect(reconciledTree.receipts?.[parentIntent.id]).toBeDefined();
  });

  it("allows a batch to reparent a live child before closing its old parent", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "stale-parent",
      parentId: "operations",
      outcome: "Retire stale parent after preserving the useful child",
      acceptance: ["The useful child remains live"],
      mode: "achieve",
    } as const;
    const childIntent = {
      id: "useful-wait",
      parentId: parentIntent.id,
      outcome: "Wait on the exact external signal",
      acceptance: ["The wait has a typed condition"],
      mode: "achieve",
    } as const;
    observeAppTaskIntent(config, { intent: parentIntent, appAgent: "app-owner" });
    observeAppTaskIntent(config, { intent: childIntent, appAgent: "app-owner" });

    const carrier = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    expect(
      completeAppTask(config, carrier, {
        summary: "Collapsed stale parent",
        evidence: ["reparented useful wait before closing stale parent"],
        actions: [
          {
            kind: "update-task",
            taskId: childIntent.id,
            expectedGeneration: 1,
            parentId: "operations",
          },
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Parent was stale after child was preserved elsewhere",
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["updated useful-wait", "closed stale-parent"] });

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[parentIntent.id]).toBeUndefined();
    expect(tree.receipts?.[parentIntent.id]).toBeDefined();
    expect(tree.resources?.[childIntent.id]?.spec.parentId).toBe("operations");
  });

  it("rejects stale results after a fallback attempt takes ownership", () => {
    const state = fixture();
    const { config } = state;
    const primary = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (primary.kind !== "claimed") throw new Error("expected primary claim");
    expect(
      markAppTaskAttention(config, primary, {
        summary: "workflow could not classify the task",
        reason: "needs-agent",
      }),
    ).toMatchObject({ status: "applied" });

    const fallback = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      reason: "workflow-fallback",
    });
    if (fallback.kind !== "claimed") throw new Error("expected fallback claim");
    expect(
      completeAppTask(config, primary, {
        summary: "late primary result",
        actions: [
          {
            kind: "create-task",
            id: "stale-action-must-not-apply",
            parentId: "operations",
            outcome: "This task must not exist",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }).status,
    ).toBe("stale");
    expect(readTaskSnapshot(config).resources?.["stale-action-must-not-apply"]).toBeUndefined();
    expect(completeAppTask(config, fallback, { summary: "owner handled exception" }).status).toBe("applied");
  });

  it("does not reclaim attention tasks during plain resync", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      markAppTaskAttention(config, claim, {
        summary: "reviewer must decide the next move",
        reason: "handler-blocked",
      }),
    ).toMatchObject({ status: "applied" });

    expect(
      declareAndClaimTask(config, {
        intent: intent(),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "task-controller",
      }),
    ).toMatchObject({
      kind: "attention",
      taskId: claim.taskId,
      generation: claim.generation,
      summary: "reviewer must decide the next move",
    });

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "attention",
        summary: "reviewer must decide the next move",
      },
    });
    expect(tree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
  });

  it("allows a new trigger to reclaim an attention task", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    markAppTaskAttention(config, claim, {
      summary: "waiting for new evidence",
      reason: "handler-blocked",
    });

    const next = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "event",
      trigger: { type: "project.problem.resolved", data: { project: "sample" } },
    });
    expect(next).toMatchObject({ kind: "claimed", taskId: claim.taskId, generation: claim.generation });
    if (next.kind !== "claimed") throw new Error("expected reclaim");
    expect(readTaskSnapshot(config).resources?.[claim.taskId]?.status.phase).toBe("running");
    const persistedAttempt = readTaskSnapshot(config).attempts?.[next.attemptId];
    expect(persistedAttempt).toMatchObject({ events: [{ event: { type: "project.problem.resolved" } }] });
    expect(persistedAttempt?.trigger).toBeUndefined();
  });

  it("accepts the current attempt after a status-only resource version change", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    mutateTaskResourceFixture(
      config,
      claim.taskId,
      (resource) => {
        resource.status.summary = "concurrent observation";
      },
      false,
    );

    expect(completeAppTask(config, claim, { summary: "current handler result" })).toMatchObject({
      status: "applied",
      actionsApplied: [],
    });
    expect(readTaskSnapshot(config).resources?.[claim.taskId]).toMatchObject({
      metadata: { resourceVersion: claim.resourceVersion + 2 },
      status: { phase: "converged", summary: "current handler result" },
    });
  });

  it("can release a stale current attempt so the task is judged again from current evidence", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    mutateAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.specHash = "superseded-attempt-contract";
    });

    expect(
      completeAppTask(config, claim, {
        summary: "late result",
        evidence: ["stale result must not apply actions"],
        actions: [
          {
            kind: "create-task",
            id: "stale-action-must-not-apply",
            parentId: "operations",
            outcome: "This task must not exist",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }),
    ).toMatchObject({ status: "stale", actionsApplied: [] });
    expect(readTaskSnapshot(config).resources?.["stale-action-must-not-apply"]).toBeUndefined();

    expect(releaseStaleAppTaskResult(config, claim)).toEqual({
      status: "released",
      taskId: claim.taskId,
    });
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "pending",
      },
    });
    expect(tree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(tree.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "stale-reconciliation-result",
    });
    expect(listRunnableAppTaskIds(config)).toContain(claim.taskId);
  });

  it("keeps accepted waits and semantic progress when feedback fences an attempt", () => {
    const state = fixture();
    const { config } = state;
    const taskIntent = intent();
    const initial = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (initial.kind !== "claimed") throw new Error("expected initial claim");
    expect(
      deferAppTask(config, initial, {
        disposition: "waiting",
        summary: "Waiting for the existing owner proof",
        evidence: ["proof request accepted"],
        conditions: [
          {
            id: "app-request:existing-proof",
            type: "app.dependency.completed",
            subject: "id:existing-proof",
            expected: { field: "status", equals: "done" },
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    observeAppTaskIntent(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      trigger: {
        type: "app.task.requested",
        source: "human",
        target: { project: "sample", taskId: taskIntent.id },
        data: { message: "Why is this still waiting?" },
      },
    });
    const feedback = claimObservedAppTask(config, {
      taskId: taskIntent.id,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (feedback.kind !== "claimed") throw new Error("expected feedback claim");

    expect(releaseStaleAppTaskResult(config, feedback, "newer feedback superseded this attempt")).toEqual({
      status: "released",
      taskId: taskIntent.id,
    });
    expect(readTaskSnapshot(config).resources?.[taskIntent.id]?.status).toMatchObject({
      phase: "pending",
      summary: "Waiting for the existing owner proof",
      conditionIds: ["app-request:existing-proof"],
      observedGeneration: 1,
    });
    expect(readTaskSnapshot(config).attempts?.[feedback.attemptId]).toMatchObject({
      state: "interrupted",
      summary: "newer feedback superseded this attempt",
    });

    const retry = claimObservedAppTask(config, {
      taskId: taskIntent.id,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (retry.kind !== "claimed") throw new Error("expected retry claim");
    expect(readTaskSnapshot(config).resources?.[taskIntent.id]?.status).toMatchObject({
      phase: "running",
      conditionIds: ["app-request:existing-proof"],
      observedGeneration: 1,
    });
  });

  it("applies handler actions atomically with reconciliation completion", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const applied = completeAppTask(config, claim, {
      summary: "owner proposed a bounded child",
      evidence: ["owner packet reviewed"],
      actions: [
        {
          kind: "create-task",
          id: "owner-created-task",
          parentId: "operations",
          outcome: "Verify the owner action boundary",
          mode: "achieve",
          outputs: ["proof.md"],
          acceptance: ["The reconciler creates this task"],
          input: { specId: "spec.network-cni.example" },
          dependsOn: ["categorized-task"],
        },
      ],
    });

    expect(applied).toEqual({
      status: "applied",
      actionsApplied: ["created owner-created-task"],
      dependentTaskIds: ["owner-created-task"],
      supersededSessionIds: [],
    });
    const tree = readTaskSnapshot(config);
    expect(readAppTaskIntent(config, "owner-created-task")).toMatchObject({
      mode: "achieve",
      input: { specId: "spec.network-cni.example" },
      dependsOn: ["categorized-task"],
    });
    expect(tree.resources?.["owner-created-task"]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending" },
    });
  });

  it("applies the same fenced action rules to runtime-prefixed task identities", () => {
    const { config } = fixture();
    const parentClaim = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review" },
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (parentClaim.kind !== "claimed") throw new Error("expected parent claim");

    expect(() =>
      completeAppTask(config, parentClaim, {
        summary: "Owner review revised its desired execution",
        evidence: ["review:current"],
        actions: [
          {
            kind: "update-task",
            taskId: parentClaim.taskId,
            expectedGeneration: parentClaim.generation,
            outcome: "Keep the platform reviewed from current evidence",
          },
        ],
      }),
    ).toThrow("assignment changes belong to its assigning owner");
    expect(readTaskSnapshot(config).resources?.[parentClaim.taskId]?.metadata.generation).toBe(parentClaim.generation);
    observeAppTaskIntent(config, {
      intent: {
        ...intent("maintain"),
        id: parentClaim.taskId,
        outcome: "Keep the platform reviewed from current evidence",
      },
      appAgent: "app-owner",
    });

    const revised = readTaskSnapshot(config).resources?.["runtime/owner-review"];
    expect(revised?.spec.outcome).toBe("Keep the platform reviewed from current evidence");
    expect(revised?.metadata.generation).toBe(parentClaim.generation + 1);

    const nextClaim = claimObservedAppTask(config, {
      taskId: "runtime/owner-review",
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (nextClaim.kind !== "claimed") throw new Error("expected revised claim");
    expect(
      completeAppTask(config, nextClaim, {
        summary: "Created one bounded follow-up",
        evidence: ["review:follow-up"],
        actions: [
          {
            kind: "create-task",
            id: "runtime/owner-review/follow-up",
            parentId: "runtime/owner-review",
            outcome: "Complete the bounded follow-up",
            mode: "achieve",
            outputs: [],
            acceptance: ["The follow-up is complete"],
            priority: "P2",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["created runtime/owner-review/follow-up"],
    });
  });

  it("requeues only the exact failed attention generation and retains immutable attempt evidence", () => {
    const state = fixture();
    const { config } = state;
    const failed = declareAndClaimTask(config, {
      intent: {
        id: "reviewed-failure",
        parentId: "operations",
        outcome: "Retry retained reviewed input",
        acceptance: ["The same identity completes"],
        mode: "achieve",
      },
      appAgent: "app-owner",
      handler: "agent:app-owner",
      trigger: { type: "project.comment.created", eventId: 811, data: { comment: "retained input" } },
    });
    if (failed.kind !== "claimed") throw new Error("expected failed claim");
    markAppTaskAttention(config, failed, {
      summary: "operator review required",
      reason: "retained-input-review",
      evidence: ["failure-log:811"],
    });
    const before = config.resourceStore.readTaskContext({ taskIds: [failed.taskId] });
    const failedResourceVersion = before.resources?.[failed.taskId]?.metadata.resourceVersion;
    if (!failedResourceVersion) throw new Error("expected failed task resource version");
    const attemptsBefore = structuredClone(before.attempts);
    const taskIdsBefore = Object.keys(before.resources ?? {});

    expect(() =>
      retryFailedAppTask(config, {
        appId: "sample",
        taskId: failed.taskId,
        expectedGeneration: failed.generation + 1,
        expectedResourceVersion: failedResourceVersion,
      }),
    ).toThrow("generation changed");
    expect(() =>
      retryFailedAppTask(config, {
        appId: "sample",
        taskId: failed.taskId,
        expectedGeneration: failed.generation,
        expectedResourceVersion: failedResourceVersion + 1,
      }),
    ).toThrow("resource version changed");
    const receipt = retryFailedAppTask(config, {
      appId: "sample",
      taskId: failed.taskId,
      expectedGeneration: failed.generation,
      expectedResourceVersion: failedResourceVersion,
      controlKey: `app-task-retry:sample:${failed.taskId}:${failed.generation}:${failedResourceVersion}`,
    });
    expect(
      retryFailedAppTask(config, {
        appId: "sample",
        taskId: failed.taskId,
        expectedGeneration: failed.generation,
        expectedResourceVersion: failedResourceVersion,
        controlKey: `app-task-retry:sample:${failed.taskId}:${failed.generation}:${failedResourceVersion}`,
      }),
    ).toEqual(receipt);

    expect(receipt).toMatchObject({
      action: "app.task.retry",
      disposition: "requeued",
      appId: "sample",
      taskId: failed.taskId,
      generation: failed.generation,
      previousAttemptId: failed.attemptId,
    });
    expect(receipt.resourceVersion).toBeGreaterThan(receipt.previousResourceVersion);
    const after = config.resourceStore.readTaskContext({ taskIds: [failed.taskId] });
    expect(Object.keys(after.resources ?? {})).toEqual(taskIdsBefore);
    expect(after.attempts).toEqual(attemptsBefore);
    expect(after.resources?.[failed.taskId]).toMatchObject({
      metadata: { id: failed.taskId, generation: failed.generation },
      status: { phase: "pending", evidence: ["failure-log:811"] },
    });
    expect(readAppTaskTrigger(config, failed.taskId)).toMatchObject({
      type: "project.comment.created",
      eventId: 811,
    });
    cancelAppTask(config, {
      appId: "sample",
      taskId: failed.taskId,
      expectedGeneration: failed.generation,
      expectedResourceVersion: receipt.resourceVersion,
      reason: "Cancel after the accepted retry",
    });
    const cancelled = readTaskSnapshot(config);
    const controlKey = `app-task-retry:sample:${failed.taskId}:${failed.generation}:${failedResourceVersion}`;
    expect(() =>
      retryFailedAppTask(config, {
        appId: "sample",
        taskId: failed.taskId,
        expectedGeneration: failed.generation,
        expectedResourceVersion: failedResourceVersion,
        controlKey,
      }),
    ).toThrow("cancelled task");
    expect(readTaskSnapshot(config)).toEqual(cancelled);
    expect(config.resourceStore.readControlReceipt(controlKey)?.result).toEqual(receipt);
  });

  it("rejects retry controls for non-attention tasks and attention without a failed attempt", () => {
    const runningState = fixture();
    const { config } = runningState;
    const running = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (running.kind !== "claimed") throw new Error("expected running claim");
    const runningResourceConfig = runningState.config;
    const runningResourceVersion = runningResourceConfig.resourceStore.readTaskContext({ taskIds: [running.taskId] })
      .resources?.[running.taskId]?.metadata.resourceVersion;
    if (!runningResourceVersion) throw new Error("expected running task resource version");
    expect(() =>
      retryFailedAppTask(runningResourceConfig, {
        appId: "sample",
        taskId: running.taskId,
        expectedGeneration: running.generation,
        expectedResourceVersion: runningResourceVersion,
      }),
    ).toThrow("expected attention");

    const attentionState = fixture();
    const attentionClaim = declareAndClaimTask(attentionState.config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (attentionClaim.kind !== "claimed") throw new Error("expected attention claim");
    mutateTaskResourceFixture(
      attentionState.config,
      attentionClaim.taskId,
      (resource) => {
        resource.status.phase = "attention";
      },
      false,
    );
    const attentionResourceConfig = attentionState.config;
    const attentionResourceVersion = attentionResourceConfig.resourceStore.readTaskContext({
      taskIds: [attentionClaim.taskId],
    }).resources?.[attentionClaim.taskId]?.metadata.resourceVersion;
    if (!attentionResourceVersion) throw new Error("expected attention task resource version");
    expect(() =>
      retryFailedAppTask(attentionResourceConfig, {
        appId: "sample",
        taskId: attentionClaim.taskId,
        expectedGeneration: attentionClaim.generation,
        expectedResourceVersion: attentionResourceVersion,
      }),
    ).toThrow("no completed failed attempt");
  });

  it("lets a controller retry a known transient attention task without changing its generation", () => {
    const state = fixture();
    const { config } = state;
    const retryIntent = {
      id: "retry-after-base-race",
      parentId: "operations",
      outcome: "Retry after the integration base moves",
      acceptance: ["The same task generation retries from current evidence"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const failed = declareAndClaimTask(config, {
      intent: retryIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (failed.kind !== "claimed") throw new Error("expected failed claim");
    expect(
      markAppTaskAttention(config, failed, {
        summary: "integration base changed",
        reason: "transient-base-race",
      }),
    ).toMatchObject({ status: "applied" });

    const controller = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:controller",
    });
    if (controller.kind !== "claimed") throw new Error("expected controller claim");
    expect(
      completeAppTask(config, controller, {
        summary: "retry transient attention",
        evidence: ["the integration base has stabilized"],
        actions: [
          {
            kind: "unblock-task",
            taskId: retryIntent.id,
            expectedGeneration: 1,
            reason: "Retry the same review against current origin/dev",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["unblocked retry-after-base-race"],
    });
    expect(readTaskSnapshot(config).resources?.[retryIntent.id]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending", observedGeneration: 0 },
    });
  });

  it("treats an unblock action whose target already advanced as stale", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: {
        id: "already-advancing",
        parentId: "operations",
        outcome: "Continue work already admitted by another reconciliation",
        acceptance: ["The task is reconciled once"],
        mode: "achieve",
      },
      appAgent: "app-owner",
    });
    const controller = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:controller",
    });
    if (controller.kind !== "claimed") throw new Error("expected controller claim");

    expect(() =>
      completeAppTask(config, controller, {
        summary: "retry from the earlier snapshot",
        evidence: ["target was waiting when reviewed"],
        actions: [
          {
            kind: "unblock-task",
            taskId: "already-advancing",
            expectedGeneration: 1,
            reason: "Resume the target",
          },
        ],
      }),
    ).toThrow(AppTaskActionStaleError);
    expect(readTaskSnapshot(config).resources?.["already-advancing"]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending" },
    });
  });

  it("rejects project as a fake workflow in observed intent", () => {
    const { config } = fixture();
    expect(() =>
      observeAppTaskIntent(config, {
        intent: {
          ...intent("achieve"),
          workflow: "project",
        },
        appAgent: "app-owner",
      }),
    ).toThrow("workflow must name a real workflow; omit workflow for agent-handled project work");
  });

  it("rejects project as a fake workflow in create actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "owner proposed a bounded child",
        evidence: ["owner packet reviewed"],
        actions: [
          {
            kind: "create-task",
            id: "owner-created-task",
            parentId: "operations",
            outcome: "Verify the owner action boundary",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["The reconciler creates this task"],
            owner: "branch-owner",
            workflow: "project",
          },
        ],
      }),
    ).toThrow("workflow must name a real workflow; omit workflow for agent-handled project work");
    expect(readTaskSnapshot(config).resources?.["owner-created-task"]).toBeUndefined();
  });

  it("updates task mode without overwriting its domain category", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeAppTask(config, claim, {
        summary: "updated categorized task",
        evidence: ["task schema review"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            mode: "achieve",
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    const task = readTaskSnapshot(config).resources?.["categorized-task"];
    expect(task?.spec.mode).toBe("achieve");
    expect(task?.spec.category).toBe("domain");
  });

  it("repairs explicit agent and workflow bindings through an update action", () => {
    const state = fixture();
    const { config } = state;
    const observed = observeAppTaskIntent(config, {
      intent: {
        id: "categorized-task",
        parentId: "operations",
        outcome: "Categorized bounded work",
        acceptance: ["The categorized work converges"],
        mode: "achieve",
        owner: "human",
        workflow: "removed-workflow",
        category: "domain",
      },
      appAgent: "app-owner",
    });
    if (observed.kind !== "observed") throw new Error("expected observation");

    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeAppTask(config, claim, {
        summary: "repaired stale binding",
        evidence: ["removed workflow is not registered"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: observed.generation,
            owner: "scout",
            workflow: null,
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    expect(readAppTaskIntent(config, "categorized-task")).toMatchObject({
      owner: "scout",
      category: "domain",
    });
    expect(readAppTaskIntent(config, "categorized-task")?.workflow).toBeUndefined();
    expect(readTaskSnapshot(config).resources?.["categorized-task"].metadata.generation).toBe(observed.generation + 1);
  });

  it.each(["complete", "wait"] as const)("prepares exact action sessions before a fenced %s commit", (mode) => {
    const state = fixture();
    const { config } = state;
    const targetIntent: AppTaskIntent = {
      id: "work/running-target",
      parentId: "operations",
      outcome: "Run the original target generation",
      acceptance: ["The current target generation converges"],
      mode: "achieve",
      workflow: "known-workflow",
    };
    const target = declareAndClaimTask(config, {
      intent: targetIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (target.kind !== "claimed") throw new Error("expected target claim");
    expect(associateAppTaskSession(config, target, "running-target-session")).toEqual({
      status: "recorded",
      taskId: targetIntent.id,
    });

    const carrier = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    let prepared = 0;
    let race = false;
    const settle = (expectedGeneration = target.generation) => {
      const result = {
        summary: "Advanced the dependent target",
        evidence: ["the dependent target needs revised execution intent"],
        actions: [
          {
            kind: "update-task" as const,
            taskId: targetIntent.id,
            expectedGeneration,
            outcome: "Run the revised target generation",
          },
        ],
        prepareSupersededSessions(ids: string[]) {
          prepared++;
          expect(ids).toEqual(["running-target-session"]);
          expect(config.resourceStore.readTask(target.taskId)).toMatchObject({
            metadata: { generation: target.generation },
            status: { currentAttemptId: target.attemptId },
          });
          if (race)
            mutateTaskResourceFixture(config, target.taskId, (resource) => {
              resource.status.summary = "A concurrent observation must not be overwritten";
            });
        },
      };
      return mode === "complete"
        ? completeAppTask(config, carrier, result)
        : deferAppTask(config, carrier, {
            ...result,
            disposition: "waiting",
            conditions: [
              {
                id: "proof",
                type: "sample.proof.ready",
                subject: "id:proof-1",
                expected: "ready",
              },
            ],
          });
    };
    expect(() => settle(target.generation + 1)).toThrow();
    expect(prepared).toBe(0); // Invalid actions never interrupt a session.
    race = true;
    expect(() => settle()).toThrow("stale fence");
    expect(config.resourceStore.readTask(target.taskId)?.metadata.generation).toBe(target.generation);
    expect(config.resourceStore.readTask(carrier.taskId)?.status.currentAttemptId).toBe(carrier.attemptId);
    race = false;
    expect(settle()).toMatchObject({
      status: "applied",
      actionsApplied: [`updated ${targetIntent.id}`],
      supersededSessionIds: ["running-target-session"],
    });
    expect(prepared).toBe(2);

    const targetResource = readTaskSnapshot(config).resources?.[targetIntent.id];
    expect(targetResource).toMatchObject({
      metadata: { generation: target.generation + 1 },
      status: { phase: "pending" },
    });
  });

  it("rejects an invalid action batch without partially applying earlier actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid batch",
        evidence: ["batch validation test"],
        actions: [
          {
            kind: "create-task",
            id: "must-roll-back",
            parentId: "operations",
            outcome: "Must not be persisted",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
          {
            kind: "close-task",
            taskId: "missing-task",
            expectedGeneration: 1,
            summary: "invalid",
          },
        ],
      }),
    ).toThrow("Handler action task not found: missing-task");
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.["must-roll-back"]).toBeUndefined();
    expect(tree.resources?.[claim.taskId]?.status.phase).toBe("running");
  });

  it("rejects task actions that declare outputs outside app and domain roots", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid output root",
        evidence: ["path boundary test"],
        actions: [
          {
            kind: "create-task",
            id: "must-not-escape",
            parentId: "operations",
            outcome: "Write outside the project",
            mode: "achieve",
            outputs: ["../../outside/result.txt"],
            acceptance: ["Never accepted"],
            priority: "P2",
          },
        ],
      }),
    ).toThrow("escapes the app/domain roots");
    expect(readTaskSnapshot(config).resources?.["must-not-escape"]).toBeUndefined();
  });

  it("treats repeated close actions against already receipted tasks as idempotent", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    expect(
      completeAppTask(config, first, {
        summary: "close completed child",
        evidence: ["first reconciliation"],
        actions: [
          {
            kind: "close-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            summary: "child finished",
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["closed categorized-task"] });

    const second = declareAndClaimTask(config, {
      intent: {
        id: "route-review",
        parentId: "operations",
        outcome: "Review route residue",
        acceptance: ["Route residue is reconciled"],
        mode: "achieve",
        workflow: "known-workflow",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");

    expect(
      completeAppTask(config, second, {
        summary: "stale child close observed",
        evidence: ["second reconciliation"],
        actions: [
          {
            kind: "close-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            summary: "already finished",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["already completed categorized-task"],
    });

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.["categorized-task"]).toBeUndefined();
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
    expect(tree.resources?.["route-review"]).toBeUndefined();
  });

  it("rejects update actions against completed task receipts", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    completeAppTask(config, first, {
      summary: "close completed child",
      evidence: ["first reconciliation"],
      actions: [
        {
          kind: "close-task",
          taskId: "categorized-task",
          expectedGeneration: 1,
          summary: "child finished",
        },
      ],
    });

    const review = declareAndClaimTask(config, {
      intent: {
        id: "receipt-update-review",
        parentId: "operations",
        outcome: "Review a completed task",
        acceptance: ["Completed work is handled truthfully"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeAppTask(config, review, {
        summary: "attempted completed-task update",
        evidence: ["receipt inspection"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            mode: "maintain",
          },
        ],
      }),
    ).toThrow("Handler update-task action cannot mutate completed task categorized-task; create a new linked task");

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.["receipt-update-review"]?.status.phase).toBe("running");
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
  });

  it("rejects create actions that reuse a completed task identity", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    completeAppTask(config, first, {
      summary: "close completed child",
      evidence: ["first reconciliation"],
      actions: [
        {
          kind: "close-task",
          taskId: "categorized-task",
          expectedGeneration: 1,
          summary: "child finished",
        },
      ],
    });

    const review = declareAndClaimTask(config, {
      intent: {
        id: "receipt-create-review",
        parentId: "operations",
        outcome: "Review a completed task identity",
        acceptance: ["Completed identities are not reused"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeAppTask(config, review, {
        summary: "attempted completed-task recreation",
        evidence: ["receipt inspection"],
        actions: [
          {
            kind: "create-task",
            id: "categorized-task",
            parentId: "operations",
            outcome: "Reuse a completed identity",
            acceptance: ["This action must be rejected"],
            mode: "achieve",
            outputs: [],
            priority: "P2",
          },
        ],
      }),
    ).toThrow("Handler action task already exists or completed: categorized-task");

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.["receipt-create-review"]?.status.phase).toBe("running");
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
  });

  it("treats an identical create action for an existing live task as idempotent", () => {
    const { config } = fixture();
    const childIntent: AppTaskIntent = {
      id: "already-created-child",
      parentId: "operations",
      outcome: "Complete deterministic child work",
      acceptance: ["The child converges once"],
      mode: "achieve",
      owner: "branch-owner",
      workflow: "known-workflow",
      input: { workKey: "same-work" },
      outputs: ["proof.md"],
      priority: "P1",
    };
    observeAppTaskIntent(config, { intent: childIntent, appAgent: "app-owner" });
    const review = declareAndClaimTask(config, {
      intent: {
        id: "live-create-review",
        parentId: "operations",
        outcome: "Reconcile deterministic child creation",
        acceptance: ["Concurrent creation is harmless"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(
      completeAppTask(config, review, {
        summary: "the desired child already exists",
        evidence: ["current task resource"],
        actions: [{ kind: "create-task", ...childIntent }],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["already exists already-created-child"] });
    const tree = readTaskSnapshot(config);
    expect(tree.resources?.["already-created-child"]?.metadata.generation).toBe(1);
    expect(tree.resources?.["live-create-review"]?.status.phase).toBe("converged");
  });

  it("rejects an existing live task with a different specification", () => {
    const { config } = fixture();
    const review = declareAndClaimTask(config, {
      intent: {
        id: "live-create-conflict-review",
        parentId: "operations",
        outcome: "Reject conflicting deterministic child creation",
        acceptance: ["Intent is not overwritten"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeAppTask(config, review, {
        summary: "attempted conflicting reuse",
        evidence: ["current task resource"],
        actions: [
          {
            kind: "create-task",
            id: "categorized-task",
            parentId: "operations",
            outcome: "Replace existing intent",
            acceptance: ["This action must be rejected"],
            mode: "achieve",
            outputs: [],
          },
        ],
      }),
    ).toThrow("Handler action task already exists with a different specification: categorized-task");
    expect(readTaskSnapshot(config).resources?.["categorized-task"]?.spec.outcome).toBe("Categorized bounded work");
  });

  it("rejects malformed action payloads and blank evidence before mutation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid runtime payload",
        evidence: ["  "],
        actions: [
          {
            kind: "create-task",
            id: "must-not-apply",
            parentId: "operations",
            outcome: "Must not be persisted",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
        ],
      }),
    ).toThrow("require non-empty evidence");
    expect(readTaskSnapshot(config).resources?.["must-not-apply"]).toBeUndefined();

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid runtime payload",
        evidence: ["runtime validation test"],
        actions: [{ kind: "create-task", id: "bad-shape" } as never],
      }),
    ).toThrow("parentId requires a non-empty string");
    expect(readTaskSnapshot(config).resources?.["bad-shape"]).toBeUndefined();
    expect(readTaskSnapshot(config).resources?.[claim.taskId]?.status.phase).toBe("running");
  });

  it("ends waiting attempts only with an exact Condition", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without identity",
      }),
    ).toThrow("requires at least one exact Condition");
    expect(readTaskSnapshot(config).resources?.[claim.taskId]?.status.phase).toBe("running");

    expect(() =>
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting with an ambiguous condition",
        conditions: [{} as never],
      }),
    ).toThrow("Condition for pipeline-monitor identity requires a non-empty string");
    expect(readTaskSnapshot(config).resources?.[claim.taskId]?.status.phase).toBe("running");

    expect(() =>
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without a type",
        conditions: [{ id: "session-terminal:s_1" } as never],
      }),
    ).toThrow("Condition session-terminal:s_1 type requires a non-empty string");

    expect(() =>
      deferCanonicalAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without accountable ownership",
        conditions: [
          {
            id: "session-terminal:s_1",
            type: "session.end",
            subject: "session:s_1",
            expected: "done",
            reviewAfterMs: 60_000,
          },
        ],
      }),
    ).toThrow("Condition session-terminal:s_1 owner requires a non-empty string");

    expect(() =>
      deferCanonicalAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without a recovery checkpoint",
        conditions: [
          {
            id: "session-terminal:s_1",
            type: "session.end",
            subject: "session:s_1",
            expected: "done",
            owner: "app:test-external",
          },
        ],
      }),
    ).toThrow("Condition session-terminal:s_1 reviewAfterMs must be an integer");

    const result = deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for the source session",
      result: {
        classification: "prod_issue",
        failureFingerprint: "failure-1",
      },
      evidence: ["source session is still running"],
      conditions: [
        {
          id: "session-terminal:s_1",
          type: "session.end",
          subject: "session:s_1",
          expected: "done",
        },
      ],
    });
    expect(result.status).toBe("applied");
    expect(readTaskSnapshot(config).resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "waiting",
        observedAttemptId: claim.attemptId,
        conditionIds: ["session-terminal:s_1"],
        result: {
          classification: "prod_issue",
          failureFingerprint: "failure-1",
        },
      },
    });
    expect(readTaskSnapshot(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      metadata: {
        id: "session-terminal:s_1",
        generation: 1,
        resourceVersion: 1,
      },
      spec: {
        type: "session.end",
        subject: "session:s_1",
        expected: "done",
      },
      status: { observedGeneration: 0, state: "unknown" },
    });

    const timerWake = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(timerWake).toMatchObject({
      kind: "waiting",
      taskId: "pipeline-monitor",
      conditionIds: ["session-terminal:s_1"],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "session.end",
        sessionId: "s_other",
        status: "done",
      }),
    ).toEqual([]);

    const wakes = trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "s_1",
      status: "done",
      source: "test",
    });
    expect(wakes).toMatchObject([
      {
        conditionId: "session-terminal:s_1",
        taskId: "pipeline-monitor",
      },
    ]);
    expect(readTaskSnapshot(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: {
        observedGeneration: 1,
        state: "true",
        observed: { eventType: "session.end", sessionId: "s_1", state: "done" },
      },
    });

    const resumed = claimObservedAppTask(config, {
      taskId: wakes[0].taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:session-terminal:s_1",
    });
    expect(resumed.kind).toBe("claimed");
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    completeAppTask(config, resumed, { summary: "session terminal observed" });
    expect(readTaskSnapshot(config).conditions?.["session-terminal:s_1"]).toBeUndefined();
    expect(readTaskSnapshot(config).resources?.["pipeline-monitor"]?.status.conditionIds ?? []).toEqual([]);
  });

  it.each(["project.task.tick", "sample.unexpected-update"])(
    "preserves new routed %s input queued while the task installs a wait",
    (type) => {
      const state = fixture();
      const { config } = state;
      const claim = declareAndClaimTask(config, {
        intent: { ...intent("maintain"), id: "work/queued-pulse" },
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (claim.kind !== "claimed") throw new Error("expected claim");

      expect(
        recordAppTaskTrigger(config, claim.taskId, {
          type,
          data: { taskId: claim.taskId, reason: "periodic-pulse" },
        }),
      ).toEqual({ kind: "recorded" });

      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting for pipeline completion",
        conditions: [
          {
            id: "pipeline-run:42:completed",
            type: "pipeline-run.state",
            subject: "pipeline-run:42",
            expected: "completed",
          },
        ],
      });

      expect(readAppTaskTrigger(config, claim.taskId)).toMatchObject({ type });
      expect(
        claimObservedAppTask(config, {
          taskId: claim.taskId,
          appAgent: "app-owner",
          handler: "workflow:known-workflow",
        }),
      ).toMatchObject({ kind: "claimed", trigger: { type } });
      expect(readTaskSnapshot(config).resources[claim.taskId].status.conditionIds).toEqual([
        "pipeline-run:42:completed",
      ]);
    },
  );

  it("preserves a queued trigger that satisfies the wait installed by the attempt", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "work/queued-completion" },
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const completion = {
      type: "pipeline-run.state",
      pipelineRunId: "42",
      state: "completed",
      source: "pipeline-watcher",
    };
    expect(recordAppTaskTrigger(config, claim.taskId, completion)).toEqual({ kind: "recorded" });

    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for pipeline completion",
      conditions: [
        {
          id: "pipeline-run:42:completed",
          type: "pipeline-run.state",
          subject: "pipeline-run:42",
          expected: "completed",
        },
      ],
    });

    expect(readTaskSnapshot(config).conditions?.["pipeline-run:42:completed"]?.status.state).toBe("true");
    expect(readAppTaskTrigger(config, claim.taskId)).toEqual(completion);
    const resumed = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(resumed).toMatchObject({ kind: "claimed", trigger: completion });
  });

  it("keeps later Condition events pending while an earlier Condition event is reconciling", () => {
    const { config } = fixture();
    const initial = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "work/two-conditions" },
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (initial.kind !== "claimed") throw new Error("expected initial claim");
    deferAppTask(config, initial, {
      disposition: "waiting",
      summary: "waiting for either dependency update",
      conditions: [
        {
          id: "dependency:a",
          type: "project.task.reconciled",
          subject: "task:dependency-a",
          expected: "done",
        },
        {
          id: "dependency:b",
          type: "project.task.reconciled",
          subject: "task:dependency-b",
          expected: "done",
        },
      ],
    });

    const firstEvent = {
      type: "project.task.reconciled",
      eventId: 801,
      taskId: "dependency-a",
      state: "converged",
    };
    expect(trackAppTaskConditionEvent(config, firstEvent)).toMatchObject([
      { conditionId: "dependency:a", taskId: "work/two-conditions" },
    ]);
    const first = claimObservedAppTask(config, {
      taskId: "work/two-conditions",
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:dependency:a",
    });
    if (first.kind !== "claimed") throw new Error("expected first Condition claim");
    expect(first.events.map(({ event }) => event.eventId)).toEqual([801]);

    const secondEvent = {
      type: "project.task.reconciled",
      eventId: 802,
      taskId: "dependency-b",
      state: "converged",
    };
    expect(trackAppTaskConditionEvent(config, secondEvent)).toMatchObject([
      { conditionId: "dependency:b", taskId: "work/two-conditions" },
    ]);
    expect(trackAppTaskConditionEvent(config, secondEvent)).toEqual([]);
    expect(
      completeAppTask(config, first, {
        summary: "observed dependency A",
        evidence: ["event:801"],
      }),
    ).toMatchObject({ status: "applied", taskContinues: true });

    const second = claimObservedAppTask(config, {
      taskId: "work/two-conditions",
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:dependency:b",
    });
    if (second.kind !== "claimed") throw new Error("expected second Condition claim");
    expect(second.events.map(({ event }) => event.eventId)).toEqual([802]);
  });

  it("keeps a decomposition parent open while applying child task actions", () => {
    const state = fixture();
    const { config } = state;
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "declared bounded child work for the parent",
        evidence: ["frontier selected child-a and child-b"],
        actions: [
          {
            kind: "create-task",
            id: "work/child-a",
            parentId: claim.taskId,
            outcome: "Finish child A",
            acceptance: ["Child A converges"],
            mode: "achieve",
            outputs: [],
          },
          {
            kind: "create-task",
            id: "work/child-b",
            parentId: claim.taskId,
            outcome: "Finish child B",
            acceptance: ["Child B converges"],
            mode: "achieve",
            outputs: [],
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["created work/child-a", "created work/child-b"],
    });

    const tree = readTaskSnapshot(config);
    expect(tree.resources?.[claim.taskId]?.status).toMatchObject({
      phase: "waiting",
      conditionIds: [],
    });
    expect(tree.resources?.["work/child-a"]).toMatchObject({
      spec: { parentId: claim.taskId },
      status: { phase: "pending" },
    });
    expect(tree.resources?.["work/child-b"]).toMatchObject({
      spec: { parentId: claim.taskId },
      status: { phase: "pending" },
    });
    expect(tree.conditions ?? {}).toEqual({});
    expect(listRunnableAppTaskIds(config)).toEqual(expect.arrayContaining(["work/child-a", "work/child-b"]));
  });

  it("delivers every child transition to the parent in one ordered event batch", () => {
    const { config } = fixture();
    const parent = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "work/parent-batch" },
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (parent.kind !== "claimed") throw new Error("expected parent claim");
    const child = (id: string) => ({
      kind: "create-task" as const,
      id,
      parentId: parent.taskId,
      outcome: `Complete ${id}`,
      acceptance: [`${id} converges`],
      mode: "achieve" as const,
      outputs: [],
      priority: "P2" as const,
    });
    expect(
      deferAppTask(config, parent, {
        disposition: "waiting",
        summary: "waiting for both children",
        evidence: ["decomposition:two-children"],
        actions: [child("work/child-one"), child("work/child-two")],
      }),
    ).toMatchObject({ status: "applied" });

    for (const childTaskId of ["work/child-one", "work/child-two"]) {
      const childClaim = claimObservedAppTask(config, {
        taskId: childTaskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "child",
      });
      if (childClaim.kind !== "claimed") throw new Error(`expected claim for ${childTaskId}`);
      expect(
        completeAppTask(config, childClaim, {
          summary: `${childTaskId} converged`,
          evidence: [`proof:${childTaskId}`],
        }),
      ).toMatchObject({ status: "applied", dependentTaskIds: [parent.taskId] });
    }

    const resumed = claimObservedAppTask(config, {
      taskId: parent.taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "children-transitioned",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed parent claim");
    expect(resumed.events.map(({ event }) => event.childTaskId)).toEqual(["work/child-one", "work/child-two"]);
  });

  it("filters task Conditions by subject and expected state", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for dependency completion",
      conditions: [
        {
          id: "task-done:dependency-1",
          type: "project.task.reconciled",
          subject: "task:dependency-1",
          expected: "done",
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-2",
        disposition: "converged",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "waiting",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "converged",
      }),
    ).toMatchObject([{ conditionId: "task-done:dependency-1", taskId: "pipeline-monitor" }]);
  });

  it("wakes an exact pipeline-run Condition from a watcher observation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for pipeline",
      evidence: [],
      conditions: [
        {
          id: "pipeline:run-42",
          type: "project.test_run.completed",
          subject: "pipeline-run:run-42",
          expected: { field: "status", equals: "passed" },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.test_run.completed",
        pipelineRunId: "run-42",
        status: "failed",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.test_run.completed",
        pipelineRunId: "run-42",
        status: "passed",
        source: "aks-pipeline-watcher",
      }),
    ).toMatchObject([{ conditionId: "pipeline:run-42", taskId: "pipeline-monitor" }]);
  });

  it("wakes every task linked to the same typed Condition", () => {
    const { config } = fixture();
    const intents = ["pipeline-a", "pipeline-b"].map((id) => ({
      ...intent("maintain"),
      id,
      outcome: `Keep ${id} current`,
    }));
    for (const taskIntent of intents) {
      const claim = declareAndClaimTask(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (claim.kind !== "claimed") throw new Error("expected claim");
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting for the shared dependency",
        conditions: [
          {
            id: "shared-dependency",
            type: "project.task.reconciled",
            subject: "task:dependency-shared",
            expected: "done",
          },
        ],
      });
    }

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-shared",
        state: "converged",
      }).map((wake) => wake.taskId),
    ).toEqual(["pipeline-a", "pipeline-b"]);
    expect(readTaskSnapshot(config).conditions?.["shared-dependency"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: { observedGeneration: 1, state: "true" },
    });

    for (const taskIntent of intents) {
      const resumed = declareAndClaimTask(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
      completeAppTask(config, resumed, { summary: `${taskIntent.id} converged` });
    }
    expect(readTaskSnapshot(config).conditions?.["shared-dependency"]).toBeUndefined();
  });

  it("rejects changing a shared Condition specification", () => {
    const { config } = fixture();
    const firstIntent = { ...intent("maintain"), id: "pipeline-a" };
    const secondIntent = { ...intent("maintain"), id: "pipeline-b" };
    const first = declareAndClaimTask(config, {
      intent: firstIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    const second = declareAndClaimTask(config, {
      intent: secondIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed" || second.kind !== "claimed") throw new Error("expected claims");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for shared session",
      conditions: [
        {
          id: "shared-session",
          type: "session.end",
          subject: "session:first",
          expected: "done",
        },
      ],
    });

    expect(() =>
      deferAppTask(config, second, {
        disposition: "waiting",
        summary: "attempted conflicting wait",
        conditions: [
          {
            id: "shared-session",
            type: "session.end",
            subject: "session:other",
            expected: "done",
          },
        ],
      }),
    ).toThrow("already linked to another task with a different specification");
  });

  it("retires a satisfied Condition only when accepting the next wait", () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    const condition = {
      id: "session-terminal",
      type: "session.end",
      subject: "session:repeatable",
      expected: "done",
    } as const;
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for first observation",
      conditions: [condition],
    });
    trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "repeatable",
      status: "done",
    });
    const resumed = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    expect(readTaskSnapshot(config).conditions?.[condition.id]).toMatchObject({ status: { state: "true" } });

    deferAppTask(config, resumed, {
      disposition: "waiting",
      summary: "waiting for a new observation",
      conditions: [condition],
    });
    expect(readTaskSnapshot(config).conditions?.[condition.id]).toMatchObject({
      status: { observedGeneration: 0, state: "unknown" },
    });
    expect(
      trackAppTaskConditionEvent(config, {
        type: "unrelated.event",
        sessionId: "repeatable",
        status: "done",
      }),
    ).toEqual([]);
  });

  it("does not replay an old level observation into a newly established state wait", async () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const condition = {
      id: "credential-ready:xhs",
      type: "credential.state",
      subject: "credential:xhs",
      expected: { field: "state", equals: "ready" },
    } as const;
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for credential",
      conditions: [condition],
    });

    const readyObservation = {
      type: "credential.state",
      credential: "xhs",
      state: "ready",
      timestamp: Date.now(),
    };
    expect(trackAppTaskConditionEvent(config, readyObservation)).toEqual([
      { conditionId: condition.id, taskId: taskIntent.id },
    ]);
    const resumed = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    await new Promise((resolve) => setTimeout(resolve, 5));
    deferAppTask(config, resumed, {
      disposition: "waiting",
      summary: "credential was lost before use",
      conditions: [condition],
    });

    expect(trackAppTaskConditionEvent(config, readyObservation)).toEqual([]);
    expect(readTaskSnapshot(config).conditions?.[condition.id]).toMatchObject({
      status: { observedGeneration: 0, state: "unknown" },
    });
  });

  it("does not replay an old scheduled check into a newly established pulse wait", () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const condition = {
      id: "next-master-validation-check",
      type: "aks.master-validation.check",
      subject: "project:demo",
      expected: { field: "project", equals: "demo" },
    } as const;
    const oldPulse = {
      type: "aks.master-validation.check",
      project: "demo",
      timestamp: Date.now() - 10_000,
    };
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for the next scheduled check",
      conditions: [condition],
    });

    expect(trackAppTaskConditionEvent(config, oldPulse)).toEqual([]);
    expect(readTaskSnapshot(config).conditions?.[condition.id]).toMatchObject({
      status: { observedGeneration: 0, state: "unknown" },
    });

    expect(
      trackAppTaskConditionEvent(config, {
        ...oldPulse,
        timestamp: Date.now() + 1_000,
      }),
    ).toEqual([{ conditionId: condition.id, taskId: taskIntent.id }]);
  });

  it("does not replay an old capacity pulse into a future-slot wait", () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const condition = {
      id: "capacity-after-slot-82677:task-holder-a",
      type: "aks.master-validation.capacity-pulse",
      subject: "project:demo",
      expected: { field: "cycleSlot", notEquals: 82677 },
    } as const;
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for a future capacity slot",
      conditions: [condition],
    });
    const establishedAt = Date.parse(readTaskSnapshot(config).conditions?.[condition.id]?.status.observedAt ?? "");

    expect(
      trackAppTaskConditionEvent(config, {
        type: condition.type,
        project: "demo",
        cycleSlot: 82676,
        timestamp: establishedAt - 1,
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: condition.type,
        project: "demo",
        cycleSlot: 82677,
        timestamp: establishedAt + 1,
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: condition.type,
        project: "demo",
        cycleSlot: 82678,
        timestamp: establishedAt + 2,
      }),
    ).toEqual([{ conditionId: condition.id, taskId: taskIntent.id }]);
  });

  it("advances Condition generation when its desired observation changes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for first session",
      conditions: [
        {
          id: "session-terminal",
          type: "session.end",
          subject: "session:first",
          expected: "done",
        },
      ],
    });
    trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "first",
      status: "done",
    });
    const resumed = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    deferAppTask(config, resumed, {
      disposition: "waiting",
      summary: "waiting for replacement session",
      conditions: [
        {
          id: "session-terminal",
          type: "session.end",
          subject: "session:replacement",
          expected: "done",
        },
      ],
    });

    expect(readTaskSnapshot(config).conditions?.["session-terminal"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 1 },
      spec: { subject: "session:replacement" },
      status: { observedGeneration: 0, state: "unknown" },
    });
    expect(
      trackAppTaskConditionEvent(config, {
        type: "session.end",
        sessionId: "first",
        status: "done",
      }),
    ).toEqual([]);
  });

  it("matches exact app-specific event fields without an app-specific controller", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact approval",
      conditions: [
        {
          id: "approval-returned",
          type: "project.approval.submitted",
          subject: "approvalId:approval-42",
          expected: { field: "decision", anyOf: ["approve", "decline"] },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        approvalId: "approval-42",
        decision: "hold",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        data: { approvalId: "approval-42", decision: "approve" },
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "approval-returned" }]);
  });

  it("keeps approval-packet waits blocked when only the decision matches but the lineage does not", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const approvalId =
      "alpha-project:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const waitId =
      "wait:alpha-project:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const pathId = "ops/request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730";

    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact approval lineage",
      conditions: [
        {
          id: waitId,
          type: "project.approval.submitted",
          subject: "project:alpha-project",
          expected: {
            approvalKind: "approval-packet-dispatch",
            approvalId,
            waitId,
            pathId,
            acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
            field: "decision",
            anyOf: ["approve", "adjust", "hold", "decline", "reroute"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        project: "alpha-project",
        approvalKind: "approval-packet-dispatch",
        approvalId:
          "alpha-project:approval:node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730:evidence-archive-ops-send-node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730-packet.md",
        waitId:
          "wait:alpha-project:approval:node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730:evidence-archive-ops-send-node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730-packet.md",
        pathId: "node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730",
        decision: "approve",
      }),
    ).toEqual([]);

    expect(readTaskSnapshot(config).conditions?.[waitId]).toMatchObject({
      status: { state: "unknown" },
    });
  });

  it("wakes approval-packet waits only when the returned event matches the exact lineage", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const approvalId =
      "alpha-project:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const waitId =
      "wait:alpha-project:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const pathId = "ops/request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730";

    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact approval lineage",
      conditions: [
        {
          id: waitId,
          type: "project.approval.submitted",
          subject: "project:alpha-project",
          expected: {
            approvalKind: "approval-packet-dispatch",
            approvalId,
            waitId,
            pathId,
            acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
            field: "decision",
            anyOf: ["approve", "adjust", "hold", "decline", "reroute"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        project: "alpha-project",
        approvalKind: "approval-packet-dispatch",
        approvalId,
        waitId,
        pathId,
        decision: "approve",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: waitId }]);

    expect(readTaskSnapshot(config).conditions?.[waitId]).toMatchObject({
      status: {
        state: "true",
        observed: {
          eventType: "project.approval.submitted",
        },
      },
    });
  });

  it("matches owner decision conditions using allowedDecisions against event decision", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact owner decision",
      conditions: [
        {
          id: "owner-decision",
          type: "project.owner-decision.recorded",
          subject: "task:pipeline-monitor",
          expected: {
            taskBranch: "task/pipeline-monitor",
            headCommit: "abc123",
            allowedDecisions: ["abandon-legacy-merge", "extract-current-lineage-successor"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.owner-decision.recorded",
        taskId: "pipeline-monitor",
        taskBranch: "task/pipeline-monitor",
        headCommit: "abc123",
        decision: "hold",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.owner-decision.recorded",
        taskId: "pipeline-monitor",
        taskBranch: "task/pipeline-monitor",
        headCommit: "abc123",
        decision: "extract-current-lineage-successor",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "owner-decision" }]);
  });

  it("matches owner decision conditions using acceptedDecisions against event decision", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact owner decision",
      conditions: [
        {
          id: "owner-decision",
          type: "project.owner-decision.recorded",
          subject: "project:alpha-project",
          expected: {
            taskId: "pipeline-monitor",
            sourceBranch: "codex/source",
            acceptedDecisions: ["abandon-stale-lineage", "approve-fresh-current-lineage-app-routing-successor"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.owner-decision.recorded",
        project: "alpha-project",
        taskId: "pipeline-monitor",
        sourceBranch: "codex/source",
        decision: "approve-fresh-current-lineage-app-routing-successor",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "owner-decision" }]);
  });

  it("keeps waiting until the Condition observer reports state", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for external evidence",
      conditions: [
        {
          id: "pipeline-result",
          type: "pipeline.result.available",
          subject: "pipeline-run:run-42",
          expected: { field: "status", equals: "succeeded" },
          owner: "app:pipeline-observer",
          reviewAfterMs: 31_536_000_000,
        },
      ],
    });
    const stale = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const staleResource = stale.resources?.[claim.taskId];
    const staleCondition = stale.conditions?.["pipeline-result"];
    if (!staleResource || !staleCondition) throw new Error("expected stale Condition fixture");
    staleCondition.status.observedAt = "2026-01-01T00:00:00.000Z";
    staleCondition.metadata.resourceVersion += 1;
    expect(
      config.resourceStore.commit({
        fences: [{ taskId: claim.taskId, resourceVersion: staleResource.metadata.resourceVersion }],
        conditions: [staleCondition],
      }),
    ).toBe(true);

    expect(
      declareAndClaimTask(config, {
        intent: intent("maintain"),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "periodic-resync",
      }),
    ).toMatchObject({ kind: "waiting", taskId: "pipeline-monitor", conditionIds: ["pipeline-result"] });
  });

  it("links a watcher event Condition without monitoring the pipeline itself", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "pipeline watcher will emit the terminal observation",
        conditions: [
          {
            id: "pipeline-run:42",
            type: "pipeline.completed",
            subject: "pipelineRun:42",
            expected: { field: "result", anyOf: ["succeeded", "failed"] },
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });
    const waitingTree = readTaskSnapshot(config);
    expect(waitingTree.resources?.["pipeline-monitor"]).toMatchObject({
      status: {
        phase: "waiting",
        conditionIds: ["pipeline-run:42"],
      },
    });
    expect(waitingTree.conditions?.["pipeline-run:42"]).toMatchObject({
      spec: {
        type: "pipeline.completed",
        subject: "pipelineRun:42",
      },
      status: { state: "unknown" },
    });
    expect(
      declareAndClaimTask(config, {
        intent: intent("maintain"),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "waiting", conditionIds: ["pipeline-run:42"] });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pipeline.completed",
        pipelineRun: "42",
        result: "succeeded",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "pipeline-run:42" }]);
  });

  it("matches pull-request typed subjects through the generic Condition tracker", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for PR merge or review change",
      conditions: [
        {
          id: "pull-request-77-changed",
          type: "pull-request.state",
          subject: "pull-request:77",
          expected: {
            field: "state",
            anyOf: ["completed", "abandoned", "conflicted", "source-updated"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        state: "completed",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "pull-request-77-changed" }]);
  });

  it("wakes when a level-observed PR source differs from the tested commit", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for PR source update",
      conditions: [
        {
          id: "pull-request-77-source-not-abc",
          type: "pull-request.state",
          subject: "pull-request:77",
          expected: { field: "sourceCommit", notEquals: "abc" },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        sourceCommit: "abc",
        state: "active",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        sourceCommit: "def",
        state: "active",
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "pull-request-77-source-not-abc",
      },
    ]);
  });

  it("does not wake a new repo-ref wait from an older journal observation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for origin/dev to advance",
      conditions: [
        {
          id: "origin-dev-after-abc",
          type: "aks.repo-ref.observed",
          subject: "repoRef:origin/dev",
          expected: { field: "commit", notEquals: "abc" },
        },
      ],
    });

    const establishedAt = Date.parse(
      readTaskSnapshot(config).conditions?.["origin-dev-after-abc"]?.status.observedAt ?? "",
    );
    expect(Number.isFinite(establishedAt)).toBe(true);

    expect(
      trackAppTaskConditionEvent(config, {
        type: "aks.repo-ref.observed",
        repoRef: "origin/dev",
        commit: "older-different-commit",
        timestamp: establishedAt - 1,
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "aks.repo-ref.observed",
        repoRef: "origin/dev",
        commit: "newer-different-commit",
        timestamp: establishedAt + 1,
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "origin-dev-after-abc",
      },
    ]);
  });

  it("supports future-only comparisons for level-based pipeline artifact facts", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for the first later artifact",
      conditions: [
        {
          id: "artifact-after-100",
          type: "pipeline-artifact.available",
          subject: "project:sample",
          expected: {
            artifactName: "slice-06-test-results",
            sourceBranch: "refs/heads/main",
            pipelineRunId: { gt: "100" },
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pipeline-artifact.available",
        project: "sample",
        artifactName: "slice-06-test-results",
        sourceBranch: "refs/heads/main",
        pipelineRunId: "100",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "pipeline-artifact.available",
        project: "sample",
        artifactName: "slice-06-test-results",
        sourceBranch: "refs/heads/main",
        pipelineRunId: "101",
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "artifact-after-100",
      },
    ]);
  });
});
