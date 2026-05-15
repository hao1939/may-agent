import { describe, it, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
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

describe("SubagentManager.getKnowledgePath()", () => {
  it("returns knowledgeDir for a registered agent", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    manager.register({
      name: "agent-k",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
      knowledgeDir: "/path/to/knowledge",
    });

    expect(manager.getKnowledgePath("agent-k")).toBe("/path/to/knowledge");
  });

  it("returns undefined for an unregistered agent", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    expect(manager.getKnowledgePath("nonexistent")).toBeUndefined();
  });

  it("returns undefined when knowledgeDir is not set", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    manager.register({
      name: "agent-nk",
      description: "Test",
      domain: "test",
      systemPrompt: "Test",
      model: fakeModel(),
      tools: [],
    });

    expect(manager.getKnowledgePath("agent-nk")).toBeUndefined();
  });
});
