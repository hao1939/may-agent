import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { createAppInboxItem } from "../state/app-inbox-store.js";
import { claimAppInboxItem, completeAppInboxClaim } from "../../../../test/fixtures/legacy-inbox.js";
import { createRuntimeAppRead, listRuntimeTaskViews, readRuntimeTaskView } from "./app-read.js";
import { readTaskOutcomes } from "../../adapters/reporting/task-outcomes.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import {
  observeAppTaskIntent,
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  closeAppTask,
  readAppTaskChildContext,
} from "../tasks/app-task-reconciler.js";

describe("App read projections", () => {
  let db: SqliteDb;
  let root: string;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
    root = mkdtempSync(join(tmpdir(), "app-read-"));
  });

  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  function resourceConfig() {
    const appDir = join(root, "evaluation.app");
    const store = AppTaskResourceStore.fromDb(db, "evaluation");
    store.bootstrapSnapshot(
      {
        project: "evaluation",
        project_lifecycle: "active",
        root_task_id: "review",
        groups: {
          review: {
            id: "review",
            parent_id: null,
            owner: "evaluation",
          },
        },
        resources: {},
        tasks: {},
      },
      "seed:test",
    );
    return appTaskContext({
      appDir,
      projectDir: root,
      agent: "evaluation",
      maxConcurrent: 1,
      resourceStore: store,
    });
  }

  it("returns only the authored result for a completed inbox item", async () => {
    createAppInboxItem(db, {
      id: "app_read_result",
      appId: "evaluation-canary",
      source: { kind: "system", id: "test" },
      input: { kind: "probe", data: { prompt: "test" } },
      now: 100,
    });
    const claim = claimAppInboxItem(db, "app_read_result", "host-1", 1_000, 100);
    expect(claim).not.toBeNull();
    completeAppInboxClaim(db, claim!, { summary: "probe complete", response: "ok", facts: ["canary"] }, 200);
    const read = createRuntimeAppRead({
      getDb: () => db,
    });

    await expect(read.appResult("app_read_result")).resolves.toEqual({
      summary: "probe complete",
      response: "ok",
      facts: ["canary"],
    });
    await expect(read.appResult("missing")).resolves.toBeNull();
    await expect(read.metric("missing")).rejects.toThrow("Metric reporting is unavailable");
    await expect(read.tasks.outcomes()).rejects.toThrow("Task outcome reporting is unavailable");
  });

  it("uses the loaded Task reader without consulting a JSON execution path", async () => {
    const taskRead = {
      list: async () => ({
        items: [{ id: "current", status: "pending" as const, generation: 1, outcome: "Use resource authority" }],
      }),
      outcomes: async () => ({
        projection: "outcomes" as const,
        manifestVersion: null,
        sourceCount: 0,
        outcomeCount: 0,
        outcomes: [],
      }),
      get: async (taskId: string) =>
        taskId === "current"
          ? ({ id: taskId, status: "pending" as const, generation: 1, outcome: "Use resource authority" } as any)
          : null,
    };
    const read = createRuntimeAppRead({
      getDb: () => db,
      taskRead,
    });

    expect(read.tasks).toBe(taskRead);
    await expect(read.tasks.get("current")).resolves.toMatchObject({ outcome: "Use resource authority" });
    await expect(read.tasks.list()).resolves.toMatchObject({ items: [{ id: "current" }] });
  });

  it("lists and gets only the current App's Tasks through one bounded collection", async () => {
    const config = resourceConfig();
    for (const id of ["review/a", "review/b"]) {
      observeAppTaskIntent(config, {
        appAgent: "evaluation",
        intent: {
          id,
          parentId: "review",
          outcome: `Complete ${id}`,
          acceptance: ["Completed"],
          agent: "evaluation",
          input: { exact: `input-for-${id}` },
        },
      });
    }
    const read = createRuntimeAppRead({
      getDb: () => db,
      taskStateConfig: config,
    });

    const first = await read.tasks.list({ limit: 1 });
    expect(first.items).toEqual([expect.objectContaining({ id: "review/a", status: "pending", generation: 1 })]);
    expect(first.items[0]).not.toHaveProperty("input");
    expect(first.items[0]).not.toHaveProperty("acceptance");
    expect(first.nextCursor).toBeString();
    await expect(read.tasks.list({ limit: 1, cursor: first.nextCursor })).resolves.toEqual({
      items: [expect.objectContaining({ id: "review/b", status: "pending", generation: 1 })],
    });
    await expect(read.tasks.list({ status: ["done"] })).resolves.toEqual({ items: [] });
    await expect(read.tasks.get("review/a")).resolves.toMatchObject({
      id: "review/a",
      parentId: "review",
      acceptance: ["Completed"],
      input: { exact: "input-for-review/a" },
      agent: "evaluation",
      owner: "evaluation",
      conditions: [],
    });
    await expect(read.tasks.get("missing")).resolves.toBeNull();
    await expect(read.tasks.list({ limit: 101 })).rejects.toThrow("between 1 and 100");
    await expect(read.tasks.list({ status: ["unknown" as never] })).rejects.toThrow("Invalid Task status filter");
    await expect(read.tasks.list({ cursor: "not-a-cursor" })).rejects.toThrow("Invalid Task cursor");
  });

  it("reads later Task mutations from the same resource authority", async () => {
    const config = resourceConfig();
    observeAppTaskIntent(config, {
      appAgent: "evaluation",
      intent: { id: "first", parentId: "review", outcome: "First", acceptance: ["Done"] },
    });
    const read = createRuntimeAppRead({
      getDb: () => db,
      taskStateConfig: config,
    });

    await expect(read.tasks.get("first")).resolves.toMatchObject({ status: "pending" });
    await expect(read.tasks.get("missing")).resolves.toBeNull();

    observeAppTaskIntent(config, {
      appAgent: "evaluation",
      intent: { id: "second", parentId: "review", outcome: "Second", acceptance: ["Done"] },
    });
    await expect(read.tasks.get("second")).resolves.toMatchObject({ status: "pending" });
    const failedReporting = createRuntimeAppRead({
      getDb: () => db,
      taskStateConfig: config,
      readMetric: async () => {
        throw new Error("report failed");
      },
      readOutcomes: async () => {
        throw new Error("report failed");
      },
    });
    await expect(failedReporting.metric("health")).rejects.toThrow("report failed");
    await expect(failedReporting.tasks.outcomes()).rejects.toThrow("report failed");
    await expect(failedReporting.tasks.get("second")).resolves.toMatchObject({ status: "pending" });
    expect((await failedReporting.tasks.list()).items).toHaveLength(2);
  });

  it("reads a new maintained cycle as pending without changing accepted state or task identity", async () => {
    const config = resourceConfig();
    const intent = {
      id: "review/standing",
      parentId: "review",
      outcome: "Keep source findings current",
      acceptance: ["Current source facts reviewed"],
      agent: "evaluation",
    };
    observeAppTaskIntent(config, { appAgent: "evaluation", intent });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "evaluation",
      handler: "agent:evaluation",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(completeAppTask(config, claim, { summary: "Previous cycle checked" }).status).toBe("applied");
    const read = createRuntimeAppRead({ getDb: () => db, taskStateConfig: config });
    await expect(read.tasks.get(intent.id)).resolves.toMatchObject({ status: "done" });

    observeAppTaskIntent(config, {
      appAgent: "evaluation",
      intent,
      trigger: { type: "source.changed", data: { revision: "next" } },
    });
    const stored = config.resourceStore.readTask(intent.id);
    expect(stored).toMatchObject({ metadata: { generation: 1 }, status: { phase: "converged" } });
    await expect(read.tasks.get(intent.id)).resolves.toMatchObject({
      id: intent.id,
      status: "pending",
      generation: 1,
      summary: "Previous cycle checked",
    });
    await expect(read.tasks.list({ status: ["pending"], limit: 1 })).resolves.toMatchObject({
      items: [{ id: intent.id, status: "pending", generation: 1 }],
    });
    await expect(read.tasks.list({ status: ["done"] })).resolves.toEqual({ items: [] });
    expect(config.resourceStore.readTask(intent.id)).toEqual(stored);
    expect(config.resourceStore.readTrigger(intent.id)).not.toBeNull();

    const next = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "evaluation",
      handler: "agent:evaluation",
    });
    if (next.kind !== "claimed") throw new Error("expected next claim");
    await expect(read.tasks.get(intent.id)).resolves.toMatchObject({ status: "running", generation: 1 });
    expect(completeAppTask(config, next, { summary: "New cycle checked" }).status).toBe("applied");
    await expect(read.tasks.get(intent.id)).resolves.toMatchObject({ status: "done", summary: "New cycle checked" });
    await expect(read.tasks.list({ status: ["pending"] })).resolves.toEqual({ items: [] });

    // Scheduler hints need not rewrite the accepted resource (or its revision).
    // Reads must agree with status-filtered discovery for either hint.
    const accepted = config.resourceStore.readTask(intent.id);
    for (const hints of [
      { ready: false, changed: true },
      { ready: true, changed: false },
      { ready: true, changed: true },
      { ready: false, changed: false },
    ]) {
      config.resourceStore.setRecoveryState(intent.id, hints);
      const status = hints.ready || hints.changed ? "pending" : "done";
      await expect(read.tasks.get(intent.id)).resolves.toMatchObject({ status });
      await expect(read.tasks.list({ status: [status], limit: 1 })).resolves.toMatchObject({
        items: [{ id: intent.id, status }],
      });
      await expect(read.tasks.list({ status: [status === "done" ? "pending" : "done"] })).resolves.toEqual({ items: [] });
      expect(config.resourceStore.readTask(intent.id)).toEqual(accepted);
    }
  });

  it("keeps an accepted result discoverable after owner closure without reporting active work", async () => {
    const config = resourceConfig();
    observeAppTaskIntent(config, {
      appAgent: "evaluation",
      intent: { id: "result", parentId: "review", outcome: "Measure", acceptance: ["Measured"], agent: "evaluation" },
    });
    const claim = claimObservedAppTask(config, { taskId: "result", appAgent: "evaluation", handler: "agent:evaluation" });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(completeAppTask(config, claim, {
      summary: "Measured", result: { value: 17 }, facts: ["measurement:17"],
    }).status).toBe("applied");
    const read = createRuntimeAppRead({ getDb: () => db, taskStateConfig: config });
    expect((await read.tasks.get("result"))?.closed).not.toBe(true);
    const resource = config.resourceStore.readTask("result")!;
    expect(closeAppTask(config, {
      appId: "evaluation", taskId: "result",
      expectedGeneration: resource.metadata.generation,
      expectedResourceVersion: resource.metadata.resourceVersion,
      reason: "Owner consumed the measurement", afterResult: claim.attemptId,
    }).applied).toBe(true);
    const page = await read.tasks.list();
    expect(page.items).toEqual([expect.objectContaining({
      id: "result", status: "done", closed: true, result: { value: 17 }, facts: ["measurement:17"],
    })]);
    expect(await read.tasks.get("result")).toMatchObject(page.items[0]!);
    expect(await read.tasks.list({ status: ["done"] })).toEqual(page);
    expect(await read.tasks.list({ status: ["attention", "pending", "running"] })).toEqual({ items: [] });
    expect(readAppTaskChildContext(config, "review").cancelled).toEqual([
      expect.objectContaining({ taskId: "result", kind: "closed", facts: ["measurement:17"] }),
    ]);
    const reporting = {
      appDir: config.appDir,
      tasks: {
        get: (id: string) => readRuntimeTaskView({ taskStateConfig: config }, id),
        list: (options: Parameters<typeof listRuntimeTaskViews>[1]) => listRuntimeTaskViews({ taskStateConfig: config }, options),
      },
    };
    expect(readTaskOutcomes(reporting).sourceCount).toBe(0);
    expect(readTaskOutcomes({ ...reporting, projection: { includeDone: true } }).sourceCount).toBe(1);
  });

  it("reads only the outcome containing an exact Task", async () => {
    const config = resourceConfig();
    for (const id of ["review/a", "review/b", "review/unrelated"]) {
      observeAppTaskIntent(config, {
        appAgent: "evaluation",
        intent: { id, parentId: "review", outcome: `Complete ${id}`, acceptance: ["Done"] },
      });
    }
    mkdirSync(join(config.appDir, "tasks"), { recursive: true });
    writeFileSync(
      join(config.appDir, "tasks", "outcome-projection.json"),
      JSON.stringify({
        version: 1,
        groups: [{ id: "review-pair", outcome: "Complete the pair", taskIds: ["review/a", "review/b"] }],
      }),
    );
    const read = createRuntimeAppRead({
      getDb: () => db,
      taskStateConfig: config,
      readOutcomes: async (projection) =>
        readTaskOutcomes({
          appDir: config.appDir,
          projection,
          tasks: {
            get: (id) => readRuntimeTaskView({ taskStateConfig: config }, id),
            list: (options) => listRuntimeTaskViews({ taskStateConfig: config }, options),
          },
        }),
    });

    await expect(read.tasks.outcomes({ taskId: "review/a" })).resolves.toMatchObject({
      sourceCount: 2,
      outcomeCount: 1,
      outcomes: [{ id: "review-pair", memberTaskIds: ["review/a", "review/b"] }],
    });
    await expect(read.tasks.outcomes({ taskId: "missing" })).resolves.toMatchObject({
      sourceCount: 0,
      outcomeCount: 0,
      outcomes: [],
    });
  });
});
