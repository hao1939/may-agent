import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "../state/task-budget-admission.js";
import { migrateTaskCompletionReceipts } from "../../migrations/task-receipt-cutover.js";
import { appTaskContext, appTaskSpecHash } from "./app-task-reconciler.js";
import { appTaskConfig, prepareAppTaskRuntimeDescriptors, standaloneAppTaskAdmissionDescriptors } from "./runtime-definition.js";

test("coordination preparation requires an available shared workflow and a small explicit time bound", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-coordination-definition-"));
  const app = defineApp({ id: "sample", version: 1, agent: "owner", inputSchema: Type.Object({}),
    tasks: { coordination: { taskId: "runtime/review", workflow: "review", maxAttemptMs: 60_000 } } });
  try {
    const store = AppTaskResourceStore.fromDb(getDb(root), app.id);
    store.bootstrapSnapshot({ groups: { root: { id: "root" } } }, "coordination-fixture");
    const options = { persistDir: root, projectsRoot: root,
      appRegistrySnapshot: { id: "candidate", generation: 1, entries: [{ appDir: root, definition: app }] } };
    await expect(prepareAppTaskRuntimeDescriptors(options)).rejects.toThrow("workflow runner is unavailable");
    const runner = (workspace: "shared" | "task", available = true) => ({
      inspect: async () => ({ available, error: null, workspace }),
      execute: async () => { throw new Error("Preparation cannot execute work"); },
    });
    await expect(prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("task") })).rejects.toThrow("shared workspace");
    await expect(prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("shared", false) })).rejects.toThrow("shared workspace");
    const prepared = await prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("shared") });
    expect(prepared).toHaveLength(1);
    app.tasks!.coordination!.maxAttemptMs = 120_001;
    await expect(prepareAppTaskRuntimeDescriptors({ ...options, workflows: runner("shared") })).rejects.toThrow("attempt bound");
  } finally { closeDb(root); rmSync(root, { recursive: true, force: true }); }
});

test("runtime preparation requires offline receipt conversion before admission or execution", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-runtime-definition-"));
  const app = defineApp({
    id: "sample",
    version: 1,
    agent: "worker",
    inputSchema: Type.Object({}),
    tasks: { maxConsecutiveFailures: 5 },
  });
  try {
    const store = AppTaskResourceStore.fromDb(getDb(root), app.id);
    const assignment = {
      id: "measurement",
      parentId: "root",
      outcome: "Measure the sample",
      acceptance: ["Measurement recorded"],
    };
    const receipt = {
      metadata: { id: assignment.id, generation: 1, resourceVersion: 1 },
      specHash: appTaskSpecHash(assignment, "worker"),
      parentId: assignment.parentId,
      outcome: assignment.outcome,
      acceptance: assignment.acceptance,
      owner: "worker",
      handler: "agent:worker",
      summary: "Measured 17",
      result: { value: 17 },
      facts: ["sample.json"],
      failureFingerprints: [],
      completedAt: "2026-09-01T00:00:00.000Z",
    };
    store.bootstrapSnapshot(
      {
        project: app.id,
        groups: { root: { id: "root", parent_id: null } },
        receipts: { [assignment.id]: receipt },
      },
      "legacy-fixture",
    );
    const options = {
      persistDir: root,
      projectsRoot: root,
      entries: [{ appDir: root, definition: app }],
    };
    const prepare = () =>
      prepareAppTaskRuntimeDescriptors({
        ...options,
        appRegistrySnapshot: { id: "candidate", generation: 1, entries: options.entries },
      });
    const before = store.readSnapshot();
    const version = store.revision();
    await expect(prepare()).rejects.toThrow("unconverted completion history for Task measurement");
    expect(() => standaloneAppTaskAdmissionDescriptors(options)).toThrow("offline Task state cutover");
    expect(store.readSnapshot()).toEqual(before);
    expect(store.revision()).toBe(version);

    const config = appTaskContext({ appDir: root, agent: "worker", resourceStore: store });
    expect(migrateTaskCompletionReceipts(config, { oldRuntimeStopped: true }).imported).toBe(1);
    const prepared = await prepare();
    expect(prepared).toHaveLength(1);
    expect(appTaskConfig(prepared[0]!).maxConsecutiveFailures).toBe(5);
    expect(standaloneAppTaskAdmissionDescriptors(options).size).toBe(1);
    expect(store.readReceipt(assignment.id)).toEqual(receipt);
    expect(store.readTask(assignment.id)?.status.result).toEqual({ value: 17 });
    expect(store.isCancelled(assignment.id)).toBe(true);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});


test("loaded App coordination must match protected funding before bootstrap or admission", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-protected-definition-"));
  const coordination = { taskId: "runtime/review", workflow: "review", maxAttemptMs: 60_000 };
  const app = defineApp({
    id: "sample",
    version: 1,
    agent: "owner",
    inputSchema: Type.Object({}),
    tasks: { coordination: { ...coordination, workflow: "business" } },
  });
  try {
    const db = getDb(root);
    new TaskBudgetAdmissionStore(db).install({
      appId: app.id,
      sponsor: { appId: app.id, agent: "owner" },
      dailyCredits: 0,
      rootCredits: 5,
      coordination: { ...coordination, agent: "owner", dailyCredits: 3, credits: 3 },
    });
    const options = { persistDir: root, projectsRoot: root, entries: [{ appDir: root, definition: app }] };
    await expect(
      prepareAppTaskRuntimeDescriptors({
        ...options,
        appRegistrySnapshot: { id: "candidate", generation: 1, entries: options.entries },
        workflows: {
          inspect: async () => ({ available: true, error: null, workspace: "shared" as const }),
          execute: async () => {
            throw new Error("must not run");
          },
        },
      }),
    ).rejects.toThrow("differs");
    expect(AppTaskResourceStore.activeFromDb(db, app.id)).toBeNull();
    expect(() => standaloneAppTaskAdmissionDescriptors(options)).toThrow("differs");
    expect(() => standaloneAppTaskAdmissionDescriptors({ ...options, initialize: false })).toThrow("differs");
    expect(db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()?.n).toBe(0);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
