import { ExecutionDeferredError, Type, defineApp } from "@may-agent/sdk";
import { EventBus } from "../app/core/events/bus.js";
import { createWorkflowRunner, createWorkflowTool } from "./workflow-tool.js";
import { getWorkflowRun } from "./db/workflows.js";
import { createTaskWorkflowRunner } from "../app/adapters/executors/workflow.js";
import { runTaskAttempt } from "../app/core/tasks/attempt-runner.js";
import { admitTaskInput } from "../app/core/state/inbox.js";
import { afterEach, expect, spyOn, test } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { fakeModel } from "../../test/fixtures/model.js";
import { createAgentRun } from "./agent-runner.js";
import { SubagentManager } from "./manager.js";
import { closeDb, getDb } from "./db/connection.js";
import { stateTransaction } from "./db/transaction.js";
import { readSessionMessages, type TaskBinding } from "./persistence.js";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "../app/core/state/task-budget-admission.js";
import { taskPrimaryStart } from "../app/core/state/task-budget-managed-start.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  deferAppTaskExecution,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
} from "../app/core/tasks/app-task-reconciler.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanups.splice(0)) await close();
});

function fixture(credits = 4) {
  const root = mkdtempSync(join(tmpdir(), "may-managed-budget-"));
  const db = getDb(root);
  const accounting = new TaskBudgetAdmissionStore(db);
  accounting.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "sponsor" },
    dailyCredits: credits,
    rootCredits: credits,
  });
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.bootstrapSnapshot(
    {
      project: "sample",
      root_task_id: "root",
      groups: {
        root: { id: "root", parent_id: null },
      },
    },
    "seed",
  );
  const config = appTaskContext({
    appDir: join(root, "sample.app"),
    projectDir: root,
    agent: "worker",
    maxConcurrent: 2,
    resourceStore: store,
  });
  observeAppTaskIntent(config, {
    appAgent: "worker",
    intent: {
      id: "work",
      parentId: "root",
      outcome: "Deliver the result",
      acceptance: ["Result accepted"],
    },
  });
  const claimed = claimObservedAppTask(config, { taskId: "work", appAgent: "worker", handler: "agent" });
  if (claimed.kind !== "claimed") throw new Error("Expected funded attempt");
  const binding: TaskBinding = {
    appId: "sample",
    taskId: "work",
    generation: claimed.generation,
    attemptId: claimed.attemptId,
  };
  let factories = 0;
  let hold = false;
  const started = Promise.withResolvers<void>();
  const replies: Array<() => void> = [];
  const bus = new EventBus();
  const manager = new SubagentManager({
    persistDir: root,
    bus,
    agentRunFactory: (options) => {
      factories++;
      return createAgentRun({
        ...options,
        streamFn: (model) => {
          const stream = createAssistantMessageEventStream();
          const reply = () => {
            const message: AssistantMessage = {
              role: "assistant",
              api: model.api,
              provider: model.provider,
              model: model.id,
              content: [{ type: "text", text: "Result" }],
              stopReason: "stop",
              timestamp: Date.now(),
              usage: {
                input: 1,
                output: 1,
                totalTokens: 2,
                cacheRead: 0,
                cacheWrite: 0,
                cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 },
              },
            };
            stream.push({ type: "done", reason: "stop", message });
          };
          started.resolve();
          if (hold) replies.push(reply);
          else reply();
          return stream;
        },
      });
    },
  });
  manager.register({
    name: "worker",
    description: "Fixture worker",
    domain: "test",
    systemPrompt: "Work",
    model: fakeModel(),
    tools: [],
  });
  cleanups.push(async () => {
    const active = manager.status();
    for (const session of active) manager.cancel(session.sessionId);
    for (const reply of replies.splice(0)) reply();
    await Promise.allSettled(active.map((session) => manager.waitFor(session.sessionId)));
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    db,
    bus,
    config,
    claim: claimed,
    accounting,
    store,
    binding,
    manager,
    started,
    factories: () => factories,
    hold: (value: boolean) => {
      hold = value;
    },
    release: () => {
      for (const reply of replies.splice(0)) reply();
    },
    view: () => accounting.budget.view(binding, Date.now()),
  };
}

