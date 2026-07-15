import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { createContextUpdater, createLastSessionWriter } from "./session-subscribers.js";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";

let tmpDir: string;
let persistDir: string;
let agentsDir: string;
let agentDir: string;
let contextPath: string;

// Minimal model for testing (won't actually call LLM)
const testModel = {
  ...getBuiltinModel("anthropic", "claude-opus-4-6"),
  id: "test-model",
};

/**
 * Helper: emit a fake session.end event to the context updater subscriber.
 * This simulates what happens in production: the manager fires session.end
 * on the bus, and createContextUpdater reacts to it.
 */
function applyContextUpdates(
  projectRoot: string,
  agentName: string,
  updates: Array<{ action: string; content: string }>,
): void {
  const subscriber = createContextUpdater(projectRoot);
  subscriber({
    type: "session.end",
    source: "runtime",
    owner: `agent:${agentName}`,
    data: {
      sessionId: "s_test",
      agent: agentName,
      outcome: "done",
      summary: "done",
      durationMs: 0,
      status: "done",
      finishParams: { context_updates: updates },
    },
  } as any);
}

describe("Context Learning", () => {
  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-learning-test-${randomBytes(6).toString("hex")}`);
    persistDir = join(tmpDir, ".state");
    agentsDir = join(tmpDir, "agents");
    agentDir = join(agentsDir, "test-agent");
    contextPath = join(agentDir, "context.md");
    mkdirSync(join(agentDir, "knowledge"), { recursive: true });
    mkdirSync(join(agentDir, "workspace"), { recursive: true });
    mkdirSync(persistDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
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

  it("writes context updates to an app-local agent when registered there", () => {
    const appAgentDir = join(tmpDir, "projects", "may-agent.app", "agents", "arc");
    const appContextPath = join(appAgentDir, "context.md");
    mkdirSync(appAgentDir, { recursive: true });
    writeFileSync(join(tmpDir, "projects", "may-agent.app", "app.ts"), "export default {};\n");
    writeFileSync(join(appAgentDir, "agent.json"), JSON.stringify({ name: "arc", model: "test", tools: [] }));

    applyContextUpdates(tmpDir, "arc", [{ action: "add", content: "Arc is app-local" }]);

    expect(existsSync(appContextPath)).toBe(true);
    expect(existsSync(join(tmpDir, "agents", "arc", "context.md"))).toBe(false);
    expect(readFileSync(appContextPath, "utf-8")).toContain("- Arc is app-local");
  });

  it("writes last-session handoff to an app-local agent when registered there", () => {
    const appAgentDir = join(tmpDir, "projects", "may-agent.app", "agents", "arc");
    const lastSessionPath = join(appAgentDir, "last-session.md");
    mkdirSync(appAgentDir, { recursive: true });
    writeFileSync(join(tmpDir, "projects", "may-agent.app", "app.ts"), "export default {};\n");
    writeFileSync(join(appAgentDir, "agent.json"), JSON.stringify({ name: "arc", model: "test", tools: [] }));

    createLastSessionWriter(tmpDir)({
      type: "session.end",
      source: "runtime",
      owner: "agent:arc",
      data: {
        sessionId: "s_test",
        agent: "arc",
        outcome: "Reviewed app-local migration",
        status: "done",
      },
    } as any);

    expect(existsSync(lastSessionPath)).toBe(true);
    expect(existsSync(join(tmpDir, "agents", "arc", "last-session.md"))).toBe(false);
    expect(readFileSync(lastSessionPath, "utf-8")).toContain("Reviewed app-local migration");
  });
});
