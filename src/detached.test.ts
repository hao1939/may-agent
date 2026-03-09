/**
 * Tests for Phase 1 Detached Sub-Agent Design.
 *
 * Tests:
 * 1. src/detached.ts — readIdentity() helper
 * 2. src/socket-client.ts — sendSocketCommand() and waitForSocketEvent()
 * 3. src/manager.ts — waitForDetached(), detached cancel, detached waitFor tool action
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { createServer, type Server } from "node:net";
import { readIdentity, type InstanceIdentity } from "./detached.js";
import { sendSocketCommand, waitForSocketEvent } from "./socket-client.js";

// ── readIdentity() tests ───────────────────────────────────────────────

describe("readIdentity", () => {
  const tmpDir = resolve("/tmp/test-detached-" + process.pid);
  const instanceName = "job-test_123";

  beforeEach(() => {
    mkdirSync(resolve(tmpDir, "instances", instanceName), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads a valid identity.json", () => {
    const identity: InstanceIdentity = {
      pid: 12345,
      agent: "bob",
      instance: instanceName,
      socket: "/tmp/bob.sock",
      startedAt: "2025-01-01T00:00:00.000Z",
      startedBy: "task",
      task: "Analyze code",
      status: "running",
      sessionId: "s_123",
    };
    writeFileSync(
      resolve(tmpDir, "instances", instanceName, "identity.json"),
      JSON.stringify(identity, null, 2),
    );

    const result = readIdentity(tmpDir, instanceName);
    expect(result).toEqual(identity);
    expect(result!.pid).toBe(12345);
    expect(result!.status).toBe("running");
    expect(result!.socket).toBe("/tmp/bob.sock");
  });

  it("returns null for missing identity.json", () => {
    const result = readIdentity(tmpDir, "nonexistent-instance");
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    writeFileSync(
      resolve(tmpDir, "instances", instanceName, "identity.json"),
      "not valid json {{{",
    );
    const result = readIdentity(tmpDir, instanceName);
    expect(result).toBeNull();
  });

  it("reads identity with done status and exitCode", () => {
    const identity: InstanceIdentity = {
      pid: 12345,
      agent: "bob",
      instance: instanceName,
      socket: "/tmp/bob.sock",
      startedAt: "2025-01-01T00:00:00.000Z",
      startedBy: "task",
      task: "Analyze code",
      status: "done",
      exitCode: 0,
      endedAt: "2025-01-01T00:05:00.000Z",
      duration: "5m0s",
      sessionId: "s_123",
    };
    writeFileSync(
      resolve(tmpDir, "instances", instanceName, "identity.json"),
      JSON.stringify(identity, null, 2),
    );

    const result = readIdentity(tmpDir, instanceName);
    expect(result!.status).toBe("done");
    expect(result!.exitCode).toBe(0);
  });
});

// ── sendSocketCommand() tests ──────────────────────────────────────────

describe("sendSocketCommand", () => {
  let socketPath: string;
  let server: Server | null = null;
  let socketCounter = 0;

  beforeEach(() => {
    socketPath = `/tmp/test-sock-cmd-${process.pid}-${socketCounter++}.sock`;
  });

  afterEach(async () => {
    if (server) {
      // Force-close all connections, then close the server
      const s = server;
      server = null;
      await new Promise<void>((resolve) => {
        s.close(() => resolve());
        // Force resolve after 1s to prevent hanging
        setTimeout(resolve, 1000);
      });
    }
  });

  it("sends a command and receives ok response", async () => {
    server = createServer((socket) => {
      // Send welcome message
      socket.write(JSON.stringify({ type: "connected", pid: 1 }) + "\n");
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          const cmd = JSON.parse(line);
          // Respond with ok
          socket.write(JSON.stringify({ type: "ok", command: cmd.type }) + "\n");
        }
      });
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    const result = await sendSocketCommand(socketPath, { type: "status" });
    expect(result.type).toBe("ok");
    expect(result.command).toBe("status");
  });

  it("rejects on error response", async () => {
    server = createServer((socket) => {
      socket.write(JSON.stringify({ type: "connected", pid: 1 }) + "\n");
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          socket.write(JSON.stringify({ type: "error", message: "Unknown command" }) + "\n");
        }
      });
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    await expect(sendSocketCommand(socketPath, { type: "bad" })).rejects.toThrow("Unknown command");
  });

  it("times out if no response", async () => {
    server = createServer((socket) => {
      // Send welcome but never respond to commands
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    await expect(
      sendSocketCommand(socketPath, { type: "status" }, { timeoutMs: 200 }),
    ).rejects.toThrow("Socket timeout");
  });

  it("rejects on connection error (no server)", async () => {
    await expect(
      sendSocketCommand("/tmp/nonexistent-socket.sock", { type: "status" }),
    ).rejects.toThrow();
  });

  it("skips broadcast events and only resolves on ok/error", async () => {
    server = createServer((socket) => {
      socket.write(JSON.stringify({ type: "connected", pid: 1 }) + "\n");
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          // Send some broadcast events first
          socket.write(JSON.stringify({ type: "info", message: "loading..." }) + "\n");
          socket.write(JSON.stringify({ type: "text", agent: "bob", text: "Hello" }) + "\n");
          // Then the actual response
          socket.write(JSON.stringify({ type: "ok", command: "cancel" }) + "\n");
        }
      });
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    const result = await sendSocketCommand(socketPath, { type: "cancel", sessionId: "s_1" });
    expect(result.type).toBe("ok");
  });
});

// ── waitForSocketEvent() tests ─────────────────────────────────────────

describe("waitForSocketEvent", () => {
  const socketPath = `/tmp/test-sock-evt-${process.pid}.sock`;
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it("resolves when matching event is received", async () => {
    server = createServer((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      // After a short delay, emit the event we're waiting for
      setTimeout(() => {
        socket.write(JSON.stringify({ type: "session_end", sessionId: "s_1", status: "done" }) + "\n");
      }, 100);
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    const event = await waitForSocketEvent(socketPath, "session_end", { timeoutMs: 5000 });
    expect(event.type).toBe("session_end");
    expect(event.sessionId).toBe("s_1");
    expect(event.status).toBe("done");
  });

  it("filters by sessionId when provided", async () => {
    server = createServer((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      setTimeout(() => {
        // Wrong session
        socket.write(JSON.stringify({ type: "session_end", sessionId: "s_other", status: "done" }) + "\n");
        // Right session
        socket.write(JSON.stringify({ type: "session_end", sessionId: "s_target", status: "error" }) + "\n");
      }, 100);
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    const event = await waitForSocketEvent(socketPath, "session_end", {
      sessionId: "s_target",
      timeoutMs: 5000,
    });
    expect(event.sessionId).toBe("s_target");
    expect(event.status).toBe("error");
  });

  it("times out if event never arrives", async () => {
    server = createServer((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      // Only send irrelevant events
      let destroyed = false;
      socket.on("close", () => { destroyed = true; clearInterval(timer); });
      socket.on("error", () => { destroyed = true; clearInterval(timer); });
      const timer = setInterval(() => {
        if (!destroyed) socket.write(JSON.stringify({ type: "info", message: "tick" }) + "\n");
      }, 50);
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    await expect(
      waitForSocketEvent(socketPath, "session_end", { timeoutMs: 300 }),
    ).rejects.toThrow("Timeout waiting for session_end");
  });

  it("rejects when socket closes before event", async () => {
    server = createServer((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      setTimeout(() => {
        socket.destroy();
      }, 100);
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    await expect(
      waitForSocketEvent(socketPath, "session_end", { timeoutMs: 5000 }),
    ).rejects.toThrow("Socket closed before event received");
  });

  it("ignores non-matching event types", async () => {
    server = createServer((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      setTimeout(() => {
        socket.write(JSON.stringify({ type: "text", agent: "bob", text: "working" }) + "\n");
        socket.write(JSON.stringify({ type: "tool_call", agent: "bob", tool: "exec" }) + "\n");
        socket.write(JSON.stringify({ type: "info", message: "[task] Completed" }) + "\n");
      }, 100);
    });

    await new Promise<void>((resolve) => server!.listen(socketPath, () => resolve()));

    const event = await waitForSocketEvent(socketPath, "info", { timeoutMs: 5000 });
    expect(event.type).toBe("info");
    expect(event.message).toBe("[task] Completed");
  });
});

// ── waitForDetached() tests (via SubagentManager) ──────────────────────

describe("waitForDetached", () => {
  const tmpDir = resolve("/tmp/test-manager-" + process.pid);

  // We need to create a minimal SubagentManager to test waitForDetached.
  let SubagentManager: typeof import("./manager.js").SubagentManager;

  beforeEach(async () => {
    mkdirSync(resolve(tmpDir, "sessions"), { recursive: true });
    mkdirSync(resolve(tmpDir, "instances"), { recursive: true });
    // History dir for archived sessions
    mkdirSync(resolve(tmpDir, "sessions", "history"), { recursive: true });
    const mod = await import("./manager.js");
    SubagentManager = mod.SubagentManager;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSessionMeta(sessionId: string, data: Record<string, unknown>) {
    const dir = resolve(tmpDir, "sessions", sessionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "meta.json"), JSON.stringify(data, null, 2));
  }

  function writeArchivedSession(sessionId: string, data: Record<string, unknown>, messages: unknown[]) {
    // Write meta.json in the active session dir (for getSession to find)
    writeSessionMeta(sessionId, data);
    // Write session.jsonl in history dir (for readArchivedSessionMessages)
    const histDir = resolve(tmpDir, "sessions", "history", sessionId);
    mkdirSync(histDir, { recursive: true });
    const jsonlContent = messages.map(m => JSON.stringify(m)).join("\n") + "\n";
    writeFileSync(resolve(histDir, "session.jsonl"), jsonlContent);
  }

  function writeInstanceIdentity(instanceName: string, data: Record<string, unknown>) {
    const dir = resolve(tmpDir, "instances", instanceName);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "identity.json"), JSON.stringify(data, null, 2));
  }

  it("resolves immediately for already-completed session", async () => {
    const manager = new SubagentManager({ persistDir: tmpDir });
    const sessionId = "s_done_1";

    writeArchivedSession(sessionId, {
      agent: "bob",
      task: "test",
      status: "done",
      startedAt: Date.now() - 5000,
      endedAt: Date.now(),
      detached: true,
      instance: "job-" + sessionId,
    }, [
      { role: "user", content: [{ type: "text", text: "Do it" }], timestamp: Date.now() - 5000 },
      { role: "assistant", content: [{ type: "text", text: "Done!" }], timestamp: Date.now() },
    ]);

    const result = await manager.waitForDetached(sessionId);
    expect(result.status).toBe("done");
    expect(result.lastAssistantText).toBe("Done!");
  });

  it("polls until session completes", async () => {
    const manager = new SubagentManager({ persistDir: tmpDir });
    const sessionId = "s_poll_1";

    writeSessionMeta(sessionId, {
      agent: "bob",
      task: "test",
      status: "running",
      startedAt: Date.now(),
      detached: true,
      instance: "job-" + sessionId,
    });

    writeInstanceIdentity("job-" + sessionId, {
      pid: process.pid,
      status: "running",
      socket: "",
    });

    // After 500ms, update meta to "done" and write archive
    setTimeout(() => {
      writeArchivedSession(sessionId, {
        agent: "bob",
        task: "test",
        status: "done",
        startedAt: Date.now() - 1000,
        endedAt: Date.now(),
        detached: true,
        instance: "job-" + sessionId,
      }, [
        { role: "assistant", content: [{ type: "text", text: "Working..." }], timestamp: Date.now() },
      ]);
    }, 500);

    const result = await manager.waitForDetached(sessionId, { pollIntervalMs: 200 });
    expect(result.status).toBe("done");
  });

  it("detects process death via identity.json", async () => {
    const manager = new SubagentManager({ persistDir: tmpDir });
    const sessionId = "s_dead_1";
    const instanceName = "job-" + sessionId;

    writeSessionMeta(sessionId, {
      agent: "bob",
      task: "test",
      status: "running",
      startedAt: Date.now(),
      detached: true,
      instance: instanceName,
    });

    writeInstanceIdentity(instanceName, {
      pid: 99999999,
      status: "running",
      socket: "",
    });

    // Write archived session (for when resultFromArchive reads it after status update)
    const histDir = resolve(tmpDir, "sessions", "history", sessionId);
    mkdirSync(histDir, { recursive: true });
    writeFileSync(
      resolve(histDir, "session.jsonl"),
      JSON.stringify({ role: "assistant", content: [{ type: "text", text: "Crashed" }], timestamp: Date.now() }) + "\n",
    );

    // After 300ms, update identity to show process exited
    setTimeout(() => {
      writeInstanceIdentity(instanceName, {
        pid: 99999999,
        status: "error",
        exitCode: 1,
        socket: "",
      });
    }, 300);

    const result = await manager.waitForDetached(sessionId, { pollIntervalMs: 200 });
    expect(result.status).toBe("error");
  });

  it("throws on timeout", async () => {
    const manager = new SubagentManager({ persistDir: tmpDir });
    const sessionId = "s_timeout_1";

    writeSessionMeta(sessionId, {
      agent: "bob",
      task: "test",
      status: "running",
      startedAt: Date.now(),
      detached: true,
      instance: "job-" + sessionId,
    });

    writeInstanceIdentity("job-" + sessionId, {
      pid: process.pid,
      status: "running",
      socket: "",
    });

    await expect(
      manager.waitForDetached(sessionId, { pollIntervalMs: 100, timeoutMs: 400 }),
    ).rejects.toThrow("Timeout waiting for detached session");
  });

  it("throws for unknown session", async () => {
    const manager = new SubagentManager({ persistDir: tmpDir });
    await expect(manager.waitForDetached("nonexistent")).rejects.toThrow("not found");
  });
});
