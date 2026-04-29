import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  cleanupCheckpoints,
  CheckpointData,
} from "../workflows/incremental-checkpoint.ts";

const TEST_DIR = "/tmp/test-incremental-checkpoint";

function makeCheckpoint(overrides: Partial<CheckpointData> = {}): CheckpointData {
  return {
    sessionId: "sess-001",
    iteration: 1,
    step: 3,
    timestamp: Date.now(),
    task: "Write a report",
    toolsCalled: ["read", "write", "bash"],
    partialResults: { filesCreated: ["output.md"] },
    completed: false,
    ...overrides,
  };
}

describe("incremental-checkpoint", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("saveIncrementalCheckpoint", () => {
    it("creates checkpoint file with correct data", () => {
      const cp = makeCheckpoint();
      saveIncrementalCheckpoint(TEST_DIR, cp);

      const path = join(TEST_DIR, ".state/checkpoints/incremental/sess-001.json");
      expect(existsSync(path)).toBe(true);

      const saved = JSON.parse(readFileSync(path, "utf-8"));
      expect(saved.sessionId).toBe("sess-001");
      expect(saved.step).toBe(3);
      expect(saved.toolsCalled).toEqual(["read", "write", "bash"]);
      expect(saved.completed).toBe(false);
    });

    it("creates directory if it does not exist", () => {
      const cp = makeCheckpoint({ sessionId: "new-sess" });
      saveIncrementalCheckpoint(TEST_DIR, cp);

      const dir = join(TEST_DIR, ".state/checkpoints/incremental");
      expect(existsSync(dir)).toBe(true);
    });

    it("overwrites existing checkpoint for same session", () => {
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ step: 1 }));
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ step: 5 }));

      const path = join(TEST_DIR, ".state/checkpoints/incremental/sess-001.json");
      const saved = JSON.parse(readFileSync(path, "utf-8"));
      expect(saved.step).toBe(5);
    });
  });

  describe("detectIncompleteCheckpoint", () => {
    it("returns null when no checkpoints exist", () => {
      expect(detectIncompleteCheckpoint(TEST_DIR)).toBeNull();
    });

    it("returns incomplete checkpoint", () => {
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ completed: false }));
      const result = detectIncompleteCheckpoint(TEST_DIR);
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe("sess-001");
    });

    it("returns null when checkpoint is completed", () => {
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ completed: true }));
      expect(detectIncompleteCheckpoint(TEST_DIR)).toBeNull();
    });

    it("finds specific session checkpoint", () => {
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ sessionId: "a" }));
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({ sessionId: "b", completed: true }));

      expect(detectIncompleteCheckpoint(TEST_DIR, "a")).not.toBeNull();
      expect(detectIncompleteCheckpoint(TEST_DIR, "b")).toBeNull();
      expect(detectIncompleteCheckpoint(TEST_DIR, "c")).toBeNull();
    });
  });

  describe("markCheckpointComplete", () => {
    it("marks an existing checkpoint as completed", () => {
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint());
      markCheckpointComplete(TEST_DIR, "sess-001");

      const result = detectIncompleteCheckpoint(TEST_DIR, "sess-001");
      expect(result).toBeNull();
    });

    it("does nothing for non-existent session", () => {
      // Should not throw
      markCheckpointComplete(TEST_DIR, "nonexistent");
    });
  });

  describe("cleanupCheckpoints", () => {
    it("removes old completed checkpoints beyond keepCount", () => {
      for (let i = 0; i < 8; i++) {
        saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({
          sessionId: `sess-${String(i).padStart(3, "0")}`,
          completed: true,
        }));
      }
      // Add one incomplete — should not be removed
      saveIncrementalCheckpoint(TEST_DIR, makeCheckpoint({
        sessionId: "sess-active",
        completed: false,
      }));

      cleanupCheckpoints(TEST_DIR, 3);

      // The incomplete one should survive
      expect(detectIncompleteCheckpoint(TEST_DIR, "sess-active")).not.toBeNull();

      // Only 3 completed should remain (most recent: 005, 006, 007)
      const dir = join(TEST_DIR, ".state/checkpoints/incremental");
      const { readdirSync } = require("node:fs");
      const files = readdirSync(dir);
      // 3 kept completed + 1 incomplete = 4
      expect(files.length).toBe(4);
    });

    it("does nothing when directory does not exist", () => {
      cleanupCheckpoints("/tmp/nonexistent-dir-xyz", 5);
      // Should not throw
    });
  });
});