test("paid primary is covered once; repair and resume are distinct charges while saved results are free", async () => {
  const f = fixture();
  const primary = taskPrimaryStart(f.binding);
  const first = await f.manager.callAgent("worker", "Primary", { taskBinding: f.binding, taskPrimaryStart: primary });
  expect(f.view()?.rootCharged).toBe(2);
  expect(f.manager.result(first.sessionId).status).toBe("done");
  await f.manager.waitFor(first.sessionId);
  expect(f.view()?.rootCharged).toBe(2);
  const repair = await f.manager.callAgent("worker", "Repair", { taskBinding: f.binding, taskPrimaryStart: primary });
  expect(f.view()?.rootCharged).toBe(3);
  f.manager.resumeSession(repair.sessionId, "Continue", { taskBinding: f.binding });
  expect((await f.manager.waitFor(repair.sessionId)).status).toBe("done");
  expect(f.view()).toMatchObject({ rootCharged: 4, grant: { charged: 4 } });
  const before = readSessionMessages(f.root, repair.sessionId);
  const failures: string[] = [];
  const stop = f.bus.listen((event) => {
    if (event.type === "session.resume_failed") failures.push(event.type);
  });
  expect(() => f.manager.resumeSession(repair.sessionId, "Denied", { taskBinding: f.binding })).toThrow(
    TaskBudgetDeferredError,
  );
  stop();
  expect(failures).toEqual([]);
  expect(readSessionMessages(f.root, repair.sessionId)).toEqual(before);
  expect(f.manager.registry.getSession(repair.sessionId)?.status).toBe("done");
  expect(f.factories()).toBe(3);
  const starts = f.db.prepare("SELECT * FROM task_budget_managed_starts ORDER BY admitted_at, invocation_id").all();
  expect(starts).toHaveLength(3);
  expect(starts.filter((row) => row.primary_covered === 1)).toHaveLength(1);
  expect(new Set(starts.map((row) => row.invocation_id)).size).toBe(3);
  expect(starts.filter((row) => row.session_id === repair.sessionId)).toHaveLength(2);
});

test("source labels and retained sessions cannot grant a free primary or restore live Task authority", async () => {
  const f = fixture(3);
  const helper = await f.manager.callAgent("worker", "Helper", { source: "app-task-agent", taskBinding: f.binding });
  expect(f.view()?.rootCharged).toBe(3);
  expect(f.db.prepare("SELECT primary_covered FROM task_budget_managed_starts").get()?.primary_covered).toBe(0);
  const before = readSessionMessages(f.root, helper.sessionId);
  expect(() => f.manager.resumeSession(helper.sessionId, "Without authority")).toThrow("current Task binding");
  expect(readSessionMessages(f.root, helper.sessionId)).toEqual(before);
  // The actual primary is covered by the original paid attempt even with no spare credits.
  await f.manager.callAgent("worker", "Primary", {
    taskBinding: f.binding,
    taskPrimaryStart: taskPrimaryStart(f.binding),
  });
  expect(f.view()?.rootCharged).toBe(3);
  expect(() => f.manager.run("worker", "Denied helper", { sessionId: "denied", taskBinding: f.binding })).toThrow(
    TaskBudgetDeferredError,
  );
  expect(existsSync(join(f.root, "sessions", "denied"))).toBe(false);
  expect(f.factories()).toBe(2);
  expect(() =>
    f.manager.run("worker", "Unbounded", { kind: "chat", autoClose: "never", taskBinding: f.binding }),
  ).toThrow("bounded managed session");
});

test("live-parent helpers inherit the account and cannot use a primary capability", async () => {
  const f = fixture();
  expect(() =>
    f.manager.run("worker", "Wrong permit", {
      taskBinding: f.binding,
      taskPrimaryStart: taskPrimaryStart({ ...f.binding, taskId: "other" }),
    }),
  ).toThrow("does not match");
  expect(f.view()?.rootCharged).toBe(2);
  f.hold(true);
  const parent = f.manager.run("worker", "Primary", {
    taskBinding: f.binding,
    taskPrimaryStart: taskPrimaryStart(f.binding),
  });
  await f.started.promise;
  f.hold(false);
  await f.manager.callAgent("worker", "Helper", {
    parentSessionId: parent,
    taskBinding: { ...f.binding, appId: "different" },
    taskPrimaryStart: taskPrimaryStart(f.binding),
  });
  expect(f.view()?.rootCharged).toBe(3);
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_managed_starts WHERE primary_covered = 1").get()?.n).toBe(
    1,
  );
  f.release();
  await f.manager.waitFor(parent);
  expect(() => f.manager.run("worker", "Stale", { taskBinding: { ...f.binding, generation: 99 } })).toThrow(
    "no longer current",
  );
  expect(f.view()?.rootCharged).toBe(3);
});

