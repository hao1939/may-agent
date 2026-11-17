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
import { controlledWorkflowImport, observeBoundedResult } from "../../test/fixtures/workflow-import.js";

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

  it("keeps one pinned catalog per execution tree when a loaded tool serves later callers", async () => {
    let caller = "first";
    const tool = manager.createAgentsTool({ getCallerSessionId: () => caller });
    const first = { name: "reviewer", description: "First snapshot", domain: "fixture", model: mockModel(), tools: [] };
    const second = { name: "reviewer", description: "Second snapshot", domain: "fixture", model: mockModel(), tools: [] };
    manager.activeSessions.set("first", { taskContext: { agentDefinitions: new Map([["reviewer", first]]) } } as any);
    manager.activeSessions.set("second", { taskContext: { agentDefinitions: new Map([["reviewer", second]]) } } as any);
    const invoked: unknown[] = [];
    manager.callAgentDefinition = async (definition) => {
      invoked.push(definition);
      return { sessionId: `s_${invoked.length}`, status: "done", lastAssistantText: "done", messages: [], duration: "0s", outputDir: "", finishResult: { status: "done", summary: definition.description } };
    };

    expect((await callTool(tool, { action: "list" }))[0].description).toBe("First snapshot");
    caller = "second";
    expect((await callTool(tool, { action: "list" }))[0].description).toBe("Second snapshot");
    expect(await callTool(tool, { action: "call", agent: "global/reviewer", input: { prompt: "second" } })).toMatchObject({ summary: "Second snapshot" });
    caller = "first";
    expect(await callTool(tool, { action: "call", agent: "global/reviewer", input: { prompt: "first" } })).toMatchObject({ summary: "First snapshot" });
    expect(invoked).toEqual([second, first]);
  });

  it("shares pinned preparation while binding a child call to the child's live session", async () => {
    const captured = { name: "reviewer", description: "Shared snapshot", domain: "fixture", model: mockModel(), tools: [] };
    const taskContext = { agentDefinitions: new Map([["reviewer", captured]]) };
    manager.activeSessions.set("parent", { taskContext } as any);
    manager.activeSessions.set("child", { taskContext } as any);
    const parentTool = manager.createAgentsTool({ getCallerSessionId: () => "parent" });
    const childTool = manager.createAgentsTool({ getCallerSessionId: () => "child" });
    const calls: Array<{ definition: unknown; parentSessionId?: string }> = [];
    manager.callAgentDefinition = async (definition, _task, options) => {
      calls.push({ definition, parentSessionId: options?.parentSessionId });
      return { sessionId: "grandchild", status: "done", lastAssistantText: "done", messages: [], duration: "0s", outputDir: "", finishResult: { status: "done", summary: "done" } };
    };

    const parentDescriptors = await callTool(parentTool, { action: "list" });
    expect(await callTool(childTool, { action: "list" })).toEqual(parentDescriptors);
    expect(await callTool(childTool, { action: "call", agent: "global/reviewer", input: { prompt: "Review" } })).toMatchObject({ id: "grandchild", status: "done" });
    expect(calls).toEqual([{ definition: captured, parentSessionId: "child" }]);
  });

  it.each(["timeout", "cancel"] as const)("bounds complete catalog preparation on %s", async (mode) => {
    const gate = await controlledWorkflowImport(persistDir);
    const agentDir = join(persistDir, `stalled-${mode}`);
    mkdirSync(join(agentDir, "workflows"), { recursive: true });
    writeFileSync(join(agentDir, "workflows", "stalled.ts"), gate.source);
    manager.register({ name: "owner", description: "Owner", domain: "fixture", model: mockModel(), tools: [], agentDir });
    const parent = new AbortController();
    manager.activeSessions.set("caller", {
      taskContext: { agentDefinitions: new Map([["owner", manager.getAgentDefinition("owner")]]) },
      executionScope: {
        signal: parent.signal,
        workSignal: parent.signal,
        deadlineAt: Infinity,
        workDeadlineAt: Infinity,
      },
    } as any);
    const tool = manager.createAgentsTool({ getCallerSessionId: () => "caller" });
    const run = callTool(tool, {
      action: "call",
      agent: "global/owner",
      input: { prompt: "bounded preparation" },
      ...(mode === "timeout" ? { options: { timeoutMs: 20 } } : {}),
    });
    await gate.started;
    if (mode === "cancel") parent.abort(new Error("parent stopped"));
    const observed = await observeBoundedResult(run);
    expect(observed).toBeDefined();
    expect(observed!.result).toMatchObject({ status: "error" });
    gate.release();
    await gate.completed;
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
