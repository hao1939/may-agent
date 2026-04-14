/**
 * Tests for Guards as Workflow Demands system.
 *
 * Tests cover:
 * 1. WorkflowGuardEvent types
 * 2. Demand types (block, warn, run_step)
 * 3. WorkflowBlocked error class
 * 4. emitAndCollectDemands helper (tested indirectly via types)
 * 5. extractWrittenFiles / extractChangedFiles utilities
 * 6. Guard event filtering
 */

import { describe, test, expect, vi } from "vitest";
import { WorkflowBlocked } from "./workflow.js";
import type {
  WorkflowGuard,
  WorkflowGuardEvent,
  Demand,
  GuardModule,
} from "./workflow.js";
import { extractWrittenFiles, extractChangedFiles } from "./workflow-utils.js";
import { loadGuards, emitAndCollectDemands } from "./workflow-tool.js";

// ──────────────────────────────────────────────────────────────────────
// WorkflowBlocked error
// ──────────────────────────────────────────────────────────────────────

describe("WorkflowBlocked", () => {
  test("extends Error with reason, completedSteps, workflowRunId", () => {
    const steps = [
      { step: "coder", sessionId: "s1", result: { sessionId: "s1", status: "done" as const, lastAssistantText: "ok", messages: [], duration: "1s", outputDir: "", turnsUsed: 1 } },
    ];
    const err = new WorkflowBlocked("safety violation", steps, "run_123");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("WorkflowBlocked");
    expect(err.reason).toBe("safety violation");
    expect(err.completedSteps).toEqual(steps);
    expect(err.workflowRunId).toBe("run_123");
    expect(err.message).toContain("safety violation");
  });
});

// ──────────────────────────────────────────────────────────────────────
// Guard interface / Demand types
// ──────────────────────────────────────────────────────────────────────

describe("Guard / Demand type contracts", () => {
  test("a guard returning empty demands means no objection", () => {
    const guard: WorkflowGuard = {
      name: "permissive",
      handle: () => [],
    };
    const event: WorkflowGuardEvent = { type: "workflow_start", workflow: "test", task: "test task" };
    expect(guard.handle(event)).toEqual([]);
  });

  test("a guard can return a block demand", () => {
    const guard: WorkflowGuard = {
      name: "blocker",
      handle: () => [{ type: "block", reason: "not allowed" }],
    };
    const event: WorkflowGuardEvent = { type: "workflow_start", workflow: "test", task: "do bad thing" };
    const demands = guard.handle(event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
    expect(demands[0].reason).toBe("not allowed");
  });

  test("a guard can return a warn demand", () => {
    const guard: WorkflowGuard = {
      name: "warner",
      handle: () => [{ type: "warn", reason: "heads up" }],
    };
    const demands = guard.handle({ type: "workflow_start", workflow: "w", task: "t" });
    expect(demands[0].type).toBe("warn");
  });

  test("a guard can return a run_step demand with step config", () => {
    const guard: WorkflowGuard = {
      name: "injector",
      handle: () => [{
        type: "run_step",
        reason: "needs linting",
        step: { agent: "linter", task: "lint the code", label: "guard:lint" },
      }],
    };
    const demands = guard.handle({ type: "workflow_start", workflow: "w", task: "t" });
    expect(demands[0].type).toBe("run_step");
    expect(demands[0].step?.agent).toBe("linter");
    expect(demands[0].step?.label).toBe("guard:lint");
  });

  test("guard events filter works at type level", () => {
    const guard: WorkflowGuard = {
      name: "selective",
      events: ["step_done"],
      handle: (event) => {
        if (event.type === "step_done") return [{ type: "warn", reason: "step completed" }];
        return [];
      },
    };
    expect(guard.events).toEqual(["step_done"]);
  });

  test("GuardModule shape: exports guard field", () => {
    const mod: GuardModule = {
      guard: {
        name: "sample",
        handle: () => [],
      },
    };
    expect(mod.guard.name).toBe("sample");
    expect(typeof mod.guard.handle).toBe("function");
  });
});

// ──────────────────────────────────────────────────────────────────────
// WorkflowGuardEvent types
// ──────────────────────────────────────────────────────────────────────

describe("WorkflowGuardEvent discriminants", () => {
  test("workflow_start event has workflow and task fields", () => {
    const event: WorkflowGuardEvent = { type: "workflow_start", workflow: "verify-wrap", task: "do a thing" };
    expect(event.type).toBe("workflow_start");
    expect(event.workflow).toBe("verify-wrap");
  });

  test("step_done event has source, step, result, completedSteps", () => {
    const mockResult = { sessionId: "s1", status: "done" as const, lastAssistantText: "done", messages: [], duration: "1s", outputDir: "", turnsUsed: 1 };
    const event: WorkflowGuardEvent = {
      type: "step_done",
      source: "agent",
      step: "coder",
      result: mockResult,
      completedSteps: [{ step: "coder", sessionId: "s1", result: mockResult }],
      task: "implement feature",
    };
    expect(event.type).toBe("step_done");
    expect(event.source).toBe("agent");
    expect(event.result.status).toBe("done");
    expect(event.completedSteps).toHaveLength(1);
  });

  test("workflow_done event has workflow, summary, completedSteps", () => {
    const event: WorkflowGuardEvent = {
      type: "workflow_done",
      workflow: "impl-and-verify",
      summary: "All tests pass",
      completedSteps: [],
    };
    expect(event.type).toBe("workflow_done");
    expect(event.summary).toBe("All tests pass");
  });
});

// ──────────────────────────────────────────────────────────────────────
// extractWrittenFiles
// ──────────────────────────────────────────────────────────────────────

const makeResult = (messages: any[]): any => ({
  sessionId: "test",
  status: "done",
  lastAssistantText: "ok",
  messages,
  duration: "1s",
  outputDir: "",
  turnsUsed: 1,
});

describe("extractWrittenFiles", () => {
  test("extracts write() calls from messages", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "write",
            arguments: { path: "src/main.ts", content: "code" },
          },
        ],
      },
    ];
    const files = extractWrittenFiles(makeResult(messages));
    expect(files).toEqual(["src/main.ts"]);
  });

  test("extracts edit() calls from messages", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "edit",
            arguments: { path: "src/lib.ts", oldText: "old", newText: "new" },
          },
        ],
      },
    ];
    const files = extractWrittenFiles(makeResult(messages));
    expect(files).toEqual(["src/lib.ts"]);
  });

  test("deduplicates files", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", name: "write", arguments: { path: "a.ts", content: "1" } },
          { type: "toolCall", name: "edit", arguments: { path: "a.ts", oldText: "x", newText: "y" } },
        ],
      },
    ];
    const files = extractWrittenFiles(makeResult(messages));
    expect(files).toEqual(["a.ts"]);
  });

  test("handles empty messages array", () => {
    expect(extractWrittenFiles(makeResult([]))).toEqual([]);
  });

  test("handles messages without content array", () => {
    const messages = [{ role: "user", content: "hello" }];
    expect(extractWrittenFiles(makeResult(messages))).toEqual([]);
  });

  test("extracts from tool result text 'Wrote N bytes to path'", () => {
    const messages = [
      {
        role: "toolResult",
        content: [{ type: "text", text: "✅ Wrote 1234 bytes to src/out.ts (42 lines)" }],
      },
    ];
    const files = extractWrittenFiles(makeResult(messages));
    expect(files).toContain("src/out.ts");
  });
});

