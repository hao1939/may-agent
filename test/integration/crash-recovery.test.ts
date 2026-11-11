/** Startup cleanup preserves evidence and marks abandoned execution interrupted. */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "../../src/lib/manager.js";
import type { PersistedSession } from "../../src/lib/persistence.js";
import {
  appendSessionMessage,
  ensureSessionDir,
  readSessionMeta,
  sessionDir,
  sessionOutputDir,
  writeSessionMeta,
} from "../../src/lib/persistence.js";
import { fakeModel } from "../fixtures/model.js";
import { markStaleSession } from "../fixtures/stale-session.js";

// ── Helpers ────────────────────────────────────────────────────────────

function registerAgent(manager: SubagentManager, name: string): void {
  manager.register({
    name,
    description: `Agent ${name}`,
    domain: "test",
    systemPrompt: `You are ${name}.`,
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

function writeSentinel(persistDir: string, sessionId: string): void {
  const dir = sessionDir(persistDir, sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "[STARTED]"), new Date().toISOString());
}

function sentinelExists(persistDir: string, sessionId: string): boolean {
  return existsSync(join(sessionDir(persistDir, sessionId), "[STARTED]"));
}

function setupSession(persistDir: string, sessionId: string, messages?: AgentMessage[]): void {
  ensureSessionDir(persistDir, sessionId);
  mkdirSync(sessionOutputDir(persistDir, sessionId), { recursive: true });
  if (messages) {
    for (const msg of messages) {
      appendSessionMessage(persistDir, sessionId, msg);
    }
  }
}

function writeRegistryState(persistDir: string, sessions: Record<string, PersistedSession>): void {
  mkdirSync(persistDir, { recursive: true });
  for (const [sid, meta] of Object.entries(sessions)) {
    writeSessionMeta(persistDir, sid, meta);
    if (meta.status === "running" || meta.status === "idle") markStaleSession(persistDir, sid);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Crash Recovery: Sentinel File Lifecycle", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "crash-recovery-sentinel-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("run() writes a [STARTED] sentinel file", () => {
    const manager = new SubagentManager({ persistDir });
    registerAgent(manager, "worker");

    const sessionId = manager.run("worker", "do something");

    // Sentinel should exist immediately after run()
    expect(sentinelExists(persistDir, sessionId)).toBe(true);

    // Clean up: cancel so the session doesn't hang
    manager.cancel(sessionId);
  });

  it("handleCompletion() deletes the [STARTED] sentinel on success", async () => {
    const manager = new SubagentManager({ persistDir });
    registerAgent(manager, "worker");

    const sessionId = manager.run("worker", "do something");
    expect(sentinelExists(persistDir, sessionId)).toBe(true);

    // Wait for completion (will error from fake model, but sentinel should be cleaned)
    await manager.waitFor(sessionId);

    // Sentinel should be gone after completion
    expect(sentinelExists(persistDir, sessionId)).toBe(false);
  });

  it("handleCompletion() deletes the [STARTED] sentinel on error", async () => {
    const manager = new SubagentManager({ persistDir });
    registerAgent(manager, "worker");

    const sessionId = manager.run("worker", "do something");
    expect(sentinelExists(persistDir, sessionId)).toBe(true);

    // The fake model will cause an error; wait for it
    await manager.waitFor(sessionId);

    // Sentinel should be gone even after error
    expect(sentinelExists(persistDir, sessionId)).toBe(false);
  });

  it("handleCompletion() deletes the [STARTED] sentinel on cancel (abort)", async () => {
    const manager = new SubagentManager({ persistDir });
    registerAgent(manager, "worker");

    const sessionId = manager.run("worker", "do something");
    expect(sentinelExists(persistDir, sessionId)).toBe(true);

    manager.cancel(sessionId);
    await manager.waitFor(sessionId);

    // Sentinel should be gone after cancellation
    expect(sentinelExists(persistDir, sessionId)).toBe(false);
  });
});

describe("Crash Recovery: Sentinel-Driven Crash Detection", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "crash-recovery-detect-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("cleanupStaleSessions() retains an orphan sentinel until ownership evidence is available", () => {
    // A sentinel alone cannot authorize cleanup of an unknown execution.
    writeSentinel(persistDir, "s_orphan");

    const manager = new SubagentManager({ persistDir });
    const { interrupted } = manager.cleanupStaleSessions();

    expect(interrupted).toHaveLength(0);

    expect(sentinelExists(persistDir, "s_orphan")).toBe(true);
    writeRegistryState(persistDir, {
      s_orphan: { agent: "worker", task: "Retained work", status: "done", startedAt: 1, endedAt: 2 },
    });
    manager.cleanupStaleSessions();
    expect(sentinelExists(persistDir, "s_orphan")).toBe(false);
  });

  it("cleanupStaleSessions() interrupts sentinel session with unregistered agent", () => {
    writeRegistryState(persistDir, {
      s_unknown: {
        agent: "nonexistent-agent",
        task: "some task",
        status: "running",
        startedAt: Date.now() - 20000,
      },
    });
    setupSession(persistDir, "s_unknown");
    writeSentinel(persistDir, "s_unknown");

    const manager = new SubagentManager({ persistDir });
    // Do NOT register "nonexistent-agent"

    const { interrupted } = manager.cleanupStaleSessions();

    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].sessionId).toBe("s_unknown");
    expect(interrupted[0].error).toContain("recover work through its owning Task");

    // Registry should show "interrupted"
    const meta = readSessionMeta(persistDir, "s_unknown");
    expect(meta!.status).toBe("interrupted");

    // Sentinel should be cleaned up
    expect(sentinelExists(persistDir, "s_unknown")).toBe(false);
  });

  it("interrupted (unregistered agent) sessions get status=interrupted in registry", () => {
    writeRegistryState(persistDir, {
      s_unreg: {
        agent: "gone-agent",
        task: "lost task",
        status: "running",
        startedAt: Date.now() - 30000,
      },
    });
    setupSession(persistDir, "s_unreg");

    const manager = new SubagentManager({ persistDir });
    // "gone-agent" is NOT registered

    manager.cleanupStaleSessions();

    const meta = readSessionMeta(persistDir, "s_unreg");
    expect(meta!.status).toBe("interrupted");
    expect(meta!.error).toContain("recover work through its owning Task");
  });

  it("does not touch done/error/interrupted sessions during recovery", () => {
    writeRegistryState(persistDir, {
      s_done: { agent: "a", task: "t", status: "done", startedAt: Date.now() - 60000, endedAt: Date.now() - 55000 },
      s_error: {
        agent: "a",
        task: "t",
        status: "error",
        startedAt: Date.now() - 50000,
        endedAt: Date.now() - 45000,
        error: "boom",
      },
      s_int: {
        agent: "a",
        task: "t",
        status: "interrupted",
        startedAt: Date.now() - 40000,
        endedAt: Date.now() - 35000,
      },
    });

    const manager = new SubagentManager({ persistDir });
    const { interrupted } = manager.cleanupStaleSessions();

    expect(interrupted).toHaveLength(0);

    // Statuses unchanged
    expect(readSessionMeta(persistDir, "s_done")!.status).toBe("done");
    expect(readSessionMeta(persistDir, "s_error")!.status).toBe("error");
    expect(readSessionMeta(persistDir, "s_int")!.status).toBe("interrupted");
  });
});
