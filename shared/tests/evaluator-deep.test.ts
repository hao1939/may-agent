import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractUsage,
  findUnevaluatedChildren,
  formatIsolatedTranscript,
  getAgentScoreSummary,
  evaluateTask,
  evaluateStandaloneSession,
} from "../evaluation/evaluator.js";
import type { EvalCtx, EvaluateTaskOptions, EvaluateStandaloneOptions } from "../evaluation/evaluator.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Helpers ──────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<EvalCtx> = {}): EvalCtx {
  return {
    readSessionMessages: vi.fn().mockReturnValue([]),
    readArchivedSessionMessages: vi.fn().mockReturnValue([]),
    upsertEvaluation: vi.fn(),
    hasEvaluation: vi.fn().mockReturnValue(false),
    hasLLMEvaluation: vi.fn().mockReturnValue(false),
    getAllEvaluations: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

function makeAssistantMsg(text: string, usage?: any): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    ...(usage ? { usage } : {}),
  } as any;
}

function makeUserMsg(text: string): AgentMessage {
  return { role: "user", content: text } as any;
}

function makeToolCallMsg(name: string, args: any): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", name, arguments: args }],
  } as any;
}

function makeToolResultMsg(toolName: string, text: string): AgentMessage {
  return {
    role: "toolResult",
    toolName,
    content: [{ type: "text", text }],
  } as any;
}

function makeThinkingMsg(thinking: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "thinking", thinking }],
  } as any;
}

function makeMockManager(responseText: string) {
  return {
    run: vi.fn().mockReturnValue("eval-session-1"),
    waitFor: vi.fn().mockResolvedValue({ lastAssistantText: responseText }),
    registryStore: {
      getRegistry: vi.fn().mockReturnValue({ sessions: {} }),
    },
  } as any;
}

// ── evaluateTask: trivial error fast path ────────────────────────────