// ──────────────────────────────────────────────────────────────────────
// extractChangedFiles
// ──────────────────────────────────────────────────────────────────────

describe("extractChangedFiles", () => {
  test("includes write calls", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", name: "write", arguments: { path: "a.ts", content: "code" } },
        ],
      },
    ];
    const files = extractChangedFiles(makeResult(messages));
    expect(files).toContain("a.ts");
  });

  test("includes finish deliverables", () => {
    const result = {
      ...makeResult([]),
      finishResult: {
        deliverables: [{ path: "b.ts", description: "new file" }],
      },
    };
    const files = extractChangedFiles(result);
    expect(files).toContain("b.ts");
  });

  test("combines write and finish results, deduplicates", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", name: "write", arguments: { path: "a.ts", content: "code" } },
        ],
      },
    ];
    const result = {
      ...makeResult(messages),
      finishResult: {
        deliverables: [
          { path: "a.ts", description: "same file" },
          { path: "b.ts", description: "another file" },
        ],
      },
    };
    const files = extractChangedFiles(result);
    expect(files).toContain("a.ts");
    expect(files).toContain("b.ts");
    // No duplicates
    expect(files.filter(f => f === "a.ts")).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────
// loadGuards
// ──────────────────────────────────────────────────────────────────────

import { join } from "node:path";

const TEST_GUARDS_DIR = join(import.meta.dir, "__test-guards__");

