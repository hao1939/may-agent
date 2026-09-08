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
import { taskUpdateIdentity } from "./task-wake.js";

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
  it("publishes and reads through the simple event interface", async () => {
    const published: unknown[] = [];
    const core = createCore({
      publishEvent: (event) => {
        published.push(event);
        return {
          eventId: 73,
          eventType: event.type,
          delivery: "accepted",
          links: [{ kind: "request", id: "app_73", state: "pending" }],
        };
      },
      getEvent: (eventId) => ({ event: { id: eventId, type: "app.input.requested" } }),
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "publish",
        event: {
          type: "app.input.requested",
          target: { appId: "sample" },
          data: { input: { kind: "message", data: { message: "hello" } } },
          idempotencyKey: "turn-73",
        },
      }),
    ).resolves.toMatchObject({
      type: "ok",
      command: "publish",
      eventId: 73,
      delivery: "accepted",
      links: [{ kind: "request", id: "app_73" }],
    });
    expect(published).toEqual([
      {
        type: "app.input.requested",
        target: { appId: "sample" },
        data: { input: { kind: "message", data: { message: "hello" } } },
        idempotencyKey: "turn-73",
      },
    ]);
    await expect(sendSocketCommand(core.endpoint, { type: "event.get", eventId: 73 })).resolves.toMatchObject({
      type: "ok",
      command: "event.get",
      event: { event: { id: 73, type: "app.input.requested" } },
    });
  });

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
    const row = getDb(persistDir).prepare("SELECT id, event_type FROM events WHERE id = ?").get(receipt.eventId) as {
      id: number;
      event_type: string;
    };
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
          appId: "alpha-project",
          targetTaskId: "normalization/current",
          input: {
            kind: "message",
            data: { message: "Review the current normalization gap." },
          },
          source: { kind: "human", id: "web-ui:project-comment-17" },
          conversationId: "web-ui:project:alpha-project",
          channel: "web-ui",
          idempotencyKey: "project-comment-17",
        });
        return { eventId: 72, eventType: "app.input.requested" };
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.input.admit",
        appId: "alpha-project",
        targetTaskId: "normalization/current",
        input: {
          kind: "message",
          data: { message: "Review the current normalization gap." },
        },
        source: { kind: "human", id: "web-ui:project-comment-17" },
        conversationId: "web-ui:project:alpha-project",
        channel: "web-ui",
        idempotencyKey: "project-comment-17",
      }),
    ).resolves.toMatchObject({
      type: "ok",
      command: "app.input.admit",
      appId: "alpha-project",
      eventId: 72,
      eventType: "app.input.requested",
    });
  });

  it("normalizes stale May reload input before it can become conversation work", async () => {
    const published: unknown[] = [];
    const core = createCore({
      admitAppInput: () => {
        throw new Error("reload must not enter the May inbox");
      },
      publishEvent: (event) => {
        published.push(event);
        return { eventId: 73, eventType: event.type, delivery: "accepted" };
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.input.admit",
        appId: "may",
        input: { kind: "message", data: { message: "/reload" } },
        source: { kind: "human", id: "stale-console:1" },
        conversationId: "may:primary",
        idempotencyKey: "stale-console:1",
      }),
    ).resolves.toMatchObject({ eventId: 73, eventType: "runtime.reload.requested" });
    expect(published).toEqual([
      {
        type: "runtime.reload.requested",
        data: { reason: "human control command" },
        idempotencyKey: "stale-console:1",
      },
    ]);
  });

  it("normalizes a published human reload command before persistence", async () => {
    const published: unknown[] = [];
    const core = createCore({
      publishEvent: (event) => {
        published.push(event);
        return { eventId: 74, eventType: event.type, delivery: "accepted" };
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "publish",
        event: {
          type: "conversation.message.created",
          target: { appId: "may" },
          data: {
            conversationId: "may:primary",
            author: { kind: "human", id: "stale-console:2" },
            text: "/reload",
          },
          idempotencyKey: "stale-console:2",
        },
      }),
    ).resolves.toMatchObject({ eventId: 74, eventType: "runtime.reload.requested" });
    expect(published).toEqual([
      {
        type: "runtime.reload.requested",
        data: { reason: "human control command" },
        idempotencyKey: "stale-console:2",
      },
    ]);
  });

  it("reads a derived App conversation without emitting an event", async () => {
    const conversation = {
      id: "may:primary",
      owner: "may",
      version: 1,
      messages: [
        {
          id: "human:1",
          sequence: 1,
          author: { kind: "human", id: "human:1" },
          text: "hello",
          createdAt: 1,
        },
      ],
    };
    const core = createCore({
      getAppConversation: (appId, conversationId, options) => {
        expect({ appId, conversationId, options }).toEqual({
          appId: "may",
          conversationId: "may:primary",
          options: { limit: 30, topicId: "0df0c0ed", topicLimit: 12, topicCursor: "older-page" },
        });
        return conversation;
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.conversation.get",
        appId: "may",
        conversationId: "may:primary",
        limit: 30,
        topicId: "0df0c0ed",
        topicLimit: 12,
        topicCursor: "older-page",
      }),
    ).resolves.toMatchObject({
      type: "ok",
      command: "app.conversation.get",
      conversation,
    });
    expect(core.emitted).toEqual([]);
  });

  it("lists and gets App-scoped Tasks without exposing storage paths", async () => {
    const task = {
      id: "review/docs",
      status: "waiting",
      generation: 2,
      outcome: "Review the docs",
      summary: "Waiting for evidence",
    };
    const core = createCore({
      listAppTasks: (appId, options) => {
        expect({ appId, options }).toEqual({
          appId: "evaluation",
          options: { status: ["waiting"], limit: 10, cursor: "next-page" },
        });
        return { items: [task] };
      },
      getAppTask: (appId, taskId) => {
        expect({ appId, taskId }).toEqual({ appId: "evaluation", taskId: "review/docs" });
        return task;
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.tasks.list",
        appId: "evaluation",
        status: ["waiting"],
        limit: 10,
        cursor: "next-page",
      }),
    ).resolves.toMatchObject({ type: "ok", command: "app.tasks.list", tasks: { items: [task] } });
    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.task.get",
        appId: "evaluation",
        taskId: "review/docs",
      }),
    ).resolves.toMatchObject({ type: "ok", command: "app.task.get", task });
    expect(core.emitted).toEqual([]);
  });

  it("publishes an exact generation-and-resource-fenced App Task retry", async () => {
    const receipt = {
      eventId: 71,
      eventType: "app.task.retry.requested",
      delivery: "accepted" as const,
    };
    const core = createCore({
      getTask: (input) => {
        expect(input).toEqual({ appId: "evaluation", taskId: "review/docs" });
        return { appId: "evaluation", taskId: "review/docs", generation: 2, resourceVersion: 7 };
      },
      publishEvent: (input) => {
        expect(input).toEqual({
          type: "app.task.retry.requested",
          target: { appId: "evaluation", taskId: "review/docs" },
          data: { expectedGeneration: 2, expectedResourceVersion: 7 },
          idempotencyKey: "app-task-retry:evaluation:review/docs:2:7",
        });
        return receipt;
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.task.retry",
        appId: "evaluation",
        taskId: "review/docs",
        expectedGeneration: 2,
      }),
    ).resolves.toEqual({ type: "ok", command: "app.task.retry", receipt });
    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.task.retry",
        appId: "evaluation",
        taskId: "review/docs",
        expectedGeneration: 0,
      }),
    ).rejects.toThrow("expectedGeneration must be a positive integer");
    expect(core.emitted).toEqual([]);
  });

  it("does not report a recorded but unaccepted Task control as success", async () => {
    const core = createCore({
      getTask: () => ({ appId: "evaluation", taskId: "review/docs", generation: 2, resourceVersion: 7 }),
      publishEvent: (input) => ({ eventId: 73, eventType: input.type, delivery: "recorded" }),
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.task.retry",
        appId: "evaluation",
        taskId: "review/docs",
        expectedGeneration: 2,
      }),
    ).rejects.toThrow("retry was recorded but not accepted");
    await expect(
      sendSocketCommand(core.endpoint, {
        type: "task.cancel",
        appId: "evaluation",
        taskId: "review/docs",
      }),
    ).rejects.toThrow("cancellation was recorded but not accepted");
  });

  it("resolves a friendly Task reference and publishes a fenced cancellation", async () => {
    let cancelled = false;
    const task = () => ({
      appId: "evaluation",
      taskId: "review/docs",
      ref: "8f12ac90",
      generation: 3,
      resourceVersion: cancelled ? 10 : 9,
      status: cancelled ? "cancelled" : "running",
    });
    const core = createCore({
      getTask: (input) => {
        if ("ref" in input) expect(input).toEqual({ ref: "8f12ac90" });
        return task();
      },
      publishEvent: (input) => {
        expect(input).toEqual({
          type: "app.task.cancel.requested",
          target: { appId: "evaluation", taskId: "review/docs" },
          data: {
            expectedGeneration: 3,
            expectedResourceVersion: 9,
            reason: "human changed direction",
          },
          idempotencyKey: "app-task-cancel:evaluation:review/docs:3:9",
        });
        cancelled = true;
        return { eventId: 72, eventType: input.type, delivery: "accepted" };
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "task.cancel",
        ref: "8f12ac90",
        reason: "human changed direction",
      }),
    ).resolves.toMatchObject({
      type: "ok",
      command: "task.cancel",
      receipt: { eventId: 72, eventType: "app.task.cancel.requested" },
      task: { status: "cancelled", resourceVersion: 10 },
    });
  });

  it("resolves an installed App Task without emitting an event", async () => {
    const observation = {
      snapshot: { id: "boot-1:3", generation: 3 },
      appId: "alpha-project",
      intent: { id: "master-validation-compact", input: { fields: ["one", "two"] } },
    };
    const core = createCore({
      resolveAppTask: (appId, event) => {
        expect({ appId, event }).toEqual({
          appId: "alpha-project",
          event: {
            type: "project.task.tick",
            action: "master-validation-compact",
            data: { taskId: "master-validation-compact" },
          },
        });
        return observation;
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "app.task.resolve",
        appId: "alpha-project",
        event: {
          type: "project.task.tick",
          action: "master-validation-compact",
          data: { taskId: "master-validation-compact" },
        },
      }),
    ).resolves.toEqual({ type: "ok", command: "app.task.resolve", ...observation });
    expect(core.emitted).toEqual([]);
  });

  it("passes the derived human-action filter through the Task resource read", async () => {
    const core = createCore({
      listTasks: (options) => {
        expect(options).toEqual({ appId: "evaluation", humanActionOnly: true, limit: 20 });
        return { items: [], total: 0 };
      },
    });

    await expect(
      sendSocketCommand(core.endpoint, {
        type: "tasks.list",
        appId: "evaluation",
        humanActionOnly: true,
        limit: 20,
      }),
    ).resolves.toEqual({ type: "ok", command: "tasks.list", tasks: { items: [], total: 0 } });
  });

  it("serves the shared App and Task resource interface without emitting work", async () => {
    const task = { appId: "evaluation", taskId: "review/docs", ref: "8f12ac90", status: "waiting" };
    const core = createCore({
      listApps: (appId) => [{ id: appId ?? "evaluation", activeTasks: 1 }],
      listTasks: (options) => {
        expect(options).toEqual({ appId: "evaluation", includeDone: true, limit: 10 });
        return { items: [task] };
      },
      getTask: (input) => {
        expect(input).toEqual({ ref: "8f12ac90" });
        return task;
      },
    });

    await expect(sendSocketCommand(core.endpoint, { type: "apps.list", appId: "evaluation" })).resolves.toEqual({
      type: "ok",
      command: "apps.list",
      apps: [{ id: "evaluation", activeTasks: 1 }],
    });
    await expect(
      sendSocketCommand(core.endpoint, {
        type: "tasks.list",
        appId: "evaluation",
        includeDone: true,
        limit: 10,
      }),
    ).resolves.toEqual({ type: "ok", command: "tasks.list", tasks: { items: [task] } });
    await expect(sendSocketCommand(core.endpoint, { type: "task.get", ref: "8f12ac90" })).resolves.toEqual({
      type: "ok",
      command: "task.get",
      task,
    });
    expect(core.emitted).toEqual([]);
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

  it("returns process memory only when diagnostics are requested", async () => {
    const core = createCore();

    const status = await sendSocketCommand(core.endpoint, { type: "status", diagnostics: true });

    expect(status).toMatchObject({
      type: "status",
      command: "status",
      diagnostics: {
        pid: process.pid,
        uptimeSeconds: expect.any(Number),
        cpu: {
          userMicros: expect.any(Number),
          systemMicros: expect.any(Number),
        },
        memory: {
          rssBytes: expect.any(Number),
          heapTotalBytes: expect.any(Number),
          heapUsedBytes: expect.any(Number),
          externalBytes: expect.any(Number),
          arrayBuffersBytes: expect.any(Number),
        },
      },
    });
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

  it("forwards correlated reload results without requiring a session subscription", async () => {
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);

    stream.write(JSON.stringify({ type: "subscribe", sessions: [], conversations: ["may:primary"] }) + "\n");
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });

    const result = {
      type: "runtime.reload.finished",
      source: "runtime",
      owner: "agent:may",
      data: {
        requestId: "may-console:reload-1",
        ok: true,
        summary: "[reload] 6 task-enabled App(s)",
      },
    };
    core.getBroadcast()?.(result);

    await expect(nextFrame(stream)).resolves.toEqual(result);
    stream.destroy();
  });

  it("forwards updates only for watched Conversation resources", async () => {
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);

    stream.write(JSON.stringify({ type: "subscribe", sessions: [], conversations: ["may:primary"] }) + "\n");
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });

    core.getBroadcast()?.({
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:other",
      data: { appId: "other", conversationId: "other:primary" },
    });
    const update = {
      type: "conversation.updated",
      source: "app-inbox",
      owner: "app:may",
      data: { appId: "may", conversationId: "may:primary" },
    };
    core.getBroadcast()?.(update);

    await expect(nextFrame(stream)).resolves.toEqual(update);
    stream.destroy();
  });

  it("turns semantic Task transitions into one identity-only wake for the exact watched Task", async () => {
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);

    stream.write(
      JSON.stringify({
        type: "subscribe",
        sessions: [],
        conversations: ["may:primary"],
        task: { appId: "evaluation", taskId: "review/docs" },
      }) + "\n",
    );
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });

    core.getBroadcast()?.({
      type: "project.task.reconciled",
      target: { appId: "other" },
      data: { project: "other", taskId: "review/docs", summary: "must not leak" },
    });
    core.getBroadcast()?.({
      type: "project.task.reconcile.profiled",
      data: { project: "evaluation", taskId: "review/docs", providerMs: 100 },
    });
    core.getBroadcast()?.({
      type: "project.task.reconciled",
      target: { appId: "evaluation" },
      data: { project: "evaluation", taskId: "review/docs", summary: "not part of the wake" },
    });

    await expect(nextFrame(stream)).resolves.toEqual({
      type: "app.task.updated",
      data: { appId: "evaluation", taskId: "review/docs" },
    });
    stream.destroy();
  });

  it("uses an App-scoped identity wake for off-watch derived views", async () => {
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);

    stream.write(
      JSON.stringify({
        type: "subscribe",
        sessions: [],
        conversations: ["may:primary"],
        taskApps: ["evaluation"],
      }) + "\n",
    );
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });

    core.getBroadcast()?.({
      type: "project.task.reconciled",
      data: { project: "other", taskId: "review/docs" },
    });
    core.getBroadcast()?.({
      type: "project.task.executor.progress",
      data: {
        project: "evaluation",
        taskId: "review/docs",
        message: "This exact-Task progress must not refresh an App-scoped list",
      },
    });
    core.getBroadcast()?.({
      type: "project.task.reconciled",
      data: { project: "evaluation", taskId: "review/other" },
    });

    await expect(nextFrame(stream)).resolves.toEqual({
      type: "app.task.updated",
      data: { appId: "evaluation", taskId: "review/other" },
    });
    stream.destroy();
  });

  it("turns passive executor progress into an identity-only wake without forwarding its payload", async () => {
    expect(
      taskUpdateIdentity({
        type: "project.task.executor.progress",
        data: { stage: "turn-started", status: "inProgress", emission: { appId: "evaluation", taskId: "review/docs" } },
      }),
    ).toBeNull();
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    await nextFrame(stream);

    stream.write(
      JSON.stringify({
        type: "subscribe",
        sessions: [],
        task: { appId: "evaluation", taskId: "review/docs" },
      }) + "\n",
    );
    await expect(nextFrame(stream)).resolves.toEqual({ type: "ok", command: "subscribe" });

    core.getBroadcast()?.({
      type: "project.task.executor.progress",
      data: {
        stage: "intermediate",
        message: "Inspecting evidence",
        emission: { appId: "other", taskId: "review/docs" },
      },
    });
    core.getBroadcast()?.({
      type: "project.task.executor.progress",
      data: {
        stage: "intermediate",
        message: "This payload must not be copied to the wake",
        emission: { appId: "evaluation", taskId: "review/docs" },
      },
    });

    await expect(nextFrame(stream)).resolves.toEqual({
      type: "app.task.updated",
      data: { appId: "evaluation", taskId: "review/docs" },
    });
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

  it("preserves human text when a command arrives one UTF-8 byte at a time", async () => {
    const received: ControlEvent[] = [];
    const core = createCore({
      emitEvent: (event) => {
        received.push(event);
        return { eventId: 1 };
      },
    });
    const stream = (core.endpoint as () => Duplex)();
    try {
      await nextFrame(stream);
      const response = nextFrame(stream);
      const message = "继续检查 café 🐑";
      const command = {
        type: "project.comment.created",
        source: "fixture",
        owner: "app:sample",
        data: { comment: message },
      };
      for (const byte of Buffer.from(JSON.stringify(command) + "\n")) stream.write(Buffer.from([byte]));
      await expect(response).resolves.toMatchObject({ type: "ok", command: command.type });
      expect(received).toContainEqual(expect.objectContaining({ data: expect.objectContaining({ comment: message }) }));
    } finally {
      stream.destroy();
    }
  });

  it.each([true, false])("keeps UTF-8 size limits byte-based (complete frame: %s)", async (complete) => {
    const core = createCore();
    const stream = (core.endpoint as () => Duplex)();
    try {
      await nextFrame(stream);
      const response = nextFrame(stream);
      const limit = complete ? CONTROL_SOCKET_LIMITS.maxFrameBytes : CONTROL_SOCKET_LIMITS.maxIncompleteBufferBytes;
      const text = "好".repeat(Math.floor(limit / Buffer.byteLength("好")) + 1);
      expect(text.length).toBeLessThan(limit);
      stream.write(text + (complete ? "\n" : ""));
      await expect(response).resolves.toMatchObject({
        type: "error",
        message: complete ? "Control socket frame is too large" : "Incomplete control socket frame is too large",
      });
      expect(core.emitted).toEqual([]);
    } finally {
      stream.destroy();
    }
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
