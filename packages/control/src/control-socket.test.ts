import { Duplex } from "node:stream";
import { afterEach, describe, expect, it } from "bun:test";
import { sendSocketCommand, type SocketEndpoint } from "./client.js";
import {
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
  it("acks daemon events before async dispatch", async () => {
    const core = createCore();

    const ack = await sendSocketCommand(core.endpoint, {
      type: "project.nudge",
      source: "test",
      owner: "agent:may",
      data: { projectPath: "agents/shared/projects/x" },
    });

    expect(ack).toEqual({ type: "ok", command: "project.nudge" });
    await new Promise((resolve) => setImmediate(resolve));
    expect(core.emitted).toMatchObject([{
      type: "project.nudge",
      source: "test",
      owner: "agent:may",
      data: { projectPath: "agents/shared/projects/x" },
    }]);
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

  it("rejects invalid event frames", async () => {
    const core = createCore();

    await expect(sendSocketCommand(core.endpoint, { event: "missing-type" })).rejects.toThrow(
      "Missing or invalid event type: undefined",
    );
  });
});
