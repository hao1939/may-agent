/**
 * Tests for bounded agent cooperation and execution evidence.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { SubagentManager } from "./manager.js";
import { closeDb } from "./db/connection.js";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";

// ── Helpers ─────────────────────────────────────────────────────────────

function mockModel() {
  return getBuiltinModel("anthropic", "claude-opus-4-6");
}

async function callTool(tool: AgentTool, params: Record<string, unknown>): Promise<any> {
  const result = (await tool.execute("tc_1", params, new AbortController().signal)) as AgentToolResult<string>;
  const text = (result.content as any[])[0]?.text ?? "";
  return JSON.parse(text);
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("canonical agents list/call", () => {
  let persistDir: string;
  let manager: SubagentManager;
  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "canonical-agents-tool-"));
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "memory"), { recursive: true });
    manager = new SubagentManager({ persistDir });
  });
  afterEach(() => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("exposes only list/call and invokes the exact listed canonical agent with one envelope", async () => {
    manager.register({ name: "reviewer", description: "Global reviewer", domain: "review", model: mockModel(), tools: [] });
    manager.register({ name: "alpha-reviewer", description: "Alpha reviewer", domain: "review", model: mockModel(), tools: [], appLocal: true, projectId: "alpha" });
    manager.activeSessions.set("caller", { definition: manager.getAgentDefinition("reviewer") } as any);
    let dispatched: unknown;
    manager.callAgentDefinition = async (definition, task) => {
      dispatched = { name: definition.name, task };
      return { sessionId: "s_child", status: "done", lastAssistantText: "reviewed", messages: [], duration: "0s", outputDir: "", finishResult: { status: "done", summary: "reviewed", output: { verdict: "accept" } } };
    };
    const tool = manager.createAgentsTool({ getCallerSessionId: () => "caller" });
    const schema = JSON.stringify(tool.parameters);
    for (const retired of ["fork", "peek", "follow-up", "cancel", "context", "sessions", "context_files", "success_criteria"]) expect(schema).not.toContain(`\"${retired}\"`);
    const listed = await callTool(tool, { action: "list" });
    expect(listed.map((item: any) => item.name)).toEqual(["alpha/alpha-reviewer", "global/reviewer"]);
    const result = await callTool(tool, { action: "call", agent: listed[0].name, input: { prompt: "Review", data: { ref: "HEAD" } } });
    expect(result).toEqual({ id: "s_child", status: "done", summary: "reviewed", output: { verdict: "accept" } });
    expect(dispatched).toEqual({ name: "alpha-reviewer", task: 'Review\n\nAssignment data (JSON):\n{\n  "ref": "HEAD"\n}' });
    expect((await callTool(tool, { action: "call", agent: "alpha-reviewer", input: { prompt: "legacy alias" } })).id).toBeUndefined();
  });

  it("lists and invokes cross-App workflows despite retired ACL/profile options", async () => {
    for (const [appId, ownerName] of [["alpha", "alpha-owner"], ["beta", "beta-owner"]] as const) {
      const agentDir = join(persistDir, ownerName);
      mkdirSync(join(agentDir, "workflows"), { recursive: true });
      writeFileSync(join(agentDir, "workflows", "review.ts"), `export const name="review"; export const description="${appId}"; export async function execute(ctx){ return ctx.done("${appId}", ctx.input.data); }`);
      manager.register({ name: ownerName, description: ownerName, domain: "fixture", model: mockModel(), tools: [], agentDir, appLocal: true, projectId: appId });
    }
    manager.activeSessions.set("caller", { definition: manager.getAgentDefinition("alpha-owner") } as any);
    const tool = manager.createAgentsTool({ getCallerSessionId: () => "caller" });
    expect(JSON.stringify(tool.parameters)).not.toContain("callDeny");
    expect(JSON.stringify(tool.parameters)).not.toContain("localProceduresOnly");
    const listed = await callTool(tool, { action: "list" });
    expect(listed.map((item: any) => item.name)).toEqual(["alpha/alpha-owner", "alpha/review", "beta/beta-owner", "beta/review"]);
    const result = await callTool(tool, { action: "call", agent: "beta/review", input: { prompt: "Review beta", data: { ref: "HEAD" } } });
    expect(result).toMatchObject({ status: "done", summary: "beta", output: { ref: "HEAD" } });
  });

  it("captures the published execution snapshot after tool creation and dispatches that exact definition", async () => {
    const tool = manager.createAgentsTool({ getCallerSessionId: () => "caller" });
    const captured = { name: "reviewer", description: "Published reviewer", domain: "fixture", model: mockModel(), tools: [] };
    manager.register({ ...captured, description: "mutable registry copy" });
    manager.activeSessions.set("caller", { taskContext: { agentDefinitions: new Map([["reviewer", captured]]) } } as any);
    let invoked: unknown;
    manager.callAgentDefinition = async (definition) => {
      invoked = definition;
      return { sessionId: "s_snapshot", status: "done", lastAssistantText: "done", messages: [], duration: "0s", outputDir: "", finishResult: { status: "done", summary: "done" } };
    };

    expect((await callTool(tool, { action: "list" })).map((item: any) => item.name)).toEqual(["global/reviewer"]);
    manager.register({ ...captured, description: "replacement" });
    expect(await callTool(tool, { action: "call", agent: "global/reviewer", input: { prompt: "Review" } })).toMatchObject({ id: "s_snapshot", status: "done" });
    expect(invoked).toBe(captured);
  });
});

describe("callAgent depth limit", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "depth-limit-"));
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "memory"), { recursive: true });
  });

  afterEach(() => {
    closeDb(persistDir);
    try {
      rmSync(persistDir, { recursive: true, force: true });
    } catch {}
  });

  it("respects maxCallDepth setting", async () => {
    const manager = new SubagentManager({ persistDir, maxCallDepth: 2 });

    // Manually test depth tracking
    // Set depth to 2 for a fake root session
    (manager as any).callDepths.set("root_session", 2);

    const result = await manager.callAgent("nonexistent", "test", {
      parentSessionId: "root_session",
    });

    expect(result.status).toBe("error");
    expect(result.error).toContain("Call depth limit exceeded");
  });
});
