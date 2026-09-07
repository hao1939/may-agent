/**
 * Integration tests: Guards firing during real workflow execution.
 *
 * These tests use createWorkflowTool with a mock SubagentManager to verify
 * that guards are discovered, loaded, called with correct events, and their
 * demands (warn, run_step, block) are resolved during executeWorkflow.
 */

import { describe, test, expect } from "bun:test";
import { join, dirname } from "node:path";
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

function createRuntimeCtx(events: unknown[] = []) {
  return {
    emit: (event: unknown) => events.push(event),
    dispatchEvent: () => {},
    getDb: () => {
      throw new Error("getDb unavailable in guard integration test");
    },
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
      runtimeCtx: createRuntimeCtx(emitted),
    });

    // Disable all guards except the warn one
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-blocker,test-inject-step";

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
    } finally {
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
    process.env.DISABLED_GUARDS = "test-valid,test-blocker,test-inject-step,test-warn-on-step-done";

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

describe("Guard integration: run_step demand injection", () => {
  test("inject guard fires on step-one completion, injected step runs", async () => {
    const { calls, manager } = createMockManager(async (name) => {
      return makeTaskResult({
        lastAssistantText: `${name} completed`,
        sessionId: `s_${name}_${Date.now()}`,
      });
    });

    // Enable only the inject guard
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-blocker,test-warn-on-step-done";

    try {
      const events: any[] = [];
      const emitted: any[] = [];
      const tool = createWorkflowTool({
        manager,
        workflowDir: TEST_WORKFLOW_DIR,
        guardsDir: TEST_GUARDS_DIR,
        agentName: "test-agent",
        onEvent: (e) => events.push(e),
        runtimeCtx: createRuntimeCtx(emitted),
      });

      const result = await tool.execute("tc_3", {
        action: "run",
        name: "test-two-step",
        task: "Test guard step injection",
      });

      const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
      expect(parsed.type).toBe("done");

      // Should have 3 calls: step-one, guard:verify-step-one (injected), step-two
      expect(calls.length).toBe(3);
      expect(calls[0].name).toBe("step-one");
      expect(calls[1].name).toBe("verifier"); // injected by guard
      expect(calls[1].task).toBe("Verify the output of step-one");
      expect(calls[1].opts?.stepLabel).toBe("guard:verify-step-one");
      expect(calls[1].opts?.source).toBe("guard");
      expect(calls[2].name).toBe("step-two");

      // Verify events include the injected step
      const stepStarts = events.filter(e => e.type === "workflow.step_started");
      const stepDones = events.filter(e => e.type === "workflow.step_completed");
      expect(stepStarts.some(e => e.step === "guard:verify-step-one")).toBe(true);
      expect(stepDones.some(e => e.step === "guard:verify-step-one")).toBe(true);
      expect(emitted).toContainEqual(expect.objectContaining({
        type: "guard.triggered",
        source: "workflow",
        owner: "agent:test-agent",
        data: expect.objectContaining({
          guard: "test-inject-step",
          demandType: "run_step",
          action: "injected",
          sessionId: expect.any(String),
          injectedStepLabel: "guard:verify-step-one",
          injectedAgent: "verifier",
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

  test("injected step only fires for step-one, not step-two", async () => {
    const { calls, manager } = createMockManager();

    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-blocker,test-warn-on-step-done";

    try {
      const tool = createWorkflowTool({
        manager,
        workflowDir: TEST_WORKFLOW_DIR,
        guardsDir: TEST_GUARDS_DIR,
        agentName: "test-agent",
      });

      await tool.execute("tc_4", {
        action: "run",
        name: "test-two-step",
        task: "Test selective injection",
      });

      // The inject guard only fires for step "step-one", not "step-two"
      // So: step-one → guard:verify-step-one → step-two (3 calls)
      // The guard does NOT fire again after step-two
      expect(calls.length).toBe(3);
      expect(calls[0].name).toBe("step-one");
      expect(calls[1].name).toBe("verifier");
      expect(calls[2].name).toBe("step-two");
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
    process.env.DISABLED_GUARDS = "test-valid,test-inject-step,test-warn-on-step-done";

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
    process.env.DISABLED_GUARDS = "test-blocker,test-inject-step,test-warn-on-step-done";

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

describe("Guard integration: combined warn + inject", () => {
  test("both warn and inject guards fire, warnings appear after injected step", async () => {
    const { calls, manager } = createMockManager();

    // Enable both warn and inject guards
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-blocker";

    try {
      const tool = createWorkflowTool({
        manager,
        workflowDir: TEST_WORKFLOW_DIR,
        guardsDir: TEST_GUARDS_DIR,
        agentName: "test-agent",
      });

      const result = await tool.execute("tc_8", {
        action: "run",
        name: "test-two-step",
        task: "Test combined guards",
      });

      const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
      expect(parsed.type).toBe("done");

      // Expected flow:
      // 1. step-one runs
      // 2. Guards fire: warn-on-step-done emits warn, inject-step emits run_step
      //    resolveDemands processes in order: warn (accumulated), then run_step (injected agent call)
      // 3. Injected step "verifier" runs without recursively firing guards.
      //    Pending warnings remain for the next authored workflow step.
      // 4. step-two runs with accumulated warnings in its task
      expect(calls.length).toBeGreaterThanOrEqual(3); // at least step-one, verifier, step-two

      // step-two should have guard warnings
      const stepTwoCall = calls.find(c => c.name === "step-two");
      expect(stepTwoCall).toBeDefined();
      expect(stepTwoCall!.task).toContain("## Guard Warnings");
    } finally {
      if (origDisabled === undefined) {
        delete process.env.DISABLED_GUARDS;
      } else {
        process.env.DISABLED_GUARDS = origDisabled;
      }
    }
  });
});

describe("Guard integration: maxInjectedSteps limit", () => {
  test("injected steps are capped at maxInjectedSteps", async () => {
    const { calls, manager } = createMockManager();

    // Create a tool with maxInjectedSteps=0 to prevent any injections
    const origDisabled = process.env.DISABLED_GUARDS;
    process.env.DISABLED_GUARDS = "test-valid,test-blocker,test-warn-on-step-done";

    try {
      const tool = createWorkflowTool({
        manager,
        workflowDir: TEST_WORKFLOW_DIR,
        guardsDir: TEST_GUARDS_DIR,
        agentName: "test-agent",
        maxInjectedSteps: 0, // No injected steps allowed
      });

      const result = await tool.execute("tc_9", {
        action: "run",
        name: "test-two-step",
        task: "Test injection limit",
      });

      const parsed = JSON.parse((result.content[0] as any).text) as WorkflowToolResult;
      expect(parsed.type).toBe("done");

      // With maxInjectedSteps=0, the inject guard's run_step demand should be skipped
      expect(calls.length).toBe(2); // Only step-one and step-two
      expect(calls[0].name).toBe("step-one");
      expect(calls[1].name).toBe("step-two");
    } finally {
      if (origDisabled === undefined) {
        delete process.env.DISABLED_GUARDS;
      } else {
        process.env.DISABLED_GUARDS = origDisabled;
      }
    }
  });
});
