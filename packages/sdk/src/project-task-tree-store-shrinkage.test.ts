import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readTaskTree, saveTaskTree, setProjectLifecycle, type TaskTreeConfig, type TaskTree } from "./project-task-tree-store.js";

const TEST_DIR = join(import.meta.dir, "__test_shrinkage__");

function makeConfig(): TaskTreeConfig {
  return {
    appDir: TEST_DIR,
    projectDir: TEST_DIR,
    treePath: join(TEST_DIR, "tasks/tree.json"),
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

describe("saveTaskTree shrinkage guard", () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, "tasks"), { recursive: true });
  });

  it("runs an atomic mutation validator against the current stored tree", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(5) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));
    const observations: Array<{ current: number; next: number; authority: unknown }> = [];
    config.mutationAuthority = { kind: "test-authority" };
    config.validateMutation = ({ current, next, authority }) => {
      observations.push({
        current: Object.keys(current.tasks).length,
        next: Object.keys(next.tasks).length,
        authority,
      });
    };

    saveTaskTree(config, { tasks: makeTasks(6) });

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
    const existingTree: TaskTree = { tasks: makeTasks(5) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));
    config.validateMutation = () => {
      throw new Error("mutation rejected");
    };

    expect(() => saveTaskTree(config, { tasks: makeTasks(6) })).toThrow("mutation rejected");
    expect(Object.keys((JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree).tasks).length).toBe(5);
  });

  it("rejects silent active-to-paused lifecycle writes", () => {
    const config = makeConfig();
    const existingTree: TaskTree = {
      project_lifecycle: "active",
      tasks: makeTasks(5),
    };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    expect(() =>
      saveTaskTree(config, {
        project_lifecycle: "paused",
        tasks: makeTasks(6),
      }),
    ).toThrow(/lifecycle guard/);

    const saved = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("active");
  });

  it("allows explicit project pause writes with a reason and journal entry", () => {
    const config = makeConfig();
    const existingTree: TaskTree = {
      project_lifecycle: "active",
      tasks: makeTasks(5),
    };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    saveTaskTree(
      config,
      {
        project_lifecycle: "paused",
        tasks: makeTasks(6),
      },
      {
        projectLifecycleReason: "operator requested a bounded pause",
      },
    );

    const saved = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("paused");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("project_lifecycle_paused");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("operator requested a bounded pause");
  });

  it("rejects silent paused-to-active lifecycle writes", () => {
    const config = makeConfig();
    writeFileSync(config.treePath, JSON.stringify({ project_lifecycle: "paused", tasks: makeTasks(5) }));

    expect(() =>
      saveTaskTree(config, {
        project_lifecycle: "active",
        tasks: makeTasks(6),
      }),
    ).toThrow(/lifecycle guard/);

    const saved = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("paused");
  });

  it("changes lifecycle through one locked helper and records the reason", () => {
    const config = makeConfig();
    writeFileSync(config.treePath, JSON.stringify({ project_lifecycle: "paused", tasks: makeTasks(5) }));

    setProjectLifecycle(config, "active", "migration verification passed");

    const saved = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
    expect(saved.project_lifecycle).toBe("active");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("project_lifecycle_resumed");
    expect(readFileSync(config.journalPath, "utf-8")).toContain("migration verification passed");
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("allows normal saves without shrinkage", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(20) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    // Save with 18 tasks (10% reduction) — should pass
    const newTree: TaskTree = { tasks: makeTasks(18) };
    expect(() => saveTaskTree(config, newTree)).not.toThrow();

    const saved = JSON.parse(readFileSync(config.treePath, "utf-8"));
    expect(Object.keys(saved.tasks).length).toBe(18);
  });

  it("rejects >80% task count reduction", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(100) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    // Try to save with 5 tasks (95% reduction) — should throw
    const newTree: TaskTree = { tasks: makeTasks(5) };
    expect(() => saveTaskTree(config, newTree)).toThrow(/shrinkage guard/);

    // Verify original file is NOT overwritten
    const onDisk = JSON.parse(readFileSync(config.treePath, "utf-8"));
    expect(Object.keys(onDisk.tasks).length).toBe(100);
  });

  it("rejects extreme shrinkage (1059 → 7 tasks)", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(1059) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    const newTree: TaskTree = { tasks: makeTasks(7) };
    expect(() => saveTaskTree(config, newTree)).toThrow(/shrinkage guard/);
    expect(() => saveTaskTree(config, newTree)).toThrow(/99%/);
  });

  it("allows shrinkage with explicit allowShrinkage option", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(100) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    const newTree: TaskTree = { tasks: makeTasks(5) };
    expect(() => saveTaskTree(config, newTree, { allowShrinkage: true })).not.toThrow();

    const saved = JSON.parse(readFileSync(config.treePath, "utf-8"));
    expect(Object.keys(saved.tasks).length).toBe(5);
  });

  it("does not guard when existing tree has fewer than 5 tasks", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(4) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    // Save with 1 task (75% reduction from 4 tasks) — should pass because existing < 5
    const newTree: TaskTree = { tasks: makeTasks(1) };
    expect(() => saveTaskTree(config, newTree)).not.toThrow();
  });

  it("does not guard when tree file does not exist", () => {
    const config = makeConfig();
    // No existing file — first write should always succeed
    rmSync(config.treePath, { force: true });

    const newTree: TaskTree = { tasks: makeTasks(3) };
    expect(() => saveTaskTree(config, newTree)).not.toThrow();
  });

  it("allows exactly 20% of original (boundary case)", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(100) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    // 20 tasks = exactly 20% of 100 — should pass (guard triggers at <20%)
    const newTree: TaskTree = { tasks: makeTasks(20) };
    expect(() => saveTaskTree(config, newTree)).not.toThrow();
  });

  it("prunes receipt-only child references during normalization", () => {
    const config = makeConfig();
    const existingTree: TaskTree = {
      root_task_id: "root",
      tasks: {
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
          failureFingerprints: [],
          completedAt: "2026-07-19T00:00:00.000Z",
        },
      },
    };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    const normalized = readTaskTree(config);
    expect(normalized.tasks.root.children).toEqual(["live-child"]);

    saveTaskTree(config, normalized);
    const saved = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
    expect(saved.tasks.root.children).toEqual(["live-child"]);
  });

  it("rejects 19% of original (just below boundary)", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(100) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    // 19 tasks = 19% of 100 — should throw (below 20% threshold)
    const newTree: TaskTree = { tasks: makeTasks(19) };
    expect(() => saveTaskTree(config, newTree)).toThrow(/shrinkage guard/);
  });
});