describe("evaluateTask", () => {
  it("returns null when no unevaluated children exist", async () => {
    const ctx = makeCtx();
    const manager = makeMockManager("");
    manager.registryStore.getRegistry.mockReturnValue({ sessions: {} });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-1",
    });

    expect(result).toBeNull();
    expect(manager.run).not.toHaveBeenCalled();
  });

  it("uses heuristic fast path for trivial error sessions", async () => {
    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue([
        makeUserMsg("do something"),
        makeAssistantMsg("I failed", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
      ]),
    });

    const manager = makeMockManager("");
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-1": {
          parentSessionId: "parent-1",
          agent: "worker",
          task: "some task",
          status: "error",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-1",
    });

    expect(result).not.toBeNull();
    expect(result!.overall.quality).toBe(0);
    expect(result!.overall.verdict).toBe("needs_improvement");
    expect(result!.agents["child-1"].agent).toBe("worker");
    expect(result!.agents["child-1"].quality).toBe(0);
    // Should NOT have called the evaluator LLM
    expect(manager.run).not.toHaveBeenCalled();
    // Should have saved evaluation
    expect(ctx.upsertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "child-1",
        agent: "worker",
        evaluatedByHeuristic: true,
        skippedByJs: true,
      }),
    );
  });

  it("calls LLM evaluator for non-trivial sessions and parses response", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("build a feature"),
      makeAssistantMsg("thinking...", { input: 500, output: 200, totalTokens: 700, cost: 0.01 }),
      makeToolCallMsg("bash", { command: "echo hello" }),
      makeToolResultMsg("bash", "hello"),
      makeAssistantMsg("done", { input: 300, output: 100, totalTokens: 400, cost: 0.005 }),
      makeToolCallMsg("finish", { status: "success", summary: "built feature" }),
    ];

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue(messages),
    });

    const evalResponse = JSON.stringify({
      agents: {
        worker: {
          efficiency: 0.8,
          quality: 0.9,
          productive_calls: 3,
          wasted_calls: 0,
          verdict: "good",
          issues: [],
        },
      },
      overall: {
        efficiency: 0.8,
        quality: 0.9,
        verdict: "good",
        result_delivered: true,
      },
    });

    const manager = makeMockManager(`\`\`\`json\n${evalResponse}\n\`\`\``);
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "s_1700000000000_abc": {
          parentSessionId: "parent-1",
          agent: "worker",
          task: "build feature",
          status: "completed",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-1",
    });

    expect(result).not.toBeNull();
    expect(result!.overall.quality).toBe(0.9);
    expect(result!.overall.efficiency).toBe(0.8);
    expect(result!.overall.result_delivered).toBe(true);
    expect(result!.agents["s_1700000000000_abc"].quality).toBe(0.9);
    expect(manager.run).toHaveBeenCalledTimes(1);
    expect(ctx.upsertEvaluation).toHaveBeenCalled();
  });

  it("retries when evaluator returns no agent scores", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("working", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
      makeToolCallMsg("bash", { command: "ls" }),
      makeToolResultMsg("bash", "file1\nfile2"),
      makeAssistantMsg("done", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
    ];

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue(messages),
    });

    const goodResponse = `\`\`\`json\n${JSON.stringify({
      agents: {
        builder: {
          efficiency: 0.7,
          quality: 0.6,
          productive_calls: 2,
          wasted_calls: 1,
          verdict: "acceptable",
          issues: ["minor issue"],
        },
      },
      overall: { efficiency: 0.7, quality: 0.6, verdict: "acceptable", result_delivered: true },
    })}\n\`\`\``;

    const manager = makeMockManager("garbage response no json");
    // First call returns garbage, retry returns good
    manager.waitFor
      .mockResolvedValueOnce({ lastAssistantText: "garbage response no json" })
      .mockResolvedValueOnce({ lastAssistantText: goodResponse });
    manager.run
      .mockReturnValueOnce("eval-1")
      .mockReturnValueOnce("eval-retry-1");

    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-2": {
          parentSessionId: "parent-2",
          agent: "builder",
          task: "build it",
          status: "completed",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-2",
    });

    expect(result).not.toBeNull();
    expect(manager.run).toHaveBeenCalledTimes(2); // original + retry
    expect(result!.agents["child-2"].quality).toBe(0.6);
  });

  it("skips already LLM-evaluated sessions", async () => {
    const ctx = makeCtx({
      hasLLMEvaluation: vi.fn().mockReturnValue(true),
    });

    const manager = makeMockManager("");
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-3": {
          parentSessionId: "parent-3",
          agent: "worker",
          task: "task",
          status: "completed",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-3",
    });

    expect(result).toBeNull();
  });

  it("skips running/idle sessions", async () => {
    const ctx = makeCtx();
    const manager = makeMockManager("");
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-4": {
          parentSessionId: "parent-4",
          agent: "worker",
          task: "task",
          status: "running",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-4",
    });

    expect(result).toBeNull();
  });

  it("skips agents in skipAgents set", async () => {
    const ctx = makeCtx();
    const manager = makeMockManager("");
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-5": {
          parentSessionId: "parent-5",
          agent: "evaluator",
          task: "evaluate",
          status: "completed",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-5",
      skipAgents: new Set(["evaluator"]),
    });

    expect(result).toBeNull();
  });

  it("handles multiple children with same agent name", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("ok", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
      makeToolCallMsg("bash", { command: "echo done" }),
      makeToolResultMsg("bash", "done"),
      makeAssistantMsg("finished", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
    ];

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue(messages),
    });

    const evalResponse = JSON.stringify({
      agents: {
        "worker (session child-a)": {
          efficiency: 0.8, quality: 0.9, productive_calls: 2, wasted_calls: 0, verdict: "good", issues: [],
        },
        "worker (session child-b)": {
          efficiency: 0.6, quality: 0.5, productive_calls: 1, wasted_calls: 1, verdict: "acceptable", issues: ["slow"],
        },
      },
      overall: { efficiency: 0.7, quality: 0.7, verdict: "good", result_delivered: true },
    });

    const manager = makeMockManager(`\`\`\`json\n${evalResponse}\n\`\`\``);
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-a": {
          parentSessionId: "parent-6",
          agent: "worker",
          task: "task a",
          status: "completed",
        },
        "child-b": {
          parentSessionId: "parent-6",
          agent: "worker",
          task: "task b",
          status: "completed",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-6",
    });

    expect(result).not.toBeNull();
    expect(result!.agents["child-a"].quality).toBe(0.9);
    expect(result!.agents["child-b"].quality).toBe(0.5);
  });

  it("uses isolated transcript when option is set", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("build feature"),
      makeThinkingMsg("let me think"),
      makeAssistantMsg("I'll do this"),
      makeToolCallMsg("bash", { command: "echo done" }),
      makeToolResultMsg("bash", "done"),
      makeAssistantMsg("Success!", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
    ];

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue(messages),
    });

    const evalResponse = JSON.stringify({
      agents: {
        worker: {
          efficiency: 0.7, quality: 0.8, productive_calls: 1, wasted_calls: 0, verdict: "good", issues: [],
        },
      },
      overall: { efficiency: 0.7, quality: 0.8, verdict: "good", result_delivered: true },
    });

    const manager = makeMockManager(`\`\`\`json\n${evalResponse}\n\`\`\``);
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-iso": {
          parentSessionId: "parent-iso",
          agent: "worker",
          task: "build feature",
          status: "completed",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-iso",
      isolatedTranscript: true,
    });

    expect(result).not.toBeNull();
    // The prompt sent to evaluator should use isolated transcript
    const promptArg = manager.run.mock.calls[0][1];
    // Isolated transcript should NOT contain agent text like "I'll do this" or "Success!"
    // but SHOULD contain tool calls
    expect(promptArg).toContain("tool_call: bash");
  });

  it("falls back to archived messages when active messages empty", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("failed"),
    ];

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue([]),
      readArchivedSessionMessages: vi.fn().mockReturnValue(messages),
    });

    const manager = makeMockManager("");
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-archive": {
          parentSessionId: "parent-archive",
          agent: "worker",
          task: "task",
          status: "error",
        },
      },
    });

    // Should be treated as trivial error (2 messages, error status)
    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-archive",
    });

    expect(result).not.toBeNull();
    expect(result!.overall.quality).toBe(0);
  });

  it("handles EXP-039 isolated re-evaluation for weak sessions", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("complex task"),
      makeAssistantMsg("starting", { input: 500, output: 200, totalTokens: 700, cost: 0.01 }),
      makeToolCallMsg("bash", { command: "npm test" }),
      makeToolResultMsg("bash", "1 failed"),
      makeAssistantMsg("hmm let me try again", { input: 300, output: 100, totalTokens: 400, cost: 0.005 }),
      makeToolCallMsg("bash", { command: "npm test" }),
      makeToolResultMsg("bash", "still failing"),
    ];

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue(messages),
    });

    // First eval returns weak quality (0.4 < 0.5 threshold triggers isolation)
    const weakResponse = JSON.stringify({
      agents: {
        worker: {
          efficiency: 0.5, quality: 0.4, productive_calls: 1, wasted_calls: 2, verdict: "needs_improvement", issues: ["failed tests"],
        },
      },
      overall: { efficiency: 0.5, quality: 0.4, verdict: "needs_improvement", result_delivered: false },
    });

    // Isolated re-eval returns even lower (confirming bias)
    const isolatedResponse = JSON.stringify({
      agents: {
        worker: {
          efficiency: 0.3, quality: 0.2, productive_calls: 0, wasted_calls: 3, verdict: "needs_improvement", issues: ["nothing delivered"],
        },
      },
      overall: { efficiency: 0.3, quality: 0.2, verdict: "needs_improvement", result_delivered: false },
    });

    const manager = makeMockManager("");
    manager.run
      .mockReturnValueOnce("eval-weak")
      .mockReturnValueOnce("eval-iso");
    manager.waitFor
      .mockResolvedValueOnce({ lastAssistantText: `\`\`\`json\n${weakResponse}\n\`\`\`` })
      .mockResolvedValueOnce({ lastAssistantText: `\`\`\`json\n${isolatedResponse}\n\`\`\`` });

    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-weak": {
          parentSessionId: "parent-weak",
          agent: "worker",
          task: "complex task",
          status: "completed",
        },
      },
    });

    const result = await evaluateTask({
      manager,
      ctx,
      parentSessionId: "parent-weak",
    });

    expect(result).not.toBeNull();
    // Should use lower isolated scores
    expect(result!.overall.quality).toBe(0.2);
    expect(result!.overall.efficiency).toBe(0.3);
    expect(manager.run).toHaveBeenCalledTimes(2); // original + isolated re-eval
    expect(result!.raw).toContain("ISOLATED RE-EVALUATION");
  });

  it("does NOT re-evaluate when quality >= isolation threshold", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("working", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
      makeToolCallMsg("bash", { command: "echo done" }),
      makeToolResultMsg("bash", "done"),
      makeAssistantMsg("finished", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
    ];

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue(messages),
    });

    const goodResponse = JSON.stringify({
      agents: {
        worker: {
          efficiency: 0.9, quality: 0.9, productive_calls: 2, wasted_calls: 0, verdict: "good", issues: [],
        },
      },
      overall: { efficiency: 0.9, quality: 0.9, verdict: "good", result_delivered: true },
    });

    const manager = makeMockManager(`\`\`\`json\n${goodResponse}\n\`\`\``);
    manager.registryStore.getRegistry.mockReturnValue({
      sessions: {
        "child-good": {
          parentSessionId: "parent-good",
          agent: "worker",
          task: "task",
          status: "completed",
        },
      },
    });

    await evaluateTask({ manager, ctx, parentSessionId: "parent-good" });

    // Only 1 call (no isolated re-eval)
    expect(manager.run).toHaveBeenCalledTimes(1);
  });
});

