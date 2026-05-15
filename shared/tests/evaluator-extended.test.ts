import { describe, it, expect } from "vitest";

// online-quality is not in the guards list output... let me check the actual filename
const { guard } = await import("../guards/milestone-quality.js");

// Actually test the evaluator functions that are at 28.96%
import {
  extractUsage,
  formatIsolatedTranscript,
  findUnevaluatedChildren,
  getAgentScoreSummary,
} from "../evaluation/evaluator.js";
import type { EvalCtx } from "../evaluation/evaluator.js";

describe("evaluator - getAgentScoreSummary", () => {
  function makeCtx(evals: any[]): EvalCtx {
    return {
      readSessionMessages: () => [],
      readArchivedSessionMessages: () => [],
      upsertEvaluation: () => {},
      hasEvaluation: () => false,
      hasLLMEvaluation: () => false,
      getAllEvaluations: () => evals,
    };
  }

  it("returns empty object for no evaluations", () => {
    const result = getAgentScoreSummary(makeCtx([]));
    expect(result).toEqual({});
  });

  it("computes averages for a single agent", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "coder", efficiency: 0.8, quality: 0.9, verdict: "good" },
      { agent: "coder", efficiency: 0.6, quality: 0.7, verdict: "ok" },
    ]));
    expect(result.coder.avgEfficiency).toBeCloseTo(0.7);
    expect(result.coder.avgQuality).toBeCloseTo(0.8);
    expect(result.coder.count).toBe(2);
  });

  it("computes separate summaries per agent", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "coder", efficiency: 0.8, quality: 0.9, verdict: "good" },
      { agent: "reviewer", efficiency: 0.5, quality: 0.6, verdict: "ok" },
    ]));
    expect(Object.keys(result)).toEqual(["coder", "reviewer"]);
  });

  it("skips entries without agent name", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "", efficiency: 0.8, quality: 0.9, verdict: "good" },
      { efficiency: 0.8, quality: 0.9, verdict: "good" },
    ]));
    expect(result).toEqual({});
  });

  it("tracks verdict counts", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "coder", efficiency: 0.8, quality: 0.9, verdict: "good" },
      { agent: "coder", efficiency: 0.6, quality: 0.7, verdict: "good" },
      { agent: "coder", efficiency: 0.4, quality: 0.3, verdict: "bad" },
    ]));
    expect(result.coder.verdicts).toEqual({ good: 2, bad: 1 });
  });

  it("detects improving trend", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "coder", efficiency: 0.3, quality: 0.5, verdict: "ok" },
      { agent: "coder", efficiency: 0.4, quality: 0.5, verdict: "ok" },
      { agent: "coder", efficiency: 0.7, quality: 0.5, verdict: "ok" },
      { agent: "coder", efficiency: 0.8, quality: 0.5, verdict: "ok" },
    ]));
    expect(result.coder.trend).toBe("improving");
  });

  it("detects declining trend", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "coder", efficiency: 0.8, quality: 0.5, verdict: "ok" },
      { agent: "coder", efficiency: 0.7, quality: 0.5, verdict: "ok" },
      { agent: "coder", efficiency: 0.3, quality: 0.5, verdict: "ok" },
      { agent: "coder", efficiency: 0.2, quality: 0.5, verdict: "ok" },
    ]));
    expect(result.coder.trend).toBe("declining");
  });

  it("detects stable trend", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "coder", efficiency: 0.5, quality: 0.5, verdict: "ok" },
      { agent: "coder", efficiency: 0.5, quality: 0.5, verdict: "ok" },
    ]));
    expect(result.coder.trend).toBe("stable");
  });

  it("returns stable for single evaluation", () => {
    const result = getAgentScoreSummary(makeCtx([
      { agent: "coder", efficiency: 0.5, quality: 0.5, verdict: "ok" },
    ]));
    expect(result.coder.trend).toBe("stable");
  });
});