test("independent runtimes share the single covered primary and the remaining helper credit", async () => {
  const f = fixture(3);
  const execute = promisify(execFile);
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, index) =>
      execute(
        process.execPath,
        [
          "-e",
          `
    const { getDb, closeDb } = await import(${JSON.stringify(new URL("./db/connection.ts", import.meta.url).href)});
    const { admitManagedTaskStart, taskPrimaryStart } = await import(${JSON.stringify(new URL("../app/core/state/task-budget-managed-start.ts", import.meta.url).href)});
    const binding = ${JSON.stringify(f.binding)};
    const root = ${JSON.stringify(f.root)};
    try {
      admitManagedTaskStart(getDb(root, { existingSchemaOnly: true }), { sessionId: ${JSON.stringify(`session-${index}`)}, binding, primary: taskPrimaryStart(binding) });
      console.log("admitted");
    } catch (error) {
      if (error.name !== "TaskBudgetDeferredError") throw error;
      console.log("deferred");
    } finally { closeDb(root); }
  `,
        ],
        { encoding: "utf8", timeout: 10_000 },
      ),
    ),
  );
  for (const result of results) if (result.status === "rejected") throw result.reason;
  const kinds = results.flatMap((result) => (result.status === "fulfilled" ? [result.value.stdout.trim()] : []));
  expect(kinds.filter((kind) => kind === "admitted")).toHaveLength(2);
  expect(kinds.filter((kind) => kind === "deferred")).toHaveLength(4);
  expect(f.view()?.rootCharged).toBe(3);
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_managed_starts WHERE primary_covered = 1").get()?.n).toBe(
    1,
  );
}, 20_000);

function helperWorkflow(f: ReturnType<typeof fixture>, reuseSessionId?: string) {
  const workflowDir = join(f.root, "workflows");
  mkdirSync(workflowDir);
  writeFileSync(
    join(workflowDir, "delegate.ts"),
    `
export const name = "delegate";
export const description = "Run a required bounded helper";
export async function execute(ctx) {
  await ctx.agents.call("worker", "Collect facts", ${JSON.stringify(reuseSessionId ? { sessionId: reuseSessionId } : {})});
  return ctx.done("Collected facts");
}`,
  );
  return { manager: f.manager, persistDir: f.root, workflowDir, taskBinding: f.binding };
}

test("model agent tools report denied call and fork as not started without inventing a helper identity", async () => {
  const f = fixture(2);
  f.hold(true);
  const parent = f.manager.run("worker", "Primary", {
    taskBinding: f.binding,
    taskPrimaryStart: taskPrimaryStart(f.binding),
  });
  await f.started.promise;
  const tool = f.manager.createAgentsTool({ getCallerSessionId: () => parent });
  for (const action of ["call", "fork"]) {
    const result = await tool.execute("denied", { action, agent: "worker", task: "Collect facts" });
    const part = result.content[0];
    if (part.type !== "text") throw new Error("Expected structured deferral");
    const value = JSON.parse(part.text);
    expect(value).toMatchObject({
      status: "deferred",
      started: false,
      deferral: { reason: "root-credit", retryAt: null },
    });
    expect(value.id).toBeUndefined();
    expect(value.sessionId).toBeUndefined();
  }
  expect(f.factories()).toBe(1);
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_managed_starts").get()?.n).toBe(1);
  f.release();
  await f.manager.waitFor(parent);
});

