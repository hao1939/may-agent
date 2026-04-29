import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractUsage,
  findUnevaluatedChildren,
  formatIsolatedTranscript,
  getAgentScoreSummary,
  evaluateTask,
  evaluateStandaloneSession,
} from "../evaluation/evaluator.js";
import type { EvalCtx, EvaluateTaskOptions } from "../evaluation/evaluator.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── extractUsage ──────────────────────────────────────────────────────

describe("extractUsage", () => {
  it("returns zeros for empty messages", () => {
    const result = extractUsage([]);
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      cost: 0,
      turns: 0,
    });
  });

  it("sums usage from assistant messages", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: "hello",
        usage: { input: 100, output: 50, cacheRead: 10, cacheWrite: 5, totalTokens: 165, cost: 0.01 },
      } as any,
      {
        role: "assistant",
        content: "world",
        usage: { input: 200, output: 100, cacheRead: 20, cacheWrite: 10, totalTokens: 330, cost: 0.02 },
      } as any,
    ];
    const result = extractUsage(messages);
    expect(result.inputTokens).toBe(300);
    expect(result.outputTokens).toBe(150);
    expect(result.cacheReadTokens).toBe(30);
    expect(result.cacheWriteTokens).toBe(15);
    expect(result.totalTokens).toBe(495);
    expect(result.cost).toBeCloseTo(0.03);
    expect(result.turns).toBe(2);
  });

  it("handles cost as object with total field", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: "hi",
        usage: { input: 50, output: 25, cacheRead: 0, cacheWrite: 0, totalTokens: 75, cost: { total: 0.005 } },
      } as any,
    ];
    const result = extractUsage(messages);
    expect(result.cost).toBeCloseTo(0.005);
  });

  it("ignores non-assistant messages", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hi" } as any,
      { role: "toolResult", content: [] } as any,
    ];
    const result = extractUsage(messages);
    expect(result.turns).toBe(0);
  });

  it("handles missing usage gracefully", () => {
    const messages: AgentMessage[] = [
      { role: "assistant", content: "no usage" } as any,
    ];
    const result = extractUsage(messages);
    expect(result.turns).toBe(1);
    expect(result.inputTokens).toBe(0);
  });
});

// ── formatIsolatedTranscript ──────────────────────────────────────────

describe("formatIsolatedTranscript", () => {
  it("includes first user message as task_specification", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "Do the thing" } as any,
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("## task_specification");
    expect(result).toContain("Do the thing");
  });

  it("excludes subsequent user messages", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "First" } as any,
      { role: "user", content: "Second" } as any,
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("First");
    expect(result).not.toContain("Second");
  });

  it("includes tool calls but strips text blocks from assistant", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "task" } as any,
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me think about this..." },
          { type: "toolCall", name: "bash", arguments: { command: "ls" }, id: "1" },
        ],
      } as any,
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).not.toContain("Let me think");
    expect(result).toContain("## tool_call: bash");
    expect(result).toContain("ls");
  });

  it("strips finish() self-narrative args, keeps status", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "task" } as any,
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "finish",
            arguments: { status: "success", summary: "I did great!", deliverables: ["file.ts"] },
            id: "1",
          },
        ],
      } as any,
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("## tool_call: finish");
    expect(result).toContain('"status":"success"');
    expect(result).not.toContain("I did great");
    expect(result).not.toContain("deliverables");
  });

  it("includes tool results", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "task" } as any,
      {
        role: "toolResult",
        toolName: "bash",
        content: [{ type: "text", text: "file1.ts\nfile2.ts" }],
      } as any,
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("## tool_result: bash");
    expect(result).toContain("file1.ts");
  });

  it("handles user content as array", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: [{ type: "text", text: "array content" }] } as any,
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("array content");
  });

  it("truncates long tool results", () => {
    const longText = "x".repeat(3000);
    const messages: AgentMessage[] = [
      { role: "user", content: "task" } as any,
      {
        role: "toolResult",
        toolName: "bash",
        content: [{ type: "text", text: longText }],
      } as any,
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("[truncated from 3000 chars]");
  });
});

// ── findUnevaluatedChildren ───────────────────────────────────────────

