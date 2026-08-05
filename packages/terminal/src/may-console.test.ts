import { afterEach, describe, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for May Console");
    await Bun.sleep(10);
  }
}

describe("May Console", () => {
  test("sends bare text to a fresh May turn and steers sessions only by explicit command", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-console-"));
    const instance = "test";
    const socketDir = join(root, "instances", instance);
    const socketPath = join(socketDir, "may.sock");
    mkdirSync(socketDir, { recursive: true });

    const frames: Array<Record<string, any>> = [];
    let client: Socket | null = null;
    let inputBuffer = "";
    const server: Server = createServer((socket) => {
      client = socket;
      socket.write(`${JSON.stringify({
        type: "connected",
        agent: "may",
        instance,
        activeAgents: [
          { sessionId: "s_worker_123", agent: "worker", status: "running", kind: "job", task: "focused work" },
        ],
      })}\n`);
      socket.on("data", (chunk) => {
        inputBuffer += chunk.toString();
        const lines = inputBuffer.split("\n");
        inputBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const frame = JSON.parse(line) as Record<string, any>;
          frames.push(frame);
          if (frame.type === "subscribe") {
            socket.write(`${JSON.stringify({ type: "ok", command: "subscribe" })}\n`);
          } else if (frame.type === "status") {
            socket.write(`${JSON.stringify({
              type: "status",
              command: "status",
              activeAgents: [
                { sessionId: "s_worker_123", agent: "worker", status: "running", kind: "job", task: "focused work" },
              ],
            })}\n`);
          } else if (frame.type === "human.input.received") {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type, eventId: 42 })}\n`);
            socket.write(`${JSON.stringify({
              type: "text",
              sessionId: "s_worker_123",
              text: "unrelated worker output",
            })}\n`);
            const turn = frames.filter((item) => item.type === "human.input.received").length;
            const sessionId = `s_may_turn_${turn}`;
            socket.write(`${JSON.stringify({
              type: "session.start",
              data: { sessionId, agent: "may", status: "running", kind: "job", task: "bounded May turn" },
            })}\n`);
            socket.write(`${JSON.stringify({ type: "text", sessionId, text: `May response ${turn}\n` })}\n`);
            socket.write(`${JSON.stringify({
              type: "session.end",
              data: { sessionId, agent: "may", status: "done", kind: "job", summary: `May response ${turn}` },
            })}\n`);
          } else {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type, eventId: 42 })}\n`);
          }
        }
      });
    });
    server.listen(socketPath);
    await once(server, "listening");

    const consolePath = resolve(import.meta.dir, "../bin/may-console.cjs");
    const child: ChildProcessWithoutNullStreams = spawn("node", [consolePath], {
      env: { ...process.env, STATE_DIR: root, DAEMON_INSTANCE: instance, DAEMON_AGENT: "may" },
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });

    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    cleanups.push(() => server.close());
    cleanups.push(() => client?.destroy());
    cleanups.push(() => child.kill("SIGKILL"));

    await waitFor(() => frames.some((frame) => frame.type === "status"));
    expect(frames.find((frame) => frame.type === "subscribe")?.sessions).toEqual(["*"]);
    expect(output).not.toContain("focused work");

    child.stdin.write("/sessions\n");
    await waitFor(() => output.includes("focused work"));

    child.stdin.write("review Gym\n");
    await waitFor(() => frames.some((frame) => frame.type === "human.input.received"));
    const input = frames.find((frame) => frame.type === "human.input.received");
    expect(input).toMatchObject({
      source: "may-console",
      owner: "agent:may",
      data: {
        actor: "human",
        text: "review Gym",
        conversation: {
          id: "may-console:local-terminal:agent:may",
          channel: "may-console",
          channelThreadId: "local-terminal",
        },
        target: { agent: "may" },
        context: { forceNew: true },
      },
    });
    expect(input?.data?.target?.sessionId).toBeUndefined();
    await waitFor(() => output.includes("[accepted #42] May is handling this turn."));
    await waitFor(() => output.includes("May response 1"));
    expect(output).not.toContain("unrelated worker output");

    child.stdin.write("/steer s_worker use the smaller plan\n");
    await waitFor(() => frames.some((frame) => frame.type === "session.steer.requested"));
    expect(frames.find((frame) => frame.type === "session.steer.requested")).toMatchObject({
      data: { sessionId: "s_worker_123", message: "use the smaller plan" },
    });

    child.stdin.write("/watch s_worker\n");
    await waitFor(() => frames.filter((frame) => frame.type === "subscribe").length === 2);
    expect(frames.filter((frame) => frame.type === "subscribe")[1]?.sessions).toEqual(["s_worker_123"]);

    child.stdin.write("another May request\n");
    await waitFor(() => frames.filter((frame) => frame.type === "human.input.received").length === 2);
    expect(frames.filter((frame) => frame.type === "subscribe")[2]?.sessions).toEqual(["*"]);
    expect(frames.filter((frame) => frame.type === "human.input.received")[1]?.data?.target).toEqual({ agent: "may" });
    await waitFor(() => output.includes("May response 2"));

    child.stdin.write("/exit\n");
    await once(child, "exit");
  }, 10_000);
});
