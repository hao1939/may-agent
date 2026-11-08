import { afterEach, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { fakeModel } from "../../test/fixtures/model.js";
import { createAgentRun } from "./agent-runner.js";
import { SubagentManager } from "./manager.js";
import { closeDb, getDb } from "./db/connection.js";
import { readSessionMessages, type TaskBinding } from "./persistence.js";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "../app/core/state/task-budget-admission.js";
import { taskPrimaryStart } from "../app/core/state/task-budget-managed-start.js";
import { appTaskContext, claimObservedAppTask, observeAppTaskIntent } from "../app/core/tasks/app-task-reconciler.js";

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
  const manager = new SubagentManager({
    persistDir: root,
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
  expect(() => f.manager.resumeSession(repair.sessionId, "Denied", { taskBinding: f.binding })).toThrow(
    TaskBudgetDeferredError,
  );
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