describe("findUnevaluatedChildren", () => {
  function makeCtx(evaluated: Set<string> = new Set()): EvalCtx {
    return {
      readSessionMessages: vi.fn().mockReturnValue([{ role: "user", content: "hi" }]),
      readArchivedSessionMessages: vi.fn().mockReturnValue([]),
      upsertEvaluation: vi.fn(),
      hasEvaluation: (id: string) => evaluated.has(id),
      hasLLMEvaluation: (id: string) => evaluated.has(id),
      getAllEvaluations: vi.fn().mockReturnValue([]),
    };
  }

  it("finds child sessions of the parent", () => {
    const ctx = makeCtx();
    const registry = {
      s1: { parentSessionId: "parent", agent: "worker", task: "do stuff", status: "completed" },
      s2: { parentSessionId: "other", agent: "worker", task: "other", status: "completed" },
    } as any;
    const result = findUnevaluatedChildren(ctx, registry, "parent", new Set());
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("s1");
  });

  it("skips already evaluated sessions", () => {
    const ctx = makeCtx(new Set(["s1"]));
    const registry = {
      s1: { parentSessionId: "parent", agent: "worker", task: "do stuff", status: "completed" },
    } as any;
    const result = findUnevaluatedChildren(ctx, registry, "parent", new Set());
    expect(result).toHaveLength(0);
  });

  it("skips running sessions", () => {
    const ctx = makeCtx();
    const registry = {
      s1: { parentSessionId: "parent", agent: "worker", task: "do stuff", status: "running" },
    } as any;
    const result = findUnevaluatedChildren(ctx, registry, "parent", new Set());
    expect(result).toHaveLength(0);
  });

  it("skips agents in skipAgents set", () => {
    const ctx = makeCtx();
    const registry = {
      s1: { parentSessionId: "parent", agent: "evaluator", task: "eval", status: "completed" },
    } as any;
    const result = findUnevaluatedChildren(ctx, registry, "parent", new Set(["evaluator"]));
    expect(result).toHaveLength(0);
  });

  it("falls back to archived messages if active is empty", () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn().mockReturnValue([]),
      readArchivedSessionMessages: vi.fn().mockReturnValue([{ role: "user", content: "archived" }]),
      upsertEvaluation: vi.fn(),
      hasEvaluation: () => false,
      hasLLMEvaluation: () => false,
      getAllEvaluations: vi.fn().mockReturnValue([]),
    };
    const registry = {
      s1: { parentSessionId: "parent", agent: "worker", task: "task", status: "completed" },
    } as any;
    const result = findUnevaluatedChildren(ctx, registry, "parent", new Set());
    expect(result).toHaveLength(1);
    expect(result[0].messages).toEqual([{ role: "user", content: "archived" }]);
  });

  it("skips sessions with no messages anywhere", () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn().mockReturnValue([]),
      readArchivedSessionMessages: vi.fn().mockReturnValue([]),
      upsertEvaluation: vi.fn(),
      hasEvaluation: () => false,
      hasLLMEvaluation: () => false,
      getAllEvaluations: vi.fn().mockReturnValue([]),
    };
    const registry = {
      s1: { parentSessionId: "parent", agent: "worker", task: "task", status: "completed" },
    } as any;
    const result = findUnevaluatedChildren(ctx, registry, "parent", new Set());
    expect(result).toHaveLength(0);
  });
});

// ── getAgentScoreSummary ──────────────────────────────────────────────

