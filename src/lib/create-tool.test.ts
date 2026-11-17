/**
 * Agent discovery, bounded helper calls and their public tool contract.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "./manager.js";
import { closeDb } from "./db/connection.js";
import { fakeModel } from "../../test/fixtures/model.js";

function registerTestAgents(manager: SubagentManager) {
  manager.register({
    name: "researcher",
    description: "Deep research on technical topics",
    domain: "academic research",
    systemPrompt: "You are a researcher.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
  manager.register({
    name: "writer",
    description: "Content writing and editing",
    domain: "content creation",
    systemPrompt: "You are a writer.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

function parseResult(result: { content: Array<{ type: string; text?: string }> }): any {
  expect(result.content).toHaveLength(1);
  expect(result.content[0]?.type).toBe("text");
  return JSON.parse(result.content[0]!.text!);
}

describe("createAgentsTool()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-agents-tool-"));
    manager = new SubagentManager({ persistDir });
    registerTestAgents(manager);
  });

  afterEach(async () => {
    const sessions = manager.status();
    for (const session of sessions) manager.cancel(session.sessionId);
    await Promise.allSettled(sessions.map((session) => manager.waitFor(session.sessionId)));
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  function startCaller(): string {
    manager = new SubagentManager({ persistDir, agentRunFactory: () => {
      const stopped = Promise.withResolvers<void>();
      const state = { messages: [] as any[] } as any;
      return {
        state,
        prompt: async (text: unknown) => {
          if (text === "hold caller") await stopped.promise;
          state.messages.push(
            {
              role: "assistant",
              content: [{
                type: "toolCall",
                id: "finish-fixture",
                name: "finish",
                arguments: { status: "done", summary: "Fixture result" },
              }],
            },
            {
              role: "toolResult",
              toolCallId: "finish-fixture",
              toolName: "finish",
              content: [{ type: "text", text: "✅ SUCCESS: Fixture result" }],
              isError: false,
            },
          );
        },
        cancel: () => stopped.resolve(), waitForIdle: async () => undefined,
        followUp: () => undefined, continue: async () => undefined, steer: () => undefined,
        subscribe: () => () => undefined,
      };
    } });
    registerTestAgents(manager);
    return manager.run("writer", "hold caller");
  }

  async function callTool(tool: ReturnType<SubagentManager["createAgentsTool"]>, params: Record<string, unknown>) {
    return parseResult(await tool.execute("tc1", params, new AbortController().signal));
  }

  it("lists the exact canonical callable catalog for a live caller", async () => {
    const caller = startCaller();
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });

    expect(tool.name).toBe("agents");
    expect(tool.description).toContain("exact canonical agent/workflow call");
    const parsed = await callTool(tool, { action: "list" });

    expect(parsed.map((item: any) => item.name)).toEqual(["global/researcher", "global/writer"]);
    expect(parsed).toEqual([
      expect.objectContaining({ name: "global/researcher", description: "Deep research on technical topics" }),
      expect.objectContaining({ name: "global/writer", description: "Content writing and editing" }),
    ]);
  });

  it("runs an exact canonical agent call to completion with one input envelope", async () => {
    const caller = startCaller();
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
    const parsed = await callTool(tool, {
      action: "call",
      agent: "global/researcher",
      input: { prompt: "find papers on RL", data: { topic: "RL" } },
    });

    expect(parsed).toMatchObject({ id: expect.any(String), status: "done", summary: "Fixture result" });
    expect(parsed).not.toHaveProperty("kind");
    expect(parsed).not.toHaveProperty("sessionId");
    expect(parsed).not.toHaveProperty("messages");
  });

  it("returns structured errors for unknown and non-exact targets", async () => {
    const caller = startCaller();
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });

    expect(await callTool(tool, {
      action: "call", agent: "global/nonexistent", input: { prompt: "do something" },
    })).toEqual({ status: "error", summary: "Callable target not found: global/nonexistent" });
    expect(await callTool(tool, {
      action: "call", agent: "researcher", input: { prompt: "legacy alias" },
    })).toEqual({ status: "error", summary: "Callable target not found: researcher" });
  });

  it("requires a live caller and a bounded signal before catalog preparation", async () => {
    const tool = manager.createAgentsTool();
    expect(await callTool(tool, { action: "list" })).toEqual({
      status: "error",
      summary: "Callable catalog preparation requires its live caller session",
    });
  });

  it("exposes only list/call and rejects retired action shapes", async () => {
    const caller = startCaller();
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
    const schema = JSON.stringify(tool.parameters);
    for (const retired of ["fork", "peek", "cancel", "context", "follow-up", "task", "sessionId"]) {
      expect(schema).not.toContain(`\"${retired}\"`);
    }
    expect(await callTool(tool, { action: "cancel", sessionId: caller })).toMatchObject({ status: "error" });
  });
});

describe("listAgents()", () => {
  let persistDir: string;
  let manager: SubagentManager;
  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-list-agents-"));
    manager = new SubagentManager({ persistDir });
  });
  afterEach(() => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns empty array when no agents registered", () => {
    expect(manager.listAgents()).toEqual([]);
  });

  it("returns correct { name, description, domain } for registered agents", () => {
    registerTestAgents(manager);

    const agents = manager.listAgents();
    expect(agents).toHaveLength(2);

    const researcher = agents.find((a) => a.name === "researcher");
    expect(researcher).toEqual({
      name: "researcher",
      description: "Deep research on technical topics",
      domain: "academic research",
    });

    const writer = agents.find((a) => a.name === "writer");
    expect(writer).toEqual({
      name: "writer",
      description: "Content writing and editing",
      domain: "content creation",
    });
  });
});
