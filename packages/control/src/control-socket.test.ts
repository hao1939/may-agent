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
import { EVENT_INGRESS_SOURCE, EVENT_ROW_ID, EventBus, type AgentEvent } from "../../../src/app/event-bus.js";
import { DbWriter } from "../../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../../src/lib/requests.js";

let sockets: ControlSocket[] = [];
const persistDirs: string[] = [];

afterEach(() => {
  for (const socket of sockets) socket.close();
  sockets = [];
  for (const persistDir of persistDirs.splice(0)) {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  }
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
    expect(core.emitted).toMatchObject([
      {
        type: "project.nudge",
        source: "test",
        owner: "agent:may",
        data: { projectPath: "agents/shared/projects/x" },
      },
    ]);
  });

  it("persists a flat trigger command and returns its durable event id", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-control-socket-flat-trigger-"));
    persistDirs.push(persistDir);
    const bus = new EventBus();
    const writer = new DbWriter(persistDir);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const core = createCore({
      emitEvent: (event) => {
        Object.defineProperty(event, EVENT_INGRESS_SOURCE, {
          value: "control-socket",
          configurable: true,
        });
        const emitted = bus.emit(event as AgentEvent);
        const eventId = emitted[EVENT_ROW_ID];
        return Number.isInteger(eventId) && Number(eventId) > 0 ? { eventId: Number(eventId) } : {};
      },
      subscribeEvents: (handler) => bus.subscribe((event) => handler(event as ControlEvent)),
    });

    const receipt = await sendSocketCommand(core.endpoint, {
      type: "trigger.metrics-snapshot",
      source: "control",
      owner: "agent:may",
      forced: true,
    });

    expect(Number(receipt.eventId)).toBeGreaterThan(0);
    const row = getDb(persistDir)
      .prepare("SELECT id, event_type FROM events WHERE id = ?")
      .get(receipt.eventId) as { id: number; event_type: string };
    expect(row).toEqual({ id: receipt.eventId, event_type: "trigger.metrics-snapshot" });
  });

  it("returns the original persisted event id when a canonical socket event is retried", async () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-control-socket-retry-"));
    persistDirs.push(persistDir);
    const bus = new EventBus();
    const writer = new DbWriter(persistDir);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const core = createCore({
      emitEvent: (event) => {
        Object.defineProperty(event, EVENT_INGRESS_SOURCE, {
          value: "control-socket",
          configurable: true,
        });
        const emitted = bus.emit(event as AgentEvent);
        const eventId = emitted[EVENT_ROW_ID];
        return Number.isInteger(eventId) && Number(eventId) > 0 ? { eventId: Number(eventId) } : {};
      },
      subscribeEvents: (handler) => bus.subscribe((event) => handler(event as ControlEvent)),
    });
    const frame = {
      type: "metric.updated",
      source: "test:control-socket",
      owner: "agent:dev",
      data: {
        metricId: "control.socket.retry.fixture",
        idempotencyKey: "control-socket-retry-1",
      },
    };

    const original = await sendSocketCommand(core.endpoint, frame);
    const retry = await sendSocketCommand(core.endpoint, frame);

    expect(Number(original.eventId)).toBeGreaterThan(0);
    expect(retry).toEqual(original);
    const rows = getDb(persistDir)
      .prepare(
        `SELECT id
         FROM events
         WHERE event_type = ?
           AND idempotency_key = ?`,
      )
      .all(frame.type, frame.data.idempotencyKey) as Array<{ id: number }>;
    expect(rows).toEqual([{ id: original.eventId }]);
  });

  it("rolls back persistence when the durable row id cannot attach to the event", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-control-socket-receipt-boundary-"));
    persistDirs.push(persistDir);
    const writer = new DbWriter(persistDir);
    const event = {
      type: "trigger.metrics-snapshot",
      source: "test:control-socket",
      owner: "agent:may",
      data: {},
    } as AgentEvent;
    Object.defineProperty(event, EVENT_INGRESS_SOURCE, {
      value: "control-socket",
      configurable: true,
    });
    Object.freeze(event);

    expect(() => writer.handler(event)).toThrow("cannot expose its durable receipt");
    const row = getDb(persistDir)
      .prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?")
      .get(event.type) as { count: number };
    expect(row.count).toBe(0);
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

  it("validates and admits App input through the explicit control command", async () => {
    const core = createCore({
      admitAppInput: (input) => {
        expect(input).toEqual({
          appId: "aks-rp-e2e",
          input: {
            kind: "message",
            data: { message: "Review the current normalization gap." },
          },
          source: { kind: "human", id: "web-ui:project-comment-17" },
          conversationId: "web-ui:project:aks-rp-e2e",
          channel: "web-ui",
          idempotencyKey: "project-comment-17",
        });
        return { eventId: 72, eventType: "app.input.requested" };
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.input.admit",
        appId: "aks-rp-e2e",
        input: {
          kind: "message",
          data: { message: "Review the current normalization gap." },
        },
        source: { kind: "human", id: "web-ui:project-comment-17" },
        conversationId: "web-ui:project:aks-rp-e2e",
        channel: "web-ui",
        idempotencyKey: "project-comment-17",
      }),
    ).resolves.toMatchObject({
      type: "ok",
      command: "app.input.admit",
      appId: "aks-rp-e2e",
      eventId: 72,
      eventType: "app.input.requested",
    });
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
      activeAgents: [
        { agent: "scout", sessionId: "s_1", status: "running", kind: "call", task: "investigate a long task name" },
      ],
    });
    expect(core.emitted).toEqual([]);
  });

  it("includes the current chat target as ready when it is not active", async () => {
    const core = createCore({
      getSessionId: () => "s_chat_done",
      getStatus: () => [{ agent: "scout", sessionId: "s_1", status: "running", kind: "call", task: "investigate" }],
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

  it("forwards a Web App inbox response without treating socket observation as delivery", async () => {
    const delivered: Array<{ event: ControlEvent; count: number }> = [];
    const core = createCore({
      onDelivered: (event, count) => delivered.push({ event, count }),
      emitEvent: (event) => {
        core.emitted.push(event);
        return { eventId: 81 };
      },
    });
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);
    stream.write(JSON.stringify({ type: "subscribe", sessions: ["legacy-chat"] }) + "\n");
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });
    const response = {
      type: "app.response.delivery.requested",
      source: "app-inbox",
      owner: "app:may",
      data: {
        channel: "web-ui",
        sessionId: "bounded-owner-session",
        operationId: "app-delivery:item-1:1",
        appInboxItemId: "item-1",
        appInboxRequestId: "app-inbox-human:item-1",
        text: "Done.",
      },
    };

    core.getBroadcast()?.(response);

    await expect(nextFrame(stream)).resolves.toEqual(response);
    expect(delivered).toEqual([]);

    const acknowledgement = {
      type: "channel.delivery.completed",
      source: "web-ui",
      owner: "app:may",
      target: { human: true },
      data: {
        channel: "web-ui",
        sessionId: "bounded-owner-session",
        resultEventType: "app.response.delivery.requested",
        operationId: "app-delivery:item-1:1",
        appInboxItemId: "item-1",
        appInboxRequestId: "app-inbox-human:item-1",
        idempotencyKey: "web-ui-delivery:app-delivery:item-1:1",
      },
    };
    await expect(sendSocketCommand(core.endpoint, acknowledgement)).resolves.toEqual({
      type: "ok",
      command: "channel.delivery.completed",
      eventId: 81,
    });
    expect(core.emitted).toEqual([acknowledgement]);
    stream.destroy();
  });

  it("rejects subscription filters containing non-string session ids", async () => {
    const core = createCore();

    await expect(sendSocketCommand(core.endpoint, { type: "subscribe", sessions: ["s_1", 42] })).rejects.toThrow(
      "sessions must be an array of strings",
    );
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

  it("releases a client slot when the peer ends before close", async () => {
    const core = createCore();
    const stream = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    core.attachClient(stream);
    expect(core.clientCount()).toBe(1);

    stream.emit("end");

    expect(core.clientCount()).toBe(0);
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

  it("fails startup instead of silently running without the requested socket", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-control-socket-owner-"));
    try {
      const socketPath = join(root, "may.sock");
      const first = await attachControlSocket({
        socketPath,
        getSessionId: () => "",
        getStatus: () => [],
        emitEvent: () => {},
        subscribeEvents: () => () => {},
        agentName: "may",
        instance: "background",
      });
      sockets.push(first);

      await expect(
        attachControlSocket({
          socketPath,
          getSessionId: () => "",
          getStatus: () => [],
          emitEvent: () => {},
          subscribeEvents: () => () => {},
          agentName: "may",
          instance: "background",
        }),
      ).rejects.toThrow("Refusing to start without control-socket ownership");

      expect(statSync(socketPath).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
