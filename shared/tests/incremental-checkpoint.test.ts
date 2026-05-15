import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  cleanupCheckpoints,
  CheckpointData,
} from "../workflows/incremental-checkpoint.js";

const TEST_DIR = "/tmp/test-incremental-checkpoint-" + Date.now();

function makeCheckpoint(overrides: Partial<CheckpointData> = {}): CheckpointData {
  return {
    sessionId: "sess-001",
    iteration: 1,
    step: 3,
    timestamp: Date.now(),
    task: "test task",
    toolsCalled: ["read", "write"],
    partialResults: { foo: "bar" },
    completed: false,
    ...overrides,
  };
}

describe("incremental-checkpoint", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("saves a checkpoint file", () => {
    const data = makeCheckpoint();
    saveIncrementalCheckpoint(TEST_DIR, data);
    const path = join(TEST_DIR, ".state/checkpoints/incremental/sess-001.json");
    expect(existsSync(path)).toBe(true);
  });

  it("saved checkpoint contains correct data", () => {
    const data = makeCheckpoint({ task: "hello world" });
    saveIncrementalCheckpoint(TEST_DIR, data);
    const path = join(TEST_DIR, ".state/checkpoints/incremental/sess-001.json");
    const loaded = JSON.parse(readFileSync(path, "utf-8"));
    expect(loaded.task).toBe("hello world");
  });

  it("detects incomplete checkpoint by sessionId", () => {
    saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint());
    const result = detectIncompleteCheckpoint(TEST_DIR, "sess-001");
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("sess-001");
  });

  it("returns null for completed checkpoint", () => {
    saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ completed: true }));
    const result = detectIncompleteCheckpoint(TEST_DIR, "sess-001");
    expect(result).toBeNull();
  });

  it("returns null when no checkpoints exist", () => {
    const result = detectIncompleteCheckpoint(TEST_DIR);
    expect(result).toBeNull();
  });

  it("detects any incomplete checkpoint without sessionId", () => {
    saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ sessionId: "sess-a" }));
    const result = detectIncompleteCheckpoint(TEST_DIR);
    expect(result).not.toBeNull();
  });

  it("marks checkpoint complete", () => {
    saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint());
    markCheckpointComplete(TEST_DIR, "sess-001");
    const result = detectIncompleteCheckpoint(TEST_DIR, "sess-001");
    expect(result).toBeNull();
  });

  it("markCheckpointComplete is no-op for missing file", () => {
    // Should not throw
    markCheckpointComplete(TEST_DIR, "nonexistent");
  });

  it("cleanupCheckpoints removes old completed ones", () => {
    for (let i = 0; i < 8; i++) {
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ sessionId: `s-${String(i).padStart(3, "0")}`, completed: true }));
    }
    cleanupCheckpoints(TEST_DIR, 3);
    const dir = join(TEST_DIR, ".state/checkpoints/incremental");
    const { readdirSync } = require("node:fs");
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
    expect(files.length).toBe(3);
  });

  it("cleanupCheckpoints keeps incomplete checkpoints", () => {
    saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ sessionId: "incomplete", completed: false }));
    saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ sessionId: "done", completed: true }));
    cleanupCheckpoints(TEST_DIR, 0);
    const result = detectIncompleteCheckpoint(TEST_DIR, "incomplete");
    expect(result).not.toBeNull();
  });

  it("cleanupCheckpoints handles missing directory", () => {
    cleanupCheckpoints("/tmp/nonexistent-dir-xyz", 5);
    // Should not throw
  });
});
