import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  cacheTaskStateReads,
  migrateTaskState,
  readTaskState,
  saveTaskState,
  setProjectLifecycle,
  type AppTaskTreeProjection,
  type TaskStateConfig,
  type TaskTree,
} from "./app-task-store.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";

const TEST_DIR = join(import.meta.dir, "__test_shrinkage__");

function makeConfig(): TaskStateConfig {
  return {
    appDir: TEST_DIR,
    projectDir: TEST_DIR,
    statePath: projectRuntimePaths(TEST_DIR).taskStatePath,
    journalPath: join(TEST_DIR, "journal.jsonl"),
    worker: "test-worker",
    maxConcurrent: 1,
  };
}

function makeTasks(count: number): Record<string, { id: string; state: string; children: string[] }> {
  const tasks: Record<string, { id: string; state: string; children: string[] }> = {};
  for (let i = 0; i < count; i++) {
    tasks[`task-${i}`] = { id: `task-${i}`, state: "backlog", children: [] };
  }
  return tasks;
}

function makeTree(count: number, project_lifecycle?: string): TaskTree {
  return {
    ...(project_lifecycle ? { project_lifecycle } : {}),
    groups: makeTasks(count),
    tasks: {},
  };
}

describe("saveTaskState shrinkage guard", () => {
  beforeEach(() => {
    mkdirSync(dirname(makeConfig().statePath), { recursive: true });
  });

  it("runs an atomic mutation validator against the current stored tree", () => {
    const config = makeConfig();
    const existingTree = makeTree(5);
    writeFileSync(config.statePath, JSON.stringify(existingTree));
    const observations: Array<{ current: number; next: number; authority: unknown }> = [];
    config.mutationAuthority = { kind: "test-authority" };
    config.validateMutation = ({ current, next, authority }) => {
      observations.push({
        current: Object.keys(current.tasks).length,
        next: Object.keys(next.tasks).length,
        authority,
      });
    };

    saveTaskState(config, makeTree(6));

    expect(observations).toEqual([
      {
        current: 5,
        next: 6,
        authority: { kind: "test-authority" },
      },
    ]);
  });

  it("does not write when the mutation validator rejects the transition", () => {
    const config = makeConfig();
    const existingTree = makeTree(5);
    writeFileSync(config.statePath, JSON.stringify(existingTree));
    config.validateMutation = () => {
      throw new Error("mutation rejected");
    };

    expect(() => saveTaskState(config, makeTree(6))).toThrow("mutation rejected");
    expect(Object.keys((JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree).groups ?? {}).length).toBe(5);
  });

  it("rejects silent active-to-paused lifecycle writes", () => {
    const config = makeConfig();
    const existingTree = makeTree(5, "active");
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    expect(() => saveTaskState(config, makeTree(6, "paused"))).toThrow(/lifecycle guard/);

    const saved = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("active");
  });

  it("preserves lifecycle and shrinkage guards when a bounded pass reuses its parsed tree", () => {
    const lifecycleConfig = makeConfig();
    writeFileSync(lifecycleConfig.statePath, JSON.stringify(makeTree(6, "active")));
    cacheTaskStateReads(lifecycleConfig);
    const lifecycleTree = readTaskState(lifecycleConfig);
    lifecycleTree.project_lifecycle = "paused";
    expect(() => saveTaskState(lifecycleConfig, lifecycleTree)).toThrow(/lifecycle guard/);

    const shrinkageConfig = makeConfig();
    writeFileSync(shrinkageConfig.statePath, JSON.stringify(makeTree(6, "active")));
    cacheTaskStateReads(shrinkageConfig);
    const shrinkageTree = readTaskState(shrinkageConfig);
    shrinkageTree.groups = { "task-0": shrinkageTree.groups?.["task-0"]! };
    expect(() => saveTaskState(shrinkageConfig, shrinkageTree)).toThrow(/shrinkage guard/);
  });

  it("allows explicit project pause writes with a reason and journal entry", () => {
    const config = makeConfig();
    const existingTree = makeTree(5, "active");
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    saveTaskState(config, makeTree(6, "paused"), {
      projectLifecycleReason: "operator requested a bounded pause",
    });

    const saved = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("paused");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("project_lifecycle_paused");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("operator requested a bounded pause");
  });

  it("dry-runs and atomically applies a reviewed paused-state migration", () => {
    const config = makeConfig();
    writeFileSync(config.statePath, JSON.stringify(makeTree(5, "paused")));
    const migrate = (tree: TaskTree) => {
      tree.groups = {
        ...(tree.groups ?? {}),
        added: { id: "added", parent_id: "task-0", state: "backlog" },
      };
    };

    const review = migrateTaskState(config, { dryRun: true, migrate });
    expect(review).toMatchObject({ changed: true, written: false, taskCountBefore: 5, taskCountAfter: 6 });
    expect(readTaskState(config).groups?.added).toBeUndefined();

    const applied = migrateTaskState(config, {
      expectedRevision: review.revision,
      migrate,
    });
    expect(applied).toMatchObject({ changed: true, written: true, taskCountBefore: 5, taskCountAfter: 6 });
    expect(readTaskState(config).groups?.added?.parent_id).toBe("task-0");
  });

  it("rejects migration when state changed after dry-run review", () => {
    const config = makeConfig();
    writeFileSync(config.statePath, JSON.stringify(makeTree(5, "paused")));
    const review = migrateTaskState(config, { dryRun: true, migrate: () => undefined });
    const changed = makeTree(6, "paused");
    writeFileSync(config.statePath, JSON.stringify(changed));

    expect(() =>
      migrateTaskState(config, {
        expectedRevision: review.revision,
        migrate: () => undefined,
      }),
    ).toThrow("Task state changed after review");
  });

  it("requires paused state and drained attempts for migration", () => {
    const config = makeConfig();
    writeFileSync(config.statePath, JSON.stringify(makeTree(5, "active")));
    expect(() => migrateTaskState(config, { migrate: () => undefined })).toThrow("project_lifecycle=paused");

    const paused = makeTree(5, "paused");
    paused.attempts = {
      running: {
        metadata: { id: "running", resourceVersion: 1 },
        taskId: "task-0",
        taskGeneration: 1,
        specHash: "hash",
        owner: "owner",
        handler: "owner:owner",
        runtimeId: "runtime",
        state: "running",
        reason: "test",
        startedAt: "2026-07-20T00:00:00.000Z",
      },
    };
    writeFileSync(config.statePath, JSON.stringify(paused));
    expect(() => migrateTaskState(config, { migrate: () => undefined })).toThrow("requires drained attempts");
  });

  it("rejects silent paused-to-active lifecycle writes", () => {
    const config = makeConfig();
    writeFileSync(config.statePath, JSON.stringify(makeTree(5, "paused")));

    expect(() => saveTaskState(config, makeTree(6, "active"))).toThrow(/lifecycle guard/);

    const saved = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("paused");
  });

  it("does not let a cached writer overwrite an external lifecycle pause", () => {
    const config = makeConfig();
    writeFileSync(config.statePath, JSON.stringify(makeTree(6, "active")));
    const cached = readTaskState(config);

    writeFileSync(config.statePath, JSON.stringify(makeTree(6, "paused")));

    expect(() => saveTaskState(config, cached)).toThrow(/lifecycle guard/);
    const saved = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("paused");
  });

  it("changes lifecycle through one locked helper and records the reason", () => {
    const config = makeConfig();
    writeFileSync(config.statePath, JSON.stringify(makeTree(5, "paused")));

    setProjectLifecycle(config, "active", "migration verification passed");

    const saved = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("active");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("project_lifecycle_resumed");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("migration verification passed");
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("allows normal saves without shrinkage", () => {
    const config = makeConfig();
    const existingTree = makeTree(20);
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    // Save with 18 tasks (10% reduction) — should pass
    const newTree = makeTree(18);
    expect(() => saveTaskState(config, newTree)).not.toThrow();

    const saved = JSON.parse(readFileSync(config.statePath, "utf-8"));
    expect(Object.keys(saved.groups).length).toBe(18);
  });

  it("rejects >80% task count reduction", () => {
    const config = makeConfig();
    const existingTree = makeTree(100);
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    // Try to save with 5 tasks (95% reduction) — should throw
    const newTree = makeTree(5);
    expect(() => saveTaskState(config, newTree)).toThrow(/shrinkage guard/);

    // Verify original file is NOT overwritten
    const onDisk = JSON.parse(readFileSync(config.statePath, "utf-8"));
    expect(Object.keys(onDisk.groups).length).toBe(100);
  });

  it("rejects extreme shrinkage (1059 → 7 tasks)", () => {
    const config = makeConfig();
    const existingTree = makeTree(1059);
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    const newTree = makeTree(7);
    expect(() => saveTaskState(config, newTree)).toThrow(/shrinkage guard/);
    expect(() => saveTaskState(config, newTree)).toThrow(/99%/);
  });

  it("allows shrinkage with explicit allowShrinkage option", () => {
    const config = makeConfig();
    const existingTree = makeTree(100);
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    const newTree = makeTree(5);
    expect(() => saveTaskState(config, newTree, { allowShrinkage: true })).not.toThrow();

    const saved = JSON.parse(readFileSync(config.statePath, "utf-8"));
    expect(Object.keys(saved.groups).length).toBe(5);
  });

  it("does not guard when existing tree has fewer than 5 tasks", () => {
    const config = makeConfig();
    const existingTree = makeTree(4);
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    // Save with 1 task (75% reduction from 4 tasks) — should pass because existing < 5
    const newTree = makeTree(1);
    expect(() => saveTaskState(config, newTree)).not.toThrow();
  });

  it("does not guard when tree file does not exist", () => {
    const config = makeConfig();
    // No existing file — first write should always succeed
    rmSync(config.statePath, { force: true });

    const newTree = makeTree(3);
    expect(() => saveTaskState(config, newTree)).not.toThrow();
  });

  it("allows exactly 20% of original (boundary case)", () => {
    const config = makeConfig();
    const existingTree = makeTree(100);
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    // 20 tasks = exactly 20% of 100 — should pass (guard triggers at <20%)
    const newTree = makeTree(20);
    expect(() => saveTaskState(config, newTree)).not.toThrow();
  });

  it("prunes receipt-only child references during normalization", () => {
    const config = makeConfig();
    const existingTree: TaskTree = {
      root_task_id: "root",
      groups: {
        root: {
          id: "root",
          state: "backlog",
          children: ["live-child", "receipt-only-child", "missing-child"],
        },
        "live-child": {
          id: "live-child",
          parent_id: "root",
          state: "backlog",
          children: [],
        },
      },
      receipts: {
        "receipt-only-child": {
          metadata: {
            id: "receipt-only-child",
            generation: 1,
            resourceVersion: 1,
          },
          specHash: "spec-hash",
          parentId: "root",
          outcome: "Completed work",
          acceptance: ["done"],
          owner: "app-owner",
          handler: "owner:app-owner",
          summary: "completed earlier",
          evidence: ["artifact:receipt.md"],
          acceptanceBasis: { method: "owner-judgment", evidence: ["artifact:receipt.md"] },
          failureFingerprints: [],
          completedAt: "2026-07-19T00:00:00.000Z",
        },
      },
    };
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    const normalized = readTaskState(config);
    expect(normalized.tasks.root.children).toEqual(["live-child"]);

    saveTaskState(config, normalized);
    const saved = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
    expect(saved.groups?.root.children).toBeUndefined();
    const projection = JSON.parse(
      readFileSync(projectRuntimePaths(TEST_DIR).taskTreePath, "utf-8"),
    ) as AppTaskTreeProjection;
    expect(projection.tasks.root.children).toEqual(["live-child"]);
  });

  it("keeps full recent child receipts and compacts older detail without losing identity", () => {
    const config = makeConfig();
    const tree = makeTree(5);
    tree.receipts = Object.fromEntries(
      Array.from({ length: 34 }, (_, index) => {
        const id = `completed-${index}`;
        return [
          id,
          {
            metadata: { id, generation: 1, resourceVersion: 1 },
            specHash: `hash-${index}`,
            parentId: "task-0",
            outcome: `Completed outcome ${index}`,
            acceptance: [`acceptance-${index}`],
            owner: "app-owner",
            handler: "owner:app-owner",
            summary: `Completed summary ${index}`,
            evidence: [`evidence-${index}`],
            acceptanceBasis: {
              method: "owner-judgment" as const,
              evidence: [`evidence-${index}`],
            },
            failureFingerprints: [],
            completedAt: new Date(index).toISOString(),
            workspace: {
              kind: "task-worktree" as const,
              path: `/tmp/completed-${index}`,
              baseRef: "origin/v2",
              baseCommit: "base",
              branch: `task/completed-${index}`,
              headCommit: `head-${index}`,
              disposition: "branch-retained" as const,
            },
          },
        ];
      }),
    );

    saveTaskState(config, tree);
    const saved = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
    const oldest = saved.receipts?.["completed-0"];
    const newest = saved.receipts?.["completed-33"];

    expect(Object.keys(saved.receipts ?? {})).toHaveLength(34);
    expect(oldest).toMatchObject({
      metadata: { id: "completed-0", generation: 1 },
      specHash: "hash-0",
      parentId: "task-0",
      acceptance: [],
      evidence: [],
      acceptanceBasis: { method: "owner-judgment", evidence: [] },
    });
    expect(oldest?.compactedDetailSha256).toHaveLength(64);
    expect(oldest?.workspace).toBeUndefined();
    expect(newest?.acceptance).toEqual(["acceptance-33"]);
    expect(newest?.evidence).toEqual(["evidence-33"]);
    expect(newest?.workspace?.headCommit).toBe("head-33");
    expect(tree.receipts?.["completed-0"]?.compactedDetailSha256).toBe(oldest?.compactedDetailSha256);
    expect(tree.receipts?.["completed-0"]?.evidence).toEqual([]);

    const digest = oldest?.compactedDetailSha256;
    saveTaskState(config, saved);
    expect(readTaskState(config).receipts?.["completed-0"]?.compactedDetailSha256).toBe(digest);
  });

  it("compacts terminal triggers while preserving running inputs", () => {
    const config = makeConfig();
    const tree = makeTree(5);
    tree.resources = {
      live: {
        metadata: { id: "live", generation: 1, resourceVersion: 1 },
        spec: {
          parentId: "task-0",
          outcome: "Finish live work",
          acceptance: ["done"],
          mode: "achieve",
          outputs: [],
          dependsOn: [],
          priority: "P1",
        },
        status: {
          observedGeneration: 1,
          phase: "attention",
          updatedAt: "2026-07-28T00:00:00.000Z",
        },
      },
    };
    const attempt = (id: string, startedAt: string, state: "running" | "failed", payload: string) => ({
      metadata: { id, resourceVersion: 1 },
      taskId: "live",
      taskGeneration: 1,
      specHash: "live-hash",
      owner: "app-owner",
      handler: "workflow:work",
      runtimeId: "runtime",
      state,
      reason: "task-controller",
      trigger: {
        type: "project.task.tick",
        source: "test",
        eventId: Number(id.slice(-1)),
        taskId: "live",
        payload,
      },
      startedAt,
      ...(state === "failed" ? { finishedAt: startedAt, failureReason: "HandlerExecutionFailed" } : {}),
    });
    tree.attempts = {
      old: attempt("old-1", "2026-07-28T00:00:00.000Z", "failed", "old detail".repeat(2_000)),
      latest: attempt("latest-2", "2026-07-28T01:00:00.000Z", "failed", "latest recovery detail".repeat(1_000)),
      running: {
        ...attempt("running-3", "2026-07-28T02:00:00.000Z", "running", "running detail"),
        taskId: "orphan-running",
      },
    };

    saveTaskState(config, tree);
    const saved = readTaskState(config);

    expect(saved.attempts?.old?.trigger).toMatchObject({
      type: "project.task.tick",
      source: "test",
      eventId: 1,
      taskId: "live",
    });
    expect(saved.attempts?.old?.trigger?.compactedPayloadSha256).toBeString();
    expect(saved.attempts?.old?.trigger).not.toHaveProperty("payload");
    expect(saved.attempts?.latest?.trigger?.compactedPayloadSha256).toBeString();
    expect(saved.attempts?.latest?.trigger).not.toHaveProperty("payload");
    expect(saved.attempts?.running?.trigger?.payload).toBe("running detail");
  });

  it("keeps only durable provenance for oversized pending event triggers", () => {
    const config = makeConfig();
    const tree = makeTree(5);
    tree.taskTriggers = {
      "task-0": {
        taskId: "task-0",
        taskGeneration: 1,
        resourceVersion: 1,
        observedAt: "2026-07-28T00:00:00.000Z",
        event: {
          type: "session.end",
          source: "runtime",
          eventId: 123,
          sessionId: "session-123",
          status: "done",
          payload: "x".repeat(20_000),
        },
      },
    };

    saveTaskState(config, tree);
    const trigger = readTaskState(config).taskTriggers?.["task-0"]?.event;
    expect(trigger).toMatchObject({
      type: "session.end",
      source: "runtime",
      eventId: 123,
      sessionId: "session-123",
      status: "done",
    });
    expect(trigger?.compactedPayloadSha256).toBeString();
    expect(trigger).not.toHaveProperty("payload");
  });

  it("rejects 19% of original (just below boundary)", () => {
    const config = makeConfig();
    const existingTree = makeTree(100);
    writeFileSync(config.statePath, JSON.stringify(existingTree));

    // 19 tasks = 19% of 100 — should throw (below 20% threshold)
    const newTree = makeTree(19);
    expect(() => saveTaskState(config, newTree)).toThrow(/shrinkage guard/);
  });
});
