import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { execute, name, description } from "../workflows/master-worker.ts";

// Mock fs. Keep this factory synchronous for Bun's Vitest-compatible runner;
// `vi.importActual` is not available there, and master-worker only needs these
// named fs functions in this test file.
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock dependencies
vi.mock("../workflows/dispatch-validator.ts", () => ({
  validateDispatch: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock("../workflows/incremental-checkpoint.ts", () => ({
  saveIncrementalCheckpoint: vi.fn(),
  detectIncompleteCheckpoint: vi.fn(() => null),
  markCheckpointComplete: vi.fn(),
  cleanupCheckpoints: vi.fn(),
}));

vi.mock("../workflows/output-validator.ts", () => ({
  validateOutput: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
}));

vi.mock("../workflows/provider-retry.ts", () => ({
  withRetry: vi.fn(async (fn: () => any) => {
    try {
      const value = await fn();
      return { success: true, value, attempts: 1, totalDelayMs: 0 };
    } catch (error) {
      return { success: false, error, attempts: 1, totalDelayMs: 0 };
    }
  }),
  isRetryableError: vi.fn(() => false),
}));

vi.mock("../workflows/worker-retry.ts", () => ({
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

vi.mock("../workflows/project-helpers.ts", () => ({
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

const { validateDispatch } = await import("../workflows/dispatch-validator.ts");
const { detectIncompleteCheckpoint, markCheckpointComplete } = await import("../workflows/incremental-checkpoint.ts");
const { validateOutput } = await import("../workflows/output-validator.ts");
const { updateProjectStatus } = await import("../workflows/project-helpers.ts");

function createMockSession(responses: string[]) {
  let callIdx = 0;
  return {
    prompt: vi.fn(async () => { callIdx++; }),
    lastText: vi.fn(() => responses[Math.min(callIdx - 1, responses.length - 1)] || "CONTINUE\nDo more work"),
    close: vi.fn(),
  };
}

function createMockCtx(task: string) {
  const sessions: any[] = [];
  return {
    task,
    projectRoot: "/app",
    log: vi.fn(),
    emit: vi.fn(),
    createSession: vi.fn(async () => {
      const idx = sessions.length;
      // Default: orchestrator says CONTINUE once then BLOCKED
      const s = createMockSession(
        idx === 0
          ? ["CONTINUE\n\n(a) Do the work\n(b) Focus\n(c) Start", "BLOCKED\n\nAll done"]
          : ["Done with the work, created file"]
      );
      sessions.push(s);
      return s;
    }),
    escalate: vi.fn((msg: string) => ({ status: "escalated", message: msg })),
    done: vi.fn((msg: string) => ({ status: "done", message: msg })),
    sessions,
  };
}

function setupProjectFs(overrides: { status?: string; maxIter?: string; projectContent?: string } = {}) {
  const status = overrides.status || "active";
  const maxIter = overrides.maxIter || "5";
  const content = overrides.projectContent || `# Project
**Status**: ${status}
**Max Iterations**: ${maxIter}
**Owner**: test

## Goal
Test the system
`;

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

  return content;
}

describe("master-worker module exports", () => {
  it("exports name and description", () => {
    expect(name).toBe("master-worker");
    expect(description).toContain("Two-session");
  });
});

describe("execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when no project: in task", async () => {
    const ctx = createMockCtx("do something");
    const result = await execute(ctx as any);
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("Usage"));
  });

  it("rejects when dispatch validation fails", async () => {
    vi.mocked(validateDispatch).mockReturnValueOnce({ valid: false, errors: ["bad dispatch"] } as any);
    setupProjectFs();
    const ctx = createMockCtx("project: agents/shared/projects/test");
    const result = await execute(ctx as any);
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("Dispatch validation failed"));
  });

  it("rejects when project.md does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const ctx = createMockCtx("project: agents/shared/projects/test");
    const result = await execute(ctx as any);
    expect(result).toEqual(expect.objectContaining({ status: "skipped", reason: "project-not-found" }));
  });

  it("skips paused projects", async () => {
    setupProjectFs({ status: "paused" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    const result = await execute(ctx as any);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("paused"));
  });

  it("skips cancelled projects", async () => {
    setupProjectFs({ status: "cancelled" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    const result = await execute(ctx as any);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("cancelled"));
  });

  it("skips closed projects with no unread comments", async () => {
    setupProjectFs({ status: "closed" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    const result = await execute(ctx as any);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("closed"));
  });

  it("proceeds with closed project when unread comments exist", async () => {
    const mockedFs = vi.mocked(fs);
    setupProjectFs({ status: "closed" });
    // Override existsSync for discussion.md
    mockedFs.existsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("discussion.md")) return true;
      if (path.includes("project.md")) return true;
      if (path.includes("journal.md")) return true;
      return false;
    });
    mockedFs.readFileSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("discussion.md")) return "# Discussion\nHey, please check this\n";
      if (path.includes("project.md")) return `# Project\n**Status**: closed\n**Max Iterations**: 2\n**Owner**: test\n\n## Goal\nTest`;
      if (path.includes("journal.md")) return "# Journal\n";
      return "";
    });

    const ctx = createMockCtx("project: agents/shared/projects/test");
    await execute(ctx as any);
    // Should NOT return early with "closed" — should proceed to create sessions
    expect(ctx.createSession).toHaveBeenCalled();
  });

  it("creates orchestrator and worker sessions", async () => {
    setupProjectFs();
    const ctx = createMockCtx("project: agents/shared/projects/test");
    await execute(ctx as any);
    expect(ctx.createSession).toHaveBeenCalledTimes(2);
    expect(ctx.createSession).toHaveBeenCalledWith(expect.objectContaining({ label: "orchestrator" }));
    expect(ctx.createSession).toHaveBeenCalledWith(expect.objectContaining({ label: "worker" }));
  });

  it("injects workflow-collected live runtime signals into planning prompt", async () => {
    setupProjectFs({ maxIter: "1" });
    const ctx = createMockCtx("project: agents/shared/projects/test") as any;
    ctx.getDb = vi.fn(() => ({
      prepare: vi.fn((sql: string) => ({
        all: vi.fn(() => {
          if (sql.includes("FROM metric_alerts")) {
            return [{
              id: 9,
              metricId: "telegram.delivery",
              message: "Delivery stalled",
              createdAt: 1778210000000,
              metricName: "Telegram delivery",
              owner: "may",
              priority: "P1",
              current: 1,
              target: 0,
              threshold: 0,
            }];
          }
          return [{
            id: "system.loop-closed-rate",
            name: "Loop closed rate",
            owner: "may",
            priority: "P1",
            current: 0.8,
            target: 0.9,
            threshold: 0.7,
            alertOp: "<",
          }];
        }),
        get: vi.fn(() => ({ current: 1 })),
      })),
    }));
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["DONE\n\nNo immediate operation"]);
      return createMockSession(["work"]);
    });

    await execute(ctx);

    const orchestrator = ctx.createSession.mock.results[0].value ? await ctx.createSession.mock.results[0].value : null;
    expect(orchestrator.prompt).toHaveBeenCalledWith(expect.stringContaining("## Live Runtime Signals (workflow-collected)"));
    expect(orchestrator.prompt).toHaveBeenCalledWith(expect.stringContaining("Status: available"));
    expect(orchestrator.prompt).toHaveBeenCalledWith(expect.stringContaining("system.loop-closed-rate"));
    expect(orchestrator.prompt).toHaveBeenCalledWith(expect.stringContaining("telegram.delivery"));
  });

  it("closes sessions in finally block", async () => {
    setupProjectFs();
    const ctx = createMockCtx("project: agents/shared/projects/test");
    await execute(ctx as any);
    // Both sessions should be closed
    for (const s of ctx.sessions) {
      expect(s.close).toHaveBeenCalled();
    }
  });

  it("handles BLOCKED from orchestrator planning phase", async () => {
    setupProjectFs();
    const ctx = createMockCtx("project: agents/shared/projects/test");
    // Override orchestrator to return BLOCKED immediately
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession(["BLOCKED\n\nNeed API credentials"]);
      }
      return createMockSession(["work done"]);
    });
    await execute(ctx as any);
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("Need API credentials"));
    expect(updateProjectStatus).toHaveBeenCalledWith(expect.any(String), "blocked", expect.any(String));
  });

  it("handles WAITING from orchestrator planning phase", async () => {
    setupProjectFs();
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession(["WAITING\n\nNeed human approval"]);
      }
      return createMockSession(["work done"]);
    });
    await execute(ctx as any);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("waiting"));
  });

  it("refuses DONE in planning when project.md still has unchecked tasks", async () => {
    setupProjectFs({
      maxIter: "1",
      projectContent: `# Project
**Status**: active
**Max Iterations**: 1
**Owner**: test

## Goal
Close the loop

## Plan
- [ ] Validate follow-up alert handling
`,
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    let worker: ReturnType<typeof createMockSession> | undefined;
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "DONE\n\nEverything is complete",
          "BLOCKED\n\nFollow-up still pending",
        ]);
      }
      worker = createMockSession(["Checked pending work"]);
      return worker;
    });

    await execute(ctx as any);

    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("DONE refused"));
    expect(worker?.prompt).toHaveBeenCalledWith(expect.stringContaining("DONE refused"));
    expect(updateProjectStatus).not.toHaveBeenCalledWith(expect.any(String), "closed", expect.any(String));
  });

  it("keeps project active when planning says DONE with no pending tasks", async () => {
    setupProjectFs({
      projectContent: `# Project
**Status**: active
**Max Iterations**: 1
**Owner**: test

## Goal
Maintain the loop

## Plan
- [x] Validate current signal
`,
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["DONE\n\nNo immediate operation"]);
      return createMockSession(["work"]);
    });

    await execute(ctx as any);

    expect(updateProjectStatus).toHaveBeenCalledWith(expect.any(String), "active", undefined);
    expect(updateProjectStatus).not.toHaveBeenCalledWith(expect.any(String), "closed", expect.anything());
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("done"));
  });

  it("treats unknown decision as CONTINUE in planning phase", async () => {
    setupProjectFs({ maxIter: "1" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        // First call: no keyword (unknown → treated as continue)
        // Second call (review): BLOCKED to stop
        return createMockSession(["Do the implementation work", "BLOCKED\n\nDone"]);
      }
      return createMockSession(["Created the file"]);
    });
    await execute(ctx as any);
    // Should have proceeded to work phase (worker session was prompted)
    const workerSession = ctx.sessions.find((_: any, i: number) => i === 1);
    // The ctx.log should show "treating as CONTINUE"
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("treating as CONTINUE"));
  });

  it("treats unclear planning as DONE when all task-list items are complete", async () => {
    setupProjectFs({
      projectContent: `# Project
**Status**: active
**Max Iterations**: 1
**Owner**: test

## Goal
Maintain the loop

## Plan
- [x] Verify current state
`,
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["Looks fine. No immediate work."]);
      return createMockSession(["work"]);
    });

    await execute(ctx as any);

    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Unknown decision treated as DONE"));
    expect(updateProjectStatus).toHaveBeenCalledWith(expect.any(String), "active", undefined);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("done"));
  });

  it("runs work-review loop with CONTINUE then stops", async () => {
    setupProjectFs({ maxIter: "2" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    let orchCallCount = 0;
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "CONTINUE\n\nDo iteration 1",  // planning
          "CONTINUE\n\nDo iteration 2",  // review 1
          "BLOCKED\n\nAll done",          // review 2 (won't reach due to maxIter)
        ]);
      }
      return createMockSession(["Created output files"]);
    });
    await execute(ctx as any);
    // Should have run up to 2 iterations
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Iteration 1"));
  });

  it("refuses DONE in review when project.md still has unchecked tasks", async () => {
    setupProjectFs({
      maxIter: "2",
      projectContent: `# Project
**Status**: active
**Max Iterations**: 2
**Owner**: test

## Goal
Close the loop

## Plan
- [ ] Revalidate alert ownership
`,
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    let worker: ReturnType<typeof createMockSession> | undefined;
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "CONTINUE\n\nInspect the pending item",
          "DONE\n\nProject complete",
          "BLOCKED\n\nPending item needs evidence",
        ]);
      }
      worker = createMockSession(["Worker output"]);
      return worker;
    });

    await execute(ctx as any);

    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("DONE refused"));
    expect(worker?.prompt).toHaveBeenLastCalledWith(expect.stringContaining("DONE refused"));
    expect(updateProjectStatus).not.toHaveBeenCalledWith(expect.any(String), "closed", expect.any(String), expect.any(Number));
  });

  it("keeps project active when review says DONE with no pending tasks", async () => {
    setupProjectFs({
      maxIter: "1",
      projectContent: `# Project
**Status**: active
**Max Iterations**: 1
**Owner**: test

## Goal
Maintain the loop

## Plan
- [x] Validate current signal
`,
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "CONTINUE\n\nCheck current state",
          "DONE\n\nNo immediate operation",
        ]);
      }
      return createMockSession(["Worker output"]);
    });

    await execute(ctx as any);

    expect(updateProjectStatus).toHaveBeenCalledWith(expect.any(String), "active", undefined, 1);
    expect(updateProjectStatus).not.toHaveBeenCalledWith(expect.any(String), "closed", expect.anything(), expect.any(Number));
  });

  it("treats unclear review as DONE when all task-list items are complete", async () => {
    setupProjectFs({
      maxIter: "2",
      projectContent: `# Project
**Status**: active
**Max Iterations**: 2
**Owner**: test

## Goal
Maintain the loop

## Plan
- [x] Verify current state
`,
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "CONTINUE\n\nCheck current state",
          "Looks fine. No immediate work.",
        ]);
      }
      return createMockSession(["Worker output"]);
    });

    await execute(ctx as any);

    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Unknown decision treated as DONE"));
    expect(updateProjectStatus).toHaveBeenCalledWith(expect.any(String), "active", undefined, 1);
    expect(updateProjectStatus).not.toHaveBeenCalledWith(expect.any(String), "closed", expect.anything(), expect.any(Number));
  });


  it("recreates worker once after Clean start (fresh) provider failure", async () => {
    setupProjectFs({ maxIter: "1" });
    const mockedFs = vi.mocked(fs);
    let snapCalls = 0;
    mockedFs.existsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("outputs")) return true;
      if (path.includes("project.md")) return true;
      if (path.includes("journal.md")) return true;
      return false;
    });
    mockedFs.readdirSync.mockImplementation(() => {
      snapCalls++;
      if (snapCalls <= 1) return [] as any;
      return [{ name: "recovered.md", isFile: () => true, isDirectory: () => false }] as any;
    });
    mockedFs.statSync.mockReturnValue({ mtimeMs: 2000, size: 500 } as any);
    mockedFs.readFileSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("recovered.md")) return "recovered output";
      if (path.includes("project.md")) return `# Project\n**Status**: active\n**Max Iterations**: 1\n**Owner**: test\n\n## Goal\nTest`;
      if (path.includes("journal.md")) return "# Journal\n";
      return "";
    });

    const ctx = createMockCtx("project: agents/shared/projects/test");
    const firstWorker = {
      prompt: vi.fn(async () => { throw new Error("Clean start (fresh)"); }),
      lastText: vi.fn(() => ""),
      close: vi.fn(),
    };
    const freshWorker = createMockSession(["Created recovered.md"]);
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["CONTINUE\n\nWrite recovered.md", "BLOCKED\n\nDone"]);
      return ctx.createSession.mock.calls.filter(([arg]: any[]) => arg.label === "worker").length === 1
        ? firstWorker
        : freshWorker;
    });

    await execute(ctx as any);

    expect(ctx.createSession).toHaveBeenCalledTimes(3);
    expect(firstWorker.close).toHaveBeenCalled();
    expect(freshWorker.prompt).toHaveBeenCalled();
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Worker session was reaped"));
  });

  it("handles zero output from worker and retries", async () => {
    setupProjectFs({ maxIter: "1" });
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "CONTINUE\n\nWrite a report",
          "BLOCKED\n\nWorker failed",
        ]);
      }
      return createMockSession(["I completed the task", "Retrying now"]);
    });
    await execute(ctx as any);
    // Should log warning about zero output
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("NO output files"));
    // Retry block removed — zero output now goes through review which returns BLOCKED
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("BLOCKED"));
  });

  it("detects incomplete checkpoint and resumes", async () => {
    setupProjectFs({ maxIter: "1" });
    vi.mocked(detectIncompleteCheckpoint).mockReturnValueOnce({
      sessionId: "old-session",
      iteration: 3,
      step: 1,
      timestamp: Date.now() - 60000,
      task: "old task",
      toolsCalled: [],
      partialResults: {},
      completed: false,
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession(["CONTINUE\n\nResume work", "BLOCKED\n\nDone"]);
      }
      return createMockSession(["Resumed and completed"]);
    });
    await execute(ctx as any);
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("incomplete checkpoint"));
    expect(markCheckpointComplete).toHaveBeenCalledWith(expect.any(String), "old-session");
  });

  it("creates journal.md if it doesn't exist", async () => {
    const mockedFs = vi.mocked(fs);
    setupProjectFs();
    mockedFs.existsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("project.md")) return true;
      if (path.includes("journal.md")) return false;
      return false;
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["BLOCKED\n\nDone"]);
      return createMockSession(["done"]);
    });
    await execute(ctx as any);
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining("journal.md"), "# Journal\n", "utf-8");
  });

  it("handles discussion.md with unread comments in planning", async () => {
    const mockedFs = vi.mocked(fs);
    setupProjectFs();
    mockedFs.existsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("project.md")) return true;
      if (path.includes("journal.md")) return true;
      if (path.includes("discussion.md")) return true;
      return false;
    });
    mockedFs.readFileSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("discussion.md")) return "# Discussion\n---read @plan---\nNew comment here\n";
      if (path.includes("project.md")) return `# Project\n**Status**: active\n**Max Iterations**: 1\n**Owner**: test\n\n## Goal\nTest`;
      if (path.includes("journal.md")) return "# Journal\n";
      return "";
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["BLOCKED\n\nHandled comment"]);
      return createMockSession(["done"]);
    });
    await execute(ctx as any);
    // Should append read marker
    expect(fs.appendFileSync).toHaveBeenCalledWith(expect.stringContaining("discussion.md"), expect.stringContaining("---read @"), "utf-8");
  });

  it("validates output files and rejects invalid ones", async () => {
    // This test verifies that when validateOutput returns invalid, the log shows "Rejected"
    // We need the snapshots to differ so files appear as "changed"
    setupProjectFs({ maxIter: "1" });
    const mockedFs = vi.mocked(fs);

    // snapshotOutputs reads dir. First call (before) returns empty, second (after) returns a file
    let snapCalls = 0;
    mockedFs.existsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("outputs")) return true;
      if (path.includes("project.md")) return true;
      if (path.includes("journal.md")) return true;
      return false;
    });
    mockedFs.readdirSync.mockImplementation((dir: any) => {
      snapCalls++;
      // First snapshot (before worker): empty. Second+ (after worker): has file
      if (snapCalls <= 1) return [] as any;
      return [{ name: "report.md", isFile: () => true, isDirectory: () => false }] as any;
    });
    mockedFs.statSync.mockImplementation(() => ({ mtimeMs: 2000, size: 500 } as any));
    mockedFs.readFileSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("report.md")) return "some content";
      if (path.includes("project.md")) return `# Project\n**Status**: active\n**Max Iterations**: 1\n**Owner**: test\n\n## Goal\nTest`;
      if (path.includes("journal.md")) return "# Journal\n";
      return "";
    });

    vi.mocked(validateOutput).mockReturnValue({ valid: false, errors: ["Empty file"], warnings: [] });

    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["CONTINUE\n\nWrite report", "BLOCKED\n\nDone"]);
      return createMockSession(["Created report"]);
    });
    await execute(ctx as any);
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("Rejected"));
  });

  it("stops at max iterations with safety cap message", async () => {
    setupProjectFs({ maxIter: "1" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "CONTINUE\n\nDo work",
          "CONTINUE\n\nKeep going", // review says continue but maxIter=1
        ]);
      }
      return createMockSession(["Done"]);
    });
    await execute(ctx as any);
    expect(updateProjectStatus).toHaveBeenCalledWith(
      expect.any(String), "blocked", expect.stringContaining("Safety cap"), 1
    );
  });

  it("handles review phase retry on error", async () => {
    vi.useFakeTimers();
    setupProjectFs({ maxIter: "1" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    let reviewCalls = 0;
    const orchSession = {
      prompt: vi.fn(async () => {
        reviewCalls++;
        if (reviewCalls === 2) throw new Error("API error");
      }),
      lastText: vi.fn(() => {
        if (reviewCalls <= 1) return "CONTINUE\n\nDo work";
        if (reviewCalls === 3) return "BLOCKED\n\nDone after retry";
        return "BLOCKED\n\nDone";
      }),
      close: vi.fn(),
    };
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return orchSession;
      return createMockSession(["Done"]);
    });
    const executePromise = execute(ctx as any);
    // Advance past all retry delays
    await vi.runAllTimersAsync();
    await executePromise;
    vi.useRealTimers();
    // Review should have retried
    expect(orchSession.prompt).toHaveBeenCalledTimes(3); // plan + review attempt 1 (fail) + review attempt 2
  });

  it("handles PIVOT decision in review", async () => {
    setupProjectFs({ maxIter: "2" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") {
        return createMockSession([
          "CONTINUE\n\nFirst approach",
          "PIVOT\n\nTry different approach",
          "BLOCKED\n\nDone pivoting",
        ]);
      }
      return createMockSession(["Work done"]);
    });
    await execute(ctx as any);
    // PIVOT should continue the loop
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("PIVOT"));
  });

  it("handles new comments during review phase", async () => {
    setupProjectFs({ maxIter: "1" });
    const mockedFs = vi.mocked(fs);
    let discReadCount = 0;
    mockedFs.existsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("discussion.md")) return true;
      if (path.includes("project.md")) return true;
      if (path.includes("journal.md")) return true;
      return false;
    });
    mockedFs.readFileSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path.includes("discussion.md")) {
        discReadCount++;
        // Planning reads: no new comments (already marked read)
        if (discReadCount <= 1) return "# Discussion\n---read @plan---\n";
        // Review reads: new comment appeared
        return "# Discussion\n---read @plan---\n---read @plan---\nNew review comment\n";
      }
      if (path.includes("project.md")) return `# Project\n**Status**: active\n**Max Iterations**: 1\n**Owner**: test\n\n## Goal\nTest`;
      if (path.includes("journal.md")) return "# Journal\n";
      return "";
    });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["CONTINUE\n\nWork", "BLOCKED\n\nDone"]);
      return createMockSession(["Done"]);
    });
    await execute(ctx as any);
    // Should mark review comments as read with iter marker
    const appendCalls = vi.mocked(fs.appendFileSync).mock.calls;
    const readMarkers = appendCalls.filter(c => String(c[1]).includes("---read @iter"));
    expect(readMarkers.length).toBeGreaterThanOrEqual(1);
  });

  it("emits iteration events", async () => {
    setupProjectFs({ maxIter: "1" });
    const ctx = createMockCtx("project: agents/shared/projects/test");
    ctx.createSession = vi.fn(async ({ label }: any) => {
      if (label === "orchestrator") return createMockSession(["CONTINUE\n\nWork", "BLOCKED\n\nDone"]);
      return createMockSession(["Done"]);
    });
    await execute(ctx as any);
    expect(ctx.emit).toHaveBeenCalledWith(expect.objectContaining({ type: "project.iteration" }));
  });
});