test("typed and model workflow callers retain blocked execution facts for an unfunded helper", async () => {
  const f = fixture(2);
  const options = helperWorkflow(f);
  let denial: ExecutionDeferredError | undefined;
  try {
    await createWorkflowRunner(options).run("delegate", "Required work");
  } catch (error) {
    if (!(error instanceof ExecutionDeferredError)) throw error;
    denial = error;
  }
  expect(denial).toBeInstanceOf(TaskBudgetDeferredError);
  expect(denial?.started).toBe(false);
  expect(denial?.callerExecution?.kind).toBe("workflow");
  expect(getWorkflowRun(f.root, denial!.callerExecution!.id)).toMatchObject({
    status: "blocked",
    result_payload: { state: "available", value: { started: false, deferral: { reason: "root-credit" } } },
  });
  const response = await createWorkflowTool(options).execute("denied", { action: "run", name: "delegate", input: {} });
  const part = response.content[0];
  if (part.type !== "text") throw new Error("Expected structured deferral");
  expect(JSON.parse(part.text)).toMatchObject({
    status: "deferred",
    started: false,
    callerExecution: { kind: "workflow", id: expect.any(String) },
  });
  expect(JSON.parse(part.text).id).toBeUndefined();
  expect(f.factories()).toBe(0);
  expect(f.view()?.rootCharged).toBe(2);
});

test("workflow resume funding denial cannot fall through to a fresh helper call", async () => {
  const f = fixture(3);
  const helper = await f.manager.callAgent("worker", "Earlier helper", { taskBinding: f.binding });
  const messages = readSessionMessages(f.root, helper.sessionId);
  const stored = spyOn(f.manager, "result").mockImplementation(() => {
    throw new Error("Saved output requires resume");
  });
  const fresh = spyOn(f.manager, "callAgent");
  const resume = spyOn(f.manager, "resumeSession");
  try {
    await expect(
      createWorkflowRunner(helperWorkflow(f, helper.sessionId)).run("delegate", "Required work"),
    ).rejects.toBeInstanceOf(ExecutionDeferredError);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(fresh).not.toHaveBeenCalled();
    expect(readSessionMessages(f.root, helper.sessionId)).toEqual(messages);
    expect(f.manager.registry.getSession(helper.sessionId)?.status).toBe("done");
    expect(f.factories()).toBe(1);
  } finally {
    stored.mockRestore();
    fresh.mockRestore();
    resume.mockRestore();
  }
});

test.each(["executor", "workflow"] as const)(
  "an unhandled real helper denial retains %s parent input without consuming an execution retry",
  async (handler) => {
    const f = fixture(3);
    if (handler === "workflow") {
      const installedDir = join(f.root, "worker", "workflows");
      mkdirSync(installedDir, { recursive: true });
      writeFileSync(
        join(installedDir, "delegate.ts"),
        `
export const name = "delegate";
export const description = "Run a required bounded helper";
export const workspace = "shared";
export async function execute(ctx) {
  await ctx.agents.call("worker", "Collect facts");
  return ctx.done("Collected facts");
}`,
      );
    }
    completeAppTask(f.config, f.claim, { summary: "Earlier result" });
    observeAppTaskIntent(f.config, {
      appAgent: "worker",
      creator: { appId: "sample" },
      creatorRevision: true,
      intent: {
        id: "work",
        parentId: "root",
        outcome: "Collect additional facts",
        acceptance: ["Facts returned"],
        ...(handler === "workflow" ? { workflow: "delegate" } : { executor: "inspect" }),
      },
    });
    admitTaskInput(f.config, {
      appId: "sample",
      attachment: { kind: "existing", taskId: "work" },
      idempotencyKey: "ask:more",
      inputContext: { id: "more", source: { kind: "human", id: "person" }, input: { kind: "work", data: {} } },
    });
    let executions = 0;
    await runTaskAttempt({
      taskId: "work",
      descriptor: {
        id: "sample",
        appDir: f.config.appDir,
        projectDir: f.root,
        agent: "worker",
        resourceStore: f.store,
        reconciliationPaused: false,
        app: defineApp({ id: "sample", version: 1, agent: "worker", inputSchema: Type.Object({}), tasks: {} }),
      },
      opts: {
        projectRoot: f.root,
        projectsRoot: f.root,
        persistDir: f.root,
        bus: f.bus,
        agentsRoot: f.root,
        sharedRoot: join(f.root, "shared"),
        workflows: createTaskWorkflowRunner({ manager: f.manager, bus: f.bus }),
        executors: {
          inspect: async (attempt) => {
            executions++;
            await f.manager.callAgent("worker", "Required helper", {
              taskBinding: {
                appId: "sample",
                taskId: "work",
                generation: attempt.task.generation,
                attemptId: attempt.attemptId,
              },
            });
            return { state: "converged", summary: "Facts returned", facts: [] };
          },
        },
      },
      dispatch: { lane: "human", enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 },
      reportTiming: () => {},
    });
    expect(executions).toBe(handler === "executor" ? 1 : 0);
    expect(f.factories()).toBe(0);
    const task = f.store.readTask("work")!;
    expect(task.status).toMatchObject({ phase: "pending", funding: { reason: "root-credit", retryAt: null } });
    expect(task.status.currentAttemptId).toBeUndefined();
    expect(task.status.executionFailures).toBeUndefined();
    expect(task.status.executionRetryAt).toBeUndefined();
    expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:more")).toBeNull();
    const retained = f.store.readTaskContext({ taskIds: ["work"], admissionIds: ["ask:more"] });
    expect(retained.appTaskAdmissions?.["ask:more"]).toMatchObject({ taskId: "work" });
    expect(retained.appTaskAdmissions?.["ask:more"]?.resultAttemptId).toBeUndefined();
    expect(retained.taskTriggers?.work?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: expect.objectContaining({ idempotencyKey: "ask:more" }) }),
      ]),
    );
    expect(f.store.listRecoveryCandidates().items).toEqual([]);
    expect(f.view()?.rootCharged).toBe(3);
    const attempts = f.db
      .prepare("SELECT attempt_json FROM app_task_attempts WHERE app_id = 'sample'")
      .all()
      .map((row) => JSON.parse(row.attempt_json as string));
    const deferred = attempts.find((attempt) => attempt.failureReason === "ResourceAdmissionDeferred");
    expect(deferred).toMatchObject({ state: "interrupted" });
    expect(deferred.acceptedResult).toBeUndefined();
    if (handler === "workflow") {
      expect(deferred.summary).toContain("workflow-run:");
      const runId = deferred.summary.split("workflow-run:")[1];
      expect(getWorkflowRun(f.root, runId)?.status).toBe("blocked");
    }
  },
);