describe("getAgentScoreSummary", () => {
  it("computes average scores and trends", () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn(),
      readArchivedSessionMessages: vi.fn(),
      upsertEvaluation: vi.fn(),
      hasEvaluation: vi.fn(),
      hasLLMEvaluation: vi.fn(),
      getAllEvaluations: () => [
        { agent: "worker", efficiency: 0.5, quality: 0.8, verdict: "good" },
        { agent: "worker", efficiency: 0.7, quality: 0.9, verdict: "good" },
        { agent: "scout", efficiency: 0.3, quality: 0.4, verdict: "needs_improvement" },
      ],
    };
    const result = getAgentScoreSummary(ctx);
    expect(result.worker.avgEfficiency).toBeCloseTo(0.6);
    expect(result.worker.avgQuality).toBeCloseTo(0.85);
    expect(result.worker.count).toBe(2);
    expect(result.worker.verdicts.good).toBe(2);
    expect(result.scout.count).toBe(1);
  });

  it("returns empty for no evaluations", () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn(),
      readArchivedSessionMessages: vi.fn(),
      upsertEvaluation: vi.fn(),
      hasEvaluation: vi.fn(),
      hasLLMEvaluation: vi.fn(),
      getAllEvaluations: () => [],
    };
    const result = getAgentScoreSummary(ctx);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("detects improving trend", () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn(),
      readArchivedSessionMessages: vi.fn(),
      upsertEvaluation: vi.fn(),
      hasEvaluation: vi.fn(),
      hasLLMEvaluation: vi.fn(),
      getAllEvaluations: () => [
        { agent: "worker", efficiency: 0.2, quality: 0.5, verdict: "needs_improvement" },
        { agent: "worker", efficiency: 0.3, quality: 0.6, verdict: "acceptable" },
        { agent: "worker", efficiency: 0.5, quality: 0.7, verdict: "good" },
        { agent: "worker", efficiency: 0.8, quality: 0.9, verdict: "good" },
      ],
    };
    const result = getAgentScoreSummary(ctx);
    expect(result.worker.trend).toBe("improving");
  });

  it("detects declining trend", () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn(),
      readArchivedSessionMessages: vi.fn(),
      upsertEvaluation: vi.fn(),
      hasEvaluation: vi.fn(),
      hasLLMEvaluation: vi.fn(),
      getAllEvaluations: () => [
        { agent: "worker", efficiency: 0.9, quality: 0.9, verdict: "good" },
        { agent: "worker", efficiency: 0.8, quality: 0.8, verdict: "good" },
        { agent: "worker", efficiency: 0.3, quality: 0.4, verdict: "needs_improvement" },
        { agent: "worker", efficiency: 0.2, quality: 0.3, verdict: "needs_improvement" },
      ],
    };
    const result = getAgentScoreSummary(ctx);
    expect(result.worker.trend).toBe("declining");
  });

  it("skips entries with no agent name", () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn(),
      readArchivedSessionMessages: vi.fn(),
      upsertEvaluation: vi.fn(),
      hasEvaluation: vi.fn(),
      hasLLMEvaluation: vi.fn(),
      getAllEvaluations: () => [
        { agent: "", efficiency: 0.5, quality: 0.5, verdict: "good" },
        { agent: "worker", efficiency: 0.7, quality: 0.8, verdict: "good" },
      ],
    };
    const result = getAgentScoreSummary(ctx);
    expect(result[""]).toBeUndefined();
    expect(result.worker).toBeDefined();
  });
});

// ── evaluateTask trivial error fast-path ──────────────────────────────

describe("evaluateTask", () => {
  it("returns null when no unevaluated children exist", async () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn().mockReturnValue([]),
      readArchivedSessionMessages: vi.fn().mockReturnValue([]),
      upsertEvaluation: vi.fn(),
      hasEvaluation: () => true,
      hasLLMEvaluation: () => true,
      getAllEvaluations: () => [],
    };
    const manager = {
      registryStore: {
        getRegistry: () => ({ sessions: {} }),
      },
    } as any;
    const result = await evaluateTask({ manager, ctx, parentSessionId: "p1" });
    expect(result).toBeNull();
  });

  it("uses heuristic fast-path for trivial error sessions", async () => {
    const ctx: EvalCtx = {
      readSessionMessages: vi.fn().mockReturnValue([
        { role: "user", content: "do thing" },
        { role: "assistant", content: "error" },
      ]),
      readArchivedSessionMessages: vi.fn().mockReturnValue([]),
      upsertEvaluation: vi.fn(),
      hasEvaluation: () => false,
      hasLLMEvaluation: () => false,
      getAllEvaluations: () => [],
    };
    const manager = {
      registryStore: {
        getRegistry: () => ({
          sessions: {
            s1: { parentSessionId: "p1", agent: "worker", task: "fail", status: "error" },
          },
        }),
      },
      run: vi.fn(),
      waitFor: vi.fn(),
    } as any;

    const result = await evaluateTask({ manager, ctx, parentSessionId: "p1" });
    expect(result).not.toBeNull();
    expect(result!.raw).toContain("heuristic");
    expect(result!.overall.quality).toBe(0);
    expect(manager.run).not.toHaveBeenCalled(); // No LLM call for trivial errors
    expect(ctx.upsertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "s1", skippedByJs: true }),
    );
  });
});