describe("evaluator - formatIsolatedTranscript", () => {
  it("includes first user message as task_specification", () => {
    const result = formatIsolatedTranscript([
      { role: "user", content: "Do the thing" } as any,
    ]);
    expect(result).toContain("task_specification");
    expect(result).toContain("Do the thing");
  });

  it("strips subsequent user messages", () => {
    const result = formatIsolatedTranscript([
      { role: "user", content: "Task" } as any,
      { role: "user", content: "System injection" } as any,
    ]);
    expect(result).not.toContain("System injection");
  });

  it("strips assistant text blocks but keeps tool calls", () => {
    const result = formatIsolatedTranscript([
      { role: "user", content: "Task" } as any,
      {
        role: "assistant",
        content: [
          { type: "text", text: "I will now do the thing" },
          { type: "toolCall", name: "read", arguments: { path: "foo.ts" } },
        ],
      } as any,
    ]);
    expect(result).not.toContain("I will now do the thing");
    expect(result).toContain("tool_call: read");
    expect(result).toContain("foo.ts");
  });

  it("sanitizes finish() tool call args", () => {
    const result = formatIsolatedTranscript([
      { role: "user", content: "Task" } as any,
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "finish",
            arguments: { status: "success", summary: "I did great", deliverables: [] },
          },
        ],
      } as any,
    ]);
    expect(result).toContain("tool_call: finish");
    expect(result).toContain('"status":"success"');
    expect(result).not.toContain("I did great");
  });

  it("includes tool results", () => {
    const result = formatIsolatedTranscript([
      { role: "user", content: "Task" } as any,
      {
        role: "toolResult",
        toolName: "read",
        content: [{ type: "text", text: "file contents here" }],
      } as any,
    ]);
    expect(result).toContain("tool_result: read");
    expect(result).toContain("file contents here");
  });

  it("truncates long tool results", () => {
    const longText = "x".repeat(3000);
    const result = formatIsolatedTranscript([
      { role: "user", content: "Task" } as any,
      {
        role: "toolResult",
        toolName: "read",
        content: [{ type: "text", text: longText }],
      } as any,
    ]);
    expect(result).toContain("truncated from 3000 chars");
  });

  it("handles array content in first user message", () => {
    const result = formatIsolatedTranscript([
      {
        role: "user",
        content: [
          { type: "text", text: "Part 1" },
          "Part 2",
        ],
      } as any,
    ]);
    expect(result).toContain("Part 1");
    expect(result).toContain("Part 2");
  });

  it("strips thinking blocks", () => {
    const result = formatIsolatedTranscript([
      { role: "user", content: "Task" } as any,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Hmm let me think about this" },
          { type: "toolCall", name: "bash", arguments: { command: "ls" } },
        ],
      } as any,
    ]);
    expect(result).not.toContain("Hmm let me think");
    expect(result).toContain("tool_call: bash");
  });

  it("handles finish with blockers", () => {
    const result = formatIsolatedTranscript([
      { role: "user", content: "Task" } as any,
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "finish",
            arguments: { status: "blocked", blockers: [{ reason: "need API key" }] },
          },
        ],
      } as any,
    ]);
    expect(result).toContain('"has_blockers":true');
  });
});

describe("evaluator - findUnevaluatedChildren", () => {
  function makeCtx(evaluated: Set<string> = new Set(), llmEvaluated: Set<string> = new Set()): EvalCtx {
    return {
      readSessionMessages: (id: string) => [{ role: "user", content: "task" } as any],
      readArchivedSessionMessages: () => [],
      upsertEvaluation: () => {},
      hasEvaluation: (id: string) => evaluated.has(id),
      hasLLMEvaluation: (id: string) => llmEvaluated.has(id),
      getAllEvaluations: () => [],
    };
  }

  it("finds child sessions of the parent", () => {
    const registry = {
      "s1": { parentSessionId: "parent", agent: "coder", status: "completed", task: "do stuff" },
      "s2": { parentSessionId: "other", agent: "coder", status: "completed", task: "other stuff" },
    } as any;
    const children = findUnevaluatedChildren(makeCtx(), registry, "parent", new Set(["evaluator"]));
    expect(children.length).toBe(1);
    expect(children[0].sessionId).toBe("s1");
  });

  it("skips running/idle sessions", () => {
    const registry = {
      "s1": { parentSessionId: "parent", agent: "coder", status: "running", task: "t" },
      "s2": { parentSessionId: "parent", agent: "coder", status: "idle", task: "t" },
    } as any;
    const children = findUnevaluatedChildren(makeCtx(), registry, "parent", new Set());
    expect(children.length).toBe(0);
  });

  it("skips already LLM-evaluated sessions", () => {
    const registry = {
      "s1": { parentSessionId: "parent", agent: "coder", status: "completed", task: "t" },
    } as any;
    const children = findUnevaluatedChildren(makeCtx(new Set(), new Set(["s1"])), registry, "parent", new Set());
    expect(children.length).toBe(0);
  });

  it("skips sessions with skipAgents", () => {
    const registry = {
      "s1": { parentSessionId: "parent", agent: "evaluator", status: "completed", task: "t" },
    } as any;
    const children = findUnevaluatedChildren(makeCtx(), registry, "parent", new Set(["evaluator"]));
    expect(children.length).toBe(0);
  });

  it("skips sessions with no messages", () => {
    const ctx = {
      ...makeCtx(),
      readSessionMessages: () => [] as any[],
      readArchivedSessionMessages: () => [] as any[],
    };
    const registry = {
      "s1": { parentSessionId: "parent", agent: "coder", status: "completed", task: "t" },
    } as any;
    const children = findUnevaluatedChildren(ctx, registry, "parent", new Set());
    expect(children.length).toBe(0);
  });

  it("falls back to archived messages", () => {
    const ctx: EvalCtx = {
      readSessionMessages: () => [],
      readArchivedSessionMessages: (id: string) => id === "s1" ? [{ role: "user", content: "t" } as any] : [],
      upsertEvaluation: () => {},
      hasEvaluation: () => false,
      hasLLMEvaluation: () => false,
      getAllEvaluations: () => [],
    };
    const registry = {
      "s1": { parentSessionId: "parent", agent: "coder", status: "completed", task: "t" },
    } as any;
    const children = findUnevaluatedChildren(ctx, registry, "parent", new Set());
    expect(children.length).toBe(1);
  });
});
