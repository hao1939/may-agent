import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "./manager.js";
import { prepareAgentExecution } from "./agent-execution.js";
import { fakeModel } from "../../test/fixtures/model.js";

function promptFor(manager: SubagentManager, name: string): string {
  const definition = manager.getAgentDefinition(name);
  if (!definition) throw new Error(`Missing test agent ${name}`);
  return prepareAgentExecution({
    definition,
    projectRoot: "/app",
    sessionId: "test-session",
    task: "test task",
    promptTimestamp: "2026-07-20T00:00:00.000Z",
  }).systemPrompt;
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
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(agentDir, { recursive: true, force: true });
  });

  it("wraps assembled prompt in <system_instructions> tags", () => {
    // Create AGENTS.md
    writeFileSync(join(agentDir, "AGENTS.md"), "# AGENTS — Test\n\n## Identity\nYou are a test agent.", "utf-8");

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

    const prompt = promptFor(manager, "ih-agent");

    expect(prompt).toMatch(/^<system_instructions>\n/);
    expect(prompt).toMatch(/\n<\/system_instructions>$/);
    expect(prompt).toContain("# AGENTS — Test");
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

    const prompt = promptFor(manager, "direct-agent");

    // Direct prompts bypass convention-file assembly, so no wrapping
    expect(prompt).toBe("You are a direct prompt agent.");
    expect(prompt).not.toContain("<system_instructions>");
  });

  it("produces identical system prompts across sessions (caching)", () => {
    writeFileSync(join(agentDir, "AGENTS.md"), "# AGENTS — Cache Test\nYou are stable.", "utf-8");

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

    const prompt1 = promptFor(manager, "cache-agent");
    const prompt2 = promptFor(manager, "cache-agent");

    expect(prompt1).toBe(prompt2);
    expect(prompt1).toMatch(/^<system_instructions>/);
  });

  it("loads only AGENTS.md plus runtime facts inside tags", () => {
    writeFileSync(join(agentDir, "AGENTS.md"), "# AGENTS\nIdentity block.", "utf-8");
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

    const prompt = promptFor(manager, "full-agent");

    // All content should be inside the tags
    const inner = prompt.slice("<system_instructions>\n".length, prompt.length - "\n</system_instructions>".length);

    expect(inner).toContain("# AGENTS");
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
    writeFileSync(join(agentDir, "AGENTS.md"), "# AGENTS\nTest.", "utf-8");

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

    const prompt = promptFor(manager, "nest-test");

    // First line should be the opening tag
    const lines = prompt.split("\n");
    expect(lines[0]).toBe("<system_instructions>");
    expect(lines[lines.length - 1]).toBe("</system_instructions>");
  });
});
