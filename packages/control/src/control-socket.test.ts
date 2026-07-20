import { Duplex } from "node:stream";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendSocketCommand, type SocketEndpoint } from "./client.js";
import {
  attachControlSocket,
  CONTROL_SOCKET_LIMITS,
  createControlSocketCore,
  type ControlEvent,
  type ControlSocket,
} from "./server.js";

let sockets: ControlSocket[] = [];

afterEach(() => {
  for (const socket of sockets) socket.close();
  sockets = [];
});

function mockEndpoint(handler: (socket: Duplex) => void): SocketEndpoint {
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

function nextFrame(stream: Duplex): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        stream.off("data", onData);
        try {
          resolve(JSON.parse(line) as Record<string, unknown>);
        } catch (err) {
          reject(err);
        }
        return;
      }
    };
    stream.on("data", onData);
    stream.on("error", reject);
  });
}

function createCore(overrides: Partial<Parameters<typeof createControlSocketCore>[0]> = {}): ControlSocket & {
  attachClient: ReturnType<typeof createControlSocketCore>["attachClient"];
  endpoint: SocketEndpoint;
  emitted: ControlEvent[];
  getBroadcast: () => ((event: ControlEvent) => void) | undefined;
} {
  const emitted: ControlEvent[] = [];
  let broadcast: ((event: ControlEvent) => void) | undefined;
  const core = createControlSocketCore({
    getSessionId: () => "chat-session",
    getStatus: () => [],
    emitEvent: (event) => emitted.push(event),
    subscribeEvents: (handler) => {
      broadcast = handler;
      return () => {
        broadcast = undefined;
      };
    },
    agentName: "may",
    instance: "test",
    ...overrides,
  });
  const wrapped = {
    ...core,
    endpoint: mockEndpoint(core.attachClient),
    emitted,
    getBroadcast: () => broadcast,
  };
  sockets.push(wrapped);
  return wrapped;
}

