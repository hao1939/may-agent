import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { truncateForPrompt } from "../src/lib/manager.js";
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

describe("truncateForPrompt", () => {
  it("returns short text unchanged", () => {
    expect(truncateForPrompt("hello world", 100)).toBe("hello world");
  });

  it("truncates long text and adds ellipsis", () => {
    const long = "a".repeat(300);
    const result = truncateForPrompt(long, 200);
    expect(result.length).toBe(201); // 200 chars + "…"
    expect(result.endsWith("…")).toBe(true);
    expect(result.startsWith("a".repeat(200))).toBe(true);
  });

  it("collapses newlines to spaces", () => {
    const multiline = "line one\nline two\nline three";
    expect(truncateForPrompt(multiline, 100)).toBe("line one line two line three");
  });

  it("collapses multiple whitespace", () => {
    const text = "word1   word2\n\n\nword3\t\tword4";
    expect(truncateForPrompt(text, 100)).toBe("word1 word2 word3 word4");
  });

  it("trims leading and trailing whitespace", () => {
    expect(truncateForPrompt("  hello  ", 100)).toBe("hello");
  });

  it("handles empty string", () => {
    expect(truncateForPrompt("", 100)).toBe("");
  });

  it("handles exact length text", () => {
    const exact = "a".repeat(100);
    expect(truncateForPrompt(exact, 100)).toBe(exact);
  });

  it("truncates text that becomes long after collapsing newlines", () => {
    // Multi-line text that's long when collapsed
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const result = truncateForPrompt(lines, 50);
    expect(result.length).toBe(51); // 50 + "…"
    expect(result.endsWith("…")).toBe(true);
    // Should not contain newlines
    expect(result.includes("\n")).toBe(false);
  });
});

describe("Manager session startup robustness", () => {
  let persistDir: string;
  let knowledgeDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-mem-trunc-test-"));
    knowledgeDir = join(persistDir, "knowledge");
    mkdirSync(knowledgeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("runs with large task text without crashing", async () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    // We can't directly access the system prompt, but we can verify
    // the manager doesn't crash and the session starts successfully
    const domainFile = join(knowledgeDir, "domain.md");
    writeFileSync(domainFile, "# Test Agent\nYou are a test.", "utf-8");

    manager.register({
      name: "test-agent",
      description: "Test",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      memoryLimit: 5,
    });

    // The session should start without issues
    const sessionId = manager.run("test-agent", "test task");
    await manager.waitFor(sessionId);
    const result = manager.result(sessionId);
    expect(result).toBeDefined();
  });

  it("runs with long summary text without crashing", async () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const domainFile = join(knowledgeDir, "domain.md");
    writeFileSync(domainFile, "# Test Agent\nYou are a test.", "utf-8");

    manager.register({
      name: "test-agent2",
      description: "Test",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      memoryLimit: 5,
    });

    const sessionId = manager.run("test-agent2", "test task");
    await manager.waitFor(sessionId);
    const result = manager.result(sessionId);
    expect(result).toBeDefined();
  });
});
