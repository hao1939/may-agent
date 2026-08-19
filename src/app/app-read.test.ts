import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { claimAppInboxItem, completeAppInboxClaim, createAppInboxItem } from "./app-inbox-store.js";
import { createRuntimeAppRead, createRuntimeTaskReader } from "./app-read.js";
import { observeAppTaskIntent, taskReconciliationConfig } from "./app-task-reconciler.js";

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
      metrics: {
        get: () => null,
      } as any,
    });

    await expect(read.appResult("app_read_result")).resolves.toEqual({
      summary: "probe complete",
      response: "ok",
      evidence: ["canary"],
    });
    await expect(read.appResult("missing")).resolves.toBeNull();
  });

  it("lists and gets only the current App's Tasks through one bounded collection", async () => {
    mkdirSync(join(root, "tasks"), { recursive: true });
    writeFileSync(
      join(root, "tasks", "seed.json"),
      `${JSON.stringify({
        root_task_id: "review",
        groups: {
          review: { id: "review", parent_id: null, state: "backlog", owner: "evaluation", children: [] },
        },
        resources: {},
      })}\n`,
    );
    const config = taskReconciliationConfig({
      appDir: root,
      projectDir: root,
      owner: "evaluation",
      maxConcurrent: 1,
    });
    for (const id of ["review/a", "review/b"]) {
      observeAppTaskIntent(config, {
        appOwner: "evaluation",
        intent: {
          id,
          parentId: "review",
          outcome: `Complete ${id}`,
          acceptance: ["Completed"],
          mode: "achieve",
        },
      });
    }
    const read = createRuntimeAppRead({
      getDb: () => db,
      metrics: { get: () => null } as any,
      executionPaths: { appDir: root, projectDir: root },
    });

    const first = await read.tasks.list({ limit: 1 });
    expect(first.items).toEqual([
      expect.objectContaining({ id: "review/a", status: "pending", generation: 1 }),
    ]);
    expect(first.nextCursor).toBeString();
    await expect(read.tasks.list({ limit: 1, cursor: first.nextCursor })).resolves.toEqual({
      items: [expect.objectContaining({ id: "review/b", status: "pending", generation: 1 })],
    });
    await expect(read.tasks.list({ status: ["done"] })).resolves.toEqual({ items: [] });
    await expect(read.tasks.get("review/a")).resolves.toEqual(await read.task("review/a"));
    await expect(read.tasks.get("missing")).resolves.toBeNull();
    await expect(read.tasks.list({ limit: 101 })).rejects.toThrow("between 1 and 100");
    await expect(read.tasks.list({ status: ["unknown" as never] })).rejects.toThrow("Invalid Task status filter");
    await expect(read.tasks.list({ cursor: "not-a-cursor" })).rejects.toThrow("Invalid Task cursor");
  });

  it("reuses one parsed Task resource for a bounded read pass and notices later writes", () => {
    mkdirSync(join(root, "tasks"), { recursive: true });
    writeFileSync(
      join(root, "tasks", "seed.json"),
      `${JSON.stringify({ groups: { root: { id: "root", parent_id: null } }, resources: {} })}\n`,
    );
    const config = taskReconciliationConfig({
      appDir: root,
      projectDir: root,
      owner: "evaluation",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      appOwner: "evaluation",
      intent: { id: "first", parentId: "root", outcome: "First", acceptance: ["Done"], mode: "achieve" },
    });
    const readTask = createRuntimeTaskReader({ appDir: root, projectDir: root });

    expect(readTask("first")?.status).toBe("pending");
    expect(readTask("missing")).toBeNull();

    observeAppTaskIntent(config, {
      appOwner: "evaluation",
      intent: { id: "second", parentId: "root", outcome: "Second", acceptance: ["Done"], mode: "achieve" },
    });
    expect(readTask("second")?.status).toBe("pending");
  });
});
