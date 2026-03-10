/**
 * Test that detached sessions survive parent restart.
 *
 * Root cause: cleanupStaleSessions() and resumeAgent() marked ALL
 * running/idle sessions as "interrupted" on restart — including
 * detached sessions running in a separate OS process.
 *
 * Fix: skip sessions where persisted.detached === true AND the
 * process (persisted.pid) is still alive.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";
import { RegistryStore } from "../src/lib/persistence.js";
import type { SubagentDefinition } from "../src/lib/types.js";
import type { Model } from "@mariozechner/pi-ai";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

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
  };
}

describe("detached sessions survive restart", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "detached-survive-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("cleanupStaleSessions skips detached session with alive process", () => {
    // Simulate: previous process wrote a detached session to registry
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

    const manager = new SubagentManager({ persistDir: dir });
    manager.register(baseDef("worker"));

    const cleaned = manager.cleanupStaleSessions();

    // The attached session should be interrupted
    const attachedCleaned = cleaned.find(s => s.sessionId === "s_attached_1");
    expect(attachedCleaned).toBeTruthy();
    expect(attachedCleaned!.status).toBe("interrupted");

    // The detached session should NOT be interrupted (process is alive)
    const detachedCleaned = cleaned.find(s => s.sessionId === "s_detached_1");
    expect(detachedCleaned).toBeUndefined();

    // Verify the detached session is still "running" in the registry
    const detachedMeta = registry.getSession("s_detached_1");
    expect(detachedMeta?.status).toBe("running");
  });

  it("cleanupStaleSessions interrupts detached session with dead process", () => {
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

    const manager = new SubagentManager({ persistDir: dir });
    manager.register(baseDef("worker"));

    const cleaned = manager.cleanupStaleSessions();

    // Dead detached process should be cleaned up
    const detachedCleaned = cleaned.find(s => s.sessionId === "s_detached_dead");
    expect(detachedCleaned).toBeTruthy();
    expect(detachedCleaned!.status).toBe("interrupted");
  });

  it("resumeAgent skips detached session with alive process", () => {
    const registry = new RegistryStore(dir);

    // Chat session to resume
    registry.saveSession("s_chat_1", {
      agent: "may",
      task: "Ready. Waiting for tasks.",
      status: "idle",
      startedAt: Date.now() - 300_000,
    });
    // Detached session from before restart — still alive
    registry.saveSession("s_detached_2", {
      agent: "worker",
      task: "background work",
      status: "running",
      startedAt: Date.now() - 120_000,
      detached: true,
      pid: process.pid, // alive
      instance: "job-s_detached_2",
    });
    // Normal child session from before restart — stale
    registry.saveSession("s_child_1", {
      agent: "worker",
      task: "was running inline",
      status: "running",
      startedAt: Date.now() - 60_000,
    });

    const manager = new SubagentManager({ persistDir: dir });
    manager.register(baseDef("may"));
    manager.register(baseDef("worker"));

    const result = manager.resumeAgent("may", { autoClose: "never" });

    // Chat session resumed
    expect(result.resumed.sessionId).toBe("s_chat_1");

    // Normal child interrupted
    const childInterrupted = result.interrupted.find(s => s.sessionId === "s_child_1");
    expect(childInterrupted).toBeTruthy();

    // Detached session NOT interrupted
    const detachedInterrupted = result.interrupted.find(s => s.sessionId === "s_detached_2");
    expect(detachedInterrupted).toBeUndefined();

    // Detached session still "running" in registry
    const detachedMeta = registry.getSession("s_detached_2");
    expect(detachedMeta?.status).toBe("running");
  });
});
