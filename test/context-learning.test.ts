import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SubagentManager } from "../src/lib/index.js";
import { createContextUpdater } from "../src/lib/session-subscribers.js";
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

/**
 * Helper: emit a fake session_end event to the context updater subscriber.
 * This simulates what happens in production: the manager fires session_end
 * on the bus, and createContextUpdater reacts to it.
 */
function applyContextUpdates(
  projectRoot: string,
  agentName: string,
  updates: Array<{ action: string; content: string }>,
): void {
  const subscriber = createContextUpdater(projectRoot);
  subscriber({
    type: "session_end",
    sessionId: "s_test",
    agent: agentName,
    status: "done",
    finishParams: { context_updates: updates },
  } as any);
}

describe("Context Learning", () => {
  beforeEach(() => {
    // Clean up
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(join(agentDir, "knowledge"), { recursive: true });
    mkdirSync(join(agentDir, "workspace"), { recursive: true });
    mkdirSync(persistDir, { recursive: true });
  });

  it("applyContextUpdates creates context.md with added facts", () => {
    applyContextUpdates(tmpDir, "test-agent", [
      { action: "add", content: "Project uses Bun not npm" },
      { action: "add", content: "Config files in /app/config/" },
    ]);

    expect(existsSync(contextPath)).toBe(true);
    const content = readFileSync(contextPath, "utf-8");
    expect(content).toContain("- Project uses Bun not npm");
    expect(content).toContain("- Config files in /app/config/");
  });

  it("applyContextUpdates removes facts", () => {
    // Pre-populate context.md
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(contextPath, "- Old fact about PostgreSQL\n- Keep this fact\n- Another old fact about pg\n");

    applyContextUpdates(tmpDir, "test-agent", [{ action: "remove", content: "PostgreSQL" }]);

    const content = readFileSync(contextPath, "utf-8");
    expect(content).not.toContain("PostgreSQL");
    expect(content).toContain("Keep this fact");
    // "pg" line stays — we only removed lines containing "PostgreSQL", not "pg"
    expect(content).toContain("Another old fact about pg");
  });

  it("applyContextUpdates deduplicates", () => {
    applyContextUpdates(tmpDir, "test-agent", [
      { action: "add", content: "Fact A" },
      { action: "add", content: "Fact A" },
      { action: "add", content: "Fact A" },
    ]);

    const content = readFileSync(contextPath, "utf-8");
    const matches = content.match(/Fact A/g);
    expect(matches?.length).toBe(1);
  });

  it("applyContextUpdates is idempotent for existing content", () => {
    // Pre-populate context.md with a fact
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(contextPath, "- Existing fact\n");

    // Try to add the same fact again
    applyContextUpdates(tmpDir, "test-agent", [{ action: "add", content: "Existing fact" }]);

    const content = readFileSync(contextPath, "utf-8");
    const matches = content.match(/Existing fact/g);
    expect(matches?.length).toBe(1);
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
