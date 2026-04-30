/**
 * Integration tests: workflow module interactions end-to-end.
 * Tests that master-worker's key utilities (extractDecision, checkpoint, metrics, timer)
 * work together in realistic multi-module scenarios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Import modules that interact in the master-worker workflow
import { extractDecision } from "../../workflows/master-worker.ts";
import {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  cleanupCheckpoints,
  type CheckpointData,
} from "../../workflows/incremental-checkpoint.ts";
import { IterationTimer } from "../../workflows/iteration-timer.ts";
import { MetricsCollector, type MetricsEntry } from "../../workflows/metrics-collector.ts";

const TEST_DIR = join("/tmp", "workflow-e2e-test-" + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("master-worker decision → checkpoint → metrics flow", () => {
  it("CONTINUE decision triggers checkpoint save and metrics recording", () => {
    // Step 1: Master extracts decision
    const decision = extractDecision("CONTINUE: Worker should implement feature X");
    expect(decision.status).toBe("continue");

    // Step 2: Worker saves checkpoint after doing work
    const checkpoint: CheckpointData = {
      sessionId: "test-session-001",
      iteration: 1,
      step: 1,
      timestamp: Date.now(),
      task: decision.detail,
      toolsCalled: ["write", "bash"],
      partialResults: { filesCreated: ["foo.ts"] },
      completed: false,
    };
    saveIncrementalCheckpoint(TEST_DIR, checkpoint);

    // Step 3: Verify checkpoint is detectable
    const incomplete = detectIncompleteCheckpoint(TEST_DIR, "test-session-001");
    expect(incomplete).not.toBeNull();
    expect(incomplete!.iteration).toBe(1);

    // Step 4: Mark complete after verification passes
    markCheckpointComplete(TEST_DIR, "test-session-001");
    const afterComplete = detectIncompleteCheckpoint(TEST_DIR, "test-session-001");
    expect(afterComplete).toBeNull();
  });

  it("PIVOT decision triggers cleanup and fresh checkpoint", () => {
    // Save initial checkpoint
    const checkpoint: CheckpointData = {
      sessionId: "pivot-session",
      iteration: 1,
      step: 3,
      timestamp: Date.now(),
      task: "original task",
      toolsCalled: ["read"],
      partialResults: { attempt: 1 },
      completed: false,
    };
    saveIncrementalCheckpoint(TEST_DIR, checkpoint);

    // Master decides to pivot
    const decision = extractDecision("PIVOT: Strategy isn't working, try alternative approach");
    expect(decision.status).toBe("pivot");

    // Cleanup old checkpoints on pivot
    cleanupCheckpoints(TEST_DIR);

    // Start fresh
    const fresh: CheckpointData = {
      sessionId: "pivot-session-v2",
      iteration: 2,
      step: 1,
      timestamp: Date.now(),
      task: "alternative approach",
      toolsCalled: [],
      partialResults: {},
      completed: false,
    };
    saveIncrementalCheckpoint(TEST_DIR, fresh);

    const detected = detectIncompleteCheckpoint(TEST_DIR, "pivot-session-v2");
    expect(detected).not.toBeNull();
    expect(detected!.task).toBe("alternative approach");
  });

  it("BLOCKED decision halts iteration without checkpoint completion", () => {
    const decision = extractDecision("BLOCKED: Need API key from user");
    expect(decision.status).toBe("blocked");

    // Checkpoint saved but never completed
    const checkpoint: CheckpointData = {
      sessionId: "blocked-session",
      iteration: 3,
      step: 1,
      timestamp: Date.now(),
      task: "blocked task",
      toolsCalled: ["bash"],
      partialResults: { error: "missing credentials" },
      completed: false,
    };
    saveIncrementalCheckpoint(TEST_DIR, checkpoint);

    const incomplete = detectIncompleteCheckpoint(TEST_DIR, "blocked-session");
    expect(incomplete).not.toBeNull();
    expect(incomplete!.completed).toBe(false);
  });
});

describe("IterationTimer + MetricsCollector integration", () => {
  it("timer duration feeds into metrics collector", () => {
    const timer = new IterationTimer();
    const collector = new MetricsCollector();

    // Simulate timed iteration
    timer.start("proj-1", 1);
    // Simulate some work (timer tracks wall clock)
    const elapsed = timer.stop("proj-1", 1);
    expect(elapsed).toBeGreaterThanOrEqual(0);

    // Record metrics including timer output
    const entry: MetricsEntry = {
      projectId: "proj-1",
      iterationNumber: 1,
      durationMs: elapsed,
      testCount: 15,
      deliverableCount: 3,
      timestamp: Date.now(),
    };
    collector.record(entry);

    const summary = collector.summarize("proj-1");
    expect(summary.totalIterations).toBe(1);
    expect(summary.totalTests).toBe(15);
    expect(summary.totalDeliverables).toBe(3);
  });

  it("multiple iterations accumulate in metrics", () => {
    const timer = new IterationTimer();
    const collector = new MetricsCollector();

    for (let i = 1; i <= 5; i++) {
      timer.start("proj-2", i);
      const elapsed = timer.stop("proj-2", i);
      collector.record({
        projectId: "proj-2",
        iterationNumber: i,
        durationMs: elapsed,
        testCount: i * 10,
        deliverableCount: i,
        timestamp: Date.now(),
      });
    }

    const summary = collector.summarize("proj-2");
    expect(summary.totalIterations).toBe(5);
    expect(summary.totalTests).toBe(150); // 10+20+30+40+50
    expect(summary.totalDeliverables).toBe(15); // 1+2+3+4+5
    expect(summary.projects).toContain("proj-2");
  });

  it("metrics stats computation across projects", () => {
    const collector = new MetricsCollector();

    collector.record({ projectId: "a", iterationNumber: 1, durationMs: 100, testCount: 5, deliverableCount: 1, timestamp: 1 });
    collector.record({ projectId: "b", iterationNumber: 1, durationMs: 200, testCount: 10, deliverableCount: 2, timestamp: 2 });
    collector.record({ projectId: "a", iterationNumber: 2, durationMs: 150, testCount: 8, deliverableCount: 1, timestamp: 3 });

    const allSummary = collector.summarizeAll();
    expect(allSummary.totalIterations).toBe(3);
    expect(allSummary.projects.length).toBe(2);
    expect(allSummary.projects).toContain("a");
    expect(allSummary.projects).toContain("b");
  });
});

describe("checkpoint recovery scenarios", () => {
  it("crash recovery: detect incomplete checkpoint and resume", () => {
    // Simulate crash: checkpoint saved but not completed
    const checkpoint: CheckpointData = {
      sessionId: "crash-session",
      iteration: 4,
      step: 2,
      timestamp: Date.now() - 60000, // 1 minute ago
      task: "implement feature Y",
      toolsCalled: ["write", "bash"],
      partialResults: { file: "feature-y.ts", linesWritten: 42 },
      completed: false,
    };
    saveIncrementalCheckpoint(TEST_DIR, checkpoint);

    // New session detects incomplete work
    const recovered = detectIncompleteCheckpoint(TEST_DIR, "crash-session");
    expect(recovered).not.toBeNull();
    expect(recovered!.iteration).toBe(4);
    expect(recovered!.step).toBe(2);
    expect(recovered!.partialResults).toHaveProperty("file", "feature-y.ts");

    // Resume from step 2, complete the work
    const resumed: CheckpointData = {
      ...recovered!,
      step: 3,
      toolsCalled: [...recovered!.toolsCalled, "bash"],
      partialResults: { ...recovered!.partialResults, verified: true },
      completed: true,
    };
    saveIncrementalCheckpoint(TEST_DIR, resumed);
    markCheckpointComplete(TEST_DIR, "crash-session");

    // Verify no longer detected as incomplete
    const afterResume = detectIncompleteCheckpoint(TEST_DIR, "crash-session");
    expect(afterResume).toBeNull();
  });

  it("multiple sessions: only incomplete ones are detected", () => {
    // Session 1: complete
    const s1: CheckpointData = {
      sessionId: "session-complete",
      iteration: 1, step: 1, timestamp: Date.now(),
      task: "done", toolsCalled: [], partialResults: {}, completed: true,
    };
    saveIncrementalCheckpoint(TEST_DIR, s1);
    markCheckpointComplete(TEST_DIR, "session-complete");

    // Session 2: incomplete
    const s2: CheckpointData = {
      sessionId: "session-incomplete",
      iteration: 2, step: 1, timestamp: Date.now(),
      task: "in progress", toolsCalled: ["write"], partialResults: {}, completed: false,
    };
    saveIncrementalCheckpoint(TEST_DIR, s2);

    expect(detectIncompleteCheckpoint(TEST_DIR, "session-complete")).toBeNull();
    expect(detectIncompleteCheckpoint(TEST_DIR, "session-incomplete")).not.toBeNull();
  });
});

describe("decision extraction edge cases in workflow context", () => {
  it("handles multi-line master response with embedded decision", () => {
    const response = `## Analysis
The worker completed 3 of 5 items successfully.
Test coverage increased from 80% to 92%.

**Decision**: CONTINUE

Next steps: Complete remaining 2 items.`;
    const decision = extractDecision(response);
    expect(decision.status).toBe("continue");
  });

  it("handles 'proceed' language as CONTINUE", () => {
    const response = "Everything looks good. Let's proceed with the implementation.";
    const decision = extractDecision(response);
    expect(decision.status).toBe("continue");
  });

  it("handles WAITING status correctly", () => {
    const response = "WAITING: Need user to provide database credentials before we can continue.";
    const decision = extractDecision(response);
    expect(decision.status).toBe("waiting");
  });

  it("unknown decision when no keywords match", () => {
    const response = "I'm not sure what to do next. The situation is ambiguous.";
    const decision = extractDecision(response);
    expect(decision.status).toBe("unknown");
  });
});
