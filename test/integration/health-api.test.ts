import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager, type SessionInfo } from "../../src/lib/manager.js";
import { closeDb } from "../../src/lib/db/connection.js";
import { fakeModel } from "../fixtures/model.js";

function registerTestAgents(manager: SubagentManager) {
  manager.register({
    name: "coder",
    description: "Writes code",
    domain: "engineering",
    systemPrompt: "You are a coder.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
  manager.register({
    name: "reviewer",
    description: "Reviews code",
    domain: "quality",
    systemPrompt: "You are a reviewer.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

let persistDir: string;
let manager: SubagentManager;

beforeEach(() => {
  persistDir = mkdtempSync(join(tmpdir(), "health-api-"));
  manager = new SubagentManager({ persistDir });
});

afterEach(() => {
  closeDb(persistDir);
  rmSync(persistDir, { recursive: true, force: true });
});

describe("health()", () => {
  it("returns correct structure with registered agents", () => {
    registerTestAgents(manager);
    const report = manager.health();

    expect(report.registeredAgents.count).toBe(2);
    expect(report.registeredAgents.names).toContain("coder");
    expect(report.registeredAgents.names).toContain("reviewer");
    expect(report.activeSessions).toEqual([]);
    expect(report.sessionCounts).toEqual({ running: 0, idle: 0, total: 0 });
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.uptime).toBeDefined();
  });

  it("returns active sessions with correct fields", async () => {
    registerTestAgents(manager);
    const sid = manager.run("coder", "write tests");

    const report = manager.health();
    expect(report.activeSessions.length).toBeGreaterThanOrEqual(1);
    const session = report.activeSessions.find((s) => s.sessionId === sid);
    expect(session).toBeDefined();
    expect(session!.agent).toBe("coder");
    expect(session!.startedAt).toBeGreaterThan(0);
    expect(session!.turnCount).toBe(0);
    expect(session!.runtime).toBeDefined();

    await manager.waitFor(sid);
  });

  it("counts each running and idle session from the current status snapshot", () => {
    const sessions: SessionInfo[] = (["running", "running", "idle"] as const).map((status, index) => ({
      sessionId: `session-${index}`,
      agent: "coder",
      task: "inspect health",
      status,
      startedAt: 1,
      runtime: "1s",
      outputDir: join(persistDir, `session-${index}`),
    }));
    const status = spyOn(manager, "status").mockReturnValue(sessions);
    try {
      expect(manager.health()).toMatchObject({
        activeSessions: sessions,
        sessionCounts: { running: 2, idle: 1, total: 3 },
      });
      status.mockReturnValue([]);
      expect(manager.health().sessionCounts).toEqual({ running: 0, idle: 0, total: 0 });
    } finally {
      status.mockRestore();
    }
  });

  it("reports elapsed uptime without waiting for wall-clock time", () => {
    const start = Date.now();
    const clock = spyOn(Date, "now").mockReturnValue(start);
    try {
      const timed = new SubagentManager({ persistDir });
      expect(timed.health().uptime).toBe("0s");
      clock.mockReturnValue(start + 61_000);
      expect(timed.health().uptime).toBe("1m1s");
    } finally {
      clock.mockRestore();
    }
  });

  it("returns empty state for fresh manager", () => {
    const report = manager.health();
    expect(report.registeredAgents.count).toBe(0);
    expect(report.registeredAgents.names).toEqual([]);
    expect(report.activeSessions).toEqual([]);
    expect(report.sessionCounts).toEqual({ running: 0, idle: 0, total: 0 });
  });
});
