import { Duplex } from "node:stream";
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendSocketCommand, type SocketEndpoint } from "../../packages/control/src/client.js";
import { createControlSocketCore, type ControlEvent, type ControlSocket } from "../../packages/control/src/server.js";
import { EVENT_ROW_ID, EventBus } from "../../src/app/event-bus.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/requests.js";

const roots: string[] = [];
const stateDirs: string[] = [];
const sockets: ControlSocket[] = [];

function makeRoot(): { root: string; stateDir: string } {
  const root = mkdtempSync(join(tmpdir(), "may-control-e2e-"));
  const stateDir = join(root, ".state");
  mkdirSync(stateDir, { recursive: true });
  roots.push(root);
  stateDirs.push(stateDir);
  return { root, stateDir };
}

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

function waitForSocketDispatch(): Promise<void> {
  return new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
}

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close();
  for (const stateDir of stateDirs.splice(0)) closeDb(stateDir);
  for (const root of roots.splice(0)) {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

describe("control routing e2e", () => {
  it("persists canonical message.created socket events without command translation", async () => {
    const { root, stateDir } = makeRoot();
    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const emitted: ControlEvent[] = [];
    bus.setPersistenceSubscriber(writer.handler);

    const core = createControlSocketCore({
      getSessionId: () => "",
      getStatus: () => [],
      emitEvent: (event: ControlEvent) => {
        emitted.push(event);
        const persisted = bus.emit(event as never);
        return { eventId: Number(persisted[EVENT_ROW_ID]) };
      },
      subscribeEvents: (handler) => bus.subscribe(handler as never),
      agentName: "may",
      instance: "test",
    });
    sockets.push(core);

    const ack = await sendSocketCommand(mockEndpoint(core.attachClient), {
      type: "message.created",
      source: "agent:may",
      owner: "agent:dev",
      urgency: "high",
      data: {
        from: "may",
        to: "dev",
        content: "Review the deploy checklist",
        intent: "notify",
        priority: "P1",
        approvalId: "approval-abc",
        waitId: "wait-abc",
        pathId: "path.example",
        packetPath: "evidence/archive/example.md",
      },
    });
    await waitForSocketDispatch();

    expect(ack).toMatchObject({ type: "ok", command: "message.created", eventId: expect.any(Number) });
    expect(emitted).toContainEqual({
      type: "message.created",
      source: "agent:may",
      owner: "agent:dev",
      urgency: "high",
      data: {
        from: "may",
        to: "dev",
        content: "Review the deploy checklist",
        intent: "notify",
        priority: "P1",
        approvalId: "approval-abc",
        waitId: "wait-abc",
        pathId: "path.example",
        packetPath: "evidence/archive/example.md",
      },
    });

    const db = getDb(stateDir);
    const row = db
      .prepare("SELECT source, owner, urgency, data FROM events WHERE event_type = ? ORDER BY id ASC LIMIT 1")
      .get("message.created") as { source: string; owner: string; urgency: string; data: string };
    expect(row).toMatchObject({
      source: "agent:may",
      owner: "agent:dev",
      urgency: "high",
    });
    expect(JSON.parse(row.data)).toEqual({
      from: "may",
      to: "dev",
      content: "Review the deploy checklist",
      intent: "notify",
      artifact: null,
      priority: "P1",
      approvalId: "approval-abc",
      waitId: "wait-abc",
      pathId: "path.example",
      packetPath: "evidence/archive/example.md",
    });
    expect(stateDir.startsWith(root)).toBe(true);
  });

  it("rejects flat message.created socket events before persistence", async () => {
    const { stateDir } = makeRoot();
    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const emitted: ControlEvent[] = [];
    bus.setPersistenceSubscriber(writer.handler);

    const core = createControlSocketCore({
      getSessionId: () => "",
      getStatus: () => [],
      emitEvent: (event: ControlEvent) => {
        emitted.push(event);
        const persisted = bus.emit(event as never);
        return { eventId: Number(persisted[EVENT_ROW_ID]) };
      },
      subscribeEvents: (handler) => bus.subscribe(handler as never),
      agentName: "may",
      instance: "test",
    });
    sockets.push(core);

    await expect(
      sendSocketCommand(mockEndpoint(core.attachClient), {
        type: "message.created",
        source: "agent:may",
        owner: "agent:dev",
        from: "may",
        to: "dev",
        content: "flat payload should be rejected",
      }),
    ).rejects.toThrow("requires object field 'data'");
    await waitForSocketDispatch();

    expect(emitted).toEqual([]);
    const db = getDb(stateDir);
    const count = db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?").get("message.created") as {
      count: number;
    };
    expect(count.count).toBe(0);
  });
});
