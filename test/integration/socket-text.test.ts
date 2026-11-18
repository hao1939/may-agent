import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { daemonSocketPath } from "../../packages/control/src/client.js";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";

const message = "继续检查 café 🐑";

async function waitFor(predicate: () => boolean, detail: () => string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Socket text fixture timed out: ${detail()}`);
    await Bun.sleep(10);
  }
}

async function splitReply(socket: Socket, frame: unknown): Promise<void> {
  const wire = Buffer.from(JSON.stringify(frame) + "\n");
  const split = wire.indexOf(Buffer.from("继")) + 1;
  if (split <= 0) throw new Error("Fixture must split inside a UTF-8 character");
  socket.write(wire.subarray(0, split));
  // Separate network writes so the receiver observes the incomplete character.
  await Bun.sleep(30);
  socket.write(wire.subarray(split));
}

function splitJsonResponse(frame: unknown): Response {
  const wire = Buffer.from(JSON.stringify(frame));
  const split = wire.indexOf(Buffer.from("继")) + 1;
  if (split <= 0) throw new Error("Fixture must split inside a UTF-8 character");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(wire.subarray(0, split));
      setTimeout(() => {
        controller.enqueue(wire.subarray(split));
        controller.close();
      }, 30);
    },
  });
  return new Response(body, { headers: { "content-type": "application/json" } });
}

async function consoleFixture(reconnect: boolean) {
  let connections = 0;
  let conversationReads = 0;
  const peers = new Set<{ close(code?: number, reason?: string): void }>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, bunServer) {
      const url = new URL(request.url);
      if (url.pathname === "/ws") {
        if (bunServer.upgrade(request)) return;
        return new Response("upgrade failed", { status: 500 });
      }
      if (url.pathname === "/api/conversation") {
        conversationReads += 1;
        const messages = reconnect && connections === 1 ? [] : [
          {
            id: "answer",
            sequence: 1,
            author: { kind: "agent", id: "may" },
            text: message,
            createdAt: 1,
          },
        ];
        const conversation = {
          id: "may:primary",
          agent: "may",
          version: conversationReads,
          topics: [],
          messages,
        };
        return messages.length === 0 ? Response.json(conversation) : splitJsonResponse(conversation);
      }
      if (url.pathname === "/api/tasks") return Response.json({ items: [], total: 0 });
      return new Response("not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        connections += 1;
        peers.add(ws);
      },
      message(ws, raw) {
        const frame = JSON.parse(String(raw));
        if (frame.type !== "subscribe") return;
        ws.send(JSON.stringify({ type: "subscribed" }));
        if (reconnect && connections === 1) setTimeout(() => ws.close(1012, "fixture restart"), 50);
      },
      close(ws) {
        peers.delete(ws);
      },
    },
  });
  const child = spawn("node", [resolve(import.meta.dir, "../../packages/terminal/bin/may-console.cjs")], {
    env: {
      ...process.env,
      DAEMON_HTTP_URL: `http://127.0.0.1:${server.port}`,
      DAEMON_INSTANCE: "text-test",
      AGENT: "may",
      CONVERSATION_APP: "may",
      CONVERSATION_ID: "may:primary",
      DAEMON_AGENT: "may",
    },
    stdio: "pipe",
  });
  const stopped = new Promise<void>((done) => child.once("close", () => done()));
  const errors: unknown[] = [];
  child.on("error", (error) => errors.push(error));
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    output += chunk;
  });
  return {
    errors,
    output: () => output,
    async close() {
      child.kill("SIGKILL");
      await stopped;
      for (const peer of peers) peer.close(1001, "fixture shutdown");
      server.stop(true);
    },
  };
}

async function fixture(
  mode: "console" | "web",
  respond: (socket: Socket, frame: Record<string, unknown>, connection: number) => Promise<void>,
) {
  const root = mkdtempSync(join(tmpdir(), "may-socket-text-"));
  const socketPath = daemonSocketPath(root, { instance: "text-test", interfaceAgent: "may" });
  mkdirSync(dirname(socketPath), { recursive: true });
  const sockets = new Set<Socket>();
  const errors: unknown[] = [];
  let connections = 0;
  const server = createServer((socket) => {
    const connection = ++connections;
    sockets.add(socket);
    socket.on("error", (error) => errors.push(error));
    socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    let buffer = "";
    let pending = Promise.resolve();
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines.filter((value) => value.trim())) {
        // Preserve frame ordering even while one reply is deliberately split.
        pending = pending
          .then(async () => {
            if (!socket.destroyed && !socket.writableEnded) await respond(socket, JSON.parse(line), connection);
          })
          .catch((error) => {
            errors.push(error);
          });
      }
    });
  });
  server.listen(socketPath);
  await once(server, "listening");
  const child =
    mode === "console"
      ? spawn("node", [resolve(import.meta.dir, "../../packages/terminal/bin/may-console.cjs")], {
          env: { ...process.env, STATE_DIR: root, DAEMON_INSTANCE: "text-test", AGENT: "may", CONVERSATION_APP: "may", CONVERSATION_ID: "may:primary", DAEMON_AGENT: "may" },
          stdio: "pipe",
        })
      : spawnFixtureProcess([resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"], {
          cwd: root,
          env: {
            ...process.env,
            PROJECT_ROOT: root,
            AGENTS_ROOT: root,
            SHARED_ROOT: root,
            PROJECTS_ROOT: root,
            DAEMON_INSTANCE: "text-test",
            AGENT: "may", CONVERSATION_APP: "may", CONVERSATION_ID: "may:primary", DAEMON_AGENT: "may",
          },
        });
  const stopped = new Promise<void>((done) => child.once("close", () => done()));
  child.on("error", (error) => errors.push(error));
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    output += chunk;
  });
  return {
    errors,
    output: () => output,
    async webSocketUrl() {
      await waitFor(
        () => /url:\s+http:\/\/localhost:\d+/.test(output),
        () => output,
      );
      return `ws://127.0.0.1:${output.match(/url:\s+http:\/\/localhost:(\d+)/)![1]}/ws`;
    },
    async close() {
      child.kill("SIGKILL");
      await stopped;
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((done) => server.close(() => done()));
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe("socket text through human interfaces", () => {
  test.each([false, true])("Console preserves text across split writes (reconnect: %s)", async (reconnect) => {
    const f = await consoleFixture(reconnect);
    try {
      await waitFor(() => f.output().includes("café") || f.output().includes("caf�"), f.output);
      expect(f.output()).toContain(message);
      expect(f.errors).toEqual([]);
    } finally {
      await f.close();
    }
  });

  test("WebUI websocket preserves an event split inside a UTF-8 character", async () => {
    const f = await fixture("web", async (socket, frame) => {
      if (frame.type === "subscribe") {
        socket.write(JSON.stringify({ type: "ok", command: "subscribe" }) + "\n");
        await splitReply(socket, { type: "info", message });
      }
    });
    let ws: WebSocket | undefined;
    try {
      ws = new WebSocket(await f.webSocketUrl());
      const received: string[] = [];
      ws.addEventListener("message", (event) => received.push(String(event.data)));
      ws.addEventListener("open", () => ws!.send(JSON.stringify({ type: "subscribe", sessions: ["*"] })));
      await waitFor(
        () => received.some((line) => JSON.parse(line).type === "info"),
        () => `${f.output()} ${JSON.stringify(received)}`,
      );
      expect(received.map((line) => JSON.parse(line)).filter((frame) => frame.type === "info")).toEqual([{ type: "info", message }]);
      expect(f.errors).toEqual([]);
    } finally {
      ws?.close();
      await f.close();
    }
  });
});
