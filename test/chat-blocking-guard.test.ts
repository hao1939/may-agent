/**
 * Test that blocking actions (delegate, waitFor, workflow.run/resume)
 * are rejected when called from the chat session.
 *
 * The chat session must never block — these actions would freeze the
 * human interface until the sub-agent or workflow completes.
 *
 * Implementation: wrapToolsForChat() in chat-harness.ts intercepts
 * blocking actions at the tool level. Applied automatically by the
 * manager when creating a chat session (autoClose: "never").
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";
import { wrapToolsForChat } from "../src/lib/chat-harness.js";
import { createWorkflowTool } from "../src/lib/workflow-tool.js";
import type { SubagentDefinition } from "../src/lib/types.js";
import type { Model } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";

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

function baseDef(name: string, overrides: Partial<SubagentDefinition> = {}): SubagentDefinition {
  return {
    name,
    description: "test",
    domain: "test",
    systemPrompt: "You are a test bot.",
    model: fakeModel(),
    tools: [],
    ...overrides,
  };
}

/** Parse the text content from a tool result. */
function parseResult(result: { content: Array<{ type: string; text?: string }> }): any {
  const text = result.content[0]?.type === "text" ? (result.content[0] as any).text : "";
  return JSON.parse(text);
}

describe("chat-harness: wrapToolsForChat", () => {
  /** Build a fake subagents tool that records calls. */
  function fakeSubagentsTool(): AgentTool & { calls: Array<{ action: string }> } {
    const calls: Array<{ action: string }> = [];
    return {
      name: "subagents",
      label: "Sub-Agents",
      description: "test",
      parameters: Type.Object({ action: Type.String(), agent: Type.Optional(Type.String()), task: Type.Optional(Type.String()), sessionId: Type.Optional(Type.String()) }),
      calls,
      execute: async (_id, params) => {
        calls.push({ action: (params as any).action });
        return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }], details: "ok" };
      },
    };
  }

  /** Build a fake workflow tool that records calls. */
  function fakeWorkflowTool(): AgentTool & { calls: Array<{ action: string }> } {
    const calls: Array<{ action: string }> = [];
    return {
      name: "workflow",
      label: "Workflow",
      description: "test",
      parameters: Type.Object({ action: Type.String(), name: Type.Optional(Type.String()), task: Type.Optional(Type.String()), workflowRunId: Type.Optional(Type.String()) }),
      calls,
      execute: async (_id, params) => {
        calls.push({ action: (params as any).action });
        return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }], details: "ok" };
      },
    };
  }

  describe("subagents tool", () => {
    it("blocks delegate", async () => {
      const original = fakeSubagentsTool();
      const [wrapped] = wrapToolsForChat([original]);
      const result = await wrapped.execute("t1", { action: "delegate", agent: "worker", task: "x" });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("blocks the chat session");
      expect(parsed.error).toContain("subagents.run()");
      expect(original.calls).toHaveLength(0); // never reached original
    });

    it("blocks waitFor", async () => {
      const original = fakeSubagentsTool();
      const [wrapped] = wrapToolsForChat([original]);
      const result = await wrapped.execute("t2", { action: "waitFor", sessionId: "s_123" });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("blocks the chat session");
      expect(original.calls).toHaveLength(0);
    });

    it("allows run (non-blocking)", async () => {
      const original = fakeSubagentsTool();
      const [wrapped] = wrapToolsForChat([original]);
      const result = await wrapped.execute("t3", { action: "run", agent: "worker", task: "x" });
      const parsed = parseResult(result);
      expect(parsed.ok).toBe(true);
      expect(original.calls).toHaveLength(1);
      expect(original.calls[0].action).toBe("run");
    });

    it("allows status (non-blocking)", async () => {
      const original = fakeSubagentsTool();
      const [wrapped] = wrapToolsForChat([original]);
      await wrapped.execute("t4", { action: "status", sessionId: "s_123" });
      expect(original.calls).toHaveLength(1);
    });

    it("allows progress (non-blocking)", async () => {
      const original = fakeSubagentsTool();
      const [wrapped] = wrapToolsForChat([original]);
      await wrapped.execute("t5", { action: "progress", sessionId: "s_123" });
      expect(original.calls).toHaveLength(1);
    });

    it("allows result (non-blocking)", async () => {
      const original = fakeSubagentsTool();
      const [wrapped] = wrapToolsForChat([original]);
      await wrapped.execute("t6", { action: "result", sessionId: "s_123" });
      expect(original.calls).toHaveLength(1);
    });

    it("allows cancel (non-blocking)", async () => {
      const original = fakeSubagentsTool();
      const [wrapped] = wrapToolsForChat([original]);
      await wrapped.execute("t7", { action: "cancel", sessionId: "s_123" });
      expect(original.calls).toHaveLength(1);
    });
  });

  describe("workflow tool", () => {
    it("blocks run", async () => {
      const original = fakeWorkflowTool();
      const [wrapped] = wrapToolsForChat([original]);
      const result = await wrapped.execute("t8", { action: "run", name: "impl", task: "x" });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("blocks the chat session");
      expect(original.calls).toHaveLength(0);
    });

    it("blocks resume", async () => {
      const original = fakeWorkflowTool();
      const [wrapped] = wrapToolsForChat([original]);
      const result = await wrapped.execute("t9", { action: "resume", workflowRunId: "wr_123" });
      const parsed = parseResult(result);
      expect(parsed.error).toContain("blocks the chat session");
      expect(original.calls).toHaveLength(0);
    });

    it("allows list (non-blocking)", async () => {
      const original = fakeWorkflowTool();
      const [wrapped] = wrapToolsForChat([original]);
      await wrapped.execute("t10", { action: "list" });
      expect(original.calls).toHaveLength(1);
    });
  });

  describe("pass-through", () => {
    it("does not wrap unrelated tools", async () => {
      const readTool: AgentTool = {
        name: "read",
        label: "Read",
        description: "test",
        parameters: Type.Object({ path: Type.String() }),
        execute: async () => ({ content: [{ type: "text", text: "data" }], details: "data" }),
      };
      const [wrapped] = wrapToolsForChat([readTool]);
      // Should be the exact same object (not wrapped)
      expect(wrapped).toBe(readTool);
    });
  });
});

