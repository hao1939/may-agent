import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SubagentManager } from "../src/manager.js";
import { evaluateSession } from "../src/evaluator.js";
import { historyDir } from "../src/persistence.js";

// ── Helpers ────────────────────────────────────────────────────────────

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function assistantMessage(text: string, usage?: {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: { total?: number };
}): AgentMessage {
  const msg: any = {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  };
  if (usage) {
    msg.usage = usage;
  }
  return msg as AgentMessage;
}

function toolCallMessage(name: string, args: Record<string, unknown>): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id: "tc_1", name, arguments: args }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function toolResultMessage(toolName: string, text: string): AgentMessage {
  return {
    role: "toolResult",
    toolName,
    toolCallId: "tc_1",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function thinkingMessage(): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "thinking", thinking: "Let me think about this carefully..." }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function mockManager(responseText: string): SubagentManager {
  const manager = new SubagentManager();
  vi.spyOn(manager, "run").mockReturnValue("eval_mock");
  vi.spyOn(manager, "waitFor").mockResolvedValue({
    sessionId: "eval_mock",
    status: "done",
    lastAssistantText: responseText,
    messages: [assistantMessage(responseText)],
    duration: "1s",
    outputDir: "",
  });
  return manager;
}

function seedHistorySession(persistDir: string, sessionId: string, messages: AgentMessage[]): void {
  const dir = join(historyDir(persistDir), sessionId);
  mkdirSync(dir, { recursive: true });
  const jsonl = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  writeFileSync(join(dir, "session.jsonl"), jsonl, "utf-8");
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("evaluateSession: usage extraction", () => {
  let persistDir: string;
  let knowledgeDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "eval-usage-"));
    knowledgeDir = join(persistDir, "knowledge");
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("extracts usage from assistant messages with usage data", async () => {
    const manager = mockManager("```json\n{}\n```");
    const sessionId = "usage-session";
    seedHistorySession(persistDir, sessionId, [
      userMessage("task"),
      assistantMessage("response 1", {
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
        totalTokens: 165,
        cost: { total: 0.01 },
      }),
      userMessage("follow up"),
      assistantMessage("response 2", {
        input: 200,
        output: 100,
        cacheRead: 20,
        cacheWrite: 10,
        totalTokens: 330,
        cost: { total: 0.02 },
      }),
    ]);

    const result = await evaluateSession({
      manager,
      sessionId,
      agentName: "test",
      workflowUsed: null,
      persistDir,
      knowledgeDir,
    });

    expect(result.usage.inputTokens).toBe(300);
    expect(result.usage.outputTokens).toBe(150);
    expect(result.usage.cacheReadTokens).toBe(30);
    expect(result.usage.cacheWriteTokens).toBe(15);
    expect(result.usage.totalTokens).toBe(495);
    expect(result.usage.cost).toBeCloseTo(0.03);
    expect(result.usage.turns).toBe(2);
  });

  it("handles assistant messages without usage data", async () => {
    const manager = mockManager("```json\n{}\n```");
    const sessionId = "no-usage-session";
    seedHistorySession(persistDir, sessionId, [
      userMessage("task"),
      assistantMessage("response without usage"),
    ]);

    const result = await evaluateSession({
      manager,
      sessionId,
      agentName: "test",
      workflowUsed: null,
      persistDir,
      knowledgeDir,
    });

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
    expect(result.usage.cost).toBe(0);
    expect(result.usage.turns).toBe(1);
  });

  it("counts only assistant messages for turns", async () => {
    const manager = mockManager("```json\n{}\n```");
    const sessionId = "turns-session";
    seedHistorySession(persistDir, sessionId, [
      userMessage("task"),
      assistantMessage("response 1"),
      toolCallMessage("exec", { command: "ls" }),
      toolResultMessage("exec", "file.txt"),
      assistantMessage("response 2"),
      userMessage("another question"),
      assistantMessage("response 3"),
    ]);

    const result = await evaluateSession({
      manager,
      sessionId,
      agentName: "test",
      workflowUsed: null,
      persistDir,
      knowledgeDir,
    });

    // toolCallMessage has role "assistant" — so 4 assistant messages total
    expect(result.usage.turns).toBe(4);
  });
});

describe("evaluateSession: transcript formatting", () => {
  let persistDir: string;
  let knowledgeDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "eval-transcript-"));
    knowledgeDir = join(persistDir, "knowledge");
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("includes thinking blocks in transcript (truncated)", async () => {
    const manager = mockManager("```json\n{}\n```");
    const sessionId = "thinking-session";
    seedHistorySession(persistDir, sessionId, [
      userMessage("task"),
      thinkingMessage(),
      assistantMessage("done"),
    ]);

    await evaluateSession({
      manager,
      sessionId,
      agentName: "test",
      workflowUsed: null,
      persistDir,
      knowledgeDir,
    });

    const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(prompt).toContain("[thinking]");
    expect(prompt).toContain("Let me think about this carefully");
  });

  it("truncates long tool call arguments", async () => {
    const manager = mockManager("```json\n{}\n```");
    const sessionId = "long-args-session";
    seedHistorySession(persistDir, sessionId, [
      userMessage("task"),
      toolCallMessage("write", { path: "/tmp/file.txt", content: "x".repeat(1000) }),
      toolResultMessage("write", "ok"),
      assistantMessage("done"),
    ]);

    await evaluateSession({
      manager,
      sessionId,
      agentName: "test",
      workflowUsed: null,
      persistDir,
      knowledgeDir,
    });

    const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(prompt).toContain("[tool_call: write]");
    // Arguments should be truncated to 500 chars
    const toolCallSection = prompt.split("[tool_call: write]")[1].split("\n")[0];
    expect(toolCallSection.length).toBeLessThanOrEqual(501);
  });

  it("truncates long tool result text", async () => {
    const manager = mockManager("```json\n{}\n```");
    const sessionId = "long-result-session";
    seedHistorySession(persistDir, sessionId, [
      userMessage("task"),
      toolCallMessage("read", { path: "/tmp/file.txt" }),
      toolResultMessage("read", "y".repeat(1000)),
      assistantMessage("done"),
    ]);

    await evaluateSession({
      manager,
      sessionId,
      agentName: "test",
      workflowUsed: null,
      persistDir,
      knowledgeDir,
    });

    const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(prompt).toContain("[tool_result: read]");
    // Tool result text should be truncated to 500 chars
    const toolResultSection = prompt.split("[tool_result: read]")[1].split("\n")[0];
    expect(toolResultSection.trim().length).toBeLessThanOrEqual(501);
  });

  it("saves usage alongside scores in evaluation JSON", async () => {
    const manager = mockManager("```json\n{\"efficiency\": 5}\n```");
    const sessionId = "save-usage-session";
    seedHistorySession(persistDir, sessionId, [
      userMessage("task"),
      assistantMessage("done", { input: 100, output: 50, totalTokens: 150, cost: { total: 0.005 } }),
    ]);

    await evaluateSession({
      manager,
      sessionId,
      agentName: "test",
      workflowUsed: null,
      persistDir,
      knowledgeDir,
    });

    const scoresPath = join(persistDir, "evaluations", `${sessionId}.json`);
    expect(existsSync(scoresPath)).toBe(true);
    const saved = JSON.parse(require("fs").readFileSync(scoresPath, "utf-8"));
    expect(saved.usage).toBeDefined();
    expect(saved.usage.inputTokens).toBe(100);
    expect(saved.usage.outputTokens).toBe(50);
    expect(saved.usage.totalTokens).toBe(150);
    expect(saved.usage.cost).toBeCloseTo(0.005);
  });
});