describe("loadGuards", () => {
  test("loads valid guards from a directory", async () => {
    const guards = await loadGuards(TEST_GUARDS_DIR);
    const names = guards.map(g => g.name);
    // Should have at least the valid guard and the blocker guard
    expect(names).toContain("test-valid");
    expect(names).toContain("test-blocker");
  });

  test("skips REGISTRY.md and non-.ts files", async () => {
    const guards = await loadGuards(TEST_GUARDS_DIR);
    const names = guards.map(g => g.name);
    // REGISTRY.md should not produce a guard entry
    expect(names.every(n => typeof n === "string" && n.length > 0)).toBe(true);
  });

  test("skips guards with invalid exports (no guard field)", async () => {
    const guards = await loadGuards(TEST_GUARDS_DIR);
    const names = guards.map(g => g.name);
    // invalid-guard.ts has no `guard` export — should be silently skipped
    expect(names).not.toContain("notAGuard");
  });

  test("handles guards that throw during import", async () => {
    // Should not throw, just skip the broken guard
    const guards = await loadGuards(TEST_GUARDS_DIR);
    // The throwing guard should be skipped but other guards should load
    expect(guards.length).toBeGreaterThan(0);
  });

  test("returns empty array for non-existent directory", async () => {
    const guards = await loadGuards("/app/src/lib/__nonexistent-guards__");
    expect(guards).toEqual([]);
  });

  test("returns empty array for undefined dirs", async () => {
    const guards = await loadGuards(undefined, undefined);
    expect(guards).toEqual([]);
  });

  test("merges guards from multiple directories", async () => {
    // Pass the same dir twice — should load guards from both (dedup by file path isn't the contract)
    const guards = await loadGuards(TEST_GUARDS_DIR, TEST_GUARDS_DIR);
    // Should have duplicates since same dir is loaded twice
    expect(guards.length).toBeGreaterThan(2);
  });

  test("loads real build-check guard from shared guards dir", async () => {
    const sharedDir = join(process.cwd(), "agents/shared/guards");
    const guards = await loadGuards(sharedDir);
    const names = guards.map(g => g.name);
    expect(names).toContain("build-check");
  });
});

// ──────────────────────────────────────────────────────────────────────
// emitAndCollectDemands
// ──────────────────────────────────────────────────────────────────────

describe("emitAndCollectDemands", () => {
  const mockResult = {
    sessionId: "s1",
    status: "done" as const,
    lastAssistantText: "done",
    messages: [],
    duration: "1s",
    outputDir: "",
    turnsUsed: 1,
  };

  const makeEvent = (type: WorkflowGuardEvent["type"]): WorkflowGuardEvent => {
    switch (type) {
      case "workflow_start":
        return { type: "workflow_start", workflow: "test", task: "test task" };
      case "step_done":
        return {
          type: "step_done",
          source: "agent",
          step: "coder",
          result: mockResult,
          completedSteps: [{ step: "coder", sessionId: "s1", result: mockResult }],
          task: "implement feature",
        };
      case "step_start":
        return {
          type: "step_start",
          source: "agent",
          step: "coder",
          task: "implement feature",
          completedSteps: [],
        };
      case "workflow_done":
        return {
          type: "workflow_done",
          workflow: "test",
          summary: "All done",
          completedSteps: [{ step: "coder", sessionId: "s1", result: mockResult }],
        };
    }
  };

  test("returns empty array when no guards match", () => {
    const guard: WorkflowGuard = {
      name: "selective",
      events: ["workflow_done"],
      handle: () => [{ type: "warn", reason: "should not fire" }],
    };
    const demands = emitAndCollectDemands([guard], makeEvent("workflow_start"));
    expect(demands).toEqual([]);
  });

  test("calls guard when event type matches", () => {
    const guard: WorkflowGuard = {
      name: "step-watcher",
      events: ["step_done"],
      handle: () => [{ type: "warn", reason: "step completed" }],
    };
    const demands = emitAndCollectDemands([guard], makeEvent("step_done"));
    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toBe("step completed");
  });

  test("calls guard for all events when events array is omitted", () => {
    const guard: WorkflowGuard = {
      name: "universal",
      handle: () => [{ type: "warn", reason: "I see everything" }],
    };
    // Should fire for any event type
    expect(emitAndCollectDemands([guard], makeEvent("workflow_start"))).toHaveLength(1);
    expect(emitAndCollectDemands([guard], makeEvent("step_done"))).toHaveLength(1);
    expect(emitAndCollectDemands([guard], makeEvent("workflow_done"))).toHaveLength(1);
  });

  test("auto-fills guardName on each demand", () => {
    const guard: WorkflowGuard = {
      name: "named-guard",
      handle: () => [
        { type: "warn", reason: "first" },
        { type: "block", reason: "second" },
      ],
    };
    const demands = emitAndCollectDemands([guard], makeEvent("workflow_start"));
    expect(demands).toHaveLength(2);
    expect(demands[0].guardName).toBe("named-guard");
    expect(demands[1].guardName).toBe("named-guard");
  });

  test("collects demands from multiple guards", () => {
    const guard1: WorkflowGuard = {
      name: "guard-a",
      handle: () => [{ type: "warn", reason: "from A" }],
    };
    const guard2: WorkflowGuard = {
      name: "guard-b",
      handle: () => [{ type: "warn", reason: "from B" }],
    };
    const demands = emitAndCollectDemands([guard1, guard2], makeEvent("workflow_start"));
    expect(demands).toHaveLength(2);
    expect(demands[0].guardName).toBe("guard-a");
    expect(demands[1].guardName).toBe("guard-b");
  });

  test("catches guard errors and continues", () => {
    const badGuard: WorkflowGuard = {
      name: "exploder",
      handle: () => { throw new Error("guard crashed"); },
    };
    const goodGuard: WorkflowGuard = {
      name: "good-guard",
      handle: () => [{ type: "warn", reason: "still works" }],
    };
    const demands = emitAndCollectDemands([badGuard, goodGuard], makeEvent("workflow_start"));
    // Bad guard's error is swallowed; good guard's demand is still collected
    expect(demands).toHaveLength(1);
    expect(demands[0].guardName).toBe("good-guard");
  });

  test("returns empty array when guards return empty arrays", () => {
    const guard: WorkflowGuard = {
      name: "no-op",
      handle: () => [],
    };
    const demands = emitAndCollectDemands([guard], makeEvent("step_done"));
    expect(demands).toEqual([]);
  });

  test("preserves demand types and step config", () => {
    const guard: WorkflowGuard = {
      name: "injector",
      handle: () => [{
        type: "run_step",
        reason: "needs verification",
        step: { agent: "verifier", task: "verify changes", label: "guard:verify" },
      }],
    };
    const demands = emitAndCollectDemands([guard], makeEvent("step_done"));
    expect(demands[0].type).toBe("run_step");
    expect(demands[0].step?.agent).toBe("verifier");
    expect(demands[0].step?.task).toBe("verify changes");
    expect(demands[0].step?.label).toBe("guard:verify");
  });

  test("demand ordering: block, run_step, warn demands all collected in order", () => {
    const guard: WorkflowGuard = {
      name: "multi-demand",
      handle: () => [
        { type: "warn", reason: "warning" },
        { type: "run_step", reason: "inject", step: { agent: "a", task: "t" } },
        { type: "block", reason: "stop" },
      ],
    };
    const demands = emitAndCollectDemands([guard], makeEvent("workflow_start"));
    expect(demands).toHaveLength(3);
    expect(demands[0].type).toBe("warn");
    expect(demands[1].type).toBe("run_step");
    expect(demands[2].type).toBe("block");
  });
});