describe("control socket protocol", () => {
  it("returns the persisted semantic event receipt", async () => {
    const core = createCore({
      emitEvent: (event) => {
        core.emitted.push(event);
        return { eventId: 42 };
      },
    });

    const ack = await sendSocketCommand(core.endpoint, {
      type: "project.nudge",
      source: "test",
      owner: "agent:may",
      data: { projectPath: "agents/shared/projects/x" },
    });

    expect(ack).toEqual({ type: "ok", command: "project.nudge", eventId: 42 });
    expect(core.emitted).toMatchObject([{
      type: "project.nudge",
      source: "test",
      owner: "agent:may",
      data: { projectPath: "agents/shared/projects/x" },
    }]);
  });

  it("returns persistence errors instead of acknowledging an unpersisted event", async () => {
    const core = createCore({
      emitEvent: () => {
        throw new Error("persistence unavailable");
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "project.nudge",
        source: "test",
        owner: "agent:may",
        data: {},
      }),
    ).rejects.toThrow("persistence unavailable");
  });

  it("does not acknowledge an event when persistence returns no event id", async () => {
    const core = createCore({ emitEvent: () => {} });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "project.nudge",
        source: "test",
        owner: "agent:may",
        data: {},
      }),
    ).rejects.toThrow("was not durably persisted");
  });

  it("discovers and invokes project action shortcuts", async () => {
    const core = createCore({
      describeProjectActions: (projectId) => [
        {
          id: "advance-project",
          description: `Advance ${projectId}`,
          inputSchema: { type: "object" },
        },
      ],
      invokeProjectAction: ({ projectId, actionId, params, idempotencyKey }) => {
        expect({ projectId, actionId, params, idempotencyKey }).toEqual({
          projectId: "sample",
          actionId: "advance-project",
          params: { reason: "manual" },
          idempotencyKey: "request-1",
        });
        return { eventId: 73, eventType: "project.owner.requested" };
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "project.actions.describe",
        projectId: "sample",
      }),
    ).resolves.toMatchObject({
      type: "ok",
      projectId: "sample",
      actions: [{ id: "advance-project", inputSchema: { type: "object" } }],
    });
    await expect(
      sendSocketCommand(core.endpoint, {
        type: "project.action.invoke",
        projectId: "sample",
        actionId: "advance-project",
        params: { reason: "manual" },
        idempotencyKey: "request-1",
      }),
    ).resolves.toMatchObject({
      type: "ok",
      eventId: 73,
      eventType: "project.owner.requested",
    });
  });

  it("serves status locally without emitting a daemon event", async () => {
    const core = createCore({
      getSessionId: () => "",
      getStatus: () => [
        { agent: "scout", sessionId: "s_1", status: "running", kind: "call", task: "investigate a long task name" },
        { agent: "dev", sessionId: "s_2", status: "done", kind: "call", task: "finished" },
      ],
    });

    const status = await sendSocketCommand(core.endpoint, { type: "status" });

    expect(status).toEqual({
      type: "status",
      command: "status",
      activeAgents: [{ agent: "scout", sessionId: "s_1", status: "running", kind: "call", task: "investigate a long task name" }],
    });
    expect(core.emitted).toEqual([]);
  });

  it("includes the current chat target as ready when it is not active", async () => {
    const core = createCore({
      getSessionId: () => "s_chat_done",
      getStatus: () => [
        { agent: "scout", sessionId: "s_1", status: "running", kind: "call", task: "investigate" },
      ],
    });

    const status = await sendSocketCommand(core.endpoint, { type: "status" });

    expect(status).toEqual({
      type: "status",
      command: "status",
      activeAgents: [
        { agent: "scout", sessionId: "s_1", status: "running", kind: "call", task: "investigate" },
        { agent: "may", sessionId: "s_chat_done", status: "ready", kind: "chat", task: "May chat" },
      ],
    });
  });

  it("filters subscribed event streams by session", async () => {
    const core = createCore();
    let serverStream!: Duplex;
    const client = mockEndpoint((stream) => {
      serverStream = stream;
      core.attachClient(stream);
    }) as () => Duplex;
    const stream = client();
    await nextFrame(stream);

    stream.write(JSON.stringify({ type: "subscribe", sessions: ["s_match"] }) + "\n");
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });

    core.getBroadcast()?.({ type: "text", sessionId: "s_other", agent: "may", text: "skip" });
    core.getBroadcast()?.({ type: "text", sessionId: "s_match", agent: "may", text: "hello" });
    await expect(nextFrame(stream)).resolves.toMatchObject({ type: "text", sessionId: "s_match", text: "hello" });
    serverStream.destroy();
    stream.destroy();
  });

  it("rejects subscription filters containing non-string session ids", async () => {
    const core = createCore();

    await expect(
      sendSocketCommand(core.endpoint, { type: "subscribe", sessions: ["s_1", 42] }),
    ).rejects.toThrow("sessions must be an array of strings");
  });

  it("does not broadcast events before a client subscribes", async () => {
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);

    core.getBroadcast()?.({ type: "text", sessionId: "chat-session", text: "before" });
    stream.write(JSON.stringify({ type: "subscribe", sessions: ["chat-session"] }) + "\n");
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });
    core.getBroadcast()?.({ type: "text", sessionId: "chat-session", text: "after" });
    await expect(nextFrame(stream)).resolves.toMatchObject({ type: "text", text: "after" });
    stream.destroy();
  });

  it("rejects invalid event frames", async () => {
    const core = createCore();

    await expect(sendSocketCommand(core.endpoint, { event: "missing-type" })).rejects.toThrow(
      "Missing or invalid event type: undefined",
    );
  });

  it("rejects oversized frames before parsing them", async () => {
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);
    const response = nextFrame(stream);

    stream.write("x".repeat(CONTROL_SOCKET_LIMITS.maxFrameBytes + 1) + "\n");

    await expect(response).resolves.toEqual({
      type: "error",
      command: null,
      message: "Control socket frame is too large",
    });
    expect(core.emitted).toEqual([]);
    stream.destroy();
  });

  it("creates the socket parent directory before listening", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-control-socket-"));
    try {
      const socketPath = join(root, "missing", "nested", "may.sock");
      const socket = await attachControlSocket({
        socketPath,
        getSessionId: () => "",
        getStatus: () => [],
        emitEvent: () => {},
        subscribeEvents: () => () => {},
        agentName: "may",
        instance: "test",
      });
      sockets.push(socket);
      expect(socket.clientCount()).toBe(0);
      expect(statSync(socketPath).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
