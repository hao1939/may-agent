/**
 * Test that detached sessions survive parent restart.
 *
 * Root cause: cleanupStaleSessions() used to mark ALL running/idle sessions
 * as "interrupted" on restart — including detached sessions running in a
 * separate OS process.
 *
 * Fix: skip sessions where persisted.detached === true AND the
 * process (persisted.pid) is still alive.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "../../src/lib/manager.js";
import { RegistryStore, ensureSessionDir, markSessionActive, sessionOutputDir } from "../../src/lib/persistence.js";
import type { SubagentDefinition } from "../../src/lib/types.js";
import { fakeModel } from "../fixtures/model.js";
import { markStaleSession } from "../fixtures/stale-session.js";

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
  markStaleSession(persistDir, sessionId);
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

  it("cleanup skips detached session with alive process", () => {
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
    markSessionActive(dir, "s_detached_1");
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

    const { interrupted } = manager.cleanupStaleSessions();

    expect(interrupted.map(({ sessionId }) => sessionId)).toEqual(["s_attached_1"]);
    expect(interrupted[0]!.status).toBe("interrupted");
    expect(manager.status()).toEqual([]);

    // Verify the detached session is still "running" in the registry
    const detachedMeta = registry.getSession("s_detached_1");
    expect(detachedMeta?.status).toBe("running");
  });

  it("cleanup interrupts detached session with dead process", async () => {
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

    const { interrupted } = manager.cleanupStaleSessions();

    expect(interrupted.map(({ sessionId }) => sessionId)).toEqual(["s_detached_dead"]);
    expect(manager.status()).toEqual([]);

    expect(manager.registryStore.getSession("s_detached_dead")?.status).toBe("interrupted");
  });
});