// ──────────────────────────────────────────────────────────────────────
// Build-check guard integration
// ──────────────────────────────────────────────────────────────────────

describe("build-check guard integration", () => {
  test("warns on coder step without build success indicator", async () => {
    const sharedDir = join(process.cwd(), "agents/shared/guards");
    const guards = await loadGuards(sharedDir);
    const buildCheck = guards.find(g => g.name === "build-check");
    expect(buildCheck).toBeDefined();

    const event: WorkflowGuardEvent = {
      type: "step_done",
      source: "agent",
      step: "coder",
      result: {
        sessionId: "s1",
        status: "done" as const,
        lastAssistantText: "I wrote some code but didn't check if it builds.",
        messages: [],
        duration: "1s",
        outputDir: "",
        turnsUsed: 1,
      },
      completedSteps: [],
      task: "implement feature",
    };

    const demands = emitAndCollectDemands([buildCheck!], event);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("coder");
  });

  test("no warning when build success is mentioned", async () => {
    const sharedDir = join(process.cwd(), "agents/shared/guards");
    const guards = await loadGuards(sharedDir);
    const buildCheck = guards.find(g => g.name === "build-check");
    expect(buildCheck).toBeDefined();

    const event: WorkflowGuardEvent = {
      type: "step_done",
      source: "agent",
      step: "coder",
      result: {
        sessionId: "s1",
        status: "done" as const,
        lastAssistantText: "All done. Build passes, tests pass. ✅",
        messages: [],
        duration: "1s",
        outputDir: "",
        turnsUsed: 1,
      },
      completedSteps: [],
      task: "implement feature",
    };

    const demands = emitAndCollectDemands([buildCheck!], event);
    expect(demands).toEqual([]);
  });

  test("ignores non-coding steps", async () => {
    const sharedDir = join(process.cwd(), "agents/shared/guards");
    const guards = await loadGuards(sharedDir);
    const buildCheck = guards.find(g => g.name === "build-check");

    const event: WorkflowGuardEvent = {
      type: "step_done",
      source: "agent",
      step: "reviewer",
      result: {
        sessionId: "s1",
        status: "done" as const,
        lastAssistantText: "The code looks good to me.",
        messages: [],
        duration: "1s",
        outputDir: "",
        turnsUsed: 1,
      },
      completedSteps: [],
      task: "review code",
    };

    const demands = emitAndCollectDemands([buildCheck!], event);
    expect(demands).toEqual([]);
  });
});