// ── evaluateStandaloneSession ─────────────────────────────────────────

describe("evaluateStandaloneSession", () => {
  it("returns null for already LLM-evaluated sessions", async () => {
    const ctx = makeCtx({ hasLLMEvaluation: vi.fn().mockReturnValue(true) });
    const manager = makeMockManager("");

    const result = await evaluateStandaloneSession({
      manager,
      ctx,
      sessionId: "s-1",
      agent: "worker",
      task: "task",
      status: "completed",
    });

    expect(result).toBeNull();
  });

  it("returns null for sessions with no messages", async () => {
    const ctx = makeCtx();
    const manager = makeMockManager("");

    const result = await evaluateStandaloneSession({
      manager,
      ctx,
      sessionId: "s-2",
      agent: "worker",
      task: "task",
      status: "completed",
    });

    expect(result).toBeNull();
  });

  it("evaluates a standalone session and returns scores", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("analyze data"),
      makeAssistantMsg("analyzing", { input: 500, output: 200, totalTokens: 700, cost: 0.01 }),
      makeToolCallMsg("bash", { command: "python analyze.py" }),
      makeToolResultMsg("bash", "analysis complete"),
      makeAssistantMsg("done", { input: 300, output: 100, totalTokens: 400, cost: 0.005 }),
    ];

    const evalResponse = JSON.stringify({
      agents: {
        analyst: {
          efficiency: 0.85, quality: 0.9, productive_calls: 2, wasted_calls: 0, verdict: "good", issues: [],
        },
      },
      overall: { efficiency: 0.85, quality: 0.9, verdict: "good", result_delivered: true },
    });

    const ctx = makeCtx();
    const manager = makeMockManager(`\`\`\`json\n${evalResponse}\n\`\`\``);

    const result = await evaluateStandaloneSession({
      manager,
      ctx,
      sessionId: "s-3",
      agent: "analyst",
      task: "analyze data",
      status: "completed",
      messages,
    });

    expect(result).not.toBeNull();
    expect(result!.quality).toBe(0.9);
    expect(result!.efficiency).toBe(0.85);
    expect(result!.verdict).toBe("good");
    expect(ctx.upsertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "s-3",
        agent: "analyst",
        quality: 0.9,
      }),
    );
  });

  it("retries on zero-score response and marks parse_error on double failure", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("ok", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
      makeToolCallMsg("bash", { command: "echo test" }),
      makeToolResultMsg("bash", "test"),
    ];

    // Both original and retry return garbage → agent scores still parsed from retry
    // Actually if both return zeros, it marks parse_error
    const zeroResponse = `\`\`\`json\n${JSON.stringify({
      agents: {
        worker: { efficiency: 0, quality: 0, productive_calls: 0, wasted_calls: 0, verdict: "needs_improvement", issues: [] },
      },
      overall: { efficiency: 0, quality: 0, verdict: "needs_improvement", result_delivered: false },
    })}\n\`\`\``;

    const ctx = makeCtx();
    const manager = makeMockManager("");
    manager.run
      .mockReturnValueOnce("eval-s1")
      .mockReturnValueOnce("eval-s1-retry");
    manager.waitFor
      .mockResolvedValueOnce({ lastAssistantText: zeroResponse })
      .mockResolvedValueOnce({ lastAssistantText: zeroResponse });

    const result = await evaluateStandaloneSession({
      manager,
      ctx,
      sessionId: "s-4",
      agent: "worker",
      task: "task",
      status: "completed",
      messages,
    });

    expect(result).not.toBeNull();
    expect(result!.verdict).toBe("parse_error");
    expect(manager.run).toHaveBeenCalledTimes(2);
  });

  it("loads messages from disk when not provided", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("heartbeat task"),
      makeAssistantMsg("checked", { input: 200, output: 100, totalTokens: 300, cost: 0.003 }),
      makeToolCallMsg("bash", { command: "echo ok" }),
      makeToolResultMsg("bash", "ok"),
    ];

    const evalResponse = JSON.stringify({
      agents: {
        coach: {
          efficiency: 0.7, quality: 0.7, productive_calls: 1, wasted_calls: 0, verdict: "acceptable", issues: [],
        },
      },
      overall: { efficiency: 0.7, quality: 0.7, verdict: "acceptable", result_delivered: true },
    });

    const ctx = makeCtx({
      readSessionMessages: vi.fn().mockReturnValue(messages),
    });
    const manager = makeMockManager(`\`\`\`json\n${evalResponse}\n\`\`\``);

    const result = await evaluateStandaloneSession({
      manager,
      ctx,
      sessionId: "s-5",
      agent: "coach",
      task: "heartbeat",
      status: "completed",
      // no messages provided — should load from ctx
    });

    expect(result).not.toBeNull();
    expect(ctx.readSessionMessages).toHaveBeenCalledWith("s-5");
  });

  it("returns null when evaluator doesn't score the agent", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("ok", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
      makeToolCallMsg("bash", { command: "echo" }),
      makeToolResultMsg("bash", ""),
    ];

    // Response has scores for wrong agent
    const evalResponse = JSON.stringify({
      agents: {
        "different-agent": {
          efficiency: 0.8, quality: 0.8, productive_calls: 1, wasted_calls: 0, verdict: "good", issues: [],
        },
      },
      overall: { efficiency: 0.8, quality: 0.8, verdict: "good", result_delivered: true },
    });

    const ctx = makeCtx();
    const manager = makeMockManager(`\`\`\`json\n${evalResponse}\n\`\`\``);

    const result = await evaluateStandaloneSession({
      manager,
      ctx,
      sessionId: "s-6",
      agent: "worker",
      task: "task",
      status: "completed",
      messages,
    });

    expect(result).toBeNull();
  });

  it("handles session label matching (agent + session id)", async () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("ok", { input: 100, output: 50, totalTokens: 150, cost: 0.001 }),
      makeToolCallMsg("bash", { command: "echo done" }),
      makeToolResultMsg("bash", "done"),
    ];

    // Response uses session label format
    const evalResponse = JSON.stringify({
      agents: {
        "worker (session s-label)": {
          efficiency: 0.75, quality: 0.85, productive_calls: 1, wasted_calls: 0, verdict: "good", issues: [],
        },
      },
      overall: { efficiency: 0.75, quality: 0.85, verdict: "good", result_delivered: true },
    });

    const ctx = makeCtx();
    const manager = makeMockManager(`\`\`\`json\n${evalResponse}\n\`\`\``);

    const result = await evaluateStandaloneSession({
      manager,
      ctx,
      sessionId: "s-label",
      agent: "worker",
      task: "task",
      status: "completed",
      messages,
    });

    expect(result).not.toBeNull();
    expect(result!.quality).toBe(0.85);
  });
});

