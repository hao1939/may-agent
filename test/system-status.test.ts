/**
 * Tests for the system-status tool.
 *
 * Tests the tool against real .state/ data to verify:
 * - Active session scanning
 * - History tail-read optimization (sort & slice)
 * - JSONL tail reading (delegations)
 * - Focus tasks and todo parsing
 * - Output formatting
 *
 * Note: Job history comes from SQLite (requests table) which requires bun:sqlite.
 * Under vitest (Node.js), job queries return empty results gracefully.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSystemStatusTool } from "../src/lib/tools/system-status.js";

// ── Test fixtures ───────────────────────────────────────────────────────

function createTestState() {
  const root = mkdtempSync(join(tmpdir(), "sys-status-test-"));
  const stateDir = join(root, ".state");
  const agentsRoot = join(root, "agents");

  // Create directory structure
  mkdirSync(join(stateDir, "sessions", "history"), { recursive: true });
  mkdirSync(join(agentsRoot, "shared"), { recursive: true });
  mkdirSync(join(agentsRoot, "may", "workspace"), { recursive: true });

  // Create active sessions
  const activeSession1 = "s_" + (Date.now() - 30_000) + "_1"; // 30s ago
  mkdirSync(join(stateDir, "sessions", activeSession1));
  writeFileSync(
    join(stateDir, "sessions", activeSession1, "meta.json"),
    JSON.stringify({
      agent: "bob",
      task: "[heartbeat] Read heartbeat.md",
      status: "running",
      startedAt: Date.now() - 30_000,
      kind: "job",
    }),
  );

  const activeSession2 = "s_" + (Date.now() - 120_000) + "_2"; // 2m ago
  mkdirSync(join(stateDir, "sessions", activeSession2));
  writeFileSync(
    join(stateDir, "sessions", activeSession2, "meta.json"),
    JSON.stringify({
      agent: "may",
      task: "Triage inbox",
      status: "idle",
      startedAt: Date.now() - 120_000,
      kind: "chat",
    }),
  );

  // Create history sessions (some recent, some old)
  const recentHistory = "s_" + (Date.now() - 5 * 60_000) + "_100";
  mkdirSync(join(stateDir, "sessions", "history", recentHistory));
  writeFileSync(
    join(stateDir, "sessions", "history", recentHistory, "meta.json"),
    JSON.stringify({
      agent: "coder",
      task: "Implement feature X",
      status: "done",
      startedAt: Date.now() - 6 * 60_000,
      endedAt: Date.now() - 5 * 60_000,
      kind: "call",
    }),
  );

  const recentError = "s_" + (Date.now() - 10 * 60_000) + "_101";
  mkdirSync(join(stateDir, "sessions", "history", recentError));
  writeFileSync(
    join(stateDir, "sessions", "history", recentError, "meta.json"),
    JSON.stringify({
      agent: "optimizer",
      task: "Optimize prompts",
      status: "error",
      startedAt: Date.now() - 12 * 60_000,
      endedAt: Date.now() - 10 * 60_000,
      error: "Context limit exceeded",
      kind: "call",
    }),
  );

  // Old history (should be outside 60m window)
  const oldHistory = "s_" + (Date.now() - 120 * 60_000) + "_50";
  mkdirSync(join(stateDir, "sessions", "history", oldHistory));
  writeFileSync(
    join(stateDir, "sessions", "history", oldHistory, "meta.json"),
    JSON.stringify({
      agent: "scout",
      task: "Deep dive research",
      status: "done",
      startedAt: Date.now() - 150 * 60_000,
      endedAt: Date.now() - 120 * 60_000,
    }),
  );

  // Create delegations.jsonl
  const delegations = [
    JSON.stringify({
      timestamp: new Date(Date.now() - 30_000).toISOString(),
      parent: "bob",
      child: "tech-lead",
      method: "call",
      status: "done",
      durationMs: 45000,
      error: null,
    }),
    JSON.stringify({
      timestamp: new Date(Date.now() - 60_000).toISOString(),
      parent: "bob",
      child: "optimizer",
      method: "call",
      status: "error",
      durationMs: 189000,
      error: "LLM returned stopReason toolUse but no tool call",
    }),
    JSON.stringify({
      timestamp: new Date(Date.now() - 90_000).toISOString(),
      parent: "may",
      child: "scout",
      method: "send",
      status: "sent",
      durationMs: null,
      error: null,
    }),
  ];
  writeFileSync(join(stateDir, "delegations.jsonl"), delegations.join("\n") + "\n");

  // Note: job history now comes from SQLite (requests table), not JSONL.
  // No job-history.jsonl fixture needed.

  // Create focus-tasks.md
  writeFileSync(
    join(agentsRoot, "shared", "focus-tasks.md"),
    `# Focus Tasks

**Status: Active**

## Active Focus

### Security & Hierarchy (P84/P85)
- Some details here

### Monitor: Agent Growth Cycle
- More details

## Archive
`,
  );

  return { root, stateDir, agentsRoot };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("system-status tool", () => {
  let root: string;
  let stateDir: string;
  let agentsRoot: string;
  let tool: ReturnType<typeof createSystemStatusTool>;

  beforeAll(() => {
    const fixtures = createTestState();
    root = fixtures.root;
    stateDir = fixtures.stateDir;
    agentsRoot = fixtures.agentsRoot;
    tool = createSystemStatusTool(stateDir, agentsRoot);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("has correct tool metadata", () => {
    expect(tool.name).toBe("system_status");
    expect(tool.label).toBe("System Status Dashboard");
    expect(tool.description).toContain("dashboard");
  });

  it("returns markdown output with all sections", async () => {
    const result = await tool.execute("test-call-1", {});
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const text = (result.content[0] as { type: "text"; text: string }).text;

    // Check all sections present
    expect(text).toContain("# System Status:");
    expect(text).toContain("Active Sessions");
    expect(text).toContain("📈 Last 60m");
    expect(text).toContain("🔄 Recent Delegations");
    expect(text).toContain("⏱️ Cron/Jobs");
    expect(text).toContain("🎯 Strategic Context");
  });

  it("shows active sessions correctly", async () => {
    const result = await tool.execute("test-call-2", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;

    expect(text).toContain("Active Sessions (2)");
    expect(text).toContain("**bob**");
    expect(text).toContain("**may**");
    expect(text).toContain("Running");
    expect(text).toContain("idle");
  });

  it("shows recent history with stats", async () => {
    const result = await tool.execute("test-call-3", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;

    // Should show 2 sessions in window (recentHistory + recentError), but not the old one
    expect(text).toContain("2 sessions completed");
    expect(text).toContain("50%"); // 1 done out of 2
    expect(text).toContain("**Errors** (1)");
    expect(text).toContain("optimizer");
    expect(text).toContain("Context limit");
  });

  it("excludes old history from window", async () => {
    // With 10-minute window, only the 5m-ago session should appear
    const result = await tool.execute("test-call-4", { windowMinutes: 10 });
    const text = (result.content[0] as { type: "text"; text: string }).text;

    expect(text).toContain("Last 10m");
    // With 10m window: the 5m-ago coder session is in, but the 120m-ago scout session is not in history
    // The "1 sessions completed" confirms only the recent one is counted
    expect(text).toContain("1 sessions completed");
    // The old scout session (120m ago) should not appear in history stats
    expect(text).toContain("coder(1)"); // only the recent one
    // Verify scout doesn't appear in the Top Agents (would indicate it leaked into history window)
    expect(text).not.toContain("scout(");
  });

  it("shows delegations", async () => {
    const result = await tool.execute("test-call-5", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;

    expect(text).toContain("bob → tech-lead");
    expect(text).toContain("bob → optimizer");
    expect(text).toContain("may → scout");
    expect(text).toContain("❌"); // error delegation
  });

  it("shows job health section (empty when SQLite unavailable in vitest)", async () => {
    const result = await tool.execute("test-call-6", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;

    // Job data comes from SQLite (requests table) which isn't available in vitest (Node.js).
    // The tool handles this gracefully by returning empty results.
    expect(text).toContain("⏱️ Cron/Jobs");
  });

  it("shows strategic context", async () => {
    const result = await tool.execute("test-call-7", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;

    expect(text).toContain("Security & Hierarchy (P84/P85)");
    expect(text).toContain("Monitor: Agent Growth Cycle");
    // todo/ops queue comes from DB (mocked as unavailable under vitest)
    expect(text).toMatch(/pending task|DB unavailable/);
  });

  it("returns structured details", async () => {
    const result = await tool.execute("test-call-8", {});
    expect(result.details).toEqual({
      activeSessions: 2,
      historyInWindow: 2,
      delegationCount: 3,
      jobCount: 0, // SQLite not available in vitest — jobs come back empty
    });
  });

  it("handles missing state directory gracefully", async () => {
    const emptyTool = createSystemStatusTool("/nonexistent/path", "/nonexistent/agents");
    const result = await emptyTool.execute("test-call-9", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;

    expect(text).toContain("Active Sessions (0)");
    expect(text).toContain("(none)");
    expect(text).toContain("(no delegation data)");
  });
});

describe("system-status tail utility", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tail-test-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles empty JSONL files", async () => {
    const stateDir = join(tmpDir, "empty-state");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, "delegations.jsonl"), "");

    const tool = createSystemStatusTool(stateDir, join(tmpDir, "agents"));
    const result = await tool.execute("test-empty", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("(no delegation data)");
  });

  it("handles corrupted JSONL lines gracefully", async () => {
    const stateDir = join(tmpDir, "corrupt-state");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      join(stateDir, "delegations.jsonl"),
      `{"parent":"bob","child":"tech-lead","method":"call","status":"done","durationMs":100,"error":null}
{CORRUPTED LINE
{"parent":"may","child":"scout","method":"send","status":"sent","durationMs":null,"error":null}
`,
    );

    const tool = createSystemStatusTool(stateDir, join(tmpDir, "agents"));
    const result = await tool.execute("test-corrupt", {});
    const text = (result.content[0] as { type: "text"; text: string }).text;
    // Should still show the valid lines
    expect(text).toContain("bob → tech-lead");
    expect(text).toContain("may → scout");
  });
});
