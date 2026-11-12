/**
 * Integration tests: Guards firing during real workflow execution.
 *
 * These tests use createWorkflowTool with a mock SubagentManager to verify
 * that guards are discovered, loaded, called with correct events, and their
 * observational/blocking demands (observe, warn, block) are resolved.
 */

import { afterEach, describe, test, expect } from "bun:test";
import { join, dirname } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { EventBus } from "../../src/app/core/events/bus.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { buildRuntimeCtx } from "../../src/lib/runtime-ctx.js";
import { fileURLToPath } from "node:url";
import { createWorkflowTool } from "../../src/lib/workflow-tool.js";
import type { WorkflowToolResult } from "../../src/lib/workflow.js";
import type { TaskResult } from "../../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_GUARDS_DIR = join(__dirname, "../fixtures/guards");
// Directory containing our test-two-step workflow
const TEST_WORKFLOW_DIR = join(__dirname, "../fixtures/guards");

// ── Mock helpers ───────────────────────────────────────────────────────

function makeTaskResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    sessionId: `s_mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: "done",
    finishResult: { status: "success", summary: overrides.lastAssistantText ?? "Mock agent completed successfully." },
    lastAssistantText: "Mock agent completed successfully.",
    messages: [],
    duration: "0.1s",
    outputDir: "",
    turnsUsed: 1,
    ...overrides,
  };
}

/** Create a mock SubagentManager with a controllable callAgent. */
function createMockManager(callAgentImpl?: (name: string, task: string, opts?: any) => Promise<TaskResult>) {
  const calls: Array<{ name: string; task: string; opts?: any }> = [];

  return {
    calls,
    manager: {
      callAgent: async (name: string, task: string, opts?: any) => {
        calls.push({ name, task, opts });
        if (callAgentImpl) {
          return callAgentImpl(name, task, opts);
        }
        return makeTaskResult({ lastAssistantText: `${name} completed: ${task.slice(0, 50)}` });
      },
      result: (_sessionId: string) => {
        throw new Error("result() not available in mock");
      },
    } as any, // We only need callAgent and result for workflow execution
  };
}

const runtimeRoots: string[] = [];
afterEach(() => {
  for (const root of runtimeRoots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function createRuntimeCtx(events: unknown[] = []) {
  const root = mkdtempSync(join(tmpdir(), "may-workflow-guard-runtime-"));
  runtimeRoots.push(root);
  return {
    emit: (event: unknown) => events.push(event),
    dispatchEvent: () => {},
    getDb: () => getDb(root),
    query: {},
    log: () => {},
    notify: () => {},
    metrics: {},
    persistDir: "",
    projectRoot: "",
    agentsRoot: "",
  } as any;
}

// ── Integration Tests ──────────────────────────────────────────────────

describe("Guard integration: warn demand delivery", () => {
  test("warn guard fires on step_done, warning appears in next step task", async () => {
    const { calls, manager } = createMockManager();
    const emitted: any[] = [];
    const root = mkdtempSync(join(tmpdir(), "may-workflow-guard-observation-"));
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    bus.subscribe((event) => { emitted.push(event); });
    const runtimeCtx = buildRuntimeCtx({
      bus, persistDir: root, projectRoot: root, projectsRoot: root,
      agentsRoot: root, sharedRoot: root, agentName: "test-agent",
    });

    // Use ONLY the warn guard (not the blocker or inject guards)
    // We create a dedicated guard dir with just the warn guard
    const tool = createWorkflowTool({
      manager,
      workflowDir: TEST_WORKFLOW_DIR,
      // Use test-guards dir which has warn-on-step-done.ts
      // But also has blocker and inject guards — we need to be selective.
      // Use DISABLED_GUARDS to disable all except the warn guard.
      guardsDir: TEST_GUARDS_DIR,
      agentName: "test-agent",
      runtimeCtx,
    });

    // Disable all guards except the warn one
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-blocker";

    try {
      const result = await tool.execute("tc_1", {
        action: "run",
        name: "test-two-step",
        task: "Test guard warning delivery",
      });

      const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
      expect(parsed.type).toBe("done");
      if (parsed.type === "done") {
        expect(parsed.summary).toContain("Step1: step-one completed:");
        expect(parsed.summary).toContain("Step2: step-two completed:");
      }

      // The warn guard fires on step_done for step-one.
      // The warning should be injected into step-two's task.
      expect(calls.length).toBe(2); // step-one + step-two (no injected steps)

      const stepTwoCall = calls[1];
      expect(stepTwoCall.name).toBe("step-two");
      // The task for step-two should contain the guard warning section
      expect(stepTwoCall.task).toContain("## Guard Warnings");
      expect(stepTwoCall.task).toContain('Step "step-one" completed — review recommended');
      expect(stepTwoCall.task).toContain("test-warn-on-step-done");
      expect(emitted).toContainEqual(expect.objectContaining({
        type: "guard.triggered",
        source: "workflow",
        owner: "agent:test-agent",
        data: expect.objectContaining({
          workflow: "test-two-step",
          guard: "test-warn-on-step-done",
          demandType: "warn",
          action: "warned",
          sourceEventType: "step_done",
          step: "step-one",
          sessionId: expect.any(String),
        }),
      }));
      const observations = getDb(root)
        .prepare("SELECT delivery_status, delivery_route FROM events WHERE event_type = 'guard.triggered'")
        .all();
      expect(observations.length).toBeGreaterThan(0);
      expect(observations.every((row) => row.delivery_status === "accepted" && row.delivery_route === "noop")).toBe(true);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
      if (origDisabled === undefined) {
        delete process.env.DISABLED_GUARDS;
      } else {
        process.env.DISABLED_GUARDS = origDisabled;
      }
    }
  });

  test("no warnings section when guard has no demands", async () => {
    const { calls, manager } = createMockManager();

    // Disable ALL guards — no warnings should appear
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-blocker,test-warn-on-step-done";

    try {
      const tool = createWorkflowTool({
        manager,
        workflowDir: TEST_WORKFLOW_DIR,
        guardsDir: TEST_GUARDS_DIR,
        agentName: "test-agent",
      });

      const result = await tool.execute("tc_2", {
        action: "run",
        name: "test-two-step",
        task: "Test no warnings",
      });

      const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
      expect(parsed.type).toBe("done");

      // Neither step should have guard warnings
      for (const call of calls) {
        expect(call.task).not.toContain("## Guard Warnings");
      }
    } finally {
      if (origDisabled === undefined) {
        delete process.env.DISABLED_GUARDS;
      } else {
        process.env.DISABLED_GUARDS = origDisabled;
      }
    }
  });
});

describe("Guard integration: block demand", () => {
  test("blocker guard blocks workflow execution", async () => {
    const { manager } = createMockManager();
    const emitted: any[] = [];

    // Enable ONLY the blocker guard
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-warn-on-step-done";

    try {
      const tool = createWorkflowTool({
        manager,
        workflowDir: TEST_WORKFLOW_DIR,
        guardsDir: TEST_GUARDS_DIR,
        agentName: "test-agent",
        runtimeCtx: createRuntimeCtx(emitted),
      });

      const result = await tool.execute("tc_5", {
        action: "run",
        name: "test-two-step",
        task: "Test guard block",
      });

      const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
      // The blocker guard has no events filter → fires on workflow_start too
      // But workflow_start demands are collected but not resolved via resolveDemands
      // Let me check... Actually looking at the code, workflow_start demands ARE just
      // collected by emitAndCollectDemands but NOT resolved. So blocking happens on step_done.
      // The blocker fires on step_done (it has no events filter → fires on all events).
      // After step-one completes, the blocker's block demand stops the workflow.
      expect(parsed.type).toBe("blocked");
      if (parsed.type === "blocked") {
        expect(parsed.reason).toBe("blocked by test guard");
      }
      expect(emitted).toContainEqual(expect.objectContaining({
        type: "guard.triggered",
        source: "workflow",
        owner: "agent:test-agent",
        data: expect.objectContaining({
          guard: "test-blocker",
          demandType: "block",
          action: "blocked",
          sourceEventType: "step_done",
          sessionId: expect.any(String),
        }),
      }));
    } finally {
      if (origDisabled === undefined) {
        delete process.env.DISABLED_GUARDS;
      } else {
        process.env.DISABLED_GUARDS = origDisabled;
      }
    }
  });
});

describe("Guard integration: guard loading and discovery", () => {
  test("guards are loaded from guardsDir and logged", async () => {
    const { manager } = createMockManager();

    // Disable most guards, keep just one to verify loading
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-blocker,test-warn-on-step-done";

    try {
      const events: any[] = [];
      const tool = createWorkflowTool({
        manager,
        workflowDir: TEST_WORKFLOW_DIR,
        guardsDir: TEST_GUARDS_DIR,
        agentName: "test-agent",
        onEvent: (e) => events.push(e),
      });

      const result = await tool.execute("tc_6", {
        action: "run",
        name: "test-two-step",
        task: "Test guard loading",
      });

      const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
      expect(parsed.type).toBe("done");
      // If we get here, the guard was loaded successfully (no crash)
      // The test-valid guard emits a warn on step_done, which would be in step-two's task
    } finally {
      if (origDisabled === undefined) {
        delete process.env.DISABLED_GUARDS;
      } else {
        process.env.DISABLED_GUARDS = origDisabled;
      }
    }
  });

  test("workflow runs without guards when guardsDir is not set", async () => {
    const { calls, manager } = createMockManager();

    const tool = createWorkflowTool({
      manager,
      workflowDir: TEST_WORKFLOW_DIR,
      // No guardsDir — no guards loaded
      agentName: "test-agent",
    });

    const result = await tool.execute("tc_7", {
      action: "run",
      name: "test-two-step",
      task: "Test no guards",
    });

    const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    expect(calls.length).toBe(2); // Just the two workflow steps
    // No guard warnings anywhere
    for (const call of calls) {
      expect(call.task).not.toContain("## Guard Warnings");
    }
  });
});
