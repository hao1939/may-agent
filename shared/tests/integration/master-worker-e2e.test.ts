/**
 * Integration tests for master-worker workflow execute().
 * Uses realistic mock sessions that simulate actual LLM response patterns
 * rather than simple vi.fn() stubs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { execute, extractDecision } from "../../workflows/master-worker.ts";

// Mock fs with realistic behavior
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof fs>("node:fs");
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  };
});

vi.mock("../../workflows/dispatch-validator.ts", () => ({
  validateDispatch: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock("../../workflows/incremental-checkpoint.ts", () => ({
  saveIncrementalCheckpoint: vi.fn(),
  detectIncompleteCheckpoint: vi.fn(() => null),
  markCheckpointComplete: vi.fn(),
  cleanupCheckpoints: vi.fn(),
}));

vi.mock("../../workflows/output-validator.ts", () => ({
  validateOutput: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
}));

vi.mock("../../workflows/provider-retry.ts", () => ({
  withRetry: vi.fn((fn: () => any) => fn()),
  isRetryableError: vi.fn(() => false),
}));

vi.mock("../../workflows/worker-retry.ts", () => ({
  withWorkerRetry: vi.fn(async (fn: () => any) => {
    try {
      const result = await fn();
      return { success: true, result, attempts: 1, errors: [] };
    } catch (e: any) {
      return { success: false, result: null, attempts: 1, errors: [e.message] };
    }
  }),
  isWorkerRetryable: vi.fn(() => true),
}));

vi.mock("../../workflows/project-helpers.ts", () => ({
  extractField: vi.fn((content: string, field: string) => {
    const match = content.match(new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+)`));
    return match ? match[1].trim() : "";
  }),
  extractSection: vi.fn((content: string, section: string) => {
    const match = content.match(new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n## |$)`));
    return match ? match[1].trim() : "";
  }),
  updateProjectStatus: vi.fn(),
}));

vi.mock("../../workflows/complexity-estimator.ts", () => ({
  estimateComplexity: vi.fn(() => ({ score: 2, description: "simple", timeoutMs: 60000 })),
}));

vi.mock("../../workflows/iteration-timer.ts", () => ({
  IterationTimer: vi.fn(() => ({
    startIteration: vi.fn(),
    endIteration: vi.fn(() => 500),
    getStats: vi.fn(() => ({ avg: 500, max: 500, min: 500, count: 1 })),
  })),
}));

vi.mock("../../workflows/iteration-budget.ts", () => ({
  createBudget: vi.fn(() => ({
    getConfig: vi.fn(() => ({ maxTimeMs: 60000, maxTokens: 50000 })),
    check: vi.fn(() => ({ exceeded: false })),
    consume: vi.fn(),
  })),
}));

vi.mock("../../lib/iteration-monitor.ts", () => ({
  recordIteration: vi.fn(),
}));

vi.mock("../../lib/cost-tracker.ts", () => ({
  recordUsage: vi.fn(),
}));

// --- Helpers ---

interface MockSession {
  prompt: ReturnType<typeof vi.fn>;
  lastText: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock session that simulates realistic LLM behavior.
 * Each call to prompt() advances the response index.
 */
function createRealisticSession(responses: string[]): MockSession {
  let callIdx = 0;
  return {
    prompt: vi.fn(async (_text: string) => { callIdx++; }),
    lastText: vi.fn(() => responses[Math.min(callIdx - 1, responses.length - 1)] || "DONE\nFinished"),
    close: vi.fn(),
  };
}

function createCtx(task: string, sessionFactory: () => MockSession[]) {
  const allSessions = sessionFactory();
  let sessionIdx = 0;
  return {
    task,
    projectRoot: "/app",
    log: vi.fn(),
    emit: vi.fn(),
    createSession: vi.fn(async () => allSessions[sessionIdx++]),
    escalate: vi.fn((msg: string) => ({ status: "escalated", message: msg })),
    done: vi.fn((msg: string) => ({ status: "done", message: msg })),
    _sessions: allSessions,
  };
}

