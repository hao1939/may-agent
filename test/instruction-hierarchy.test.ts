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

describe("Instruction Hierarchy (P84)", () => {
  let persistDir: string;
  let agentDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-ih-test-"));
    agentDir = mkdtempSync(join(tmpdir(), "may-ih-agent-"));
    mkdirSync(join(agentDir, "knowledge"), { recursive: true });
    mkdirSync(join(agentDir, "workspace"), { recursive: true });
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(agentDir, { recursive: true, force: true });
  });

  it("wraps convention-file prompt in <system_instructions> tags", () => {
    // Create SOUL.md
    writeFileSync(
      join(agentDir, "SOUL.md"),
      "# SOUL — Test\n\n## Identity\nYou are a test agent.",
      "utf-8",
    );

    manager.register({
      name: "ih-agent",
      description: "Test agent",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: "/app",
    });

    // Access the private method for testing
    // @ts-expect-error Accessing private method
    const prompt: string = manager.resolveSystemPrompt(
      manager.getAgentDefinition("ih-agent"),
    );

    expect(prompt).toMatch(/^<system_instructions>\n/);
    expect(prompt).toMatch(/\n<\/system_instructions>$/);
    expect(prompt).toContain("# SOUL — Test");
    expect(prompt).toContain("# Runtime Environment");
  });

  it("does NOT wrap when systemPrompt is set directly", () => {
    manager.register({
      name: "direct-agent",
      description: "Test agent",
      domain: "test",
      systemPrompt: "You are a direct prompt agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    // @ts-expect-error Accessing private method
    const prompt: string = manager.resolveSystemPrompt(
      manager.getAgentDefinition("direct-agent"),
    );

    // Direct prompts bypass convention-file assembly, so no wrapping
    expect(prompt).toBe("You are a direct prompt agent.");
    expect(prompt).not.toContain("<system_instructions>");
  });

  it("produces identical system prompts across sessions (caching)", () => {
    writeFileSync(
      join(agentDir, "SOUL.md"),
      "# SOUL — Cache Test\nYou are stable.",
      "utf-8",
    );

    manager.register({
      name: "cache-agent",
      description: "Test agent",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: "/app",
    });

    const def = manager.getAgentDefinition("cache-agent");
    // @ts-expect-error Accessing private method
    const prompt1: string = manager.resolveSystemPrompt(def);
    // @ts-expect-error Accessing private method
    const prompt2: string = manager.resolveSystemPrompt(def);

    expect(prompt1).toBe(prompt2);
    expect(prompt1).toMatch(/^<system_instructions>/);
  });

  it("wraps all convention files inside tags", () => {
    writeFileSync(join(agentDir, "SOUL.md"), "# SOUL\nIdentity block.", "utf-8");
    writeFileSync(join(agentDir, "DOMAIN.md"), "# Domain\nExpertise block.", "utf-8");
    writeFileSync(join(agentDir, "TOOLS.md"), "# Tools\nTool guide.", "utf-8");
    writeFileSync(join(agentDir, "LESSONS.md"), "# Lessons\nLearned stuff.", "utf-8");
    writeFileSync(join(agentDir, "knowledge", "INDEX.md"), "# Index\nKnowledge index.", "utf-8");

    manager.register({
      name: "full-agent",
      description: "Full agent",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: "/app",
    });

    // @ts-expect-error Accessing private method
    const prompt: string = manager.resolveSystemPrompt(
      manager.getAgentDefinition("full-agent"),
    );

    // All content should be inside the tags
    const inner = prompt.slice(
      "<system_instructions>\n".length,
      prompt.length - "\n</system_instructions>".length,
    );

    expect(inner).toContain("# SOUL");
    expect(inner).toContain("# Runtime Environment");

    // Files no longer loaded (removed as part of prompt simplification):
    // DOMAIN.md, TOOLS.md, LESSONS.md, knowledge/INDEX.md

    // Tags appear exactly once (no nesting)
    const openCount = (prompt.match(/<system_instructions>/g) || []).length;
    const closeCount = (prompt.match(/<\/system_instructions>/g) || []).length;
    expect(openCount).toBe(1);
    expect(closeCount).toBe(1);
  });

  it("tags appear at the outermost level (no nesting)", () => {
    writeFileSync(join(agentDir, "SOUL.md"), "# SOUL\nTest.", "utf-8");

    manager.register({
      name: "nest-test",
      description: "Test",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
    });

    // @ts-expect-error Accessing private method
    const prompt: string = manager.resolveSystemPrompt(
      manager.getAgentDefinition("nest-test"),
    );

    // First line should be the opening tag
    const lines = prompt.split("\n");
    expect(lines[0]).toBe("<system_instructions>");
    expect(lines[lines.length - 1]).toBe("</system_instructions>");
  });
});
