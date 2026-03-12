/**
 * Test that detached sessions survive parent restart.
 *
 * Root cause: resumeStaleSessions() used to mark ALL running/idle sessions
 * as "interrupted" on restart — including detached sessions running in a
 * separate OS process.
 *
 * Fix: skip sessions where persisted.detached === true AND the
 * process (persisted.pid) is still alive.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";
import { RegistryStore, ensureSessionDir, sessionOutputDir } from "../src/lib/persistence.js";
import type { SubagentDefinition } from "../src/lib/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";

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

function baseDef(name: string): SubagentDefinition {
  return {
    name,
    description: "test",
    domain: "test",
    systemPrompt: "You are a test bot.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  };
}

function setupSessionDir(persistDir: string, sessionId: string): void {
  ensureSessionDir(persistDir, sessionId);
  mkdirSync(sessionOutputDir(persistDir, sessionId), { recursive: true });
}

describe("detached sessions survive restart", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "detached-survive-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("resumeStaleSessions skips detached session with alive process", () => {
    const registry = new RegistryStore(dir);
    registry.saveSession("s_detached_1", {
      agent: "worker",
      task: "long running task",
      status: "running",
      startedAt: Date.now() - 60_000,
      detached: true,
      pid: process.pid, // current process — definitely alive
      instance: "job-s_detached_1",
    });
    // Also a normal (non-detached) stale session
    registry.saveSession("s_attached_1", {
      agent: "worker",
      task: "in-process task",
      status: "running",
      startedAt: Date.now() - 60_000,
    });
    setupSessionDir(dir, "s_attached_1");

    const manager = new SubagentManager({ persistDir: dir });
    manager.register(baseDef("worker"));

    const { resumed, interrupted } = manager.resumeStaleSessions();

    // The attached session should be resumed (agent is registered)
    const attachedResumed = resumed.find((s) => s.sessionId === "s_attached_1");
    expect(attachedResumed).toBeTruthy();
    expect(attachedResumed!.status).toBe("running");

    // The detached session should NOT appear in either list (process is alive, skipped)
    const detachedResumed = resumed.find((s) => s.sessionId === "s_detached_1");
    expect(detachedResumed).toBeUndefined();
    const detachedInterrupted = interrupted.find((s) => s.sessionId === "s_detached_1");
    expect(detachedInterrupted).toBeUndefined();

    // Verify the detached session is still "running" in the registry
    const detachedMeta = registry.getSession("s_detached_1");
    expect(detachedMeta?.status).toBe("running");
  });

  it("resumeStaleSessions resumes detached session with dead process", async () => {
    const registry = new RegistryStore(dir);
    registry.saveSession("s_detached_dead", {
      agent: "worker",
      task: "long running task",
      status: "running",
      startedAt: Date.now() - 60_000,
      detached: true,
      pid: 999999999, // no such process
      instance: "job-s_detached_dead",
    });
    setupSessionDir(dir, "s_detached_dead");

    const manager = new SubagentManager({ persistDir: dir });
    manager.register(baseDef("worker"));

    const { resumed, interrupted } = manager.resumeStaleSessions();

    // Dead detached process should be resumed (agent is registered)
    const detachedResumed = resumed.find((s) => s.sessionId === "s_detached_dead");
    expect(detachedResumed).toBeTruthy();

    await manager.waitFor("s_detached_dead");
  });
});
