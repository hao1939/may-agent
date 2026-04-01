import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SubagentManager } from "../src/lib/index.js";
import { getModel } from "@mariozechner/pi-ai";

const tmpDir = join(process.cwd(), "test-workspace", "context-learning-test");
const persistDir = join(tmpDir, ".state");
const agentsDir = join(tmpDir, "agents");
const agentDir = join(agentsDir, "test-agent");
const contextPath = join(agentDir, "context.md");

// Minimal model for testing (won't actually call LLM)
const testModel = {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "test-model",
};

describe("Context Learning", () => {
  beforeEach(() => {
    // Clean up
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(join(agentDir, "knowledge"), { recursive: true });
    mkdirSync(join(agentDir, "workspace"), { recursive: true });
    mkdirSync(persistDir, { recursive: true });
  });

  it("applyContextUpdates creates context.md with added facts", () => {
    const manager = new SubagentManager({
      persistDir,
      projectRoot: tmpDir,
      infraRetryMax: 0,
    });

    manager.register({
      name: "test-agent",
      description: "test",
      domain: "test",
      tools: [],
      model: testModel,
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: tmpDir,
    });

    // Call the private method via any cast
    (manager as any).applyContextUpdates("test-agent", [
      { action: "add", content: "Project uses Bun not npm" },
      { action: "add", content: "Config files in /app/config/" },
    ]);

    expect(existsSync(contextPath)).toBe(true);
    const content = readFileSync(contextPath, "utf-8");
    expect(content).toContain("- Project uses Bun not npm");
    expect(content).toContain("- Config files in /app/config/");
  });

  it("applyContextUpdates removes facts", () => {
    const manager = new SubagentManager({
      persistDir,
      projectRoot: tmpDir,
      infraRetryMax: 0,
    });

    manager.register({
      name: "test-agent",
      description: "test",
      domain: "test",
      tools: [],
      model: testModel,
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: tmpDir,
    });

    // Pre-populate context.md
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(contextPath, "- Old fact about PostgreSQL\n- Keep this fact\n- Another old fact about pg\n");

    (manager as any).applyContextUpdates("test-agent", [{ action: "remove", content: "PostgreSQL" }]);

    const content = readFileSync(contextPath, "utf-8");
    expect(content).not.toContain("PostgreSQL");
    expect(content).toContain("Keep this fact");
    // "pg" line stays — we only removed lines containing "PostgreSQL", not "pg"
    expect(content).toContain("Another old fact about pg");
  });

  it("applyContextUpdates deduplicates", () => {
    const manager = new SubagentManager({
      persistDir,
      projectRoot: tmpDir,
      infraRetryMax: 0,
    });

    manager.register({
      name: "test-agent",
      description: "test",
      domain: "test",
      tools: [],
      model: testModel,
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: tmpDir,
    });

    (manager as any).applyContextUpdates("test-agent", [
      { action: "add", content: "Fact A" },
      { action: "add", content: "Fact A" },
      { action: "add", content: "Fact A" },
    ]);

    const content = readFileSync(contextPath, "utf-8");
    const matches = content.match(/Fact A/g);
    expect(matches?.length).toBe(1);
  });

  it("applyContextUpdates trims when over 2KB", () => {
    const manager = new SubagentManager({
      persistDir,
      projectRoot: tmpDir,
      infraRetryMax: 0,
    });

    manager.register({
      name: "test-agent",
      description: "test",
      domain: "test",
      tools: [],
      model: testModel,
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: tmpDir,
    });

    // Add lots of content to exceed 2KB
    const updates = Array.from({ length: 50 }, (_, i) => ({
      action: "add" as const,
      content: `Fact number ${i}: ${"x".repeat(80)}`,
    }));

    (manager as any).applyContextUpdates("test-agent", updates);

    const content = readFileSync(contextPath, "utf-8");
    expect(content.length).toBeLessThanOrEqual(2048 + 100); // small buffer for last line
    // Oldest entries should be trimmed (fact 0, 1, 2...)
    expect(content).not.toContain("Fact number 0:");
    // Newest entries should remain
    expect(content).toContain("Fact number 49:");
  });

  it("buildSessionContext includes context.md content", () => {
    const manager = new SubagentManager({
      persistDir,
      projectRoot: tmpDir,
      infraRetryMax: 0,
    });

    const def = {
      name: "test-agent",
      description: "test",
      domain: "test",
      tools: [],
      model: testModel,
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: tmpDir,
    };

    manager.register(def);

    // Write context.md
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(contextPath, "- Runtime is Bun\n- Config at /app/config/\n");

    // Call buildSessionContext via any cast
    const ctx = (manager as any).buildSessionContext(def, "test-agent", "s_test_1", persistDir);

    expect(ctx).toContain("What You Know (persistent context)");
    expect(ctx).toContain("Runtime is Bun");
    expect(ctx).toContain("Config at /app/config/");
  });

  it("buildSessionContext works without context.md", () => {
    const manager = new SubagentManager({
      persistDir,
      projectRoot: tmpDir,
      infraRetryMax: 0,
    });

    const def = {
      name: "test-agent",
      description: "test",
      domain: "test",
      tools: [],
      model: testModel,
      knowledgeDir: join(agentDir, "knowledge"),
      workspace: join(agentDir, "workspace"),
      projectRoot: tmpDir,
    };

    manager.register(def);

    // No context.md exists
    const ctx = (manager as any).buildSessionContext(def, "test-agent", "s_test_1", persistDir);

    expect(ctx).not.toContain("What You Know");
    expect(ctx).toContain("Session ID: s_test_1");
  });
});
