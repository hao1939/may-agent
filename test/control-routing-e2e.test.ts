import { Duplex } from "node:stream";
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendSocketCommand, type SocketEndpoint } from "../packages/control/src/client.js";
import { createControlSocketCore, type ControlEvent, type ControlSocket } from "../packages/control/src/server.js";
import { attachCommandRouter } from "../src/app/command-router.js";
import { EventBus } from "../src/app/event-bus.js";
import { DbWriter } from "../src/lib/db-writer.js";
import { closeDb, getDb } from "../src/lib/requests.js";

type RunCall = {
  agent: string;
  task: string;
  opts: Record<string, unknown>;
};

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
  it("routes socket fork frames to agent work and persists the inbox event in a temp state DB", async () => {
    const { root, stateDir } = makeRoot();
    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const runCalls: RunCall[] = [];
    bus.subscribe(writer.handler, { priority: "first" });

    const router = attachCommandRouter({
      bus,
      manager: {
        status: () => [],
        run: (agent: string, task: string, opts: Record<string, unknown>) => {
          runCalls.push({ agent, task, opts });
          return "s_e2e_dev";
        },
        cancel: () => {},
        input: () => {},
        steer: () => {},
        resumeSession: () => {},
        resumeInterrupted: () => false,
      } as never,
      getChatSession: () => undefined,
      clearCancelLatch: () => {},
      projectRoot: root,
      reload: () => {},
      restart: () => {},
      shutdown: () => {},
    });

    const core = createControlSocketCore({
      getSessionId: () => "",
      getStatus: () => [],
      emitEvent: (event: ControlEvent) => bus.emit(event as never),
      subscribeEvents: (handler) => bus.subscribe(handler as never),
      agentName: "may",
      instance: "test",
    });
    sockets.push(core);

    try {
      const ack = await sendSocketCommand(mockEndpoint(core.attachClient), {
        type: "fork",
        agent: "dev",
        task: "Investigate the failing migration",
        opts: { kind: "job", source: "socket" },
      });
      await waitForSocketDispatch();

      expect(ack).toEqual({ type: "ok", command: "fork" });
      expect(runCalls).toEqual([
        {
          agent: "dev",
          task: "Investigate the failing migration",
          opts: { kind: "job", requestId: undefined },
        },
      ]);

      const db = getDb(stateDir);
      const row = db.prepare(
        "SELECT source, owner, data FROM events WHERE event_type = ? ORDER BY id ASC LIMIT 1",
      ).get("message.created") as { source: string; owner: string; data: string };
      expect(row).toMatchObject({
        source: "socket",
        owner: "agent:dev",
      });
      expect(JSON.parse(row.data)).toMatchObject({
        from: "socket",
        to: "dev",
        content: "Investigate the failing migration",
        intent: "fork",
        priority: "P0",
      });
      expect(stateDir.startsWith(root)).toBe(true);
    } finally {
      router.close();
    }
  });
});
