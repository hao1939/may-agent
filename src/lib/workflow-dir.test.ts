import { describe, it, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { SubagentManager } from "./manager.js";
import type { Model } from "@earendil-works/pi-ai";

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

describe("getWorkflowDir", () => {
  it("returns undefined for an unregistered agent name", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    expect(manager.getWorkflowDir("nonexistent")).toBeUndefined();
  });

  it("returns undefined when the agent has no workspace", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "no-workspace",
      description: "Agent without workspace",
      domain: "testing",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
    });
    expect(manager.getWorkflowDir("no-workspace")).toBeUndefined();
  });

  it("returns <dirname(workspace)>/workflows when workspace is set", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "coder",
      description: "Coding agent",
      domain: "coding",
      systemPrompt: "You are a coder.",
      workspace: "/home/user/agents/coder/workspace",
      model: fakeModel(),
      tools: [],
    });
    expect(manager.getWorkflowDir("coder")).toBe("/home/user/agents/coder/workflows");
  });

  it("works for different workspace paths", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "myagent",
      description: "Another agent",
      domain: "general",
      systemPrompt: "You are an agent.",
      workspace: "/tmp/myagent/ws",
      model: fakeModel(),
      tools: [],
    });
    expect(manager.getWorkflowDir("myagent")).toBe("/tmp/myagent/workflows");
  });
});
