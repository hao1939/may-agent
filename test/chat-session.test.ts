/**
 * Tests for ChatSession — persistent chat session.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager } from "../src/lib/manager.js";
import { ChatSession } from "../src/app/chat-session.js";
import { EventBus } from "../src/app/event-bus.js";
import { readSessionMeta, writeSessionMeta, ensureSessionDir, appendSessionMessage } from "../src/lib/persistence.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";

// ── Helpers ─────────────────────────────────────────────────────────────

function echoTool(): AgentTool {
  return {
    name: "echo",
    label: "Echo",
    description: "Echoes input",
    parameters: {},
    execute: async (_id, params) => ({
      content: [{ type: "text" as const, text: JSON.stringify(params) }],
      details: JSON.stringify(params),
    }),
  };
}

function mockModel() {
  return getModel("anthropic", "claude-sonnet-4-20250514");
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("ChatSession", () => {
  let persistDir: string;
  let manager: SubagentManager;
  let bus: EventBus;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "chatsession-"));
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "memory"), { recursive: true });
    manager = new SubagentManager({ persistDir });
    bus = new EventBus();

    manager.register({
      name: "may",
      description: "Test agent",
      domain: "testing",
      model: mockModel(),
      tools: [echoTool()],
    });
  });

  afterEach(() => {
    for (const s of manager.status()) {
      if (s.status === "running") manager.cancel(s.sessionId);
    }
    // Give sessions a tick to clean up
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          rmSync(persistDir, { recursive: true, force: true });
        } catch {}
        resolve();
      }, 100);
    });
  });

  it("handles status command directly (no LLM)", () => {
    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("status");

    expect(messages.some((m) => m.includes("No active sessions"))).toBe(true);
  });

  it("handles cancel command when no sessions", () => {
    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("cancel");

    expect(messages.some((m) => m.includes("No active sessions to cancel"))).toBe(true);
  });

  it("creates a persistent session on first message", () => {
    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("fix the login bug");

    expect(session.getSessionId()).toBeTruthy();

    const status = manager.status();
    expect(status.length).toBe(1);
    expect(status[0].agent).toBe("may");
    expect(status[0].kind).toBe("chat");
    expect(status[0].autoClose).toBe("never");
  });

  it("reuses the same session for subsequent messages", async () => {
    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("first message");

    const firstId = session.getSessionId();
    expect(firstId).toBeTruthy();

    // Wait for session to go idle
    await new Promise((r) => setTimeout(r, 500));

    session.handleInput("second message");
    expect(session.getSessionId()).toBe(firstId);
  });

  it("ignores empty input", () => {
    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("");
    session.handleInput("   ");

    expect(session.getSessionId()).toBeNull();
    expect(manager.status().length).toBe(0);
  });

  it("cancel all cancels running sessions", () => {
    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("fix something");
    session.handleInput("cancel all");

    expect(messages.some((m) => m.includes("Cancelled"))).toBe(true);
  });

  it("calls onDone when session finishes", async () => {
    let doneCalled = false;
    const session = new ChatSession({
      manager,
      bus,
      agentName: "may",
      onDone: () => {
        doneCalled = true;
      },
    });

    session.handleInput("test task");
    await new Promise((r) => setTimeout(r, 500));

    expect(doneCalled).toBe(true);
  });

  it("delegates reload to onReload callback", () => {
    let reloadCalled = false;
    const session = new ChatSession({
      manager,
      bus,
      agentName: "may",
      onReload: () => {
        reloadCalled = true;
      },
    });

    session.handleInput("reload");
    expect(reloadCalled).toBe(true);
    expect(session.getSessionId()).toBeNull();
  });

  it("delegates close to onClose callback", () => {
    let closeCalled = false;
    const session = new ChatSession({
      manager,
      bus,
      agentName: "may",
      onClose: () => {
        closeCalled = true;
      },
    });

    session.handleInput("close");
    expect(closeCalled).toBe(true);
  });

  it("delegates restart to onRestart callback", () => {
    let restartCalled = false;
    const session = new ChatSession({
      manager,
      bus,
      agentName: "may",
      onRestart: () => {
        restartCalled = true;
      },
    });

    session.handleInput("restart");
    expect(restartCalled).toBe(true);
  });

  it("handles @agent prefix for direct invocation", () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("@coder fix the type error");

    // Direct sessions should be kind: "job", not "chat"
    const status = manager.status();
    expect(status.length).toBe(1);
    expect(status[0].agent).toBe("coder");
    expect(status[0].kind).toBe("job");
    expect(messages.some((m) => m.includes("[direct]"))).toBe(true);

    // Chat session ID should still be null (direct sessions don't set it)
    expect(session.getSessionId()).toBeNull();
  });

  it("/new closes current session and allows fresh start", async () => {
    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("first conversation");

    const firstId = session.getSessionId();
    expect(firstId).toBeTruthy();

    // Wait for idle
    await new Promise((r) => setTimeout(r, 500));

    session.handleInput("/new");
    expect(session.getSessionId()).toBeNull();
    expect(messages.some((m) => m.includes("Closed session"))).toBe(true);

    // Next message creates a new session
    session.handleInput("new conversation");
    const secondId = session.getSessionId();
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);
  });

  it("cancelAll cancels all tracked sessions", async () => {
    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("task one");

    session.cancelAll();

    await new Promise((r) => setTimeout(r, 200));

    const running = manager.status().filter((s) => s.status === "running");
    expect(running.length).toBe(0);
  });

  it("isRunning reflects session state", async () => {
    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    expect(session.isRunning()).toBe(false);

    session.handleInput("do something");
    // Should be running immediately after input
    expect(session.isRunning()).toBe(true);

    // Wait for completion
    await new Promise((r) => setTimeout(r, 500));
    expect(session.isRunning()).toBe(false);
  });
});

describe("Session kind in resumeStaleSessions", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "session-kind-"));
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "memory"), { recursive: true });
    manager = new SubagentManager({ persistDir });
    manager.register({
      name: "may",
      description: "Test agent",
      domain: "testing",
      model: mockModel(),
      tools: [echoTool()],
    });
  });

  afterEach(() => {
    for (const s of manager.status()) {
      if (s.status === "running") manager.cancel(s.sessionId);
    }
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          rmSync(persistDir, { recursive: true, force: true });
        } catch {}
        resolve();
      }, 100);
    });
  });

  it("run() persists kind and autoClose to meta.json", () => {
    const sid = manager.run("may", "test task", { kind: "chat", autoClose: "never" });
    const meta = readSessionMeta(persistDir, sid);

    expect(meta).toBeTruthy();
    expect(meta!.kind).toBe("chat");
    expect(meta!.autoClose).toBe("never");
  });

  it("run() defaults kind to 'job'", () => {
    const sid = manager.run("may", "test task");
    const meta = readSessionMeta(persistDir, sid);

    expect(meta).toBeTruthy();
    expect(meta!.kind).toBe("job");
    expect(meta!.autoClose).toBe("immediate");
  });

  it("resumeStaleSessions with kinds filter only resumes matching sessions", async () => {
    // Create a chat session that will become stale
    const chatSid = manager.run("may", "chat task", { kind: "chat", autoClose: "never" });
    await new Promise((r) => setTimeout(r, 500));
    manager.close(chatSid);
    await new Promise((r) => setTimeout(r, 200));

    // Create a job session that will become stale
    const jobSid = manager.run("may", "job task", { kind: "job" });
    await new Promise((r) => setTimeout(r, 500));

    // Mark both as "running" in meta to simulate stale state
    for (const sid of [chatSid, jobSid]) {
      ensureSessionDir(persistDir, sid);
      const meta = readSessionMeta(persistDir, sid);
      if (meta) {
        meta.status = "running";
        writeSessionMeta(persistDir, sid, meta);
      }
    }

    // Create a fresh manager to simulate restart
    const manager2 = new SubagentManager({ persistDir });
    manager2.register({
      name: "may",
      description: "Test agent",
      domain: "testing",
      model: mockModel(),
      tools: [echoTool()],
    });

    // Resume only job sessions
    const { resumed, interrupted } = manager2.resumeStaleSessions({ kinds: ["job"] });

    // Job should be resumed, chat should be untouched (not in either list)
    expect(resumed.some((s) => s.sessionId === jobSid)).toBe(true);
    expect(resumed.some((s) => s.sessionId === chatSid)).toBe(false);
    expect(interrupted.some((s) => s.sessionId === chatSid)).toBe(false);

    // Cleanup
    for (const s of manager2.status()) {
      if (s.status === "running") manager2.cancel(s.sessionId);
    }
    await new Promise((r) => setTimeout(r, 200));
  });

  it("status() includes kind field", () => {
    manager.run("may", "chat task", { kind: "chat", autoClose: "never" });
    manager.run("may", "job task", { kind: "job" });

    const statuses = manager.status();
    const chatSession = statuses.find((s) => s.kind === "chat");
    const jobSession = statuses.find((s) => s.kind === "job");

    expect(chatSession).toBeTruthy();
    expect(jobSession).toBeTruthy();
  });
});
