import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskMode } from "@may-agent/sdk";
import { AppTaskController } from "./controller.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { readAppTaskLiveEvent, readAppTaskReconciliationEvents } from "./app-task-context.js";
import { APP_TASK_RECOVERY_OWNER } from "./session-binding.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskRequest, type TaskRequestInput } from "../state/inbox.js";
import { readRuntimeTaskView } from "../reads/app-read.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import { trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import {
  appTaskContext,
  cancelAppTask,
  closeAppTask,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  readAppTaskAdmissionOutcome,
  stopAppTask,
} from "./app-task-reconciler.js";

const roots: string[] = [];
const stores = new Set<AppTaskResourceStore>();
afterEach(() => {
  setSystemTime();
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
    advanceRetry(taskId = "conversation") {
      const due = config.resourceStore.readTask(taskId)?.status.executionRetryAt;
      if (due === undefined) throw new Error("Expected a durable retry deadline");
      setSystemTime(new Date(due));
    },
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
  it("recovers 24 transient failures through the controller without an agent-generated unblock batch", async () => {
    const f = fixture();
    completeAppTask(f.config, f.claim(), { summary: "Fixture owner is quiet" });
    const ids = Array.from({ length: 24 }, (_, index) => `work-${index}`);
    for (const id of ids) observeAppTaskIntent(f.config, {
      appAgent: "owner", intent: { ...f.intent, id, outcome: "Read a retry-safe measurement" },
    });
    const counts = new Map<string, number>();
    let completed = 0;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const done = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const controller = new AppTaskController({
      maxConcurrent: 3,
      onError: (_id, error) => reject(error),
      async reconcile(taskId) {
        const claim = claimObservedAppTask(f.config, { taskId, appAgent: "owner", handler: "agent" });
        if (claim.kind !== "claimed") return;
        counts.set(taskId, (counts.get(taskId) ?? 0) + 1);
        if (counts.get(taskId) === 1) {
          expect(failAppTaskAttempt(f.config, claim, "Temporary provider unavailable").status).toBe("retrying");
          recovery.stateChanged();
          controller.enqueue(taskId); // An ordinary early wake must not bypass persisted pacing.
          return;
        }
        expect(completeAppTask(f.config, claim, { summary: "Read succeeded", result: { value: 7 } }).status).toBe("applied");
        recovery.stateChanged();
        if (++completed === ids.length) resolve();
      },
    });
    const recovery = new AppTaskRecoveryScheduler({ source: f.config.resourceStore, enqueue: (id) => controller.enqueue(id) });
    const timeout = setTimeout(() => reject(new Error("Mechanical recovery did not finish")), 4_000);
    try { recovery.start(); await done; }
    finally { clearTimeout(timeout); recovery.close(); controller.close(); await controller.whenDrained(); }
    f.reopen();
    expect([...counts.values()]).toEqual(ids.map(() => 2));
    for (const id of ids) {
      expect(f.config.resourceStore.readTask(id)?.status.result).toEqual({ value: 7 });
      expect(f.config.resourceStore.readCancellation(id)).toBeNull();
    }
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  });

  it("keeps retrying beyond four failures, with durable pacing across restart and duplicate wakes", () => {
    const f = fixture();
    const original = f.claim();
    let claim = original;
    for (let index = 0; index < 7; index++) {
      expect(failAppTaskAttempt(f.config, claim, "Execution unavailable").status).toBe("retrying");
      const retryAt = f.config.resourceStore.readTask("conversation")!.status.executionRetryAt!;
      f.reopen();
      recordAppTaskTrigger(f.config, "conversation", { type: "project.task.tick", eventId: 50, data: {} });
      expect(claimObservedAppTask(f.config, { taskId: "conversation", appAgent: "owner", handler: "agent" }))
        .toMatchObject({ kind: "waiting", retryAt });
      expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
      expect(f.config.resourceStore.nextDueAt()).toBe(retryAt);
      expect(f.config.resourceStore.readCancellation("conversation")).toBeNull();
      f.advanceRetry();
      claim = f.claim();
      expect(claim.events[0]).toEqual(original.events[0]);
    }
    expect(f.config.resourceStore.readTask("conversation")?.status.executionFailures).toBe(7);
    completeAppTask(f.config, claim, { summary: "Provider is available; original work completed" });
    f.reopen();
    expect(f.config.resourceStore.readTask("conversation")?.status.executionFailures).toBeUndefined();
    expect(f.config.resourceStore.nextDueAt()).toBeNull();
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  });

  it("returns a delayed input's answer after an intervening question and restart", () => {
    const f = fixture();
    const ask = (id: string) => admitTaskRequest(f.config, {
      appId: "sample", attachment: { kind: "existing", taskId: "conversation" },
      idempotencyKey: `task:${id}`,
      request: { id, source: { kind: "app", id: "caller" }, input: { kind: "question", data: { id } } },
    });
    ask("measurement");
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: {
        id: "sampler",
        parentId: "conversation",
        mode: "achieve",
        outcome: "Measure the sample",
        acceptance: ["Return observed value"],
        outputs: [],
      },
    });
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting", summary: "Get the measurement", evidence: ["measurement:needed"],
    });
    f.reopen();
    ask("explanation");
    completeAppTask(f.config, f.claim(), {
      summary: "Explained the method", result: { explanation: "Measure once the sample is ready" },
    });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:measurement")).toBeNull();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:explanation")?.result)
      .toEqual({ explanation: "Measure once the sample is ready" });

    completeAppTask(f.config, f.claim("sampler"), {
      summary: "Measured the sample", result: { value: 17 }, evidence: ["measurement:17"],
    });
    f.reopen();
    const resumed = f.claim();
    const context = readAppTaskReconciliationEvents(f.config.resourceStore, resumed);
    expect(context.continuedInputs?.map(({ event }) => event.data.request)).toEqual([
      { id: "measurement", source: { kind: "app", id: "caller" }, input: { kind: "question", data: { id: "measurement" } } },
    ]);
    expect(context.items
      .some(({ event }) => event.data.childTaskId === "sampler")).toBe(true);
    completeAppTask(f.config, resumed, {
      summary: "The measurement answers the original ask", result: { value: 17 }, evidence: ["measurement:17"],
    });
    f.reopen();
    // No supplied admission IDs, restored subscriptions or repeated wait declaration.
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:measurement"))
      .toMatchObject({ attemptId: resumed.attemptId, state: "converged", result: { value: 17 } });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:explanation")?.result)
      .toEqual({ explanation: "Measure once the sample is ready" });
    expect(f.config.resourceStore.readTask("conversation")?.status.inputWaits).toBeUndefined();
  });

  it("keeps a satisfied input wait across failed execution and restart until acceptance", () => {
    const f = fixture();
    admitTaskRequest(f.config, {
      appId: "sample", attachment: { kind: "existing", taskId: "conversation" }, idempotencyKey: "task:measurement",
      request: { id: "measurement", source: { kind: "app", id: "caller" }, input: { kind: "measure", data: {} } },
    });
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting", summary: "Waiting for observed evidence",
      conditions: [{ id: "measurement", type: "project.task.reconciled", subject: "task:measurement",
        expected: "done", owner: "app:sampler", reviewAfterMs: 60_000 }],
    });
    const event = { type: "project.task.reconciled", taskId: "measurement", state: "converged", eventId: 5 };
    expect(trackAppTaskConditionEventForTasks(f.config, event, ["conversation"])).toHaveLength(1);
    const first = f.claim();
    expect(first.continuedInputKeys).toEqual(["task:measurement"]);
    expect(failAppTaskAttempt(f.config, first, "Temporary provider failure").status).toBe("retrying");
    f.reopen();
    f.advanceRetry();
    const retry = f.claim();
    expect(readAppTaskReconciliationEvents(f.config.resourceStore, retry).continuedInputs?.[0]?.event.data.request)
      .toMatchObject({ id: "measurement" });
    const result = { summary: "Observed measurement", result: { value: 17 }, evidence: ["measurement:17"] };
    f.config.resourceStore.db.exec(`CREATE TRIGGER reject_delayed_answer BEFORE UPDATE ON app_task_admissions
      BEGIN SELECT RAISE(ABORT, 'answer rejected'); END`);
    expect(() => completeAppTask(f.config, retry, result)).toThrow("answer rejected");
    expect(f.config.resourceStore.readTask("conversation")?.status.inputWaits).toHaveProperty("task:measurement");
    expect(f.config.resourceStore.readTask("conversation")?.status.conditionIds).toEqual(["measurement"]);
    f.config.resourceStore.db.exec("DROP TRIGGER reject_delayed_answer");
    completeAppTask(f.config, retry, result);
    f.reopen();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:measurement")?.result).toEqual({ value: 17 });
    expect(f.config.resourceStore.readTask("conversation")?.status.conditionIds).toEqual([]);
    expect(f.config.resourceStore.readTask("conversation")?.status.inputWaits).toBeUndefined();
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  });

  it("keeps two callers separate when child work returns out of order and needs another attempt", () => {
    const f = fixture();
    for (const name of ["first", "second"]) {
      admitTaskRequest(f.config, {
        appId: "sample", attachment: { kind: "existing", taskId: "conversation" }, idempotencyKey: `task:${name}`,
        request: { id: name, source: { kind: "app", id: "caller" }, input: { kind: "measure", data: { name } } },
      });
      observeAppTaskIntent(f.config, {
        appAgent: "owner",
        intent: {
          id: name,
          parentId: "conversation",
          mode: "achieve",
          outcome: `Measure ${name}`,
          acceptance: ["Return measured value"],
          outputs: [],
        },
      });
      deferAppTask(f.config, f.claim(), {
        disposition: "waiting", summary: `Measure ${name}`, evidence: ["measurement:needed"],
        actions: [{ kind: "update-task", taskId: name, expectedGeneration: 1, priority: "P1" }],
      });
    }
    completeAppTask(f.config, f.claim("second"), { summary: "First observation", result: { value: 2 } });
    const reconsider = f.claim();
    expect(reconsider.continuedInputKeys).toEqual(["task:second"]);
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: {
        id: "second-check",
        parentId: "conversation",
        mode: "achieve",
        outcome: "Recheck second sample",
        acceptance: ["Return measured value"],
        outputs: [],
      },
    });
    deferAppTask(f.config, reconsider, {
      disposition: "waiting", summary: "Check the second sample again", evidence: ["measurement:inconclusive"],
      actions: [{ kind: "update-task", taskId: "second-check", expectedGeneration: 1, priority: "P1" }],
    });
    f.reopen();
    completeAppTask(f.config, f.claim("first"), { summary: "First sample measured", result: { value: 1 } });
    const first = f.claim();
    expect(first.continuedInputKeys).toEqual(["task:first"]);
    completeAppTask(f.config, first, { summary: "First answer", result: { value: 1 } });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:second")).toBeNull();
    completeAppTask(f.config, f.claim("second-check"), { summary: "Rechecked", result: { value: 3 } });
    const second = f.claim();
    expect(second.continuedInputKeys).toEqual(["task:second"]);
    completeAppTask(f.config, second, { summary: "Second answer", result: { value: 3 } });
    f.reopen();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:first")?.result).toEqual({ value: 1 });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:second")?.result).toEqual({ value: 3 });
  });

  it.each([false, true])("keeps the ask with live wait evidence (accepted live: %s)", (acceptLive) => {
    const f = fixture();
    const ask = (id: string) => admitTaskRequest(f.config, {
      appId: "sample", attachment: { kind: "existing", taskId: "conversation" }, idempotencyKey: `task:${id}`,
      request: { id, source: { kind: "app", id: "caller" }, input: { kind: "question", data: { id } } },
    });
    ask("measurement");
    deferAppTask(f.config, f.claim(), { disposition: "waiting", summary: "Get evidence",
      conditions: [{ id: "measurement", type: "project.task.reconciled", subject: "task:measurement", expected: "done",
        owner: "app:fixture", reviewAfterMs: 60_000 }] });
    ask("explanation");
    let claim = f.claim();
    const fact = { type: "project.task.reconciled", eventId: 500, taskId: "measurement", state: "converged" };
    trackAppTaskConditionEventForTasks(f.config, fact, ["conversation"]);
    const live = readAppTaskLiveEvent(f.config, "conversation", fact);
    expect(live.data.continuedInputs).toMatchObject([{ event: { data: { request: { id: "measurement" } } } }]);
    const result = { summary: "Explained the threshold and judged the new measurement",
      result: { value: 17, explanation: "A threshold is a minimum" } };
    if (!acceptLive) {
      completeAppTask(f.config, claim, result);
      expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:explanation")).toBeNull();
      f.reopen();
      claim = f.claim();
      const inputs = readAppTaskReconciliationEvents(f.config.resourceStore, claim);
      expect(inputs.continuedInputs?.some(({ event }) => (event.data.request as { id?: string } | undefined)?.id === "explanation")).toBe(true);
      expect(inputs.continuedInputs?.map(({ event }) => (event.data.request as { id: string }).id).sort())
        .toEqual(["explanation", "measurement"]);
    }
    completeAppTask(f.config, claim, { ...result, ...(acceptLive ? { acceptedLiveEventIds: [500] } : {}) });
    f.reopen();
    for (const id of ["measurement", "explanation"]) {
      expect(readAppTaskAdmissionOutcome(f.config, "conversation", `task:${id}`)?.result).toEqual(result.result);
    }
    expect(f.config.resourceStore.readTask("conversation")?.status.conditionIds).toEqual([]);
  });

  it("a failure report retains its own ask without discarding another input's wait", () => {
    const f = fixture();
    for (const id of ["measurement", "expensive-question"]) {
      admitTaskRequest(f.config, { appId: "sample", attachment: { kind: "existing", taskId: "conversation" },
        idempotencyKey: `task:${id}`, request: { id, source: { kind: "app", id: "caller" },
          input: { kind: "question", data: { id } } } });
      if (id === "measurement") deferAppTask(f.config, f.claim(), { disposition: "waiting", summary: "Get measurement",
        conditions: [{ id: "measurement", type: "project.task.reconciled", subject: "task:measurement", expected: "done",
          owner: "app:fixture", reviewAfterMs: 60_000 }] });
      else stopAppTask(f.config, f.claim(), { summary: "This extra question is too expensive", evidence: ["cost:unjustified"] });
    }
    f.reopen();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:expensive-question")).toBeNull();
    f.advanceRetry();
    completeAppTask(f.config, f.claim(), { summary: "Found a cheaper way to answer the extra question" });
    expect(f.config.resourceStore.readTask("conversation")?.status.inputWaits).toHaveProperty("task:measurement");
    expect(trackAppTaskConditionEventForTasks(f.config, {
      type: "project.task.reconciled", eventId: 501, taskId: "measurement", state: "converged",
    }, ["conversation"])).toHaveLength(1);
    const measured = f.claim();
    completeAppTask(f.config, measured, { summary: "Measured", result: { value: 17 } });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:measurement")?.result).toEqual({ value: 17 });
  });

  it("an old child generation cannot satisfy a newer input wait", () => {
    const f = fixture();
    const ask = (id: string) => admitTaskRequest(f.config, {
      appId: "sample", attachment: { kind: "existing", taskId: "conversation" }, idempotencyKey: `task:${id}`,
      request: { id, source: { kind: "app", id: "caller" }, input: { kind: "measure", data: { id } } },
    });
    ask("first");
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: {
        id: "sampler",
        parentId: "conversation",
        mode: "achieve",
        outcome: "Measure first sample",
        acceptance: ["Return measured value"],
        outputs: [],
      },
    });
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting", summary: "Measure first sample", evidence: ["measurement:needed"],
    });
    const firstChild = f.claim("sampler");
    completeAppTask(f.config, firstChild, { summary: "First measurement", result: { value: 17 } });
    completeAppTask(f.config, f.claim(), { summary: "First answer", result: { value: 17 } });
    ask("second");
    deferAppTask(f.config, f.claim(), { disposition: "waiting", summary: "Measure second sample", evidence: ["measurement:needed"],
      actions: [{ kind: "update-task", taskId: "sampler", expectedGeneration: 1, outcome: "Measure second sample" }] });
    recordAppTaskTrigger(f.config, "conversation", {
      type: "project.task.child-transitioned", source: APP_TASK_RECOVERY_OWNER,
      childTaskId: "sampler", resultAttemptId: firstChild.attemptId,
    });
    const staleFact = f.claim();
    expect(staleFact.continuedInputKeys).toBeUndefined();
    completeAppTask(f.config, staleFact, { summary: "This old result has already been handled" });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:second")).toBeNull();
    completeAppTask(f.config, f.claim("sampler"), { summary: "Second measurement", result: { value: 23 } });
    const second = f.claim();
    expect(second.continuedInputKeys).toEqual(["task:second"]);
    completeAppTask(f.config, second, { summary: "Second answer", result: { value: 23 } });
    f.reopen();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:first")?.result).toEqual({ value: 17 });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:second")?.result).toEqual({ value: 23 });
  });

  it("keeps each admitted input's answer while a reused Task waits, answers again and closes", () => {
    const f = fixture();
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting", summary: "An earlier measurement remains pending",
      conditions: [{ id: "measurement", type: "sample.ready", subject: "sample:one", expected: true,
        owner: "app:sampler", reviewAfterMs: 60_000 }],
    });
    const input = (id: string): TaskRequestInput => ({
      appId: "sample", attachment: { kind: "existing", taskId: "conversation" }, idempotencyKey: `task:${id}`,
      request: { id, source: { kind: "app", id: "caller" }, input: { kind: "question", data: { id } } },
    });
    admitTaskRequest(f.config, input("first"));
    const first = f.claim();
    completeAppTask(f.config, first, { summary: "Answer", result: { value: 17 }, evidence: ["measurement:17"] });
    expect(f.config.resourceStore.readTask("conversation")?.status.phase).toBe("waiting");
    expect(readRuntimeTaskView({ taskStateConfig: f.config }, "conversation")?.closed).toBeUndefined();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:first")).toMatchObject({
      state: "converged", attemptId: first.attemptId, result: { value: 17 },
    });

    admitTaskRequest(f.config, input("second"));
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:second")).toBeNull();
    const second = f.claim();
    stopAppTask(f.config, second, { summary: "Unavailable", result: { abandoned: true }, evidence: ["cost:too-high"] });
    f.reopen();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:first")?.result).toEqual({ value: 17 });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:second")).toBeNull();
    expect(f.config.resourceStore.readAttempt(second.attemptId)?.acceptedResult)
      .toMatchObject({ state: "stopped", result: { abandoned: true } });
    const resource = f.config.resourceStore.readTask("conversation")!;
    closeAppTask(f.config, { appId: "sample", taskId: "conversation", reason: "Owner ended the work",
      expectedGeneration: resource.metadata.generation, expectedResourceVersion: resource.metadata.resourceVersion });
    f.reopen();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:first")?.result).toEqual({ value: 17 });
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:second")).toBeNull();
    expect(f.config.resourceStore.readAttempt(second.attemptId)?.acceptedResult?.state).toBe("stopped");
    expect(readRuntimeTaskView({ taskStateConfig: f.config }, "conversation")?.closed).toBe(true);
    expect(readAppTaskAdmissionOutcome(f.config, "another-task", "task:first")).toBeNull();
  });

  it("commits the input-to-answer binding and accepted outcome atomically", () => {
    const f = fixture();
    admitTaskRequest(f.config, { appId: "sample", attachment: { kind: "existing", taskId: "conversation" },
      idempotencyKey: "task:atomic", request: { id: "atomic", source: { kind: "app", id: "caller" },
        input: { kind: "question", data: {} } } });
    const claim = f.claim();
    f.config.resourceStore.db.exec(`CREATE TRIGGER reject_input_answer BEFORE UPDATE ON app_task_admissions
      BEGIN SELECT RAISE(ABORT, 'input answer write rejected'); END`);
    expect(() => completeAppTask(f.config, claim, { summary: "Answer", result: { value: 17 } }))
      .toThrow("input answer write rejected");
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:atomic")).toBeNull();
    expect(f.config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(f.config.resourceStore.readTask("conversation")?.status.currentAttemptId).toBe(claim.attemptId);
    f.config.resourceStore.db.exec("DROP TRIGGER reject_input_answer");
    completeAppTask(f.config, claim, { summary: "Answer", result: { value: 17 } });
    f.reopen();
    expect(readAppTaskAdmissionOutcome(f.config, "conversation", "task:atomic")?.result).toEqual({ value: 17 });
  });

  it("rejects legacy closure in an action batch without accepting any result or earlier action", () => {
    const f = fixture();
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: {
        id: "child",
        parentId: "conversation",
        outcome: "Temporary work",
        acceptance: ["Return evidence"],
        mode: "achieve",
      },
    });
    const before = f.config.resourceStore.readTask("child");
    const claim = f.claim();
    expect(() => completeAppTask(f.config, claim, {
      summary: "Withdraw scope",
      evidence: ["owner:withdrawal"],
      actions: [
        {
          kind: "update-task", taskId: "child", expectedGeneration: 1, outcome: "Changed work",
        },
        // A previously persisted/provider-generated action must fail atomically.
        { kind: "close-task", taskId: "child", expectedGeneration: 1, summary: "No longer needed" } as never,
      ],
    })).toThrow("unsupported action kind: close-task");
    expect(f.config.resourceStore.readTask("child")).toEqual(before);
    expect(f.config.resourceStore.readReceipt("child")).toBeNull();
    expect(f.config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
    expect(f.config.resourceStore.readTask("conversation")?.status.currentAttemptId).toBe(claim.attemptId);
  });

  it.each(["answer", "wait"])("rejects a worker rewriting its own assignment through %s and retains the original work", (settlement) => {
    const f = fixture();
    const claim = f.claim();
    const before = f.config.resourceStore.readTask("conversation")!;
    const proposal = {
      summary: "Make the requirement easier",
      evidence: ["The measurement is unavailable"],
      actions: [
        { kind: "update-task" as const, taskId: "conversation", expectedGeneration: claim.generation,
          outcome: "Explain why the measurement is unavailable", acceptance: ["An explanation is enough"] },
      ],
    };
    expect(() => settlement === "answer"
      ? completeAppTask(f.config, claim, proposal)
      : deferAppTask(f.config, claim, { ...proposal, disposition: "waiting" }))
      .toThrow("assignment changes belong to its assigning owner");
    expect(f.config.resourceStore.readTask("conversation")).toEqual(before);
    expect(f.config.resourceStore.readTask("child")).toBeNull();
    expect(f.config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
    failAppTaskAttempt(f.config, claim, "Rejected self-revision");
    f.reopen();
    f.advanceRetry();
    const retry = f.claim();
    expect(f.config.resourceStore.readTask("conversation")?.spec).toEqual(before.spec);
    expect(retry.generation).toBe(claim.generation);
    expect(retry.events).toEqual(claim.events);
    completeAppTask(f.config, retry, { summary: "Measurement obtained", result: { value: 17 } });
    expect(f.config.resourceStore.readAttempt(retry.attemptId)?.acceptedResult?.state).toBe("converged");
  });

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

  it("returns an honest failure to its owner and retains continuation until the owner closes it", () => {
    const f = fixture("maintain");
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: {
        id: "report",
        parentId: "conversation",
        outcome: "Recover a disposable report",
        acceptance: ["Return the report within its cost limit"],
        mode: "maintain",
        outputs: [],
        priority: "P2",
      },
    });
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Get the report",
      evidence: ["input:report"],
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
    expect(f.config.resourceStore.nextDueAt()).toBeGreaterThan(Date.now());
    f.reopen();
    const resource = f.config.resourceStore.readTask("report")!;
    expect(
      closeAppTask(f.config, {
        appId: "sample",
        taskId: "report",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
        reason: "Owner accepted the abandonment",
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
    expect(readRuntimeTaskView({ taskStateConfig: f.config }, "conversation")).toMatchObject({
      status: "done", closed: true,
    });
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
    expect(readRuntimeTaskView({ taskStateConfig: f.config }, "conversation")).toMatchObject({
      status: "attention", closed: true,
    });
    expect(f.config.resourceStore.readAttempt(current.attemptId)).not.toHaveProperty("acceptedResult");
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  });

  it("supplies exact accepted outcomes to an executor after later cycles and restart", () => {
    const f = fixture();
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: {
        id: "sample",
        parentId: "conversation",
        outcome: "Measure the sample",
        acceptance: ["Verify the value"],
        mode: "achieve",
        outputs: [],
        priority: "P2",
      },
    });
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Get a sample",
      evidence: ["input:sample"],
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

  it("one controller follows App-declared B -> A -> Conversation links while handling human input", async () => {
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
          observeAppTaskIntent(f.config, {
            appAgent: "owner",
            intent: {
              id: childId,
              parentId: taskId,
              outcome: "Verify the requested measurement",
              acceptance: ["Return verified measurement"],
              mode: childId === "A" ? "achieve" : "maintain",
              outputs: [],
              priority: "P2",
            },
          });
          controller.enqueue(childId);
          settlement = deferAppTask(f.config, claim, {
            disposition: "waiting",
            summary: "Get the needed measurement",
            evidence: ["input:measurement"],
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
