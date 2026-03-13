import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import type { Model } from "@mariozechner/pi-ai";

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

describe("delegation metrics logging", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-delegation-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "child-agent",
      description: "Test child agent",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    manager.register({
      name: "parent-agent",
      description: "Test parent agent",
      domain: "test",
      systemPrompt: "You are a test parent agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("logs a delegation entry when callAgent completes", async () => {
    // Start a parent session so callAgent has a parentSessionId to reference
    const parentSessionId = manager.run("parent-agent", "parent task");

    // callAgent as if parent is calling child
    const result = await manager.callAgent("child-agent", "child task", {
      parentSessionId,
    });

    // Wait for parent to finish too
    await manager.waitFor(parentSessionId);

    const logPath = join(persistDir, "delegations.jsonl");
    expect(existsSync(logPath)).toBe(true);

    const lines = readFileSync(logPath, "utf-8").trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.parent).toBe("parent-agent");
    expect(entry.child).toBe("child-agent");
    expect(entry.method).toBe("call");
    expect(["success", "error"]).toContain(entry.status);
    expect(entry.traceId).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(typeof entry.durationMs).toBe("number");
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.sessionId).toBeTruthy();
  });

  it("does not create log file when no delegations occur", async () => {
    const sessionId = manager.run("child-agent", "standalone task");
    await manager.waitFor(sessionId);

    const logPath = join(persistDir, "delegations.jsonl");
    expect(existsSync(logPath)).toBe(false);
  });

  it("logs correct schema fields", async () => {
    await manager.callAgent("child-agent", "test task");

    const logPath = join(persistDir, "delegations.jsonl");
    expect(existsSync(logPath)).toBe(true);

    const entry = JSON.parse(readFileSync(logPath, "utf-8").trim().split("\n")[0]);

    // Verify all required schema fields are present
    const requiredFields = ["timestamp", "traceId", "sessionId", "parent", "child", "method", "status", "durationMs", "error"];
    for (const field of requiredFields) {
      expect(entry).toHaveProperty(field);
    }
  });

  it("logs send delegations via agents tool", async () => {
    // Create an agents root directory for the send action
    const agentsRoot = join(persistDir, "agents");
    const tool = manager.createAgentsTool({
      getCallerSessionId: () => "test-session-123",
      getCallerAgentName: () => "orchestrator",
      agentsRoot,
    });

    // Execute a send action
    await tool.execute("tool-call-1", {
      action: "send",
      agent: "child-agent",
      message: "do something",
    });

    const logPath = join(persistDir, "delegations.jsonl");
    expect(existsSync(logPath)).toBe(true);

    const entry = JSON.parse(readFileSync(logPath, "utf-8").trim().split("\n")[0]);
    expect(entry.parent).toBe("orchestrator");
    expect(entry.child).toBe("child-agent");
    expect(entry.method).toBe("send");
    expect(entry.status).toBe("sent");
    expect(entry.sessionId).toBe("test-session-123");
    expect(entry.durationMs).toBeNull();
  });
});