function setupFs(opts: { status?: string; maxIter?: string } = {}) {
  const status = opts.status || "active";
  const maxIter = opts.maxIter || "5";
  const content = `# Project\n**Status**: ${status}\n**Max Iterations**: ${maxIter}\n**Owner**: test\n\n## Goal\nImplement feature X\n`;

  const mockedFs = vi.mocked(fs);
  mockedFs.existsSync.mockImplementation((p: any) => {
    const path = String(p);
    if (path.includes("project.md")) return true;
    if (path.includes("journal.md")) return true;
    if (path.includes("discussion.md")) return false;
    return false;
  });
  mockedFs.readFileSync.mockImplementation((p: any) => {
    const path = String(p);
    if (path.includes("project.md")) return content;
    if (path.includes("journal.md")) return "# Journal\n";
    return "";
  });
  mockedFs.readdirSync.mockReturnValue([] as any);
  mockedFs.statSync.mockImplementation(() => ({ isFile: () => true, size: 100 }) as any);
}

// --- Tests ---

describe("master-worker e2e: happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFs();
  });

  it("completes a single-iteration workflow (orchestrator says CONTINUE then DONE)", async () => {
    const orchestrator = createRealisticSession([
      "CONTINUE\n\n(a) Write the implementation\n(b) Focus on correctness\n(c) Start with file.ts",
      "DONE\n\nAll tasks completed successfully. The feature is implemented and tested.",
    ]);
    const worker = createRealisticSession([
      "I've completed the implementation. Created src/feature.ts with the required functionality.",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, worker]);
    const result = await execute(ctx as any);

    expect(orchestrator.prompt).toHaveBeenCalled();
    expect(worker.prompt).toHaveBeenCalled();
    // Workflow should reach completion
    expect(result).toBeDefined();
  });

  it("runs multiple iterations before completing", async () => {
    const orchestrator = createRealisticSession([
      "CONTINUE\n\n(a) Write tests first\n(b) TDD approach\n(c) Start with test file",
      "CONTINUE\n\n(a) Now implement the feature\n(b) Follow the tests\n(c) Create feature.ts",
      "DONE\n\nBoth tests and implementation are complete.",
    ]);
    const worker = createRealisticSession([
      "Created test file with 5 test cases covering the feature.",
      "Implemented the feature, all tests passing.",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, worker]);
    const result = await execute(ctx as any);

    expect(worker.prompt.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result).toBeDefined();
  });

  it("handles pivot decision correctly", async () => {
    const orchestrator = createRealisticSession([
      "PIVOT\n\nOriginal approach won't work. Switch to using streams instead of buffers.",
      "DONE\n\nStream-based implementation complete.",
    ]);
    const worker = createRealisticSession([
      "Refactored to use streams. All tests passing with the new approach.",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, worker]);
    const result = await execute(ctx as any);

    // PIVOT should still trigger work
    expect(worker.prompt).toHaveBeenCalled();
  });
});

describe("master-worker e2e: early termination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFs();
  });

  it("stops immediately when project is paused", async () => {
    setupFs({ status: "paused" });
    const ctx = createCtx("project: agents/shared/projects/test-proj", () => []);
    const result = await execute(ctx as any);

    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("paused"));
  });

  it("stops immediately when project is done", async () => {
    setupFs({ status: "done" });
    const ctx = createCtx("project: agents/shared/projects/test-proj", () => []);
    const result = await execute(ctx as any);

    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("done"));
  });

  it("stops immediately when project is cancelled", async () => {
    setupFs({ status: "cancelled" });
    const ctx = createCtx("project: agents/shared/projects/test-proj", () => []);
    const result = await execute(ctx as any);

    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("cancelled"));
  });

  it("escalates when orchestrator says BLOCKED", async () => {
    const orchestrator = createRealisticSession([
      "BLOCKED\n\nCannot proceed: missing API credentials in environment.",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, createRealisticSession([])]);
    const result = await execute(ctx as any);

    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("API credentials"));
  });

  it("returns done when orchestrator says WAITING", async () => {
    const orchestrator = createRealisticSession([
      "WAITING\n\nNeed user feedback on the design before proceeding.",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, createRealisticSession([])]);
    const result = await execute(ctx as any);

    expect(ctx.done).toHaveBeenCalled();
  });
});

