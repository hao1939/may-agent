/**
 * Retained instance identity and socket-control compatibility.
 *
 * Tests:
 * 1. src/lib/instance-identity.ts — shared reader/writer
 * 2. src/socket-client.ts — sendSocketCommand() and waitForSocketEvent()
 * Detached launching/polling is retired; existing instances remain controllable.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Duplex } from "node:stream";
import { readIdentity, type InstanceIdentity } from "../../src/lib/instance-identity.js";
import { createIdentityWriter } from "../../src/app/daemon-lifecycle.js";
import { sendSocketCommand, waitForSocketEvent, type SocketEndpoint } from "../../src/lib/socket-client.js";

type ClientHandler = (socket: Duplex) => void;

function mockEndpoint(handler: ClientHandler): SocketEndpoint {
  return () => {
    let peer: Duplex;
    const client = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        peer.push(Buffer.from(chunk));
        callback();
      },
      final(callback) {
        peer.push(null);
        callback();
      },
    });
    peer = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        client.push(Buffer.from(chunk));
        callback();
      },
      final(callback) {
        client.push(null);
        callback();
      },
    });
    client.on("finish", () => peer.push(null));
    peer.on("finish", () => client.push(null));
    client.on("close", () => {
      if (!peer.destroyed) peer.destroy();
    });
    peer.on("close", () => {
      if (!client.destroyed) client.destroy();
    });
    queueMicrotask(() => {
      client.emit("connect");
      handler(peer);
    });
    return client;
  };
}

function onSubscription(socket: Duplex, emit: () => void): void {
  let buffer = "";
  socket.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const frame = JSON.parse(line) as Record<string, unknown>;
      if (frame.type !== "subscribe") continue;
      socket.write(JSON.stringify({ type: "ok", command: "subscribe" }) + "\n");
      emit();
    }
  });
}

// ── readIdentity() tests ───────────────────────────────────────────────

describe("readIdentity", () => {
  let tmpDir: string;
  const instanceName = "job-test_123";

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), "may-instance-"));
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
    writeFileSync(resolve(tmpDir, "instances", instanceName, "identity.json"), JSON.stringify(identity, null, 2));

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

  it("reads daemon identity writes without a second record shape", () => {
    const write = createIdentityWriter({ persistDir: tmpDir, instanceLabel: "daemon" });
    write({ pid: process.pid, instance: "daemon", status: "running", socket: "/fixture.sock" });
    expect(readIdentity(tmpDir, "daemon")).toEqual({
      pid: process.pid, instance: "daemon", status: "running", socket: "/fixture.sock",
    });
    write({ pid: process.pid, status: "done", exitCode: 0 });
    expect(readIdentity(tmpDir, "daemon")).toEqual({ pid: process.pid, status: "done", exitCode: 0 });
  });

  it("returns null for invalid JSON", () => {
    writeFileSync(resolve(tmpDir, "instances", instanceName, "identity.json"), "not valid json {{{");
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
    writeFileSync(resolve(tmpDir, "instances", instanceName, "identity.json"), JSON.stringify(identity, null, 2));

    const result = readIdentity(tmpDir, instanceName);
    expect(result!.status).toBe("done");
    expect(result!.exitCode).toBe(0);
  });
});
// ── sendSocketCommand() tests ──────────────────────────────────────────

describe("sendSocketCommand", () => {
  let endpoint: SocketEndpoint;

  it("sends a command and receives ok response", async () => {
    endpoint = mockEndpoint((socket) => {
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

    const result = await sendSocketCommand(endpoint, { type: "status" });
    expect(result.type).toBe("ok");
    expect(result.command).toBe("status");
  });

  it("rejects on error response", async () => {
    endpoint = mockEndpoint((socket) => {
      socket.write(JSON.stringify({ type: "connected", pid: 1 }) + "\n");
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const _line of lines) {
          socket.write(JSON.stringify({ type: "error", command: "bad", message: "Unknown command" }) + "\n");
        }
      });
    });

    await expect(sendSocketCommand(endpoint, { type: "bad" })).rejects.toThrow("Unknown command");
  });

  it("times out if no response", async () => {
    endpoint = mockEndpoint((socket) => {
      // Send welcome but never respond to commands
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
    });

    await expect(sendSocketCommand(endpoint, { type: "status" }, { timeoutMs: 200 })).rejects.toThrow("Socket timeout");
  });

  it("rejects on connection error (no server)", async () => {
    await expect(sendSocketCommand("/tmp/nonexistent-socket.sock", { type: "status" })).rejects.toThrow();
  });

  it("skips broadcast events and only resolves on ok/error", async () => {
    endpoint = mockEndpoint((socket) => {
      socket.write(JSON.stringify({ type: "connected", pid: 1 }) + "\n");
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const _line of lines) {
          // Send some broadcast events first
          socket.write(JSON.stringify({ type: "info", message: "loading..." }) + "\n");
          socket.write(JSON.stringify({ type: "text", agent: "bob", text: "Hello" }) + "\n");
          // Then the actual response
          socket.write(JSON.stringify({ type: "ok", command: "publish" }) + "\n");
        }
      });
    });

    const result = await sendSocketCommand(endpoint, {
      type: "publish",
      event: {
        type: "session.cancel.requested",
        target: { sessionId: "s_1" },
        data: { reason: "test cancellation" },
      },
    });
    expect(result.type).toBe("ok");
  });
});

// ── waitForSocketEvent() tests ─────────────────────────────────────────

describe("waitForSocketEvent", () => {
  let endpoint: SocketEndpoint;

  it("resolves when matching event is received", async () => {
    endpoint = mockEndpoint((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      onSubscription(socket, () => setTimeout(() => {
        socket.write(
          JSON.stringify({
            type: "session.end",
            source: "runtime",
            owner: "agent:may",
            data: { sessionId: "s_1", status: "done" },
          }) + "\n",
        );
      }, 10));
    });

    const event = await waitForSocketEvent(endpoint, "session.end", { timeoutMs: 5000 });
    expect(event.type).toBe("session.end");
    expect(event.data?.sessionId).toBe("s_1");
    expect(event.data?.status).toBe("done");
  });

  it("filters by sessionId when provided", async () => {
    endpoint = mockEndpoint((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      onSubscription(socket, () => setTimeout(() => {
        // Wrong session
        socket.write(
          JSON.stringify({
            type: "session.end",
            source: "runtime",
            owner: "agent:may",
            data: { sessionId: "s_other", status: "done" },
          }) + "\n",
        );
        // Right session
        socket.write(
          JSON.stringify({
            type: "session.end",
            source: "runtime",
            owner: "agent:may",
            data: { sessionId: "s_target", status: "error" },
          }) + "\n",
        );
      }, 10));
    });

    const event = await waitForSocketEvent(endpoint, "session.end", {
      sessionId: "s_target",
      timeoutMs: 5000,
    });
    expect(event.data?.sessionId).toBe("s_target");
    expect(event.data?.status).toBe("error");
  });

  it("times out if event never arrives", async () => {
    endpoint = mockEndpoint((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      // Only send irrelevant events
      let destroyed = false;
      socket.on("close", () => {
        destroyed = true;
        clearInterval(timer);
      });
      socket.on("error", () => {
        destroyed = true;
        clearInterval(timer);
      });
      const timer = setInterval(() => {
        if (!destroyed) socket.write(JSON.stringify({ type: "info", message: "tick" }) + "\n");
      }, 50);
      onSubscription(socket, () => {});
    });

    await expect(waitForSocketEvent(endpoint, "session.end", { timeoutMs: 300 })).rejects.toThrow(
      "Timeout waiting for session.end",
    );
  });

  it("rejects when socket closes before event", async () => {
    endpoint = mockEndpoint((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      onSubscription(socket, () => setTimeout(() => {
        socket.destroy();
      }, 10));
    });

    await expect(waitForSocketEvent(endpoint, "session.end", { timeoutMs: 5000 })).rejects.toThrow(
      "Socket closed before event received",
    );
  });

  it("ignores non-matching event types", async () => {
    endpoint = mockEndpoint((socket) => {
      socket.write(JSON.stringify({ type: "connected" }) + "\n");
      onSubscription(socket, () => setTimeout(() => {
        socket.write(JSON.stringify({ type: "text", agent: "bob", text: "working" }) + "\n");
        socket.write(JSON.stringify({ type: "tool_call", agent: "bob", tool: "exec" }) + "\n");
        socket.write(JSON.stringify({ type: "info", message: "[task] Completed" }) + "\n");
      }, 10));
    });

    const event = await waitForSocketEvent(endpoint, "info", { timeoutMs: 5000 });
    expect(event.type).toBe("info");
    expect(event.message).toBe("[task] Completed");
  });
});
