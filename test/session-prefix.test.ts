import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { SubagentManager } from "../src/manager.js";
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

describe("session ID prefix", () => {
  it("uses default 's' prefix when sessionIdPrefix is not set", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "default-agent",
      description: "Agent with default prefix",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("default-agent", "do something");
    expect(sessionId).toMatch(/^s_\d+_\d+$/);
  });

  it("uses custom prefix when sessionIdPrefix is set", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "custom-agent",
      description: "Agent with custom prefix",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      sessionIdPrefix: "custom",
    });

    const sessionId = manager.run("custom-agent", "do something");
    expect(sessionId).toMatch(/^custom_\d+_\d+$/);
  });

  it("different agents can have different prefixes", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "coder",
      description: "Coder agent",
      domain: "dev",
      systemPrompt: "You code.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      sessionIdPrefix: "coder",
    });
    manager.register({
      name: "reviewer",
      description: "Reviewer agent",
      domain: "dev",
      systemPrompt: "You review.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      sessionIdPrefix: "rev",
    });

    const coderId = manager.run("coder", "write code");
    const reviewerId = manager.run("reviewer", "review code");

    expect(coderId).toMatch(/^coder_\d+_\d+$/);
    expect(reviewerId).toMatch(/^rev_\d+_\d+$/);
  });
});
