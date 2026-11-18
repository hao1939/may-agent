import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const message = "继续检查 café 🐑";

async function waitFor(predicate: () => boolean, detail: () => string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Socket text fixture timed out: ${detail()}`);
    await Bun.sleep(10);
  }
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
});
