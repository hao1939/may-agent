import assert from "node:assert/strict";
import net from "node:net";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { HerdrClient } from "../src/herdr-client.js";

async function fakeHerdr(handler) {
  const directory = await mkdtemp(join(tmpdir(), "fake-herdr-"));
  const socketPath = join(directory, "herdr.sock");
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline >= 0) handler(JSON.parse(buffer.slice(0, newline)), socket);
    });
  });
  await new Promise((resolve) => server.listen(socketPath, resolve));
  return { socketPath, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("request correlates a newline-delimited Herdr response", async () => {
  const fake = await fakeHerdr((request, socket) => {
    socket.write(`${JSON.stringify({ id: "unrelated", result: {} })}\n`);
    socket.write(`${JSON.stringify({ id: request.id, result: { snapshot: { agents: [] } } })}\n`);
  });
  try {
    const client = new HerdrClient({ socketPath: fake.socketPath });
    assert.deepEqual(await client.snapshot(), { agents: [] });
  } finally { await fake.close(); }
});

test("subscription returns immediately and forwards events", async () => {
  let eventResolve;
  const received = new Promise((resolve) => { eventResolve = resolve; });
  const fake = await fakeHerdr((request, socket) => {
    socket.write(`${JSON.stringify({ id: request.id, result: { type: "subscription_started" } })}\n`);
    socket.write(`${JSON.stringify({ event: "pane.agent_status_changed", data: { pane_id: "w1:p2", agent_status: "idle" } })}\n`);
  });
  const client = new HerdrClient({ socketPath: fake.socketPath });
  const stop = client.subscribe(
    [{ type: "pane.agent_status_changed", pane_id: "w1:p2" }],
    eventResolve,
  );
  try {
    assert.equal((await received).data.agent_status, "idle");
  } finally {
    stop();
    await fake.close();
  }
});
