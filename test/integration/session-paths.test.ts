import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import {
  ensureSessionDir,
  markSessionActive,
  markSessionInactive,
  sessionDir,
  sessionOutputDir,
  appendSessionMessage,
} from "../../src/lib/persistence.js";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { fakeModel } from "../fixtures/model.js";

describe("permanent session paths", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-archive-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("changes lifecycle markers without moving session artifacts", () => {
    const sessionId = "path-test-1";
    ensureSessionDir(persistDir, sessionId);
    mkdirSync(sessionOutputDir(persistDir, sessionId), { recursive: true });

    // Write a message so there's content
    appendSessionMessage(persistDir, sessionId, {
      role: "user",
      content: [{ type: "text", text: "hello" }],
      timestamp: Date.now(),
    } as AgentMessage);

    const originalDir = sessionDir(persistDir, sessionId);
    markSessionActive(persistDir, sessionId);
    expect(existsSync(join(originalDir, "[ACTIVE]"))).toBe(true);

    markSessionInactive(persistDir, sessionId);
    expect(existsSync(originalDir)).toBe(true);
    expect(existsSync(join(originalDir, "[ACTIVE]"))).toBe(false);
    expect(existsSync(join(originalDir, "session.jsonl"))).toBe(true);
    expect(existsSync(join(originalDir, "output"))).toBe(true);
  });
});

describe("SubagentManager.sessions()", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-sessions-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("filters sessions by agent name", async () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "agent-a",
      description: "A",
      domain: "a",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake",
    });

    manager.register({
      name: "agent-b",
      description: "B",
      domain: "b",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake",
    });

    const s1 = manager.run("agent-a", "task 1");
    const s2 = manager.run("agent-b", "task 2");
    const s3 = manager.run("agent-a", "task 3");

    const sessionsA = manager.sessions("agent-a");
    const sessionsB = manager.sessions("agent-b");

    expect(sessionsA).toHaveLength(2);
    expect(sessionsB).toHaveLength(1);
    expect(sessionsA.map((s) => s.task)).toContain("task 1");
    expect(sessionsA.map((s) => s.task)).toContain("task 3");
    expect(sessionsB[0].task).toBe("task 2");

    // Wait for all to finish
    await Promise.all([manager.waitFor(s1), manager.waitFor(s2), manager.waitFor(s3)]);
  });

  it("returns empty array for unknown agent", () => {
    const manager = new SubagentManager({ persistDir });
    expect(manager.sessions("unknown")).toEqual([]);
  });
});