// ── getAgentScoreSummary ──────────────────────────────────────────────

describe("getAgentScoreSummary", () => {
  it("returns empty for no evaluations", () => {
    const ctx = makeCtx({ getAllEvaluations: vi.fn().mockReturnValue([]) });
    expect(getAgentScoreSummary(ctx)).toEqual({});
  });

  it("computes averages and counts correctly", () => {
    const ctx = makeCtx({
      getAllEvaluations: vi.fn().mockReturnValue([
        { agent: "worker", efficiency: 0.8, quality: 0.9, verdict: "good" },
        { agent: "worker", efficiency: 0.6, quality: 0.7, verdict: "acceptable" },
        { agent: "scout", efficiency: 0.5, quality: 0.5, verdict: "needs_improvement" },
      ]),
    });

    const summary = getAgentScoreSummary(ctx);

    expect(summary.worker.count).toBe(2);
    expect(summary.worker.avgEfficiency).toBeCloseTo(0.7);
    expect(summary.worker.avgQuality).toBeCloseTo(0.8);
    expect(summary.worker.verdicts).toEqual({ good: 1, acceptable: 1 });
    expect(summary.scout.count).toBe(1);
  });

  it("computes improving trend", () => {
    const ctx = makeCtx({
      getAllEvaluations: vi.fn().mockReturnValue([
        { agent: "worker", efficiency: 0.3, quality: 0.3, verdict: "needs_improvement" },
        { agent: "worker", efficiency: 0.4, quality: 0.4, verdict: "needs_improvement" },
        { agent: "worker", efficiency: 0.7, quality: 0.7, verdict: "good" },
        { agent: "worker", efficiency: 0.8, quality: 0.8, verdict: "good" },
      ]),
    });

    const summary = getAgentScoreSummary(ctx);
    expect(summary.worker.trend).toBe("improving");
  });

  it("computes declining trend", () => {
    const ctx = makeCtx({
      getAllEvaluations: vi.fn().mockReturnValue([
        { agent: "worker", efficiency: 0.9, quality: 0.9, verdict: "good" },
        { agent: "worker", efficiency: 0.8, quality: 0.8, verdict: "good" },
        { agent: "worker", efficiency: 0.4, quality: 0.4, verdict: "needs_improvement" },
        { agent: "worker", efficiency: 0.3, quality: 0.3, verdict: "needs_improvement" },
      ]),
    });

    const summary = getAgentScoreSummary(ctx);
    expect(summary.worker.trend).toBe("declining");
  });

  it("computes stable trend", () => {
    const ctx = makeCtx({
      getAllEvaluations: vi.fn().mockReturnValue([
        { agent: "worker", efficiency: 0.7, quality: 0.7, verdict: "good" },
        { agent: "worker", efficiency: 0.7, quality: 0.7, verdict: "good" },
        { agent: "worker", efficiency: 0.7, quality: 0.7, verdict: "good" },
        { agent: "worker", efficiency: 0.7, quality: 0.7, verdict: "good" },
      ]),
    });

    const summary = getAgentScoreSummary(ctx);
    expect(summary.worker.trend).toBe("stable");
  });

  it("returns stable for single evaluation", () => {
    const ctx = makeCtx({
      getAllEvaluations: vi.fn().mockReturnValue([
        { agent: "worker", efficiency: 0.7, quality: 0.7, verdict: "good" },
      ]),
    });

    const summary = getAgentScoreSummary(ctx);
    expect(summary.worker.trend).toBe("stable");
  });

  it("skips evaluations with empty agent name", () => {
    const ctx = makeCtx({
      getAllEvaluations: vi.fn().mockReturnValue([
        { agent: "", efficiency: 0.5, quality: 0.5, verdict: "good" },
        { agent: "worker", efficiency: 0.7, quality: 0.7, verdict: "good" },
      ]),
    });

    const summary = getAgentScoreSummary(ctx);
    expect(summary[""]).toBeUndefined();
    expect(summary.worker).toBeDefined();
  });
});

