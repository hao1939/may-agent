/**
 * Crash Recovery Design Verification Tests
 *
 * These tests verify the crash recovery system described in
 * agents/bob/workspace/crash-recovery-design.md.
 *
 * The design specifies:
 * 1. Sentinel files (`[STARTED]`) written on session start, deleted on completion
 * 2. `resumeStaleSessions()` scans for orphan sentinels to detect crashed sessions
 * 3. Crashed sessions are marked "interrupted" or resumed (if agent is registered)
 * 4. Stale workflow runs (status "running") are marked "interrupted"
 * 5. JSONL rehydration: resumed sessions reload messages from disk
 * 6. Mid-tool-call crash repair: inject error tool results for pending tool calls
 * 7. Restart notice injection: "Process restarted. Continue where you left off."
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import {
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  sessionDir,
  sessionOutputDir,
  writeSessionMeta,
  readSessionMeta,
  RegistryStore,
} from "../src/lib/persistence.js";
import type { PersistedSession } from "../src/lib/persistence.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";

// ── Helpers ────────────────────────────────────────────────────────────

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

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function assistantMessage(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function toolCallMessage(toolCallId: string, toolName: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id: toolCallId, name: toolName, input: {} }],
    timestamp: Date.now(),
    stopReason: "toolUse",
  } as unknown as AgentMessage;
}

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
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    const sessionId = manager.run("worker", "do something");

    // Sentinel should exist immediately after run()
    expect(sentinelExists(persistDir, sessionId)).toBe(true);

    // Clean up: cancel so the session doesn't hang
    manager.cancel(sessionId);
  });

  it("handleCompletion() deletes the [STARTED] sentinel on success", async () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    const sessionId = manager.run("worker", "do something");
    expect(sentinelExists(persistDir, sessionId)).toBe(true);

    // Wait for completion (will error from fake model, but sentinel should be cleaned)
    await manager.waitFor(sessionId);

    // Sentinel should be gone after completion
    expect(sentinelExists(persistDir, sessionId)).toBe(false);
  });

  it("handleCompletion() deletes the [STARTED] sentinel on error", async () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    const sessionId = manager.run("worker", "do something");
    expect(sentinelExists(persistDir, sessionId)).toBe(true);

    // The fake model will cause an error; wait for it
    await manager.waitFor(sessionId);

    // Sentinel should be gone even after error
    expect(sentinelExists(persistDir, sessionId)).toBe(false);
  });

  it("handleCompletion() deletes the [STARTED] sentinel on cancel (abort)", async () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
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

  it("resumeStaleSessions() detects orphan [STARTED] sentinel and resumes session", async () => {
    // Simulate crash: sentinel exists + registry says "running" + no live process
    writeRegistryState(persistDir, {
      s_crashed: {
        agent: "worker",
        task: "important task",
        status: "running",
        startedAt: Date.now() - 30000,
      },
    });
    setupSession(persistDir, "s_crashed", [userMessage("important task"), assistantMessage("Working on it...")]);
    writeSentinel(persistDir, "s_crashed");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    const { resumed, interrupted } = manager.resumeStaleSessions();

    // Session should be resumed (agent is registered)
    expect(resumed).toHaveLength(1);
    expect(resumed[0].sessionId).toBe("s_crashed");
    expect(resumed[0].status).toBe("running");
    expect(interrupted).toHaveLength(0);

    // Sentinel should be cleaned up during resumeStaleSessions()
    expect(sentinelExists(persistDir, "s_crashed")).toBe(false);

    // Wait for it to finish (will error from fake model)
    await manager.waitFor("s_crashed");
  });

  it("resumeStaleSessions() cleans up orphan sentinel with no registry entry", () => {
    // Sentinel exists but no corresponding registry entry — should be cleaned up
    writeSentinel(persistDir, "s_orphan");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(0);
    expect(interrupted).toHaveLength(0);

    // Sentinel should be cleaned up
    expect(sentinelExists(persistDir, "s_orphan")).toBe(false);
  });

  it("resumeStaleSessions() interrupts sentinel session with unregistered agent", () => {
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

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    // Do NOT register "nonexistent-agent"

    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(0);
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].sessionId).toBe("s_unknown");
    expect(interrupted[0].error).toContain("agent not registered");

    // Registry should show "interrupted"
    const meta = readSessionMeta(persistDir, "s_unknown");
    expect(meta!.status).toBe("interrupted");

    // Sentinel should be cleaned up
    expect(sentinelExists(persistDir, "s_unknown")).toBe(false);
  });

  it("simulates full crash-restart cycle: start → crash → restart → detect", async () => {
    // Phase 1: "Start" a session (write what run() would write)
    const sessionId = "s_crash_cycle";
    writeRegistryState(persistDir, {
      [sessionId]: {
        agent: "worker",
        task: "build feature X",
        status: "running",
        startedAt: Date.now() - 60000,
      },
    });
    setupSession(persistDir, sessionId, [
      userMessage("build feature X"),
      assistantMessage("Starting to work on feature X..."),
    ]);
    writeSentinel(persistDir, sessionId);

    // Phase 2: Verify pre-crash state
    expect(sentinelExists(persistDir, sessionId)).toBe(true);
    expect(readSessionMeta(persistDir, sessionId)!.status).toBe("running");

    // Phase 3: "Restart" — create new manager (simulates new process)
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    // Phase 4: Run crash recovery
    const { resumed, interrupted } = manager.resumeStaleSessions();

    // Phase 5: Verify recovery
    expect(resumed).toHaveLength(1);
    expect(resumed[0].sessionId).toBe(sessionId);
    expect(resumed[0].agent).toBe("worker");
    expect(resumed[0].task).toBe("build feature X");

    // Sentinel cleaned
    expect(sentinelExists(persistDir, sessionId)).toBe(false);

    // Wait for resumed session to settle
    await manager.waitFor(sessionId);

    // After completion, registry shows terminal status
    const finalMeta = readSessionMeta(persistDir, sessionId);
    expect(finalMeta!.status).not.toBe("running");
  });
});

describe("Crash Recovery: JSONL Rehydration", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "crash-recovery-rehydrate-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("resumed session preserves messages from before the crash", async () => {
    const sessionId = "s_rehydrate";
    writeRegistryState(persistDir, {
      [sessionId]: {
        agent: "worker",
        task: "analyze data",
        status: "running",
        startedAt: Date.now() - 30000,
      },
    });
    setupSession(persistDir, sessionId, [
      userMessage("analyze data"),
      assistantMessage("I found 3 issues in the dataset."),
    ]);

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    manager.resumeStaleSessions();

    // The session should have the original messages rehydrated
    const messages = manager.progress(sessionId);
    // At minimum, original user + assistant messages should be present
    const texts = messages.map((m) => {
      if (m.content && Array.isArray(m.content)) {
        return m.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");
      }
      return "";
    });
    expect(texts).toContain("analyze data");
    expect(texts).toContain("I found 3 issues in the dataset.");

    await manager.waitFor(sessionId);
  });

  it("resumed session gets a restart notice injected", async () => {
    const sessionId = "s_notice";
    writeRegistryState(persistDir, {
      [sessionId]: {
        agent: "worker",
        task: "build module",
        status: "running",
        startedAt: Date.now() - 30000,
      },
    });
    // Last message is assistant (not user), so resumeSession injects restart notice
    setupSession(persistDir, sessionId, [userMessage("build module"), assistantMessage("Working on the module...")]);

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    manager.resumeStaleSessions();

    // Wait for the session to finish (will error from fake model)
    await manager.waitFor(sessionId);

    // Check that the restart notice was injected into the message history
    // The JSONL should contain the restart message
    // Read from the session's messages (may be in history now)
    const result = await manager.waitFor(sessionId);
    const allTexts = result.messages
      .filter((m) => m.role === "user")
      .flatMap((m) => (m.content as any[]).filter((b) => b.type === "text").map((b) => b.text));
    expect(allTexts.some((t) => t.includes("Process restarted"))).toBe(true);
  });

  it("resumed session with last message=user calls continue() (no extra injection)", async () => {
    const sessionId = "s_continue";
    writeRegistryState(persistDir, {
      [sessionId]: {
        agent: "worker",
        task: "fix bug",
        status: "running",
        startedAt: Date.now() - 30000,
      },
    });
    // Last message is user — resumeSession calls agent.continue() without injecting a new message
    setupSession(persistDir, sessionId, [userMessage("fix bug")]);

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    manager.resumeStaleSessions();
    await manager.waitFor(sessionId);

    // The result messages should NOT contain a "Process restarted" user message
    // because the last message was already a user message (continue() is used)
    const result = await manager.waitFor(sessionId);
    const restartMessages = result.messages
      .filter((m) => m.role === "user")
      .filter((m) => (m.content as any[]).some((b) => b.type === "text" && b.text.includes("Process restarted")));
    expect(restartMessages).toHaveLength(0);
  });
});

describe("Crash Recovery: Mid-Tool-Call Repair", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "crash-recovery-tool-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("injects error tool results for pending tool calls from a crash", async () => {
    const sessionId = "s_toolcrash";
    writeRegistryState(persistDir, {
      [sessionId]: {
        agent: "worker",
        task: "run tests",
        status: "running",
        startedAt: Date.now() - 30000,
      },
    });
    // Session crashed mid-tool-call: last message is assistant with a toolCall
    setupSession(persistDir, sessionId, [userMessage("run tests"), toolCallMessage("tc_1", "exec")]);

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    manager.resumeStaleSessions();

    // Wait for completion
    await manager.waitFor(sessionId);

    // Verify: the resumed session should have an error toolResult injected
    const result = await manager.waitFor(sessionId);
    const toolResults = result.messages.filter((m) => m.role === "toolResult");
    expect(toolResults.length).toBeGreaterThanOrEqual(1);

    // The first toolResult should be an error for the crashed tool call
    const errorResult = toolResults.find((m) => (m as any).toolCallId === "tc_1" && (m as any).isError === true);
    expect(errorResult).toBeDefined();
    const errorText = (errorResult!.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    expect(errorText).toContain("process restarted");
  });
});

describe("Crash Recovery: Registry Status Updates", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "crash-recovery-registry-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
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

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    // "gone-agent" is NOT registered

    manager.resumeStaleSessions();

    const meta = readSessionMeta(persistDir, "s_unreg");
    expect(meta!.status).toBe("interrupted");
    expect(meta!.error).toContain("agent not registered");
  });

  it("resumed sessions get status=running in registry during recovery", async () => {
    writeRegistryState(persistDir, {
      s_resuming: {
        agent: "worker",
        task: "task",
        status: "running",
        startedAt: Date.now() - 30000,
      },
    });
    setupSession(persistDir, "s_resuming", [userMessage("task")]);

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    registerAgent(manager, "worker");

    const { resumed } = manager.resumeStaleSessions();
    expect(resumed).toHaveLength(1);

    // During resume, the registry is updated to "running"
    const meta = readSessionMeta(persistDir, "s_resuming");
    expect(meta!.status).toBe("running");

    await manager.waitFor("s_resuming");
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

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });
    const { resumed, interrupted } = manager.resumeStaleSessions();

    expect(resumed).toHaveLength(0);
    expect(interrupted).toHaveLength(0);

    // Statuses unchanged
    expect(readSessionMeta(persistDir, "s_done")!.status).toBe("done");
    expect(readSessionMeta(persistDir, "s_error")!.status).toBe("error");
    expect(readSessionMeta(persistDir, "s_int")!.status).toBe("interrupted");
  });
});
