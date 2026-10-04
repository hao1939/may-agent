import { afterEach, expect, it, setSystemTime, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskInput } from "../state/inbox.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { AppTaskController } from "./controller.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import {
  appTaskContext,
  claimObservedAppTask,
  cancelAppTask,
  completeAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
  recordAppTaskTrigger,
  retryFailedAppTask,
  reportAppTaskFailure,
  stopAppTaskAttempt,
  listRunnableAppTaskIds,
} from "./app-task-reconciler.js";

const cleanup: Array<() => void> = [];
afterEach(() => {
  setSystemTime();
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-durable-retry-"));
  const databasePath = join(root, "host.sqlite");
  let config = appTaskTestContext({ appDir: root, agent: "owner", databasePath,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "owner" } } } });
  cleanup.push(() => { config.resourceStore.close(); rmSync(root, { recursive: true, force: true }); });
  const intent = { id: "work", parentId: "root", outcome: "Read the measurement", acceptance: ["Return observed value"] };
  observeAppTaskIntent(config, { intent, appAgent: "owner" });
  admitTaskInput(config, { appId: "sample", attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: "ask:measure", inputContext: { id: "measure", source: { kind: "app", id: "caller" },
      input: { kind: "measure", data: { sample: "one" } } } });
  return {
    get config() { return config; }, intent, databasePath,
    claim(handler = "agent") {
      const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler });
      if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${claim.kind}`);
      return claim;
    },
    reopen() {
      config.resourceStore.close();
      config = appTaskContext({ appDir: root, projectDir: root, agent: "owner",
        resourceStore: AppTaskResourceStore.openStandalone(databasePath, "sample") });
    },
  };
}

it("continues hourly after prolonged failure, preserving its deadline and input across reopen", () => {
  const f = fixture();
  let now = Date.now();
  let previousDelay = 0;
  for (let failures = 1; failures <= 20; failures++) {
    setSystemTime(now);
    const claim = f.claim();
    expect(claim.events.some(({ event }) => event.type === "app.task.requested")).toBe(true);
    failAppTaskAttempt(f.config, claim, "Source still unavailable");
    const task = f.config.resourceStore.readTask("work")!;
    const due = task.status.executionRetryAt!;
    const delay = due - now;
    expect(delay).toBeGreaterThanOrEqual(previousDelay);
    expect(delay).toBeLessThanOrEqual(60 * 60_000);
    if (failures >= 15) expect(delay).toBe(60 * 60_000);
    if (failures === 15) {
      recordAppTaskTrigger(f.config, "work", { type: "sample.source.changed", eventId: 99 });
      f.reopen();
      expect(f.config.resourceStore.nextDueAt()).toBe(due);
      setSystemTime(due - 1);
      expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" }))
        .toMatchObject({ kind: "waiting", retryAt: due });
    }
    expect(task.status.executionFailures).toBe(failures);
    expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
    expect(f.config.resourceStore.isCancelled("work")).toBe(false);
    previousDelay = delay;
    now = due;
  }
  setSystemTime(now);
  const final = f.claim();
  expect(final.events.some(({ event }) => event.eventId === 99)).toBe(true);
  completeAppTask(f.config, final, { summary: "Source restored", result: { value: 17 } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")?.attemptId).toBe(final.attemptId);
  expect(f.config.resourceStore.readTask("work")?.status.executionRetryAt).toBeUndefined();
});

it("uses the real due timer after restart, preserves cooldown under early wakes, and releases capacity", async () => {
  const f = fixture();
  const capacity = new HostCapacity(1);
  let failure!: () => void;
  let success!: () => void;
  let reject!: (error: unknown) => void;
  const failed = new Promise<void>((resolve) => { failure = resolve; });
  const done = new Promise<void>((resolve, no) => { success = resolve; reject = no; });
  const timeout = setTimeout(() => reject(new Error("Persisted retry did not execute")), 5_000);
  let attempts = 0;
  let retryAt = 0;
  let retryStartedAt = 0;
  let earlyWakes = 0;
  let scheduler: AppTaskRecoveryScheduler;
  const createController = () => new AppTaskController({ maxConcurrent: 1, capacity,
    onError: (_id, error) => reject(error),
    async reconcile() {
      const claim = claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" });
      if (claim.kind === "waiting") { earlyWakes++; return; }
      if (claim.kind !== "claimed") throw new Error(`Unexpected ${claim.kind}`);
      attempts++;
      if (attempts === 1) {
        expect(failAppTaskAttempt(f.config, claim, "Provider unavailable").status).toBe("retrying");
        retryAt = f.config.resourceStore.readTask("work")!.status.executionRetryAt!;
        scheduler.stateChanged();
        failure();
        return;
      }
      retryStartedAt = Date.now();
      expect(claim.events.some(({ event }) => event.type === "app.task.requested")).toBe(true);
      completeAppTask(f.config, claim, { summary: "Measured", result: { value: 17 } });
      scheduler.stateChanged();
      success();
    },
  });
  let controller = createController();
  const createScheduler = () => new AppTaskRecoveryScheduler({ source: f.config.resourceStore,
    enqueue: (id, options) => { controller.enqueue(id, options); } });
  scheduler = createScheduler();
  try {
    scheduler.start();
    await Promise.race([failed, done]);
    // This cannot acquire until the controller releases its failed attempt.
    const release = await Promise.race([capacity.acquire(), done.then(() => { throw new Error("Retry held capacity through its delay"); })]);
    expect(Date.now()).toBeLessThan(retryAt);
    release();
    scheduler.close();
    controller.close();
    await controller.whenDrained();
    f.reopen();
    expect(f.config.resourceStore.nextDueAt()).toBe(retryAt);
    controller = createController();
    scheduler = createScheduler();
    recordAppTaskTrigger(f.config, "work", { type: "project.task.tick", eventId: 99 });
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
    controller.enqueue("work");
    scheduler.start();
    await done;
    expect(earlyWakes).toBeGreaterThan(0);
    expect(attempts).toBe(2);
    expect(retryStartedAt).toBeGreaterThanOrEqual(retryAt);
    expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")?.result).toEqual({ value: 17 });
    expect(f.config.resourceStore.nextDueAt()).toBeNull();
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
    expect(f.config.resourceStore.readCancellation("work")).toBeNull();
  } finally {
    clearTimeout(timeout);
    scheduler.close();
    controller.close();
    await controller.whenDrained();
  }
});

it("fences a due retry when another connection pauses the project immediately before claiming", () => {
  const f = fixture();
  failAppTaskAttempt(f.config, f.claim(), "Provider unavailable");
  setSystemTime(new Date(f.config.resourceStore.nextDueAt()!));
  const store = f.config.resourceStore;
  const other = AppTaskResourceStore.openStandalone(f.databasePath, "sample");
  const before = store.readTaskContext({ taskIds: ["work"] });
  const commit = store.commit.bind(store);
  const interleave = spyOn(store, "commit").mockImplementationOnce((mutation) => {
    other.setProjectLifecycle("paused");
    return commit(mutation);
  });
  try {
    expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" }).kind).toBe("waiting");
    expect(interleave).toHaveBeenCalledTimes(1);
    expect(store.readTaskContext({ taskIds: ["work"] }).resources).toEqual(before.resources);
    expect(store.readTaskContext({ taskIds: ["work"] }).attempts).toEqual(before.attempts);
    interleave.mockRestore();
    expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" }).kind).toBe("waiting");
    other.setProjectLifecycle("active");
    expect(f.claim().generation).toBe(before.resources!.work!.metadata.generation);
  } finally {
    interleave.mockRestore();
    other.close();
  }
});

it("retains ordered failure input and newer human steering through a paced retry", () => {
  const f = fixture();
  const first = f.claim();
  const steering = { type: "project.comment.created", source: "human", eventId: 81,
    data: { text: "Use the corrected sample location" } };
  recordAppTaskTrigger(f.config, "work", steering);
  failAppTaskAttempt(f.config, first, "Provider unavailable");
  f.reopen();
  expect(() => f.claim()).toThrow("waiting");
  setSystemTime(new Date(f.config.resourceStore.nextDueAt()!));
  const next = f.claim();
  expect(next.events.map(({ event }) => event)).toEqual([...first.events.map(({ event }) => event), steering]);
  expect(next.generation).toBe(first.generation);
  expect(f.config.resourceStore.readAttempt(first.attemptId)?.state).toBe("failed");
});

function admitHuman(f: ReturnType<typeof fixture>, id = "correction") {
  return admitTaskInput(f.config, {
    appId: "sample",
    attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: `human:${id}`,
    inputContext: {
      id,
      source: { kind: "human", id },
      input: { kind: "message", data: { text: "Use the corrected source" } },
    },
  });
}

it("a new human admission waives one cooldown across reopen without resetting failure cost", () => {
  setSystemTime(new Date("2026-09-11T00:00:00Z"));
  const f = fixture();
  const first = f.claim();
  failAppTaskAttempt(f.config, first, "Source unavailable");
  expect(f.config.resourceStore.nextDueAt()).toBe(Date.now() + 250);
  admitHuman(f);
  f.reopen();
  expect(f.config.resourceStore.readTask("work")?.status.executionFailures).toBe(1);
  expect(f.config.resourceStore.listRecoveryCandidates().items.map(({ taskId }) => taskId)).toContain("work");
  const next = f.claim();
  expect(next.events.map(({ event }) => event.idempotencyKey)).toEqual(["ask:measure", "human:correction"]);
  expect(next.previousAttempt?.attemptId).toBe(first.attemptId);
  failAppTaskAttempt(f.config, next, "Still unavailable");
  const due = Date.now() + 500;
  expect(f.config.resourceStore.nextDueAt()).toBe(due);
  expect(f.config.resourceStore.readTask("work")?.status.executionFailures).toBe(2);
  admitHuman(f); // Durable replay must not buy another early attempt.
  recordAppTaskTrigger(f.config, "work", { type: "project.task.tick", eventId: 100 });
  admitTaskInput(f.config, {
    appId: "sample",
    attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: "system:review",
    inputContext: {
      id: "review",
      source: { kind: "system", id: "timer" },
      humanRequested: true,
      input: { kind: "review", data: {} },
    },
  });
  f.reopen();
  expect(f.config.resourceStore.nextDueAt()).toBe(due);
  expect(() => f.claim()).toThrow("waiting");
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "human:correction")).toBeNull();
});

it.each(["executor failure", "rejected result"])("human input arriving during %s gets one fresh attempt", (kind) => {
  setSystemTime(new Date("2026-09-11T00:00:00Z"));
  const f = fixture();
  const first = f.claim();
  admitHuman(f);
  const retry =
    kind === "executor failure"
      ? failAppTaskAttempt(f.config, first, "Source unavailable")
      : failAppTaskAttempt(f.config, first, "Invalid result", { facts: [], reason: "InvalidHandlerResult" });
  expect(retry.retryAt).toBeNull();
  f.reopen();
  const report = readAppTaskAdmissionOutcome(f.config, "work", "ask:measure", "report");
  expect(report).toMatchObject({ attemptId: first.attemptId, state: "error", reportRevision: 1 });
  // Input admitted during execution was not considered by the failing attempt.
  expect(readAppTaskAdmissionOutcome(f.config, "work", "human:correction", "report")).toBeNull();
  expect(f.config.resourceStore.readAttempt(first.attemptId)?.acceptedResult).toBeUndefined();
  const next = f.claim();
  expect(next.events.map(({ event }) => event.idempotencyKey)).toEqual(["ask:measure", "human:correction"]);
  expect(next.previousAttempt?.attemptId).toBe(first.attemptId);
  expect(f.config.resourceStore.readTask("work")?.status.executionFailures).toBe(1);
  admitHuman(f); // Replay while running is not a new human message either.
  expect(failAppTaskAttempt(f.config, next, "Still unavailable").retryAt).toBe(Date.now() + 500);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure", "report")).toEqual(report);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "human:correction", "report"))
    .toMatchObject({ attemptId: next.attemptId, state: "error", reportRevision: 1 });
  expect(f.config.resourceStore.nextDueAt()).toBe(Date.now() + 500);
  expect(() => f.claim()).toThrow("waiting");
});

it("keeps an internal workflow handoff quiet, then returns the agent failure through the shared path", () => {
  const f = fixture();
  const workflow = f.claim("workflow:measure");
  failAppTaskAttempt(f.config, workflow, "Need agent judgment", {
    reason: "needs-agent",
    facts: ["workflow:observation"],
  });
  f.reopen();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure", "report")).toBeNull();
  expect(f.config.resourceStore.readTask("work")?.status.executionRetryAt).toBeUndefined();
  const agent = claimObservedAppTask(f.config, {
    taskId: "work", appAgent: "owner", handler: "auto", canUseAgentFallback: () => false,
  });
  if (agent.kind !== "claimed") throw new Error(`Expected handoff, got ${agent.kind}`);
  expect(agent.handler).toBe("agent:owner");
  expect(agent.handoff?.reason).toBe("needs-agent");
  expect(f.config.resourceStore.readAttempt(agent.attemptId)?.failoverFromAttemptId).toBeUndefined();
  expect(agent.events).toEqual(workflow.events);
  failAppTaskAttempt(f.config, agent, "Agent result failed verification", {
    reason: "HandlerResultInvalid",
    facts: ["verifier:rejected"],
  });
  f.reopen();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure", "report"))
    .toMatchObject({ attemptId: agent.attemptId, state: "error", reportRevision: 1 });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
  expect(f.config.resourceStore.readAttempt(agent.attemptId)?.acceptedResult).toBeUndefined();
  expect(f.config.resourceStore.isCancelled("work")).toBe(false);
  setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
  const retry = f.claim();
  completeAppTask(f.config, retry, { summary: "Verified measurement", result: { value: 17 } });
  f.reopen();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure"))
    .toMatchObject({ attemptId: retry.attemptId, result: { value: 17 } });
});

it.each(["workflow", "executor"] as const)("keeps %s failover on the same Task across partial progress and resets selection only for revised work", (kind) => {
  setSystemTime(new Date("2026-10-04T00:00:00Z"));
  const f = fixture();
  const intent = { ...f.intent, [kind]: "measure" };
  observeAppTaskIntent(f.config, { appAgent: "owner", intent });
  const original = f.claim("auto");
  expect(original.handler).toBe(`${kind}:measure`);
  failAppTaskAttempt(f.config, original, "Unexpected procedure failure", { facts: ["receipt:original-effect"] });
  const failed = f.config.resourceStore.readAttempt(original.attemptId);
  const due = f.config.resourceStore.readTask("work")!.status.executionRetryAt!;
  f.reopen();
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "auto" }))
    .toMatchObject({ kind: "waiting", retryAt: due });
  setSystemTime(due + 1);
  const agent = f.claim("auto");
  expect(agent.handler).toBe("agent:owner");
  expect(agent.handoff).toMatchObject({ reason: "needs-agent", facts: ["receipt:original-effect"] });
  expect(agent.previousAttempt?.attemptId).toBe(original.attemptId);
  f.reopen(); // The switch is durable before the agent reports anything.
  expect(f.config.resourceStore.readAttempt(agent.attemptId)?.failoverFromAttemptId).toBe(original.attemptId);
  reportAppTaskFailure(f.config, agent, { state: "incomplete", summary: "Diagnosis retained; original work remains", facts: ["diagnosis:partial"] });
  setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt! + 1);
  f.reopen();
  const continuation = f.claim("auto");
  expect(continuation.handler).toBe("agent:owner");
  expect(f.config.resourceStore.readAttempt(continuation.attemptId)?.failoverFromAttemptId).toBeUndefined();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
  completeAppTask(f.config, continuation, { summary: "Recovered and verified", facts: ["defect:retained-for-evaluation"] });
  expect(f.config.resourceStore.readAttempt(original.attemptId)).toEqual(failed);
  expect(f.config.resourceStore.readAttempt(agent.attemptId)?.failoverFromAttemptId).toBe(original.attemptId);
  observeAppTaskIntent(f.config, { appAgent: "owner", intent: { ...intent, outcome: "Read the revised measurement" } });
  expect(f.claim("auto").handler).toBe(`${kind}:measure`);
});

it("keeps procedure retry without an agent and retains agent selection if it later becomes unavailable", () => {
  const f = fixture();
  observeAppTaskIntent(f.config, { appAgent: "owner", intent: { ...f.intent, executor: "measure" } });
  failAppTaskAttempt(f.config, f.claim("auto"), "Procedure failed");
  setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
  const retry = claimObservedAppTask(f.config, {
    taskId: "work", appAgent: "owner", handler: "auto", canUseAgentFallback: () => false,
  });
  if (retry.kind !== "claimed") throw new Error(`Expected retry, got ${retry.kind}`);
  expect(retry.handler).toBe("executor:measure");
  expect(f.config.resourceStore.readAttempt(retry.attemptId)?.failoverFromAttemptId).toBeUndefined();
  failAppTaskAttempt(f.config, retry, "Still failed");
  setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
  const agent = f.claim("auto");
  expect(agent.handler).toBe("agent:owner");
  expect(f.config.resourceStore.readAttempt(agent.attemptId)?.failoverFromAttemptId).toBe(retry.attemptId);
  failAppTaskAttempt(f.config, agent, "Agent temporarily unavailable");
  setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
  f.reopen();
  const continuation = claimObservedAppTask(f.config, {
    taskId: "work", appAgent: "owner", handler: "auto", canUseAgentFallback: () => false,
  });
  expect(continuation).toMatchObject({ kind: "claimed", handler: "agent:owner" });
  if (continuation.kind !== "claimed") throw new Error("Expected agent continuation");
  expect(f.config.resourceStore.readAttempt(continuation.attemptId)?.failoverFromAttemptId).toBeUndefined();
});

it("marks a CLI-to-agent switch only when its claim commits", () => {
  const f = fixture();
  const original = f.claim("cli:measure");
  failAppTaskAttempt(f.config, original, "CLI failed before returning a result");
  setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
  const commit = spyOn(f.config.resourceStore, "commit").mockImplementationOnce(() => {
    throw new Error("Claim storage unavailable");
  });
  try {
    expect(() => f.claim("auto")).toThrow("Claim storage unavailable");
  } finally {
    commit.mockRestore();
  }
  f.reopen();
  const count = () => f.config.resourceStore.db.prepare(`SELECT COUNT(*) AS n FROM app_task_attempts
    WHERE json_extract(attempt_json, '$.failoverFromAttemptId') IS NOT NULL`).get();
  expect(count()).toEqual({ n: 0 });
  const agent = f.claim("auto");
  f.reopen();
  expect(f.config.resourceStore.readAttempt(agent.attemptId)?.failoverFromAttemptId).toBe(original.attemptId);
  expect(count()).toEqual({ n: 1 });
});

it("does not turn fallback selection into permission to resume owner-stopped work", () => {
  const f = fixture();
  observeAppTaskIntent(f.config, { appAgent: "owner", intent: { ...f.intent, executor: "measure" } });
  failAppTaskAttempt(f.config, f.claim("auto"), "Procedure failed");
  setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
  const agent = f.claim("auto");
  expect(agent.handler).toBe("agent:owner");
  stopAppTaskAttempt(f.config, {
    taskId: "work", attemptId: agent.attemptId, expectedGeneration: agent.generation, reason: "Stop this work",
  });
  f.reopen();
  expect(listRunnableAppTaskIds(f.config)).not.toContain("work");
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "auto" }))
    .toMatchObject({ kind: "attention" });
  admitHuman(f);
  expect(f.claim("auto").handler).toBe("agent:owner");
});

it("failed capability admission consumes the human opportunity without an unpaced retry loop", () => {
  setSystemTime(new Date("2026-09-11T00:00:00Z"));
  const f = fixture();
  failAppTaskAttempt(f.config, f.claim(), "Source unavailable");
  admitHuman(f);
  const claim = claimObservedAppTask(f.config, {
    taskId: "work",
    appAgent: "owner",
    handler: "agent",
    isAgentRunnable: () => false,
  });
  expect(claim.kind).toBe("attention");
  expect(f.config.resourceStore.nextDueAt()).toBe(Date.now() + 500);
  admitHuman(f);
  expect(() => f.claim()).toThrow("waiting");
  setSystemTime(new Date(f.config.resourceStore.nextDueAt()!));
  failAppTaskAttempt(f.config, f.claim(), "Source still unavailable");
  expect(f.config.resourceStore.nextDueAt()).toBe(Date.now() + 1_000);
});

it("a rejected human admission cannot clear durable cooldown", () => {
  setSystemTime(new Date("2026-09-11T00:00:00Z"));
  const f = fixture();
  failAppTaskAttempt(f.config, f.claim(), "Source unavailable");
  const before = f.config.resourceStore.readTask("work");
  const commit = spyOn(f.config.resourceStore, "commit").mockImplementationOnce(() => {
    throw new Error("Admission storage unavailable");
  });
  try {
    expect(() => admitHuman(f)).toThrow("Admission storage unavailable");
  } finally {
    commit.mockRestore();
  }
  f.reopen();
  expect(f.config.resourceStore.readTask("work")).toEqual(before);
  expect(() => f.claim()).toThrow("waiting");
  admitHuman(f);
  expect(f.claim().events.map(({ event }) => event.idempotencyKey)).toEqual(["ask:measure", "human:correction"]);
});

it.each(["execution error", "failure report"])("allows an explicit owner retry during cooldown after %s", (kind) => {
  const f = fixture();
  const first = f.claim();
  if (kind === "execution error") failAppTaskAttempt(f.config, first, "Provider unavailable");
  else reportAppTaskFailure(f.config, first, { summary: "Source unavailable", facts: ["source:offline"] });
  const facts = f.config.resourceStore.readAttempt(first.attemptId);
  const resource = f.config.resourceStore.readTask("work")!;
  const instruction = { appId: "sample", taskId: "work", controlKey: "owner-retry",
    expectedGeneration: resource.metadata.generation, expectedResourceVersion: resource.metadata.resourceVersion };
  const receipt = retryFailedAppTask(f.config, instruction);
  expect(retryFailedAppTask(f.config, instruction)).toEqual(receipt);
  expect(f.config.resourceStore.nextDueAt()).toBeNull();
  expect(f.config.resourceStore.readAttempt(first.attemptId)).toEqual(facts);
  const next = f.claim();
  expect(next.events).toEqual(kind === "execution error" ? first.events : []);
  expect(next.continuedInputKeys).toEqual(["ask:measure"]);
  expect(next.generation).toBe(first.generation);
  expect(f.config.resourceStore.readTask("work")?.status.executionFailures).toBeUndefined();
});

it("lets a later repair input pass a considered backlog before the original input resumes", () => {
  const f = fixture();
  for (let index = 1; index <= 34; index++) {
    recordAppTaskTrigger(f.config, "work", { type: "sample.observed", eventId: index, data: { index } });
  }
  admitTaskInput(f.config, {
    appId: "sample",
    attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: "ask:repair",
    inputContext: {
      id: "repair",
      source: { kind: "app", id: "caller" },
      input: { kind: "message", data: { text: "repair" } },
    },
  });

  const first = f.claim();
  expect(first.events).toHaveLength(32);
  expect(first.events.some(({ event }) => event.idempotencyKey === "ask:repair")).toBe(false);
  reportAppTaskFailure(f.config, first, {
    summary: "The original prerequisite is unavailable",
    facts: ["probe:failed"],
    inputKeys: ["ask:measure"],
  });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
  expect(f.config.resourceStore.readTask("work")?.status.inputWaits?.["ask:measure"]?.pending).toBe(true);

  const failed = f.config.resourceStore.readTask("work")!;
  retryFailedAppTask(f.config, {
    appId: "sample",
    taskId: "work",
    expectedGeneration: failed.metadata.generation,
    expectedResourceVersion: failed.metadata.resourceVersion,
    controlKey: "owner-retry-backlog",
  });
  const repair = f.claim();
  expect(repair.events.some(({ event }) => event.idempotencyKey === "ask:repair")).toBe(true);
  expect(repair.events.some(({ event }) => event.idempotencyKey === "ask:measure")).toBe(false);
  expect(repair.continuedInputKeys).toContain("ask:measure");
  completeAppTask(f.config, repair, { summary: "Repair request answered", inputKeys: ["ask:repair"] });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:repair")?.attemptId).toBe(repair.attemptId);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();

  const original = f.claim();
  expect(original.continuedInputKeys).toContain("ask:measure");
  completeAppTask(f.config, original, { summary: "Original request answered", inputKeys: ["ask:measure"] });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")?.attemptId).toBe(original.attemptId);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:repair")?.attemptId).toBe(repair.attemptId);
});

it.each(["omitted", "explicit", "execution"])(
  "keeps diagnostic facts scoped when the next failure is %s",
  (kind) => {
    setSystemTime(Date.now());
    const f = fixture();
    const first = f.claim();
    reportAppTaskFailure(f.config, first, { summary: "Source unavailable", facts: ["source:offline"] });
    const accepted = f.config.resourceStore.readAttempt(first.attemptId);
    setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
    const next = f.claim();
    if (kind === "execution") failAppTaskAttempt(f.config, next, "Executor disconnected");
    else
      failAppTaskAttempt(f.config, next, "Later result was rejected", {
        facts: [],
        reason: "HandlerResultInvalid",
        ...(kind === "explicit" ? { facts: ["result:invalid"] } : {}),
      });
    f.reopen();
    expect(f.config.resourceStore.readTask("work")?.status).toMatchObject({
      phase: "pending",
      executionFailures: 2,
      facts: kind === "execution" ? ["source:offline"] : kind === "explicit" ? ["result:invalid"] : [],
    });
    expect(f.config.resourceStore.readAttempt(first.attemptId)).toEqual(accepted);
    expect(f.config.resourceStore.readAttempt(next.attemptId)?.acceptedResult).toBeUndefined();
    expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
    expect(f.config.resourceStore.isCancelled("work")).toBe(false);
    setSystemTime(f.config.resourceStore.readTask("work")!.status.executionRetryAt!);
    const retry = f.claim();
    expect(retry.continuedInputKeys).toEqual(["ask:measure"]);
    expect(retry.events.map(({ event }) => event.idempotencyKey)).toEqual([undefined]);
  },
);

it("accepts failure facts without resolving the ask, then succeeds on the same assignment", () => {
  const f = fixture();
  const first = f.claim();
  reportAppTaskFailure(f.config, first, { summary: "Could not read this measurement", result: { problem: "source offline" }, facts: ["source:offline"] });
  f.reopen();
  expect(f.config.resourceStore.readAttempt(first.attemptId)).toMatchObject({ state: "completed",
    acceptedResult: { state: "incomplete", facts: ["source:offline"] } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
  const due = f.config.resourceStore.readTask("work")!.status.executionRetryAt!;
  expect(() => f.claim()).toThrow("waiting");
  setSystemTime(new Date(due));
  const next = f.claim();
  expect(next.taskId).toBe(first.taskId);
  expect(next.generation).toBe(first.generation);
  expect(next.events).toEqual([]);
  expect(next.continuedInputKeys).toEqual(["ask:measure"]);
  expect(next.previousAttempt).toMatchObject({
    attemptId: first.attemptId,
    generation: first.generation,
    state: "completed",
    acceptedResult: {
      state: "incomplete",
      summary: "Could not read this measurement",
      result: { problem: "source offline" },
      facts: ["source:offline"],
    },
  });
  next.previousAttempt!.acceptedResult!.facts.push("untrusted consumer edit");
  expect(f.config.resourceStore.readAttempt(first.attemptId)?.acceptedResult?.facts).toEqual(["source:offline"]);
  expect(f.config.resourceStore.readTask("work")?.status.facts).toEqual(["source:offline"]);
  completeAppTask(f.config, next, { summary: "Source repaired; measurement read", result: { value: 17 } });
  f.reopen();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toMatchObject({ attemptId: next.attemptId, result: { value: 17 } });
  expect(f.config.resourceStore.readAttempt(first.attemptId)?.acceptedResult?.state).toBe("incomplete");
  expect(f.config.resourceStore.nextDueAt()).toBeNull();
});

it("rolls failure, input restoration and deadline back together, and guards indexed hint updates", () => {
  setSystemTime(new Date("2026-09-11T00:00:00Z"));
  const f = fixture();
  const claim = f.claim();
  f.config.resourceStore.db.exec(`CREATE TRIGGER reject_retry BEFORE UPDATE ON app_tasks
    BEGIN SELECT RAISE(ABORT, 'retry write rejected'); END`);
  expect(() => failAppTaskAttempt(f.config, claim, "Provider unavailable")).toThrow("retry write rejected");
  expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("running");
  expect(f.config.resourceStore.readTask("work")?.status.executionRetryAt).toBeUndefined();
  expect(f.config.resourceStore.readTaskContext({ taskIds: [], admissionIds: ["ask:measure"] })
    .appTaskAdmissions?.["ask:measure"]?.reportAttemptId).toBeUndefined();
  f.config.resourceStore.db.exec("DROP TRIGGER reject_retry");
  failAppTaskAttempt(f.config, claim, "Provider unavailable");
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure", "report"))
    .toMatchObject({ attemptId: claim.attemptId, state: "error", reportRevision: 1 });
  const due = f.config.resourceStore.nextDueAt();
  expect(due).toBe(Date.now() + 250);
  f.config.resourceStore.setRecoveryState("work", { ready: true, changed: true, nextCheckAt: null });
  expect(f.config.resourceStore.nextDueAt()).toBe(due);
  expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  expect(f.config.resourceStore.readTask("work")?.status.executionFailures).toBe(1);
});

it("applies owner revision during cooldown and fences retry plus late failure on closure", () => {
  const f = fixture();
  const first = f.claim();
  failAppTaskAttempt(f.config, first, "Provider unavailable");
  const oldDue = f.config.resourceStore.nextDueAt()!;
  observeAppTaskIntent(f.config, { intent: { ...f.intent, outcome: "Read the cheaper replacement measurement" }, appAgent: "owner" });
  expect(f.config.resourceStore.readTask("work")?.status.executionRetryAt).toBe(oldDue);
  setSystemTime(oldDue + 1);
  const revised = f.claim();
  expect(revised.generation).toBeGreaterThan(first.generation);
  expect(revised.previousAttempt).toMatchObject({
    attemptId: first.attemptId,
    generation: first.generation,
    state: "failed",
    summary: "Provider unavailable",
  });
  expect(revised.intent.outcome).toBe("Read the cheaper replacement measurement");
  const resource = f.config.resourceStore.readTask("work")!;
  cancelAppTask(f.config, { appId: "sample", taskId: "work", decision: "app-policy", reason: "Owner withdrew this assignment",
    expectedGeneration: resource.metadata.generation, expectedResourceVersion: resource.metadata.resourceVersion });
  const admissions = f.config.resourceStore.readTaskContext({ taskIds: [], admissionIds: ["ask:measure"] }).appTaskAdmissions;
  expect(failAppTaskAttempt(f.config, revised, "Late provider failure").status).toBe("superseded");
  f.reopen();
  expect(f.config.resourceStore.readTaskContext({ taskIds: [], admissionIds: ["ask:measure"] }).appTaskAdmissions).toEqual(admissions);
  setSystemTime(new Date(oldDue + 1));
  expect(recordAppTaskTrigger(f.config, "work", { type: "project.task.tick" }).kind).not.toBe("recorded");
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" }).kind).toBe("completed");
  expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
});