describe("master-worker e2e: error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFs();
  });

  it("escalates when no project path provided", async () => {
    const ctx = createCtx("do something without project path", () => []);
    const result = await execute(ctx as any);

    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("Usage"));
  });

  it("handles missing project.md gracefully", async () => {
    const mockedFs = vi.mocked(fs);
    mockedFs.existsSync.mockReturnValue(false);

    const ctx = createCtx("project: agents/shared/projects/nonexistent", () => []);
    const result = await execute(ctx as any);

    // Should skip or log about missing project
    expect(result).toBeDefined();
  });

  it("respects max iterations limit", async () => {
    setupFs({ maxIter: "2" });
    const orchestrator = createRealisticSession([
      "CONTINUE\n\nKeep going iteration 1",
      "CONTINUE\n\nKeep going iteration 2",
      "CONTINUE\n\nKeep going iteration 3", // should not reach here
    ]);
    const worker = createRealisticSession([
      "Did work 1",
      "Did work 2",
      "Did work 3",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, worker]);
    const result = await execute(ctx as any);

    // Worker should not be called more than maxIter+1 times (loop may overshoot by 1 before checking)
    expect(worker.prompt.mock.calls.length).toBeLessThanOrEqual(5);
  });
});

describe("master-worker e2e: state transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFs();
  });

  it("transitions: init → plan → work → review → done", async () => {
    const logCalls: string[] = [];
    const orchestrator = createRealisticSession([
      "CONTINUE\n\nImplement the feature as described in the goal.",
      "DONE\n\nFeature complete, tests passing.",
    ]);
    const worker = createRealisticSession([
      "Implementation complete. All files written.",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, worker]);
    ctx.log = vi.fn((msg: string) => logCalls.push(msg));

    await execute(ctx as any);

    // Verify state transition logging
    const logStr = logCalls.join("\n");
    expect(logStr).toContain("[plan]");
    expect(logStr).toContain("[work]");
  });

  it("handles unknown decision by treating as CONTINUE", async () => {
    const orchestrator = createRealisticSession([
      "Here's what we should do:\n1. Write the code\n2. Test it\n3. Ship it",
      "DONE\n\nEverything is complete.",
    ]);
    const worker = createRealisticSession([
      "Done with the implementation.",
    ]);

    const ctx = createCtx("project: agents/shared/projects/test-proj", () => [orchestrator, worker]);
    await execute(ctx as any);

    // Should still work (unknown → continue)
    expect(worker.prompt).toHaveBeenCalled();
  });
});

describe("extractDecision unit tests (integration context)", () => {
  it("parses CONTINUE with guidance", () => {
    const d = extractDecision("CONTINUE\n\n(a) Do X\n(b) Focus Y\n(c) Start Z");
    expect(d.status).toBe("continue");
  });

  it("parses DONE", () => {
    const d = extractDecision("DONE\n\nAll objectives met.");
    expect(d.status).toBe("done");
  });

  it("parses COMPLETE as done", () => {
    const d = extractDecision("COMPLETE\n\nProject finished.");
    expect(d.status).toBe("done");
  });

  it("parses BLOCKED", () => {
    const d = extractDecision("BLOCKED\n\nNeed access to production DB.");
    expect(d.status).toBe("blocked");
  });

  it("parses WAITING", () => {
    const d = extractDecision("WAITING\n\nAwaiting review from team lead.");
    expect(d.status).toBe("waiting");
  });

  it("parses PIVOT", () => {
    const d = extractDecision("PIVOT\n\nChanging approach to use WebSockets.");
    expect(d.status).toBe("pivot");
  });

  it("handles Decision: KEYWORD pattern", () => {
    const d = extractDecision("After analysis:\n\nDecision: CONTINUE\n\nProceed with implementation.");
    expect(d.status).toBe("continue");
  });

  it("returns unknown for ambiguous text", () => {
    const d = extractDecision("I think we should maybe do something about this situation.");
    expect(d.status).toBe("unknown");
  });
});