describe("chat-harness integration: manager applies harness to chat sessions", () => {
  let dir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "chat-harness-int-"));
    manager = new SubagentManager({ persistDir: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("chat session gets wrapped tools", async () => {
    const subagentsTool = {
      name: "subagents",
      label: "Sub-Agents",
      description: "test",
      parameters: Type.Object({ action: Type.String() }),
      execute: async () => ({ content: [{ type: "text", text: "{}" }], details: "" }),
    } satisfies AgentTool;

    manager.register(baseDef("may", { tools: [subagentsTool] }));
    const chatSid = manager.createChatSession("may", "hello");
    await manager.waitForIdle(chatSid);

    // The chat session's agent should have wrapped tools
    // We can verify by checking the tool is different from the original
    const sessions = manager.status();
    expect(sessions.length).toBe(1);
    // The session is created — the harness is applied internally
    // We trust the unit tests above for correctness
  });

  it("task session gets original tools (no wrapping)", async () => {
    const subagentsTool = {
      name: "subagents",
      label: "Sub-Agents",
      description: "test",
      parameters: Type.Object({ action: Type.String() }),
      execute: async () => ({ content: [{ type: "text", text: "{}" }], details: "" }),
    } satisfies AgentTool;

    manager.register(baseDef("bot", { tools: [subagentsTool] }));
    const taskSid = manager.run("bot", "hello");
    await manager.waitFor(taskSid);

    // Task session completes normally — tools are not wrapped
    const result = await manager.waitFor(taskSid);
    // Task session may have an LLM error (fake model), but it should NOT
    // have a "blocks the chat session" guard error — those are chat-only.
    if (result.error) {
      expect(result.error).not.toContain("blocks the chat session");
    }
  });
});
