import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wrapToolsWithReceipts, type ReceiptWrapContext } from "../src/lib/manager-receipts.js";
import type { ActiveSession } from "../src/lib/manager-utils.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";

/**
 * P114 Experience Replay Enforcer Tests
 *
 * Verifies that the runtime harness blocks edit/write tool calls from ANY
 * agent when it hasn't first read its ERROR_LOG.jsonl (universalized P114).
 */
describe("P114 Experience Replay Enforcer", () => {
  let projectRoot: string;
  let persistDir: string;
  let activeSessions: Map<string, ActiveSession>;
  let ctx: ReceiptWrapContext;
  const sessionId = "test_p114_session";

  // Create a minimal ActiveSession stub
  function makeSession(agentName: string): ActiveSession {
    return {
      sessionId,
      agentName,
      agent: {} as any,
      promise: Promise.resolve(),
      task: "test task",
      startedAt: Date.now(),
      status: "running",
      outputDir: "/tmp/out",
      closed: false,
      autoClose: "immediate",
      kind: "job",
      opBudget: 0,
      opCount: 0,
      infraRetryCount: 0,
      toolErrorHistory: new Map(),
      toolErrorCount: 0,
      turnBudgetWarningAt: 40,
      turnBudgetWarned: false,
      hasReadErrorLog: false,
      turnCount: 0,
    };
  }

  // Create a minimal tool stub
  function makeTool(name: string): AgentTool {
    return {
      name,
      label: name,
      description: `Test ${name} tool`,
      parameters: {},
      execute: async () => ({
        content: [{ type: "text" as const, text: `${name} executed successfully` }],
        details: undefined,
      }),
    };
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "p114-test-"));
    persistDir = join(projectRoot, ".state");
    mkdirSync(persistDir, { recursive: true });

    // Create session dir for receipt logging
    mkdirSync(join(persistDir, "sessions", sessionId), { recursive: true });

    activeSessions = new Map();
    ctx = { activeSessions, persistDir, projectRoot };
  });

  afterEach(() => {
    if (existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("blocks coder edit when ERROR_LOG.jsonl exists and has not been read", async () => {
    // Create coder's ERROR_LOG.jsonl with content
    const agentDir = join(projectRoot, "agents", "coder");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"test failure","timestamp":"2026-03-14"}\n');

    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit"), makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const editTool = wrapped.find(t => t.name === "edit")!;

    const result = await editTool.execute("tc1", { path: "src/foo.ts", oldText: "a", newText: "b" });
    const text = result.content.map((b: any) => b.text).join("");

    expect(text).toContain("BLOCKED");
    expect(text).toContain("P114");
    expect(text).toContain("ERROR_LOG.jsonl");
  });

  it("blocks coder write when ERROR_LOG.jsonl exists and has not been read", async () => {
    const agentDir = join(projectRoot, "agents", "coder");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"test failure"}\n');

    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("write"), makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const writeTool = wrapped.find(t => t.name === "write")!;

    const result = await writeTool.execute("tc2", { path: "src/foo.ts", content: "hello" });
    const text = result.content.map((b: any) => b.text).join("");

    expect(text).toContain("BLOCKED");
    expect(text).toContain("P114");
  });

  it("allows coder edit after reading ERROR_LOG.jsonl", async () => {
    const agentDir = join(projectRoot, "agents", "coder");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"test failure"}\n');

    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit"), makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);

    // First: read ERROR_LOG.jsonl
    const readTool = wrapped.find(t => t.name === "read")!;
    await readTool.execute("tc-read", { path: "agents/coder/ERROR_LOG.jsonl" });

    // Now edit should be allowed
    const editTool = wrapped.find(t => t.name === "edit")!;
    const result = await editTool.execute("tc-edit", { path: "src/foo.ts", oldText: "a", newText: "b" });
    const text = result.content.map((b: any) => b.text).join("");

    expect(text).not.toContain("BLOCKED");
    expect(text).toContain("edit executed successfully");
  });

  it("does not block coder when ERROR_LOG.jsonl does not exist", async () => {
    // No ERROR_LOG.jsonl created — agent dir may or may not exist
    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const editTool = wrapped.find(t => t.name === "edit")!;

    const result = await editTool.execute("tc3", { path: "src/foo.ts", oldText: "a", newText: "b" });
    const text = result.content.map((b: any) => b.text).join("");

    expect(text).not.toContain("BLOCKED");
    expect(text).toContain("edit executed successfully");
  });

  it("does not block coder when ERROR_LOG.jsonl is empty", async () => {
    const agentDir = join(projectRoot, "agents", "coder");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), ""); // empty file

    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const editTool = wrapped.find(t => t.name === "edit")!;

    const result = await editTool.execute("tc4", { path: "src/foo.ts", oldText: "a", newText: "b" });
    const text = result.content.map((b: any) => b.text).join("");

    expect(text).not.toContain("BLOCKED");
  });

  it("blocks non-coder agents (universalized P114)", async () => {
    // Create tech-lead's ERROR_LOG.jsonl
    const agentDir = join(projectRoot, "agents", "tech-lead");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"test failure"}\n');

    const session = makeSession("tech-lead");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const editTool = wrapped.find(t => t.name === "edit")!;

    const result = await editTool.execute("tc5", { path: "src/foo.ts", oldText: "a", newText: "b" });
    const text = result.content.map((b: any) => b.text).join("");

    expect(text).toContain("BLOCKED");
    expect(text).toContain("P114");
    expect(text).toContain("agents/tech-lead/ERROR_LOG.jsonl");
  });

  it("allows non-coder agent after reading ERROR_LOG.jsonl", async () => {
    const agentDir = join(projectRoot, "agents", "optimizer");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"optimizer failure"}\n');

    const session = makeSession("optimizer");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit"), makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);

    // Read ERROR_LOG first
    const readTool = wrapped.find(t => t.name === "read")!;
    await readTool.execute("tc-read", { path: "agents/optimizer/ERROR_LOG.jsonl" });

    // Now edit should be allowed
    const editTool = wrapped.find(t => t.name === "edit")!;
    const result = await editTool.execute("tc-edit", { path: "src/foo.ts", oldText: "a", newText: "b" });
    const text = result.content.map((b: any) => b.text).join("");

    expect(text).not.toContain("BLOCKED");
    expect(text).toContain("edit executed successfully");
  });

  it("tracks read of ERROR_LOG via path substring matching", async () => {
    const agentDir = join(projectRoot, "agents", "coder");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"test"}\n');

    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit"), makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);

    // Read with a path that contains ERROR_LOG
    const readTool = wrapped.find(t => t.name === "read")!;
    await readTool.execute("tc-read", { path: "agents/coder/ERROR_LOG.jsonl" });

    // Verify the flag was set
    expect(session.hasReadErrorLog).toBe(true);
  });

  it("sets hasReadErrorLog for various ERROR_LOG path formats", async () => {
    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const readTool = wrapped.find(t => t.name === "read")!;

    // Test with ERROR_LOG.md (legacy format)
    await readTool.execute("tc-r1", { path: "agents/coder/ERROR_LOG.md" });
    expect(session.hasReadErrorLog).toBe(true);
  });

  it("does not set hasReadErrorLog for unrelated reads", async () => {
    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const readTool = wrapped.find(t => t.name === "read")!;

    await readTool.execute("tc-r2", { path: "src/lib/manager.ts" });
    expect(session.hasReadErrorLog).toBe(false);
  });

  it("allows coder read tool calls regardless of ERROR_LOG status", async () => {
    const agentDir = join(projectRoot, "agents", "coder");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"test"}\n');

    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("read")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const readTool = wrapped.find(t => t.name === "read")!;

    // Read of non-ERROR_LOG should succeed (not blocked)
    const result = await readTool.execute("tc-r3", { path: "src/lib/foo.ts" });
    const text = result.content.map((b: any) => b.text).join("");
    expect(text).not.toContain("BLOCKED");
  });

  it("P114 block message includes instruction on what to read", async () => {
    const agentDir = join(projectRoot, "agents", "coder");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), '{"error":"test"}\n');

    const session = makeSession("coder");
    activeSessions.set(sessionId, session);

    const tools = [makeTool("edit")];
    const wrapped = wrapToolsWithReceipts(tools, sessionId, ctx);
    const editTool = wrapped.find(t => t.name === "edit")!;

    const result = await editTool.execute("tc6", { path: "src/foo.ts", oldText: "a", newText: "b" });
    const text = result.content.map((b: any) => b.text).join("");

    // Should tell the coder exactly what to read
    expect(text).toContain("agents/coder/ERROR_LOG.jsonl");
    expect(text).toContain("previous failures");
  });
});
