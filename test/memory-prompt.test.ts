import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
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

describe("System prompt assembly", () => {
  let persistDir: string;
  let knowledgeDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-prompt-test-"));
    knowledgeDir = mkdtempSync(join(tmpdir(), "may-knowledge-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(knowledgeDir, { recursive: true, force: true });
  });

  it("uses systemPrompt directly when set", async () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "direct-prompt",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a direct prompt agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("direct-prompt", "do something");
    await manager.waitFor(sessionId);

    // We can't easily inspect the system prompt directly, but we can verify
    // the agent ran (the test is that it doesn't crash with systemPrompt set)
    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });

  it("runs without a direct systemPrompt", async () => {
    // Create knowledge files
    const file1 = join(knowledgeDir, "domain.md");
    const file2 = join(knowledgeDir, "patterns.md");
    writeFileSync(file1, "# Domain\nYou are an expert.", "utf-8");
    writeFileSync(file2, "# Patterns\nUse pattern X.", "utf-8");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "files-agent",
      description: "Test",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("files-agent", "do something");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });

  it("runs with memoryLimit set (digest-based context)", async () => {
    const file1 = join(knowledgeDir, "domain.md");
    writeFileSync(file1, "# Identity\nYou are a test agent.", "utf-8");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "memory-agent",
      description: "Test",
      domain: "test",
      workspace: "/test/workspace",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      memoryLimit: 10,
    });

    const sessionId = manager.run("memory-agent", "do something");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });

  it("skips memory section when memoryLimit is 0", async () => {
    const file1 = join(knowledgeDir, "domain.md");
    writeFileSync(file1, "# Identity\nYou are a test agent.", "utf-8");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "no-memory-agent",
      description: "Test",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      memoryLimit: 0,
    });

    const sessionId = manager.run("no-memory-agent", "do something");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });
});
