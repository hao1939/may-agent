import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import { SubagentManager } from "./manager.js";

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

function tool(name: string): AgentTool {
  return {
    name,
    description: `${name} test tool`,
    parameters: {},
    execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
  };
}

function registerMay(manager: SubagentManager): void {
  manager.register({
    name: "may",
    description: "Hao's deputy",
    domain: "test",
    systemPrompt: "You are May.",
    model: fakeModel(),
    apiKey: "fake-key",
    tools: [
      "query_db",
      "system_status",
      "agents",
      "message",
      "read",
      "run_cli_agent",
      "cc_worker",
      "codex_worker",
      "dual_review",
      "bash",
      "edit",
      "write",
      "cron",
      "finish",
    ].map(tool),
  });
}

function activeSession(manager: SubagentManager, sessionId: string): any {
  return (manager as any).activeSessions.get(sessionId);
}

describe("chat runtime policy", () => {
  it("adds fresh chat context and removes mutation/lifecycle tools for persistent chat", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-chat-policy-"));
    const manager = new SubagentManager({ persistDir });
    registerMay(manager);

    const sessionId = manager.run("may", "what needs attention?", { kind: "chat", autoClose: "never" });

    try {
      const session = activeSession(manager, sessionId);
      const prompt = session.agent.state.systemPrompt;
      const toolNames = session.agent.state.tools.map((t: AgentTool) => t.name);

      expect(prompt).toContain("Persistent Human Chat");
      expect(prompt).toContain("Fresh System State");
      expect(prompt).toContain("Current human message: what needs attention?");
      expect(toolNames).toEqual(["query_db", "system_status", "agents", "message", "read", "run_cli_agent"]);
    } finally {
      manager.cancel(sessionId);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("keeps the full tool surface for normal job sessions", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-job-policy-"));
    const manager = new SubagentManager({ persistDir });
    registerMay(manager);

    const sessionId = manager.run("may", "do worker task", { kind: "job" });

    try {
      const session = activeSession(manager, sessionId);
      const prompt = session.agent.state.systemPrompt;
      const toolNames = session.agent.state.tools.map((t: AgentTool) => t.name);

      expect(prompt).not.toContain("Persistent Human Chat");
      expect(toolNames).toContain("bash");
      expect(toolNames).toContain("write");
      expect(toolNames).toContain("finish");
      expect(toolNames).toContain("cc_worker");
    } finally {
      manager.cancel(sessionId);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