test.each(["cancel", "revise"] as const)("a late helper deferral cannot overwrite a concurrent %s", async (change) => {
  const f = fixture(2);
  let denial: TaskBudgetDeferredError | undefined;
  try {
    await f.manager.callAgent("worker", "Required helper", { taskBinding: f.binding });
  } catch (error) {
    if (!(error instanceof TaskBudgetDeferredError)) throw error;
    denial = error;
  }
  expect(denial).toBeInstanceOf(TaskBudgetDeferredError);
  const current = f.store.readTask("work")!;
  if (change === "cancel") {
    cancelAppTask(f.config, {
      appId: "sample",
      taskId: "work",
      expectedGeneration: current.metadata.generation,
      expectedResourceVersion: current.metadata.resourceVersion,
      reason: "Assignment withdrawn",
    });
  } else {
    observeAppTaskIntent(f.config, {
      appAgent: "worker",
      intent: { id: "work", parentId: "root", outcome: "Changed requirements", acceptance: ["New facts accepted"] },
    });
  }
  const before = f.store.readTaskContext({ taskIds: ["work"] });
  expect(deferAppTaskExecution(f.config, f.claim, denial!.constraint)).toBe("stale");
  expect(f.store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
  expect(f.view()?.rootCharged).toBe(2);
  expect(f.factories()).toBe(0);
});

test("caller rollback preserves the live parent claim and recovery facts together", async () => {
  const f = fixture(2);
  let denial: TaskBudgetDeferredError | undefined;
  try {
    await f.manager.callAgent("worker", "Required helper", { taskBinding: f.binding });
  } catch (error) {
    if (!(error instanceof TaskBudgetDeferredError)) throw error;
    denial = error;
  }
  expect(denial).toBeInstanceOf(TaskBudgetDeferredError);
  const before = f.store.readTaskContext({ taskIds: ["work"] });
  const recovery = f.store.listRecoveryCandidates();
  expect(() =>
    stateTransaction(f.db, () => {
      expect(deferAppTaskExecution(f.config, f.claim, denial!.constraint)).toBe("applied");
      throw new Error("Caller commit failed");
    }),
  ).toThrow("Caller commit failed");
  expect(f.store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
  expect(f.store.listRecoveryCandidates()).toEqual(recovery);
  expect(f.view()?.rootCharged).toBe(2);
  expect(f.factories()).toBe(0);
});
