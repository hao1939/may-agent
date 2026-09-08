import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { daemonSocketPath } from "../../packages/control/src/client.js";

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

async function fixture(
  mode: "console" | "web",
  respond: (socket: Socket, frame: Record<string, unknown>, connection: number) => Promise<void>,
) {
  const root = mkdtempSync(join(tmpdir(), "may-socket-text-"));
  const socketPath = daemonSocketPath(root, { instance: "text-test" });
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
          env: { ...process.env, STATE_DIR: root, DAEMON_INSTANCE: "text-test", DAEMON_AGENT: "may" },
          stdio: "pipe",
        })
      : spawn("bun", [resolve(import.meta.dir, "../../src/app/http/server.ts"), "--state-dir", root, "--port", "0"], {
          cwd: root,
          stdio: "pipe",
          env: {
            ...process.env,
            PROJECT_ROOT: root,
            AGENTS_ROOT: root,
            SHARED_ROOT: root,
            PROJECTS_ROOT: root,
            DAEMON_INSTANCE: "text-test",
            DAEMON_AGENT: "may",
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
    const f = await fixture("console", async (socket, frame, connection) => {
      if (frame.type === "app.conversation.get") {
        if (reconnect && connection === 1) {
          socket.end('{"type":"ok","message":"discard-this-fragment');
          return;
        }
        await splitReply(socket, {
          type: "ok",
          command: frame.type,
          conversation: {
            id: "may:primary",
            owner: "may",
            version: 1,
            topics: [],
            messages: [
              {
                id: "answer",
                sequence: 1,
                author: { kind: "agent", id: "may" },
                text: message,
                createdAt: 1,
              },
            ],
          },
        });
      } else {
        socket.write(JSON.stringify({ type: "ok", command: frame.type, tasks: { items: [], total: 0 } }) + "\n");
      }
    });
    try {
      await waitFor(() => f.output().includes("café") || f.output().includes("caf�"), f.output);
      expect(f.output()).toContain(message);
      expect(f.output()).not.toContain("discard-this-fragment");
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
        () => received.length > 0,
        () => `${f.output()} ${JSON.stringify(received)}`,
      );
      expect(received.map((line) => JSON.parse(line))).toEqual([{ type: "info", message }]);
      expect(f.errors).toEqual([]);
    } finally {
      ws?.close();
      await f.close();
    }
  });
});
