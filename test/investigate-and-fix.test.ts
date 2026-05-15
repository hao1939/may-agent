import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import the workflow directly
import { execute, name, description } from "../app/agents/optimizer/workflows/investigate-and-fix.js";
import type { WorkflowContext, WorkflowResult, WorkflowEvent } from "../src/lib/workflow.js";
import type { TaskResult } from "../src/lib/types.js";

// ── Test fixtures ──────────────────────────────────────────────────────

let testDir: string;

function freshDir(): string {
  const dir = join(tmpdir(), `inv-fix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

function makeTaskResult(
  text: string,
  opts: {
    status?: "done" | "error";
    writtenFiles?: Array<{ path: string; tool: "write" | "edit" }>;
  } = {},
): TaskResult {
  const { status = "done", writtenFiles = [] } = opts;

  // Build messages that mimic real tool call/result patterns
  const messages: any[] = [];
  if (writtenFiles.length > 0) {
    // Assistant message with tool calls
    const toolCalls = writtenFiles.map((f) => ({
      type: "toolCall",
      name: f.tool,
      arguments: { path: f.path },
    }));
    messages.push({ role: "assistant", content: toolCalls });

    // Tool results
    const results = writtenFiles.map((f) =>
      f.tool === "write"
        ? { type: "text", text: `Wrote 500 bytes to ${f.path} (20 lines)` }
        : { type: "text", text: `Edit applied to ${f.path} (line 10)` },
    );
    messages.push({ role: "toolResult", content: results });
  }

  // Final assistant message
  messages.push({
    role: "assistant",
    content: [{ type: "text", text }],
  });

  return {
    sessionId: `s_test_${Date.now()}`,
    status,
    lastAssistantText: text,
    messages,
    duration: "5s",
    outputDir: testDir,
    turnsUsed: 3,
    ...(status === "error" ? { error: "agent failed" } : {}),
  };
}

interface MockCtxOptions {
  task: string;
  agentResponses: Array<{
    text: string;
    status?: "done" | "error";
    writtenFiles?: Array<{ path: string; tool: "write" | "edit" }>;
  }>;
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
    agent: "optimizer",

    runAgent: async (agentName: string, task: string): Promise<TaskResult> => {
      agentCalls.push({ name: agentName, task });
      const response = opts.agentResponses[callIndex] ?? { text: "Default response" };
      callIndex++;
      return makeTaskResult(response.text, {
        status: response.status,
        writtenFiles: response.writtenFiles,
      });
    },

    runWorkflow: async (_name: string, _task: string): Promise<WorkflowResult> => {
      return { type: "done", summary: "sub-workflow done" };
    },

    emit: (event: WorkflowEvent) => {
      events.push(event);
    },

    done: (summary: string): WorkflowResult => ({
      type: "done",
      summary,
    }),

    escalate: (reason: string, details?: Record<string, any>): WorkflowResult => ({
      type: "escalated",
      reason,
      ...(details ? { details } : {}),
    }),

    summarize: (result: TaskResult, _opts?: any): string => {
      return result.lastAssistantText ?? "(no text)";
    },
  };

  return { ctx, events, agentCalls };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("investigate-and-fix workflow", () => {
  it("exports correct name and description", () => {
    expect(name).toBe("investigate-and-fix");
    expect(description).toBeTruthy();
    expect(description).toContain("investigate");
    expect(description).toContain("fix");
    expect(description).toContain("verify");
  });

  it("runs 3 phases: investigate → fix → verify", async () => {
    const findingPath = join(testDir, "finding-test.md");
    const fixPath = join(testDir, "heartbeat-fixed.md");

    // Create the files that the agent would produce
    writeFileSync(findingPath, "# Finding: Test issue\n\n## Recommendations\nR1: Fix the thing\n");
    writeFileSync(fixPath, "# Fixed heartbeat\nThis file was actually changed.\n");

    const { ctx, agentCalls } = createMockContext({
      task: "Investigate test issue",
      agentResponses: [
        {
          text: "Found the issue. R1: Edit heartbeat.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
        {
          text: "Applied the fix to heartbeat.",
          writtenFiles: [{ path: fixPath, tool: "edit" }],
        },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect(agentCalls).toHaveLength(2);
    expect(agentCalls[0].name).toBe("optimizer");
    expect(agentCalls[0].task).toContain("Phase 1: INVESTIGATE");
    expect(agentCalls[1].name).toBe("optimizer");
    expect(agentCalls[1].task).toContain("Phase 2: EXECUTE THE FIX");
  });

  it("escalates when Phase 1 fails", async () => {
    const { ctx, agentCalls } = createMockContext({
      task: "Investigate failing thing",
      agentResponses: [
        { text: "Error occurred", status: "error" },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalated");
    expect(result.reason).toContain("Phase 1");
    expect(agentCalls).toHaveLength(1); // Only Phase 1 was attempted
  });

  it("accepts NO_ACTION_NEEDED with a finding file", async () => {
    const findingPath = join(testDir, "finding-monitoring.md");
    writeFileSync(findingPath, "# Finding: All healthy\nNO_ACTION_NEEDED\n");

    const { ctx, agentCalls } = createMockContext({
      task: "Check workflow health",
      agentResponses: [
        {
          text: "All metrics healthy. NO_ACTION_NEEDED — workflows at 99% success rate.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect(result.summary).toContain("no action needed");
    expect(agentCalls).toHaveLength(1); // Only Phase 1, no Phase 2
  });

  it("escalates NO_ACTION_NEEDED without a finding file", async () => {
    const { ctx } = createMockContext({
      task: "Check workflow health",
      agentResponses: [
        {
          text: "Everything looks fine. NO_ACTION_NEEDED",
          // No files written!
        },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalated");
    expect(result.reason).toContain("didn't write a finding file");
  });

  it("accepts DISPATCH-READY with a finding file", async () => {
    const findingPath = join(testDir, "finding-dispatch.md");
    writeFileSync(findingPath, "# Finding: Coach needs fix\nDISPATCH-READY\n");

    const { ctx, agentCalls } = createMockContext({
      task: "Investigate coach op usage",
      agentResponses: [
        {
          text: "Coach needs heartbeat rewrite. DISPATCH-READY to tech-lead.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect(result.summary).toContain("dispatched");
    expect(agentCalls).toHaveLength(1);
  });

  it("escalates when Phase 2 fails", async () => {
    const findingPath = join(testDir, "finding-test.md");
    writeFileSync(findingPath, "# Finding\n## Recommendations\nR1: Fix it\n");

    const { ctx, agentCalls } = createMockContext({
      task: "Investigate and fix",
      agentResponses: [
        {
          text: "Found issue. R1: Fix the config.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
        { text: "Failed to apply fix", status: "error" },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalated");
    expect(result.reason).toContain("Phase 2");
    expect(agentCalls).toHaveLength(2);
  });

  it("escalates when Phase 2 writes no new files (just more docs)", async () => {
    const findingPath = join(testDir, "finding-test.md");
    writeFileSync(findingPath, "# Finding\n## Recommendations\nR1: Fix it\n");

    const { ctx } = createMockContext({
      task: "Investigate and fix",
      agentResponses: [
        {
          text: "Found issue.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
        {
          text: "Here's my plan for the fix...",
          writtenFiles: [{ path: findingPath, tool: "edit" }], // Same file!
        },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalated");
    expect(result.reason).toContain("did not modify any files beyond");
  });

  it("escalates when fix file doesn't exist on disk", async () => {
    const findingPath = join(testDir, "finding-test.md");
    const ghostPath = join(testDir, "ghost-file.md");
    writeFileSync(findingPath, "# Finding\n");
    // ghostPath NOT created — simulating a write that was claimed but didn't happen

    const { ctx } = createMockContext({
      task: "Investigate and fix",
      agentResponses: [
        {
          text: "Found issue.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
        {
          text: "Applied fix.",
          writtenFiles: [{ path: ghostPath, tool: "write" }],
        },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("escalated");
    expect(result.reason).toContain("missing or empty");
  });

  it("succeeds when fix produces real files", async () => {
    const findingPath = join(testDir, "finding-test.md");
    const fixPath1 = join(testDir, "heartbeat.md");
    const fixPath2 = join(testDir, "config.json");

    writeFileSync(findingPath, "# Finding: Config issue\n## Recommendations\nR1: Update config\n");
    writeFileSync(fixPath1, "# Updated heartbeat\nWith real content that proves the fix was applied.\n");
    writeFileSync(fixPath2, '{"setting": "fixed", "value": 42}\n');

    const { ctx } = createMockContext({
      task: "Fix config issue",
      agentResponses: [
        {
          text: "Found config issue.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
        {
          text: "Applied fix to heartbeat and config.",
          writtenFiles: [
            { path: fixPath1, tool: "edit" },
            { path: fixPath2, tool: "write" },
          ],
        },
      ],
    });

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect(result.summary).toContain("Phase 1: Finding");
    expect(result.summary).toContain("Phase 2: Fix applied");
    expect(result.summary).toContain("Phase 3: Verification");
    expect(result.summary).toContain("✅");
  });

  it("emits step events for all 3 phases", async () => {
    const findingPath = join(testDir, "finding.md");
    const fixPath = join(testDir, "fix.md");
    writeFileSync(findingPath, "# Finding\n");
    writeFileSync(fixPath, "# Fix\nActual content.\n");

    const { ctx, events } = createMockContext({
      task: "Test events",
      agentResponses: [
        {
          text: "Found it.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
        {
          text: "Fixed it.",
          writtenFiles: [{ path: fixPath, tool: "write" }],
        },
      ],
    });

    await execute(ctx);

    const stepStarts = events.filter((e: any) => e.type === "step_start").map((e: any) => e.step);
    expect(stepStarts).toContain("phase1-investigate");
    expect(stepStarts).toContain("phase2-fix");
    expect(stepStarts).toContain("phase3-verify");
  });

  it("passes the original task into Phase 1", async () => {
    const findingPath = join(testDir, "finding.md");
    writeFileSync(findingPath, "# Finding\n");

    const { ctx, agentCalls } = createMockContext({
      task: "Mode D: Check workflow adoption rates",
      agentResponses: [
        {
          text: "NO_ACTION_NEEDED — all good.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
      ],
    });

    await execute(ctx);

    expect(agentCalls[0].task).toContain("Mode D: Check workflow adoption rates");
  });

  it("passes Phase 1 summary into Phase 2", async () => {
    const findingPath = join(testDir, "finding.md");
    const fixPath = join(testDir, "fix.md");
    writeFileSync(findingPath, "# Finding\n");
    writeFileSync(fixPath, "# Fix applied\nReal content.\n");

    const { ctx, agentCalls } = createMockContext({
      task: "Investigate coach ops",
      agentResponses: [
        {
          text: "Coach averaging 46 ops. R1: Add budget cap to heartbeat.md.",
          writtenFiles: [{ path: findingPath, tool: "write" }],
        },
        {
          text: "Added budget cap.",
          writtenFiles: [{ path: fixPath, tool: "edit" }],
        },
      ],
    });

    await execute(ctx);

    // Phase 2 should contain the Phase 1 findings
    expect(agentCalls[1].task).toContain("Coach averaging 46 ops");
    expect(agentCalls[1].task).toContain("Execute your TOP recommendation");
  });
});