// ── formatIsolatedTranscript edge cases ───────────────────────────────

describe("formatIsolatedTranscript edge cases", () => {
  it("strips thinking blocks from transcript", () => {
    const messages: AgentMessage[] = [
      makeUserMsg("build feature"),
      makeThinkingMsg("let me think about this"),
      makeToolCallMsg("bash", { command: "echo test" }),
      makeToolResultMsg("bash", "test output"),
    ];

    const result = formatIsolatedTranscript(messages);
    expect(result).not.toContain("let me think");
    expect(result).toContain("tool_call: bash");
    expect(result).toContain("test output");
  });

  it("strips agent free-text but keeps tool calls", () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeAssistantMsg("I will now solve this problem carefully"),
      makeToolCallMsg("bash", { command: "npm test" }),
      makeToolResultMsg("bash", "all pass"),
    ];

    const result = formatIsolatedTranscript(messages);
    expect(result).not.toContain("I will now solve");
    expect(result).toContain("tool_call: bash");
  });

  it("sanitizes finish() arguments", () => {
    const messages: AgentMessage[] = [
      makeUserMsg("task"),
      makeToolCallMsg("finish", {
        status: "success",
        summary: "I did great work",
        deliverables: [{ path: "file.ts" }],
        verification_evidence: ["it works trust me"],
      }),
    ];

    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("tool_call: finish");
    expect(result).toContain('"status":"success"');
    expect(result).not.toContain("I did great work");
    expect(result).not.toContain("trust me");
  });

  it("only includes first user message", () => {
    const messages: AgentMessage[] = [
      makeUserMsg("original task"),
      makeAssistantMsg("ok"),
      makeUserMsg("heartbeat injection"),
      makeToolCallMsg("bash", { command: "echo" }),
    ];

    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("original task");
    expect(result).not.toContain("heartbeat injection");
  });
});

// ── extractUsage edge cases ──────────────────────────────────────────

describe("extractUsage edge cases", () => {
  it("handles cost as object with total field", () => {
    const messages: AgentMessage[] = [
      makeAssistantMsg("test", { input: 100, output: 50, totalTokens: 150, cost: { total: 0.005 } }),
    ];
    const result = extractUsage(messages);
    expect(result.cost).toBe(0.005);
  });

  it("handles missing usage fields gracefully", () => {
    const messages: AgentMessage[] = [
      makeAssistantMsg("test", {}),
    ];
    const result = extractUsage(messages);
    expect(result.inputTokens).toBe(0);
    expect(result.cost).toBe(0);
    expect(result.turns).toBe(1);
  });

  it("handles null cost", () => {
    const messages: AgentMessage[] = [
      makeAssistantMsg("test", { input: 100, output: 50, cost: null }),
    ];
    const result = extractUsage(messages);
    expect(result.cost).toBe(0);
  });
});
