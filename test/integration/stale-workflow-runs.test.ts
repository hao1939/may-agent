import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import { insertWorkflowRun, getWorkflowRun } from "../../src/lib/requests.js";
import type { WorkflowRunRecord } from "../../src/lib/requests.js";
import { createWorkflowDiagnostics } from "../../src/lib/workflow-diagnostics.js";
import { readWorkflowFacts } from "../../src/lib/workflow-facts.js";

let persistDir: string;

beforeEach(() => {
  persistDir = mkdtempSync(join(tmpdir(), "stale-wf-"));
});

afterEach(() => {
  if (existsSync(persistDir)) {
    rmSync(persistDir, { recursive: true, force: true });
  }
});

function makeStaleRun(runId: string, workflow = "test-wf"): WorkflowRunRecord {
  return {
    runId,
    workflow,
    task: "some task",
    parentSessionId: "parent_1",
    parentWorkflowRunId: null,
    depth: 1,
    startedAt: Date.now() - 60000,
    endedAt: null,
    status: "running",
    result_summary: null,
    result_reason: null,
    resumedFromRunId: null,
  };
}

describe("stale workflow run cleanup", () => {
  it("resumeStaleSessions marks stale workflow runs as interrupted", () => {
    const manager = new SubagentManager({ persistDir });
    insertWorkflowRun(persistDir, makeStaleRun("wr_stale_1"));
    createWorkflowDiagnostics(persistDir, "wr_stale_1")("info", "prepared before restart");

    manager.resumeStaleSessions();

    const updated = getWorkflowRun(persistDir, "wr_stale_1");
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("interrupted");
    expect(updated!.endedAt).toBeTypeOf("number");
    expect(updated!.result_reason).toBe("Process restarted");
    expect(readWorkflowFacts(persistDir, "wr_stale_1")!.diagnostics.entries[0]?.message).toBe("prepared before restart");
  });

  it("resumeStaleSessions leaves completed workflow runs untouched", () => {
    const manager = new SubagentManager({ persistDir });
    const run: WorkflowRunRecord = {
      ...makeStaleRun("wr_done"),
      status: "done",
      endedAt: Date.now() - 30000,
      result_summary: "completed",
    };
    insertWorkflowRun(persistDir, run);

    manager.resumeStaleSessions();

    const updated = getWorkflowRun(persistDir, "wr_done");
    expect(updated!.status).toBe("done");
    expect(updated!.result_summary).toBe("completed");
  });

  it("leaves workflow runs started by the current manager untouched", () => {
    const manager = new SubagentManager({ persistDir });
    insertWorkflowRun(persistDir, {
      ...makeStaleRun("wr_current"),
      startedAt: Date.now(),
    });

    manager.resumeStaleSessions();

    expect(getWorkflowRun(persistDir, "wr_current")!.status).toBe("running");
  });

  it("resumeStaleSessions handles multiple stale workflow runs", () => {
    const manager = new SubagentManager({ persistDir });
    insertWorkflowRun(persistDir, makeStaleRun("wr_a"));
    insertWorkflowRun(persistDir, makeStaleRun("wr_b"));
    insertWorkflowRun(persistDir, {
      ...makeStaleRun("wr_c"),
      status: "done",
      endedAt: Date.now(),
    });

    manager.resumeStaleSessions();

    expect(getWorkflowRun(persistDir, "wr_a")!.status).toBe("interrupted");
    expect(getWorkflowRun(persistDir, "wr_b")!.status).toBe("interrupted");
    expect(getWorkflowRun(persistDir, "wr_c")!.status).toBe("done");
  });

  it("no-op when no workflow runs exist", () => {
    const manager = new SubagentManager({ persistDir });
    // Should not throw
    manager.resumeStaleSessions();
  });
});
