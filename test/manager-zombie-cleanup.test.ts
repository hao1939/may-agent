import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import {
  writeSessionMeta,
  ensureSessionDir,
  listActiveSessionIds,
  listArchivedSessionIds,
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

  it("archives sessions with 'interrupted' status", () => {
    createZombieSession(persistDir, "s_zombie_1", "interrupted");

    expect(listActiveSessionIds(persistDir)).toContain("s_zombie_1");
    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(1);
    expect(listActiveSessionIds(persistDir)).not.toContain("s_zombie_1");
    expect(listArchivedSessionIds(persistDir)).toContain("s_zombie_1");
  });

  it("archives sessions with 'done' status", () => {
    createZombieSession(persistDir, "s_zombie_done", "done");

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(1);
    expect(listArchivedSessionIds(persistDir)).toContain("s_zombie_done");
  });

  it("archives sessions with 'error' status", () => {
    createZombieSession(persistDir, "s_zombie_err", "error");

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(1);
    expect(listArchivedSessionIds(persistDir)).toContain("s_zombie_err");
  });

  it("does NOT archive sessions with 'running' status", () => {
    createZombieSession(persistDir, "s_running", "running");

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(0);
    expect(listActiveSessionIds(persistDir)).toContain("s_running");
  });

  it("does NOT archive sessions with 'idle' status", () => {
    createZombieSession(persistDir, "s_idle", "idle");

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(0);
    expect(listActiveSessionIds(persistDir)).toContain("s_idle");
  });

  it("handles multiple zombie sessions at once", () => {
    createZombieSession(persistDir, "s_z1", "interrupted");
    createZombieSession(persistDir, "s_z2", "done");
    createZombieSession(persistDir, "s_z3", "error");
    createZombieSession(persistDir, "s_z4", "running"); // should stay

    const archived = manager.cleanupZombieSessions();
    expect(archived).toBe(3);
    expect(listActiveSessionIds(persistDir)).toEqual(expect.arrayContaining(["s_z4"]));
    expect(listActiveSessionIds(persistDir)).toHaveLength(1);
    expect(listArchivedSessionIds(persistDir)).toHaveLength(3);
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
