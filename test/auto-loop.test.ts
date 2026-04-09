import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import the workflow directly
import { execute, name, description } from "../agents/shared/workflows/auto-loop.js";
import type { WorkflowContext, WorkflowResult, WorkflowEvent } from "../src/lib/workflow.js";
import type { TaskResult } from "../src/lib/types.js";

// ── Test fixtures ──────────────────────────────────────────────────────

let testDir: string;

function freshDir(): string {
  const dir = join(tmpdir(), `auto-loop-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  testDir = freshDir();
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// ── Mock helpers ───────────────────────────────────────────────────────

function makeTaskResult(text: string, status: "done" | "error" = "done"): TaskResult {
  return {
    sessionId: `s_test_${Date.now()}`,
    status,
    lastAssistantText: text,
    messages: [],
    duration: "5s",
    outputDir: testDir,
    turnsUsed: 3,
    ...(status === "error" ? { error: "agent failed" } : {}),
  };
}

interface MockCtxOptions {
  task: string;
  /** Array of responses the mock agent will return, in order. */
  agentResponses: Array<string | { text: string; status: "error" }>;
}

function createMockContext(opts: MockCtxOptions): {
  ctx: WorkflowContext;
  events: WorkflowEvent[];
  agentCalls: Array<{ name: string; task: string }>;
} {
  const events: WorkflowEvent[] = [];
  const agentCalls: Array<{ name: string; task: string }> = [];
  let callIndex = 0;

  const ctx: WorkflowContext = {
    task: opts.task,

    runAgent: async (agentName: string, task: string): Promise<TaskResult> => {
      agentCalls.push({ name: agentName, task });
      const response = opts.agentResponses[callIndex] ?? "Default response";
      callIndex++;

      if (typeof response === "object" && response.status === "error") {
        return makeTaskResult(response.text, "error");
      }
      return makeTaskResult(typeof response === "string" ? response : response.text);
    },

    runWorkflow: async (_name: string, _task: string): Promise<WorkflowResult> => {
      return { type: "done", summary: "sub-workflow done" };
    },

    emit: (event: WorkflowEvent) => {
      events.push(event);
    },

    summarize: (result: TaskResult) => result.lastAssistantText ?? "",

    done: (summary: string): WorkflowResult => ({ type: "done", summary }),

    escalate: (reason: string, context?: unknown): WorkflowResult => ({
      type: "escalate",
      reason,
      context,
    }),
  };

  return { ctx, events, agentCalls };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("auto-loop workflow", () => {
  it("exports correct name and description", () => {
    expect(name).toBe("auto-loop");
    expect(description).toContain("Multi-cycle");
  });

  it("runs a complete 2-cycle loop with inline task", async () => {
    const { ctx, events, agentCalls } = createMockContext({
      task: `agent: bob\nmaxCycles: 2\ntask: Research token efficiency`,
      agentResponses: [
        // Cycle 1 plan
        "Here's the plan:\n1. Analyze current token usage\n2. Test compression approaches",
        // Cycle 1 execute
        "Analyzed token usage. Created file analysis.md. Found that 60% of tokens are tool results.",
        // Cycle 1 evaluate
        "Good progress. Decision: CONTINUE. Moving to next cycle.",
        // Cycle 2 execute
        "Tested compression. Created file compression-results.md. Found 40% reduction possible.",
        // Cycle 2 evaluate
        "Task complete. All experiments done. Decision: DONE.\n## Done\nFinal summary: token efficiency can be improved 40%.",
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(result.summary).toContain("Auto-loop complete");
      expect(result.summary).toContain("Research token efficiency");
    }

    // Should have called the agent 5 times (plan, execute, evaluate, execute, evaluate)
    expect(agentCalls.length).toBe(5);
    expect(agentCalls.every((c) => c.name === "bob")).toBe(true);

    // Verify events
    expect(events.some((e) => e.type === "workflow_start")).toBe(true);
    expect(events.filter((e) => e.type === "step_start").length).toBeGreaterThanOrEqual(3);

    // Verify state file was created
    const stateFiles = findStateFiles(testDir);
    // State file is created under agents/bob/workspace/auto-loop/
    // Since we're in test, check the cwd
  }, 30000);

  it("creates and persists state file from inline task", async () => {
    const { ctx } = createMockContext({
      task: `agent: bob\nmaxCycles: 1\ntask: Quick test task`,
      agentResponses: [
        "Plan:\n1. Do the thing",
        "Did the thing. Created output.md",
        "Task complete. Decision: DONE.\n## Done",
      ],
    });

    const result = await execute(ctx);
    expect(result.type).toBe("done");

    // Check state file exists somewhere under agents/bob/workspace/auto-loop/
    const statePath = `agents/bob/workspace/auto-loop/quick-test-task.json`;
    expect(existsSync(statePath)).toBe(true);

    // Verify state content
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(state.status).toBe("done");
    expect(state.phase).toBe("done");
    expect(state.task).toBe("Quick test task");
    expect(state.agent).toBe("bob");
    expect(state.history.length).toBe(3); // plan, execute, evaluate

    // Clean up
    rmSync(statePath);
    // Clean empty dirs
    try { rmSync(`agents/bob/workspace/auto-loop`, { recursive: true }); } catch {}
  }, 30000);

  it("loads from existing state file", async () => {
    const statePath = join(testDir, "test-state.json");
    const initialState = {
      task: "Continue research",
      agent: "bob",
      phase: "execute",
      cycle: 2,
      maxCycles: 3,
      status: "active",
      stuckCount: 0,
      created: new Date().toISOString(),
      lastCycleAt: null,
      plan: ["Step 1: baseline", "Step 2: test A", "Step 3: test B"],
      history: [
        { cycle: 1, phase: "plan", result: "Created plan", files: [], duration: "5s" },
        { cycle: 1, phase: "execute", result: "Did step 1", files: ["baseline.md"], duration: "10s" },
        { cycle: 1, phase: "evaluate", result: "Decision: continue", files: [], duration: "3s" },
      ],
      context: { keyFindings: ["Baseline established"], openQuestions: [], blockers: [] },
    };
    writeFileSync(statePath, JSON.stringify(initialState), "utf-8");

    const { ctx, agentCalls } = createMockContext({
      task: statePath,
      agentResponses: [
        // Cycle 2 execute (resumes from execute phase)
        "Tested approach A. Results show 30% improvement.",
        // Cycle 2 evaluate
        "Good results. Decision: CONTINUE",
        // Cycle 3 execute
        "Tested approach B. Results show 45% improvement.",
        // Cycle 3 evaluate
        "All tests complete. Decision: DONE.\n## Done\nBoth approaches tested.",
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect(agentCalls.length).toBe(4); // execute, evaluate, execute, evaluate

    // Verify state was updated
    const finalState = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(finalState.status).toBe("done");
    expect(finalState.cycle).toBe(3);
    expect(finalState.history.length).toBe(7); // 3 original + 4 new
  }, 30000);

  it("escalates when agent fails during plan phase", async () => {
    const { ctx, agentCalls } = createMockContext({
      task: `agent: bob\nmaxCycles: 3\ntask: Failing task`,
      agentResponses: [
        { text: "Agent crashed", status: "error" },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("plan phase");
    }
  }, 30000);

  it("retries once on execute failure, then escalates", async () => {
    const { ctx, agentCalls } = createMockContext({
      task: `agent: bob\nmaxCycles: 2\ntask: Flaky task`,
      agentResponses: [
        // Plan succeeds
        "Plan:\n1. Step one\n2. Step two",
        // Execute fails first time
        { text: "Timeout", status: "error" },
        // Execute retry also fails
        { text: "Timeout again", status: "error" },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("execute phase");
    }
    // Should have 3 calls: plan, execute, execute retry
    expect(agentCalls.length).toBe(3);
  }, 30000);

  it("handles max cycles exhaustion gracefully", async () => {
    const { ctx } = createMockContext({
      task: `agent: bob\nmaxCycles: 1\ntask: One cycle only`,
      agentResponses: [
        "Plan:\n1. Single step",
        "Executed the step. Wrote results.md",
        "More work needed but this is good progress. Decision: CONTINUE",
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(result.summary).toContain("max cycles reached");
    }
  }, 30000);

  it("handles already-done state file", async () => {
    const statePath = join(testDir, "done-state.json");
    writeFileSync(statePath, JSON.stringify({
      task: "Already finished",
      agent: "bob",
      phase: "done",
      cycle: 3,
      maxCycles: 5,
      status: "done",
      stuckCount: 0,
      created: new Date().toISOString(),
      lastCycleAt: new Date().toISOString(),
      plan: ["a", "b"],
      history: [{ cycle: 1, phase: "execute", result: "did stuff", files: [], duration: "5s" }],
      context: { keyFindings: [], openQuestions: [], blockers: [] },
    }), "utf-8");

    const { ctx, agentCalls } = createMockContext({
      task: statePath,
      agentResponses: [],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(result.summary).toContain("already complete");
    }
    // No agent calls — already done
    expect(agentCalls.length).toBe(0);
  }, 30000);

  it("handles paused state file", async () => {
    const statePath = join(testDir, "paused-state.json");
    writeFileSync(statePath, JSON.stringify({
      task: "Paused task",
      agent: "bob",
      phase: "execute",
      cycle: 2,
      maxCycles: 5,
      status: "paused",
      stuckCount: 0,
      created: new Date().toISOString(),
      lastCycleAt: new Date().toISOString(),
      plan: ["a"],
      history: [],
      context: { keyFindings: [], openQuestions: [], blockers: [] },
    }), "utf-8");

    const { ctx, agentCalls } = createMockContext({
      task: statePath,
      agentResponses: [],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("paused");
    }
    expect(agentCalls.length).toBe(0);
  }, 30000);

  it("evaluator can trigger replan by saying REVISE", async () => {
    const { ctx, agentCalls } = createMockContext({
      task: `agent: bob\nmaxCycles: 3\ntask: Adaptive research`,
      agentResponses: [
        // Cycle 1 plan
        "Plan:\n1. Test hypothesis A\n2. Test hypothesis B\n3. Synthesize",
        // Cycle 1 execute
        "Tested hypothesis A. It was wrong — need to revise the approach.",
        // Cycle 1 evaluate — triggers replan
        "Need to revise plan. Hypothesis A disproven, should pivot to C. Replanning needed.",
        // Cycle 1 replan (phase goes back to plan)
        "Revised plan:\n1. Test hypothesis C\n2. Compare C vs B\n3. Final synthesis",
        // Cycle 1 execute (still cycle 1 after replan)
        "Tested hypothesis C. Promising results.",
        // Cycle 1 evaluate
        "Good progress. Decision: CONTINUE",
        // Cycle 2 execute
        "Compared C vs B. C is clearly better.",
        // Cycle 2 evaluate
        "All done. Decision: DONE.\n## Done",
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    // Verify the plan agent was called more than once (replan happened)
    const planCalls = agentCalls.filter((c) => c.task.includes("plan") || c.task.includes("Plan"));
    expect(planCalls.length).toBeGreaterThanOrEqual(2);
  }, 30000);

  it("detects stuck loops and escalates", async () => {
    // Stuck detection fires when the last 2 history entries have the same phase
    // and no files. We set stuckCount=1 so one more same-phase no-file entry
    // pushes it to 2 (the threshold). We start at evaluate phase so the
    // workflow records an evaluate entry — matching the last history entry.
    const statePath = join(testDir, "stuck-state.json");
    writeFileSync(statePath, JSON.stringify({
      task: "Stuck task",
      agent: "bob",
      phase: "evaluate",
      cycle: 3,
      maxCycles: 10,
      status: "active",
      stuckCount: 1, // already 1 stuck count — one more triggers escalation
      created: new Date().toISOString(),
      lastCycleAt: new Date().toISOString(),
      plan: ["a", "b", "c", "d", "e"],
      history: [
        { cycle: 2, phase: "execute", result: "No progress", files: [], duration: "5s" },
        // Last entry is evaluate with no files — next evaluate will match
        { cycle: 2, phase: "evaluate", result: "Still nothing new", files: [], duration: "5s" },
      ],
      context: { keyFindings: [], openQuestions: [], blockers: [] },
    }), "utf-8");

    const { ctx } = createMockContext({
      task: statePath,
      agentResponses: [
        // Evaluate call — will say CONTINUE, no files, same phase as last history entry
        "No real progress. Decision: CONTINUE",
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("stuck");
    }
  }, 30000);

  it("returns error for missing state file path", async () => {
    const { ctx } = createMockContext({
      task: join(testDir, "nonexistent.yaml"),
      agentResponses: [],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("not found");
    }
  }, 30000);

  it("carries context (key findings) across cycles", async () => {
    const { ctx, agentCalls } = createMockContext({
      task: `agent: bob\nmaxCycles: 2\ntask: Context carry test`,
      agentResponses: [
        "Plan:\n1. First test\n2. Second test",
        // Execute cycle 1 — produces findings
        "Key findings: Token compression reduces context by 40%.",
        // Evaluate cycle 1
        "Decision: CONTINUE",
        // Execute cycle 2 — should see context from cycle 1
        "Built on previous findings. Additional finding that batch processing helps.",
        // Evaluate cycle 2
        "Decision: DONE.\n## Done",
      ],
    });

    const result = await execute(ctx);
    expect(result.type).toBe("done");

    // The execute task for cycle 2 should contain context from cycle 1
    const cycle2ExecCall = agentCalls[3]; // 4th call = cycle 2 execute
    expect(cycle2ExecCall.task).toContain("Context");
  }, 30000);
});

// ── Helper ─────────────────────────────────────────────────────────────

function findStateFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = require("fs").readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.name.endsWith(".json") && entry.parentPath?.includes("auto-loop")) {
        results.push(join(entry.parentPath, entry.name));
      }
    }
  } catch {}
  return results;
}
