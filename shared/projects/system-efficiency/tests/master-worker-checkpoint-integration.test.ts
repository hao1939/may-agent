/**
 * Integration test: verifies incremental checkpointing is wired into master-worker.ts
 * Tests that:
 * 1. detectIncompleteCheckpoint() is called at iteration start
 * 2. saveIncrementalCheckpoint() is called after worker.prompt()
 * 3. markCheckpointComplete() is called at iteration end
 * 4. A simulated crash leaves a recoverable checkpoint
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  cleanupCheckpoints,
  type CheckpointData,
} from "../../../workflows/incremental-checkpoint.ts";

const TEST_DIR = join(import.meta.dirname || __dirname, "../.test-checkpoint-integration");
const CHECKPOINT_DIR = join(TEST_DIR, ".state/checkpoints/incremental");

describe("master-worker checkpoint integration", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it("saves checkpoint after worker prompt (simulated)", () => {
    const sessionId = `iter-1-${Date.now()}`;
    
    // Simulate what master-worker does after worker.prompt()
    saveIncrementalCheckpoint(TEST_DIR, {
      sessionId,
      iteration: 1,
      step: 1,
      timestamp: Date.now(),
      task: "Test task",
      toolsCalled: ["worker.prompt"],
      partialResults: { workerResponseLength: 500 },
      completed: false,
    });

    // Checkpoint should exist and be incomplete
    const checkpoint = detectIncompleteCheckpoint(TEST_DIR);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.sessionId).toBe(sessionId);
    expect(checkpoint!.completed).toBe(false);
  });

  it("marks checkpoint complete at iteration end", () => {
    const sessionId = `iter-1-${Date.now()}`;
    
    saveIncrementalCheckpoint(TEST_DIR, {
      sessionId,
      iteration: 1,
      step: 1,
      timestamp: Date.now(),
      task: "Test task",
      toolsCalled: ["worker.prompt"],
      partialResults: {},
      completed: false,
    });

    // Simulate iteration end
    markCheckpointComplete(TEST_DIR, sessionId);

    // Should no longer detect incomplete checkpoint
    const checkpoint = detectIncompleteCheckpoint(TEST_DIR);
    expect(checkpoint).toBeNull();
  });

  it("detects crash: incomplete checkpoint from previous session", () => {
    const crashedSessionId = "iter-3-crashed";
    
    // Simulate a crashed iteration that left an incomplete checkpoint
    saveIncrementalCheckpoint(TEST_DIR, {
      sessionId: crashedSessionId,
      iteration: 3,
      step: 1,
      timestamp: Date.now() - 60000, // 1 minute ago
      task: "Create error-recovery-audit.md",
      toolsCalled: ["worker.prompt"],
      partialResults: { workerResponseLength: 1200 },
      completed: false,
    });

    // New iteration starts — should detect the incomplete checkpoint
    const incomplete = detectIncompleteCheckpoint(TEST_DIR);
    expect(incomplete).not.toBeNull();
    expect(incomplete!.sessionId).toBe(crashedSessionId);
    expect(incomplete!.iteration).toBe(3);
    expect(incomplete!.task).toContain("error-recovery-audit");

    // Master-worker marks it complete before proceeding
    markCheckpointComplete(TEST_DIR, crashedSessionId);
    expect(detectIncompleteCheckpoint(TEST_DIR)).toBeNull();
  });

  it("cleanup removes old completed checkpoints", () => {
    // Create 7 completed checkpoints
    for (let i = 0; i < 7; i++) {
      const sid = `iter-${i}-${1000 + i}`;
      saveIncrementalCheckpoint(TEST_DIR, {
        sessionId: sid,
        iteration: i,
        step: 1,
        timestamp: Date.now() + i,
        task: `Task ${i}`,
        toolsCalled: [],
        partialResults: {},
        completed: true,
      });
    }

    // Keep only 3
    cleanupCheckpoints(TEST_DIR, 3);

    // Should have at most 3 files remaining
    const { readdirSync } = require("node:fs");
    const remaining = readdirSync(CHECKPOINT_DIR).filter((f: string) => f.endsWith(".json"));
    expect(remaining.length).toBeLessThanOrEqual(3);
  });

  it("verifies master-worker.ts imports checkpoint module", () => {
    const masterWorkerPath = join(import.meta.dirname || __dirname, "../../../workflows/master-worker.ts");
    const content = readFileSync(masterWorkerPath, "utf-8");
    
    expect(content).toContain('import {');
    expect(content).toContain('saveIncrementalCheckpoint');
    expect(content).toContain('detectIncompleteCheckpoint');
    expect(content).toContain('markCheckpointComplete');
    expect(content).toContain('cleanupCheckpoints');
    expect(content).toContain('from "./incremental-checkpoint.ts"');
  });

  it("verifies checkpoint calls exist in master-worker iteration loop", () => {
    const masterWorkerPath = join(import.meta.dirname || __dirname, "../../../workflows/master-worker.ts");
    const content = readFileSync(masterWorkerPath, "utf-8");
    
    // Should call detectIncompleteCheckpoint at iteration start
    expect(content).toContain("detectIncompleteCheckpoint(projectDir)");
    // Should call saveIncrementalCheckpoint after worker.prompt
    expect(content).toContain("saveIncrementalCheckpoint(projectDir,");
    // Should call markCheckpointComplete at iteration end
    expect(content).toContain("markCheckpointComplete(projectDir, checkpointSessionId)");
    // Should call cleanupCheckpoints at workflow start
    expect(content).toContain("cleanupCheckpoints(projectDir, 5)");
  });
});
