/**
 * Tests for V2 ChatLoop — the code-level UI loop.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getModel } from "@mariozechner/pi-ai";
import { SubagentManager } from "../src/lib/manager.js";
import { ChatLoop } from "../src/app/chat-loop.js";
import { EventBus } from "../src/app/event-bus.js";
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

describe("ChatLoop", () => {
  let persistDir: string;
  let manager: SubagentManager;
  let bus: EventBus;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "chatloop-"));
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
      manager.cancel(s.sessionId);
    }
    try { rmSync(persistDir, { recursive: true, force: true }); } catch {}
  });

  it("handles status command directly (no LLM)", () => {
    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("status");

    expect(messages.some((m) => m.includes("No active sessions"))).toBe(true);
  });

  it("handles cancel command when no sessions", () => {
    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("cancel");

    expect(messages.some((m) => m.includes("No active sessions to cancel"))).toBe(true);
  });

  it("starts a session for regular input", () => {
    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("fix the login bug");

    expect(loop.getActiveCount()).toBe(1);

    const transcript = loop.getTranscript();
    expect(transcript).toHaveLength(1);
    expect(transcript[0].role).toBe("human");
    expect(transcript[0].text).toBe("fix the login bug");
  });

  it("starts concurrent sessions for multiple inputs", () => {
    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("fix the login bug");
    loop.handleInput("also fix the signup");

    expect(loop.getActiveCount()).toBeGreaterThanOrEqual(1);

    const transcript = loop.getTranscript();
    expect(transcript).toHaveLength(2);
  });

  it("ignores empty input", () => {
    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("");
    loop.handleInput("   ");

    expect(loop.getActiveCount()).toBe(0);
    expect(loop.getTranscript()).toHaveLength(0);
  });

  it("cancel all cancels running sessions", () => {
    const messages: string[] = [];
    bus.on((event) => {
      if (event.type === "info") messages.push(event.message);
    });

    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("fix something");
    loop.handleInput("cancel all");

    expect(messages.some((m) => m.includes("Cancelled"))).toBe(true);
  });

  it("calls onSessionDone when session finishes", async () => {
    const doneSessions: string[] = [];
    const loop = new ChatLoop({
      manager,
      bus,
      agentName: "may",
      onSessionDone: (sid) => doneSessions.push(sid),
    });

    loop.handleInput("test task");

    await new Promise((r) => setTimeout(r, 500));

    expect(doneSessions.length).toBeGreaterThanOrEqual(1);
  });

  // ── V2 additions ────────────────────────────────────────────────────

  it("delegates reload to onReload callback", () => {
    let reloadCalled = false;
    const loop = new ChatLoop({
      manager, bus, agentName: "may",
      onReload: () => { reloadCalled = true; },
    });

    loop.handleInput("reload");
    expect(reloadCalled).toBe(true);
    expect(loop.getActiveCount()).toBe(0);
  });

  it("delegates close to onClose callback", () => {
    let closeCalled = false;
    const loop = new ChatLoop({
      manager, bus, agentName: "may",
      onClose: () => { closeCalled = true; },
    });

    loop.handleInput("close");
    expect(closeCalled).toBe(true);
  });

  it("delegates restart to onRestart callback", () => {
    let restartCalled = false;
    const loop = new ChatLoop({
      manager, bus, agentName: "may",
      onRestart: () => { restartCalled = true; },
    });

    loop.handleInput("restart");
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

    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("@coder fix the type error");

    // Should start a session (not on may, but on coder)
    expect(loop.getActiveCount()).toBe(1);
    expect(messages.some((m) => m.includes("[direct]"))).toBe(true);
  });

  it("cancelAll cancels all tracked sessions", async () => {
    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("task one");
    loop.handleInput("task two");

    expect(loop.getActiveCount()).toBeGreaterThanOrEqual(1);

    loop.cancelAll();

    // Give a tick for cancellation to propagate
    await new Promise((r) => setTimeout(r, 200));

    const running = manager.status().filter((s) => s.status === "running");
    expect(running.length).toBe(0);
  });

  it("builds transcript context for second message", () => {
    const loop = new ChatLoop({ manager, bus, agentName: "may" });
    loop.handleInput("first message");
    loop.handleInput("second message");

    const transcript = loop.getTranscript();
    expect(transcript).toHaveLength(2);
    expect(transcript[0].text).toBe("first message");
    expect(transcript[1].text).toBe("second message");
  });
});
