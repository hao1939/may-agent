import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskMode } from "@may-agent/sdk";
import { AppTaskController } from "./controller.js";
import { readAppTaskReconciliationEvents } from "./app-task-context.js";
import { APP_TASK_RECOVERY_OWNER } from "./session-binding.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskRequest, type TaskRequestInput } from "../state/inbox.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import {
  appTaskContext,
  cancelAppTask,
  closeAppTask,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  stopAppTask,
} from "./app-task-reconciler.js";

const roots: string[] = [];
const stores = new Set<AppTaskResourceStore>();
afterEach(() => {
  for (const store of stores) store.close();
  stores.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(mode: TaskMode = "achieve") {
  const root = mkdtempSync(join(tmpdir(), "may-common-lifecycle-"));
  roots.push(root);
  const databasePath = join(root, "host.sqlite");
  let config = appTaskTestContext({
    appDir: root,
    agent: "owner",
    maxConcurrent: 3,
    databasePath,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "owner" } } },
  });
  stores.add(config.resourceStore);
  const intent = {
    id: "conversation",
    parentId: "root",
    outcome: "Discuss and return requested measurements",
    acceptance: ["Explain evidence honestly"],
    mode,
  };
  observeAppTaskIntent(config, {
    intent,
    appAgent: "owner",
    trigger: { type: "conversation.message", eventId: 1, data: { text: "Get a measurement" } },
  });
  const claim = (taskId = "conversation") => {
    const result = claimObservedAppTask(config, { taskId, appAgent: "owner", handler: "agent" });
    if (result.kind !== "claimed") throw new Error(`Expected ${taskId} claim, got ${result.kind}`);
    return result;
  };
  const reopen = () => {
    config.resourceStore.close();
    stores.delete(config.resourceStore);
    const store = AppTaskResourceStore.openStandalone(databasePath, "sample");
    stores.add(store);
    config = appTaskContext({ appDir: root, projectDir: root, agent: "owner", maxConcurrent: 3, resourceStore: store });
  };
  return {
    get config() {
      return config;
    },
    intent,
    claim,
    reopen,
  };
}

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("common Task lifecycle source PoC", () => {
  it("accepts an answer to new input while keeping a different accepted wait and its route", () => {
    const f = fixture();
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Wait for measurement",
      evidence: ["measurement:pending"],
      conditions: [
        {
          id: "measurement",
          type: "sample.ready",
          subject: "sample:one",
          expected: true,
          owner: "app:sampler",
          reviewAfterMs: 60_000,
        },
      ],
    });
    const conditions = f.config.resourceStore.readTaskContext({ taskIds: ["conversation"] }).conditions;
    recordAppTaskTrigger(f.config, "conversation", {
      type: "conversation.message",
      eventId: 2,
      data: { text: "Discuss the cost while measurement continues" },
    });
    const discussion = f.claim();
    completeAppTask(f.config, discussion, {
      summary: "Explained the cost tradeoff",
      response: "The measurement can continue.",
      evidence: ["human:discussion"],
    });
    expect(f.config.resourceStore.readAttempt(discussion.attemptId)?.acceptedResult?.state).toBe("converged");
    expect(f.config.resourceStore.readTaskContext({ taskIds: ["conversation"] }).conditions).toEqual(conditions);
    expect(f.config.resourceStore.readTask("conversation")?.status.phase).toBe("waiting");
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  });

  it("returns a give-up judgment as non-success without closing the Task or retrying it automatically", () => {
    const f = fixture("maintain");
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Get the report",
      evidence: ["input:report"],
      actions: [
        {
          kind: "create-task",
          id: "report",
          parentId: "conversation",
          outcome: "Recover a disposable report",
          acceptance: ["Return the report within its cost limit"],
          mode: "maintain",
          outputs: [],
          priority: "P2",
        },
      ],
    });
    const child = f.claim("report");
    expect(
      stopAppTask(f.config, child, {
        summary: "Reconstruction costs more than the report is worth",
        result: { abandoned: true },
        evidence: ["cost:four-hours"],
      }).status,
    ).toBe("applied");
    expect(f.config.resourceStore.readCancellation("report")).toBeNull();
    expect(f.config.resourceStore.readAttempt(child.attemptId)?.acceptedResult?.state).toBe("stopped");
    const owner = f.claim();
    const returned = readAppTaskReconciliationEvents(f.config.resourceStore, owner).items[0]?.event.data.acceptedResult;
    expect(returned).toMatchObject({ state: "stopped", result: { abandoned: true } });
    completeAppTask(f.config, owner, { summary: "Explained the abandonment", evidence: ["report:stopped"] });
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
    f.reopen();
    const resource = f.config.resourceStore.readTask("report")!;
    expect(
      closeAppTask(f.config, {
        appId: "sample",
        taskId: "report",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
        reason: "Owner accepted the abandonment",
        afterResult: child.attemptId,
      }).closure.kind,
    ).toBe("closed");
    expect(f.config.resourceStore.readAttempt(child.attemptId)?.acceptedResult?.state).toBe("stopped");
  });

  it("keeps an accepted wait without asking the agent to repeat its identifiers or timing", () => {
    const f = fixture();
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Waiting for a sample",
      evidence: ["sample:pending"],
      conditions: [
        {
          id: "sample-ready",
          type: "sample.ready",
          subject: "sample:one",
          expected: true,
          owner: "app:sampler",
          reviewAfterMs: 60_000,
        },
      ],
    });
    const before = f.config.resourceStore.readTaskContext({ taskIds: ["conversation"] }).conditions;
    f.reopen();
    recordAppTaskTrigger(f.config, "conversation", {
      type: "conversation.message",
      eventId: 2,
      data: { text: "The sample is still needed" },
    });
    expect(
      deferAppTask(f.config, f.claim(), {
        disposition: "waiting",
        summary: "The wait is still useful",
        evidence: ["human:confirmation"],
      }).status,
    ).toBe("applied");
    expect(f.config.resourceStore.readTaskContext({ taskIds: ["conversation"] }).conditions).toEqual(before);
    expect(f.config.resourceStore.readTask("conversation")?.status.phase).toBe("waiting");
  });

  it("closes after an exact outcome without changing the outcome or closing independent children", () => {
    const f = fixture();
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: { ...f.intent, id: "child", parentId: "conversation" },
    });
    const current = f.claim();
    completeAppTask(f.config, current, {
      summary: "Discussion answered",
      response: "The background measurement can continue.",
      result: { answered: true },
      evidence: ["human:discussion"],
    });
    const resource = f.config.resourceStore.readTask("conversation")!;
    const input = {
      appId: "sample",
      taskId: "conversation",
      expectedGeneration: resource.metadata.generation,
      expectedResourceVersion: resource.metadata.resourceVersion,
      reason: "Caller consumed the answer",
      afterResult: current.attemptId,
    };
    expect(closeAppTask(f.config, input)).toMatchObject({
      applied: true,
      closure: { kind: "closed", acceptedResultAttemptId: current.attemptId },
    });
    expect(closeAppTask(f.config, input).applied).toBe(false);
    f.reopen();
    expect(f.config.resourceStore.readTask("conversation")?.status.result).toEqual({ answered: true });
    expect(f.config.resourceStore.readAttempt(current.attemptId)?.acceptedResult).toMatchObject({
      state: "converged",
      result: { answered: true },
    });
    const child = f.claim("child");
    expect(
      completeAppTask(f.config, child, { summary: "Late child result", result: { value: 17 }, evidence: ["sample:17"] })
        .dependentTaskIds,
    ).toEqual([]);
    expect(f.config.resourceStore.readTask("child")?.status.phase).toBe("converged");
  });

  it("rejects a conventional close when newer input is pending, even at the refreshed resource version", () => {
    const f = fixture();
    const current = f.claim();
    completeAppTask(f.config, current, { summary: "Answer", evidence: ["answer"] });
    recordAppTaskTrigger(f.config, "conversation", {
      type: "conversation.message",
      eventId: 2,
      data: { text: "Correction" },
    });
    const resource = f.config.resourceStore.readTask("conversation")!;
    expect(() =>
      closeAppTask(f.config, {
        appId: "sample",
        taskId: "conversation",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
        reason: "Caller consumed the old answer",
        afterResult: current.attemptId,
      }),
    ).toThrow("newer or unresolved");
    expect(f.config.resourceStore.readCancellation("conversation")).toBeNull();
    expect(f.claim().events).toMatchObject([{ event: { eventId: 2 } }]);
  });

  it("owner closure interrupts an active attempt and retains an honest unfinished disposition", () => {
    const f = fixture("maintain");
    const current = f.claim();
    const resource = f.config.resourceStore.readTask("conversation")!;
    const closed = closeAppTask(f.config, {
      appId: "sample",
      taskId: "conversation",
      expectedGeneration: resource.metadata.generation,
      expectedResourceVersion: resource.metadata.resourceVersion,
      reason: "Scope withdrawn",
    });
    expect(closed).toMatchObject({
      applied: true,
      interruptedAttemptId: current.attemptId,
      closure: { kind: "closed" },
    });
    expect(closed.closure).not.toHaveProperty("acceptedResultAttemptId");
    expect(completeAppTask(f.config, current, { summary: "Late success", evidence: ["late"] }).status).toBe("stale");
    f.reopen();
    expect(f.config.resourceStore.readAttempt(current.attemptId)).not.toHaveProperty("acceptedResult");
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  });

  it("supplies exact accepted outcomes to an executor after later cycles and restart", () => {
    const f = fixture();
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Get a sample",
      evidence: ["input:sample"],
      actions: [
        {
          kind: "create-task",
          id: "sample",
          parentId: "conversation",
          outcome: "Measure the sample",
          acceptance: ["Verify the value"],
          mode: "achieve",
          outputs: [],
          priority: "P2",
        },
      ],
    });
    const first = f.claim("sample");
    completeAppTask(f.config, first, { summary: "Measured", result: { value: 17 }, evidence: ["sample:first"] });
    recordAppTaskTrigger(f.config, "sample", { type: "sample.requested", eventId: 3 });
    const second = f.claim("sample");
    completeAppTask(f.config, second, { summary: "Measured", result: { value: 23 }, evidence: ["sample:second"] });
    f.reopen();
    const caller = f.claim();
    const before = structuredClone(caller.events);
    const context = readAppTaskReconciliationEvents(f.config.resourceStore, caller);
    expect(context.items.map(({ event }) => event.data.acceptedResult)).toMatchObject([
      { state: "converged", result: { value: 17 } },
      { state: "converged", result: { value: 23 } },
    ]);
    expect(caller.events).toEqual(before);
    expect(f.config.resourceStore.readTask("sample")?.status.result).toEqual({ value: 23 });
    const unavailable = readAppTaskReconciliationEvents(f.config.resourceStore, {
      taskId: "unrelated-owner",
      eventsTruncated: false,
      events: [
        {
          observedAt: "now",
          event: {
            type: "project.task.child-transitioned",
            source: APP_TASK_RECOVERY_OWNER,
            childTaskId: "sample",
            resultAttemptId: first.attemptId,
            acceptedResult: { state: "converged", result: { value: "forged" } },
          },
        },
      ],
    });
    expect(unavailable.items[0]?.event.data).not.toHaveProperty("acceptedResult");
    expect(unavailable.items[0]?.event.data.resultUnavailable).toBeString();
  });

  for (const mode of ["achieve", "maintain"] as const) {
    it(`${mode} accepts an outcome, rests without capacity, and accepts later input`, () => {
      const f = fixture(mode);
      const first = f.claim();
      completeAppTask(f.config, first, {
        summary: "First answer",
        result: { value: 17 },
        evidence: ["measurement:17"],
      });
      expect(f.config.resourceStore.readTask("conversation")?.status.phase).toBe("converged");
      expect(f.config.resourceStore.readReceipt("conversation")).toBeNull();
      expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
      f.reopen();
      const input: TaskRequestInput = {
        appId: "sample",
        attachment: { kind: "existing", taskId: "conversation" },
        idempotencyKey: "second-input",
        request: {
          id: "second-input",
          source: { kind: "human", id: "console" },
          input: { kind: "message", data: { text: "Check again" } },
        },
      };
      admitTaskRequest(f.config, input);
      const second = f.claim();
      completeAppTask(f.config, second, {
        summary: "Second answer",
        result: { value: 23 },
        evidence: ["measurement:23"],
      });
      expect(f.config.resourceStore.readAttempt(first.attemptId)?.acceptedResult?.result).toEqual({ value: 17 });
      expect(f.config.resourceStore.readAttempt(second.attemptId)?.acceptedResult?.result).toEqual({ value: 23 });
      admitTaskRequest(f.config, input);
      expect(f.config.resourceStore.readTrigger("conversation")).toBeNull();
    });

    it(`${mode} can be explicitly closed during execution without accepting late output`, () => {
      const f = fixture(mode);
      const current = f.claim();
      const resource = f.config.resourceStore.readTask("conversation")!;
      const control = {
        appId: "sample",
        taskId: "conversation",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
        reason: "The owner no longer wants this work",
      };
      expect(cancelAppTask(f.config, control).applied).toBe(true);
      expect(cancelAppTask(f.config, control).applied).toBe(false);
      expect(completeAppTask(f.config, current, { summary: "Late output", evidence: ["late"] }).status).toBe("stale");
      f.reopen();
      recordAppTaskTrigger(f.config, "conversation", { type: "timer.tick", eventId: 9 });
      expect(claimObservedAppTask(f.config, { taskId: "conversation", appAgent: "owner", handler: "agent" }).kind).toBe(
        "completed",
      );
      expect(f.config.resourceStore.readAttempt(current.attemptId)).not.toHaveProperty("acceptedResult");
      expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
      expect(() => observeAppTaskIntent(f.config, { intent: f.intent, appAgent: "owner" })).toThrow("cancelled");
    });
  }

  it("one controller returns B -> A -> Conversation and handles human input while B runs", async () => {
    const f = fixture();
    const bRunning = signal();
    const releaseB = signal();
    const humanAnswered = signal();
    const finished = signal();
    const failures: unknown[] = [];
    let discussionAnswered = false;
    let conversationRuns = 0;
    const controller = new AppTaskController({
      maxConcurrent: 3,
      maxRetries: 0,
      onError: (_id, error) => {
        failures.push(error);
        bRunning.resolve();
        humanAnswered.resolve();
        finished.resolve();
      },
      reconcile: async (taskId) => {
        const claim = f.claim(taskId);
        let settlement;
        const childId = taskId === "conversation" ? "A" : "B";
        if (taskId === "conversation") conversationRuns++;
        if (taskId !== "B" && !f.config.resourceStore.readTask(childId)) {
          settlement = deferAppTask(f.config, claim, {
            disposition: "waiting",
            summary: "Get the needed measurement",
            evidence: ["input:measurement"],
            actions: [
              {
                kind: "create-task",
                id: childId,
                parentId: taskId,
                outcome: "Verify the requested measurement",
                acceptance: ["Return verified measurement"],
                mode: childId === "A" ? "achieve" : "maintain",
                outputs: [],
                priority: "P2",
              },
            ],
          });
        } else if (taskId === "B") {
          bRunning.resolve();
          await releaseB.promise;
          settlement = completeAppTask(f.config, claim, {
            summary: "Measured value",
            result: { value: 17 },
            evidence: ["measurement:17"],
          });
        } else if (taskId === "conversation" && claim.events.some(({ event }) => event.eventId === 2)) {
          settlement = completeAppTask(f.config, claim, {
            summary: "Discussed the tradeoff",
            response: "The measurement can continue while we discuss its cost.",
            evidence: ["human:discussion"],
          });
          expect(f.config.resourceStore.readTask("B")?.status.phase).toBe("running");
          discussionAnswered = true;
          humanAnswered.resolve();
        } else {
          const returned = readAppTaskReconciliationEvents(f.config.resourceStore, claim).items.find(
            ({ event }) => event.data.childTaskId === childId,
          )?.event.data;
          const result = returned?.acceptedResult as { state: string; result: Record<string, unknown> } | undefined;
          expect(result?.state).toBe("converged");
          settlement = completeAppTask(f.config, claim, {
            summary: "Accepted the returned measurement",
            result: result!.result,
            evidence: ["returned:measurement"],
          });
          if (taskId === "conversation") finished.resolve();
        }
        expect(settlement.status).toBe("applied");
        const wakes = "reconcileTaskIds" in settlement ? settlement.reconcileTaskIds : settlement.dependentTaskIds;
        for (const id of wakes) controller.enqueue(id);
      },
    });
    try {
      controller.enqueue("conversation");
      controller.enqueue("conversation");
      await bRunning.promise;
      expect(failures).toEqual([]);
      recordAppTaskTrigger(f.config, "conversation", {
        type: "conversation.message",
        eventId: 2,
        data: { text: "Discuss the tradeoff while work continues" },
      });
      controller.enqueue("conversation", { lane: "human" });
      await humanAnswered.promise;
      expect(failures).toEqual([]);
      expect(discussionAnswered).toBe(true);
      releaseB.resolve();
      await finished.promise;
      expect(failures).toEqual([]);
    } finally {
      releaseB.resolve();
      controller.close();
      await controller.whenDrained();
    }
    expect(conversationRuns).toBe(3);
    f.reopen();
    for (const id of ["conversation", "A", "B"]) {
      expect(f.config.resourceStore.readTask(id)?.status).toMatchObject({ phase: "converged", result: { value: 17 } });
      expect(f.config.resourceStore.readReceipt(id)).toBeNull();
    }
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  }, 10_000);
});
