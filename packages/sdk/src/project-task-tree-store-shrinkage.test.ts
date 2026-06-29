import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { saveTaskTree, type TaskTreeConfig, type TaskTree } from "./project-task-tree-store.js";

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

  it("rejects 19% of original (just below boundary)", () => {
    const config = makeConfig();
    const existingTree: TaskTree = { tasks: makeTasks(100) };
    writeFileSync(config.treePath, JSON.stringify(existingTree));

    // 19 tasks = 19% of 100 — should throw (below 20% threshold)
    const newTree: TaskTree = { tasks: makeTasks(19) };
    expect(() => saveTaskTree(config, newTree)).toThrow(/shrinkage guard/);
  });
});
