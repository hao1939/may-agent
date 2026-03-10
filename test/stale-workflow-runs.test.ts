import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import type { WorkflowRun } from "../src/lib/persistence.js";
import { saveWorkflowRun, readWorkflowRun } from "../src/lib/persistence.js";

let persistDir: string;

beforeEach(() => {
  persistDir = mkdtempSync(join(tmpdir(), "stale-wf-"));
});

afterEach(() => {
  if (existsSync(persistDir)) {
    rmSync(persistDir, { recursive: true, force: true });
  }
});

function makeStaleRun(runId: string, workflow = "test-wf"): WorkflowRun {
  return {
    runId,
    workflow,
    task: "some task",
    parentSessionId: "parent_1",
    depth: 1,
    startedAt: Date.now() - 60000,
    status: "running",
    steps: [],
  };
}

describe("stale workflow run cleanup", () => {
  it("cleanupStaleSessions marks stale workflow runs as interrupted", () => {
    const run = makeStaleRun("wr_stale_1");
    saveWorkflowRun(persistDir, run);

    const manager = new SubagentManager({ persistDir });
    manager.cleanupStaleSessions();

    const updated = readWorkflowRun(persistDir, "wr_stale_1");
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("interrupted");
    expect(updated!.endedAt).toBeTypeOf("number");
    expect(updated!.result).toEqual({ reason: "Process restarted" });
  });

  it("cleanupStaleSessions leaves completed workflow runs untouched", () => {
    const run: WorkflowRun = {
      ...makeStaleRun("wr_done"),
      status: "done",
      endedAt: Date.now() - 30000,
      result: { summary: "completed" },
    };
    saveWorkflowRun(persistDir, run);

    const manager = new SubagentManager({ persistDir });
    manager.cleanupStaleSessions();

    const updated = readWorkflowRun(persistDir, "wr_done");
    expect(updated!.status).toBe("done");
    expect(updated!.result).toEqual({ summary: "completed" });
  });

  it("cleanupStaleSessions handles multiple stale workflow runs", () => {
    saveWorkflowRun(persistDir, makeStaleRun("wr_a"));
    saveWorkflowRun(persistDir, makeStaleRun("wr_b"));
    saveWorkflowRun(persistDir, {
      ...makeStaleRun("wr_c"),
      status: "done",
      endedAt: Date.now(),
    });

    const manager = new SubagentManager({ persistDir });
    manager.cleanupStaleSessions();

    expect(readWorkflowRun(persistDir, "wr_a")!.status).toBe("interrupted");
    expect(readWorkflowRun(persistDir, "wr_b")!.status).toBe("interrupted");
    expect(readWorkflowRun(persistDir, "wr_c")!.status).toBe("done");
  });

  it("resumeAgent also cleans up stale workflow runs", () => {
    saveWorkflowRun(persistDir, makeStaleRun("wr_orphan"));

    const manager = new SubagentManager({ persistDir });
    // No agents registered, no sessions to resume — resumeAgent throws
    expect(() => manager.resumeAgent("may")).toThrow(
      'No running/idle session for "may" in registry'
    );

    // But stale workflow runs should still be cleaned up (side effect before throw)
    const updated = readWorkflowRun(persistDir, "wr_orphan");
    expect(updated!.status).toBe("interrupted");
  });

  it("no-op when no workflow runs exist", () => {
    const manager = new SubagentManager({ persistDir });
    // Should not throw
    manager.cleanupStaleSessions();
  });
});
