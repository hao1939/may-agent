/**
 * Tests for ChatSession — persistent chat session.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { SubagentManager } from "../../src/lib/manager.js";
import { ChatSession } from "../../src/app/chat-session.js";
import { EventBus } from "../../src/app/event-bus.js";
import {
  appendSessionMessage,
  readSessionMeta,
  writeSessionMeta,
  ensureSessionDir,
} from "../../src/lib/persistence.js";
import type { AgentTool } from "@earendil-works/pi-agent-core";

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
  return getBuiltinModel("anthropic", "claude-opus-4-6");
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
    bus.subscribe((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("status");

    expect(messages.some((m) => m.includes("No active sessions"))).toBe(true);
  });

  it("handles cancel command when no sessions", () => {
    const messages: string[] = [];
    bus.subscribe((event) => {
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

  it("reuses the same persistent session across completed chat turns", async () => {
    const runOpts: any[] = [];
    const sends: Array<{ sessionId: string; message: string }> = [];
    let created = false;
    const fakeManager = {
      status: () =>
        created
          ? [
              {
                sessionId: "s_chat",
                agent: "may",
                task: "first message",
                status: "idle",
                startedAt: Date.now(),
                runtime: "0s",
                outputDir: "",
                kind: "chat",
                autoClose: "never",
              },
            ]
          : [],
      hasActiveSession: (sessionId: string) => created && sessionId === "s_chat",
      run: (_agentName: string, _task: string, opts?: any) => {
        runOpts.push(opts ?? {});
        created = true;
        return "s_chat";
      },
      send: (sessionId: string, message: string) => {
        sends.push({ sessionId, message });
      },
      waitForIdle: async () => {},
      close: () => {},
      progress: () => [],
    } as unknown as SubagentManager;

    const session = new ChatSession({ manager: fakeManager, bus, agentName: "may", persistDir });
    session.handleInput("first message");

    const firstId = session.getSessionId();
    expect(firstId).toBeTruthy();

    session.handleInput("second message");
    expect(session.getSessionId()).toBeTruthy();
    expect(session.getSessionId()).toBe(firstId);
    expect(runOpts.length).toBe(1);
    expect(sends).toEqual([{ sessionId: firstId!, message: "second message" }]);

    const secondId = session.getSessionId();

    session.handleInput("third message");
    expect(session.getSessionId()).toBeTruthy();
    expect(session.getSessionId()).toBe(secondId);
    expect(runOpts.length).toBe(1);
    expect(sends).toEqual([
      { sessionId: firstId!, message: "second message" },
      { sessionId: firstId!, message: "third message" },
    ]);
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
    bus.subscribe((event) => {
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

  it("handles @agent prefix by routing through May's session", () => {
    manager.register({
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: mockModel(),
      tools: [echoTool()],
    });

    const session = new ChatSession({ manager, bus, agentName: "may", persistDir });
    session.handleInput("@coder fix the type error");

    // @agent prefix now routes through May's chat session (she forks the target agent)
    const status = manager.status();
    expect(status.length).toBe(1);
    expect(status[0].agent).toBe("may");
    expect(status[0].kind).toBe("chat");

    // May's session is now active (not null)
    expect(session.getSessionId()).toBeTruthy();
  });

  it("/new closes current session and allows fresh start", async () => {
    const messages: string[] = [];
    bus.subscribe((event) => {
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
  }, 15_000);

  it("resumeStaleSessions resumes stale chat sessions with the same session id", () => {
    const chatSid = "s_restart_chat";
    ensureSessionDir(persistDir, chatSid);
    writeSessionMeta(persistDir, chatSid, {
      agent: "may",
      task: "continue this Telegram reply",
      status: "running",
      startedAt: Date.now() - 10_000,
      kind: "chat",
      autoClose: "never",
      source: "telegram",
    });
    appendSessionMessage(persistDir, chatSid, {
      role: "user",
      content: [{ type: "text", text: "continue this Telegram reply" }],
      timestamp: Date.now() - 10_000,
    } as any);
    writeFileSync(join(persistDir, "sessions", chatSid, "[STARTED]"), new Date().toISOString(), "utf-8");

    const manager2 = new SubagentManager({ persistDir });
    manager2.register({
      name: "may",
      description: "Test agent",
      domain: "testing",
      model: mockModel(),
      tools: [echoTool()],
    });

    const { resumed, interrupted } = manager2.resumeStaleSessions({ kinds: ["chat"] });

    expect(resumed.some((s) => s.sessionId === chatSid && s.kind === "chat")).toBe(true);
    expect(interrupted.some((s) => s.sessionId === chatSid)).toBe(false);
    expect(manager2.hasActiveSession(chatSid)).toBe(true);

    manager2.cancel(chatSid);
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
