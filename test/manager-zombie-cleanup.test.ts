import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import {
  writeSessionMeta,
  ensureSessionDir,
  listActiveSessionIds,
  readSessionMeta,
} from "../src/lib/persistence.js";
import type { PersistedSession } from "../src/lib/persistence.js";
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

function registerAgent(manager: SubagentManager, name = "test-agent") {
  manager.register({
    name,
    description: "Test agent",
    domain: "test",
    systemPrompt: "You are a test agent.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

function createZombieSession(
  persistDir: string,
  sessionId: string,
  status: PersistedSession["status"],
  agent = "test-agent",
): void {
  ensureSessionDir(persistDir, sessionId);
  writeSessionMeta(persistDir, sessionId, {
    agent,
    task: "zombie task",
    status,
    startedAt: Date.now() - 3600000,
    endedAt: status !== "running" ? Date.now() - 1800000 : undefined,
    autoClose: "never",
  });
}

describe("SubagentManager.cleanupZombieSessions()", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-zombie-"));
    manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager);
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("archives sessions with 'interrupted' status (Phase 2)", () => {
    createZombieSession(persistDir, "s_zombie_1", "interrupted");

    expect(listActiveSessionIds(persistDir)).toContain("s_zombie_1");
    const cleaned = manager.cleanupZombieSessions();
    // Phase 2 archives terminal sessions (done/error/interrupted) from sessions/ to history/
    expect(cleaned).toBe(1);
    expect(listActiveSessionIds(persistDir)).not.toContain("s_zombie_1");
  });

  it("archives sessions with 'done' status (Phase 2)", () => {
    createZombieSession(persistDir, "s_zombie_done", "done");

    const cleaned = manager.cleanupZombieSessions();
    expect(cleaned).toBe(1);
    expect(listActiveSessionIds(persistDir)).not.toContain("s_zombie_done");
  });

  it("archives sessions with 'error' status (Phase 2)", () => {
    createZombieSession(persistDir, "s_zombie_err", "error");

    const cleaned = manager.cleanupZombieSessions();
    expect(cleaned).toBe(1);
    expect(listActiveSessionIds(persistDir)).not.toContain("s_zombie_err");
  });

  it("marks stale 'running' sessions (>30min) as interrupted then archives", () => {
    // createZombieSession sets startedAt to 1 hour ago — qualifies as stale
    createZombieSession(persistDir, "s_running", "running");

    const cleaned = manager.cleanupZombieSessions();
    // Phase 1: mark interrupted (+1), Phase 2: archive (+1) = 2 total
    expect(cleaned).toBe(2);
    // Session is archived (moved to history/)
    expect(listActiveSessionIds(persistDir)).not.toContain("s_running");
  });

  it("does NOT mark recent 'running' sessions (<30min)", () => {
    // Create a session with startedAt = 5 minutes ago (not stale)
    ensureSessionDir(persistDir, "s_recent");
    writeSessionMeta(persistDir, "s_recent", {
      agent: "test-agent",
      task: "recent task",
      status: "running",
      startedAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
      autoClose: "never",
    });

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(0);
    expect(listActiveSessionIds(persistDir)).toContain("s_recent");
  });

  it("does NOT touch sessions with 'idle' status", () => {
    createZombieSession(persistDir, "s_idle", "idle");

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(0);
    expect(listActiveSessionIds(persistDir)).toContain("s_idle");
  });

  it("handles multiple stale running sessions at once", () => {
    createZombieSession(persistDir, "s_r1", "running");
    createZombieSession(persistDir, "s_r2", "running");

    const cleaned = manager.cleanupZombieSessions();
    // Phase 1: 2 marked interrupted, Phase 2: 2 archived = 4 total
    expect(cleaned).toBe(4);
    expect(listActiveSessionIds(persistDir)).not.toContain("s_r1");
    expect(listActiveSessionIds(persistDir)).not.toContain("s_r2");
  });

  it("returns 0 when no zombie sessions exist", () => {
    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(0);
  });

  it("skips sessions without valid meta.json", () => {
    // Create a dir without meta.json
    ensureSessionDir(persistDir, "s_no_meta");

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(0);
    expect(listActiveSessionIds(persistDir)).toContain("s_no_meta");
  });
});
