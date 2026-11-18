import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { SubagentManager } from "./manager.js";
import { fakeModel } from "../../test/fixtures/model.js";

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
      "agents",
      "read",
      "run_cli_agent",
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

describe("managed tool policy", () => {
  it("keeps the full tool surface for normal job sessions", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-job-policy-"));
    const manager = new SubagentManager({ persistDir });
    registerMay(manager);

    const sessionId = manager.run("may", "do worker task", { kind: "job" });

    try {
      const session = activeSession(manager, sessionId);
      const prompt = session.agent.state.systemPrompt;
      const toolNames = session.agent.state.tools.map((t: AgentTool) => t.name);

      expect(prompt).not.toContain("This is a persistent conversation.");
      expect(toolNames).toContain("bash");
      expect(toolNames).toContain("write");
      expect(toolNames).toContain("finish");
      expect(toolNames).toContain("run_cli_agent");
    } finally {
      manager.cancel(sessionId);
      await manager.waitFor(sessionId);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("restricts readonly workflow sessions to observation tools and structured finish", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-readonly-policy-"));
    const manager = new SubagentManager({ persistDir });
    registerMay(manager);

    const sessionId = manager.run("may", "review and propose", {
      kind: "call",
      requireFinish: true,
      toolPolicy: "readonly",
    });

    try {
      const session = activeSession(manager, sessionId);
      const toolNames = session.agent.state.tools.map((t: AgentTool) => t.name);

      expect(toolNames).toEqual(["query_db", "read", "finish"]);
      expect(toolNames).not.toContain("bash");
      expect(toolNames).not.toContain("write");
      expect(session.toolPolicy).toBe("readonly");
    } finally {
      manager.cancel(sessionId);
      await manager.waitFor(sessionId);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });
});
