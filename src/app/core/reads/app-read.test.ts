import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { claimAppInboxItem, completeAppInboxClaim, createAppInboxItem } from "../../app-inbox-store.js";
import { createRuntimeAppRead, listRuntimeTaskViews, readRuntimeTaskView } from "./app-read.js";
import { readTaskOutcomes } from "../../adapters/reporting/task-outcomes.js";
import { AppTaskResourceStore } from "../../app-task-resource-store.js";
import { observeAppTaskIntent, appTaskContext } from "../../app-task-reconciler.js";

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
    completeAppInboxClaim(db, claim!, { summary: "probe complete", response: "ok", evidence: ["canary"] }, 200);
    const read = createRuntimeAppRead({
      getDb: () => db,
    });

    await expect(read.appResult("app_read_result")).resolves.toEqual({
      summary: "probe complete",
      response: "ok",
      evidence: ["canary"],
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
          mode: "achieve",
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
      intent: { id: "first", parentId: "review", outcome: "First", acceptance: ["Done"], mode: "achieve" },
    });
    const read = createRuntimeAppRead({
      getDb: () => db,
      taskStateConfig: config,
    });

    await expect(read.tasks.get("first")).resolves.toMatchObject({ status: "pending" });
    await expect(read.tasks.get("missing")).resolves.toBeNull();

    observeAppTaskIntent(config, {
      appAgent: "evaluation",
      intent: { id: "second", parentId: "review", outcome: "Second", acceptance: ["Done"], mode: "achieve" },
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

  it("reads only the outcome containing an exact Task", async () => {
    const config = resourceConfig();
    for (const id of ["review/a", "review/b", "review/unrelated"]) {
      observeAppTaskIntent(config, {
        appAgent: "evaluation",
        intent: { id, parentId: "review", outcome: `Complete ${id}`, acceptance: ["Done"], mode: "achieve" },
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
