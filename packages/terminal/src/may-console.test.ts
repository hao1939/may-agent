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
    let completedCommitmentId: string | null = null;
    let client: Socket | null = null;
    let inputBuffer = "";
    const server: Server = createServer((socket) => {
      client = socket;
      socket.write(
        `${JSON.stringify({
          type: "connected",
          agent: "may",
          instance,
          activeAgents: [
            { sessionId: "s_worker_123", agent: "worker", status: "running", kind: "job", task: "focused work" },
          ],
        })}\n`,
      );
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
            socket.write(
              `${JSON.stringify({
                type: "status",
                command: "status",
                activeAgents: [
                  { sessionId: "s_worker_123", agent: "worker", status: "running", kind: "job", task: "focused work" },
                ],
              })}\n`,
            );
          } else if (frame.type === "app.conversation.get") {
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "app.conversation.get",
                turns: [
                  {
                    requestId: "item-history",
                    input: { kind: "message", data: { message: "Earlier question" } },
                    state: "done",
                    deliveries: [
                      {
                        operationId: "app-delivery:item-history:1",
                        kind: "final",
                        status: "delivered",
                        text: "Earlier answer",
                      },
                    ],
                  },
                ],
              })}\n`,
            );
          } else if (frame.type === "app.commitments.get") {
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "app.commitments.get",
                commitments: [
                  {
                    requestId: "item-working",
                    message: "Review the May design",
                    state: "analyzing",
                    progress: "Codex is reviewing the implementation.",
                    createdAt: Date.UTC(2026, 7, 17, 8, 0, 0),
                    updatedAt: Date.UTC(2026, 7, 17, 8, 5, 0),
                  },
                  {
                    requestId: "item-queued",
                    message: "Review AKS tasks",
                    state: "queued",
                    createdAt: Date.UTC(2026, 7, 17, 8, 10, 0),
                    updatedAt: Date.UTC(2026, 7, 17, 8, 10, 0),
                  },
                ].filter((item) => item.requestId !== completedCommitmentId),
              })}\n`,
            );
          } else if (frame.type === "app.input.admit") {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type, eventId: 42 })}\n`);
            socket.write(
              `${JSON.stringify({
                type: "text",
                sessionId: "s_worker_123",
                text: "unrelated worker output",
              })}\n`,
            );
            const turn = frames.filter((item) => item.type === "app.input.admit").length;
            const sessionId = `s_may_turn_${turn}`;
            socket.write(
              `${JSON.stringify({
                type: "session.start",
                data: { sessionId, agent: "may", status: "running", kind: "job", task: "bounded May turn" },
              })}\n`,
            );
            socket.write(`${JSON.stringify({ type: "text", sessionId, text: `May response ${turn}\n` })}\n`);
            socket.write(
              `${JSON.stringify({
                type: "session.end",
                data: { sessionId, agent: "may", status: "done", kind: "job", summary: `May response ${turn}` },
              })}\n`,
            );
            socket.write(
              `${JSON.stringify({
                type: "app.response.delivery.requested",
                owner: "app:may",
                data: {
                  channel: "may-console",
                  sessionId,
                  operationId: `app-delivery:item-${turn}:1`,
                  appInboxItemId: `item-${turn}`,
                  appInboxRequestId: `app-inbox-human:item-${turn}`,
                  text: `May response ${turn}`,
                },
              })}\n`,
            );
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
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    cleanups.push(() => server.close());
    cleanups.push(() => client?.destroy());
    cleanups.push(() => child.kill("SIGKILL"));

    await waitFor(() => frames.some((frame) => frame.type === "status"));
    await waitFor(() => output.includes("\nyou> Earlier question\n\n") && output.includes("\nmay> Earlier answer\n\n"));
    await waitFor(
      () =>
        output.includes("Working:") &&
        output.includes("Review the May design — Analyzing") &&
        output.includes("Codex is reviewing the implementation.") &&
        output.includes("Review AKS tasks — Queued"),
    );
    expect(frames.find((frame) => frame.type === "subscribe")).toMatchObject({
      sessions: [],
      deliveryChannel: "may-console",
    });
    expect(output).not.toContain("focused work");

    child.stdin.write("/work\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.commitments.get").length === 2);

    child.stdin.write("/work 1\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.commitments.get").length === 3);
    expect(frames.filter((frame) => frame.type === "app.commitments.get")[2]).toMatchObject({ limit: 100 });
    await waitFor(
      () =>
        output.includes("Work 1:") &&
        output.includes("Request: Review the May design") &&
        output.includes("Status: Analyzing") &&
        output.includes("Progress: Codex is reviewing the implementation.") &&
        output.includes("Created: 2026-08-17 08:00:00 UTC") &&
        output.includes("Updated: 2026-08-17 08:05:00 UTC"),
    );

    child.stdin.write("/work 2\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.commitments.get").length === 4);
    await waitFor(
      () =>
        output.includes("Work 2:") &&
        output.includes("Request: Review AKS tasks") &&
        output.includes("Status: Queued") &&
        output.includes("Progress: No durable progress update yet."),
    );

    completedCommitmentId = "item-working";
    child.stdin.write("/work 1\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.commitments.get").length === 5);
    await waitFor(() => output.includes("Request: Review the May design") && output.includes("Status: No longer open"));

    child.stdin.write("/sessions\n");
    await waitFor(() => output.includes("focused work"));

    child.stdin.write("review Gym\n");
    await waitFor(() => frames.some((frame) => frame.type === "app.input.admit"));
    const input = frames.find((frame) => frame.type === "app.input.admit");
    expect(input).toMatchObject({
      appId: "may",
      input: { kind: "message", data: { message: "review Gym" } },
      source: { kind: "human", id: expect.stringMatching(/^may-console:local-terminal:\d+$/) },
      conversationId: "may-console:local-terminal:agent:may",
      channel: "may-console",
      channelThreadId: "local-terminal",
    });
    await waitFor(() => output.includes("\nmay> May response 1\n\nyou> "));
    expect(output).not.toContain("unrelated worker output");
    expect(output).not.toContain("[accepted");
    await waitFor(() => frames.some((frame) => frame.type === "channel.delivery.completed"));
    expect(frames.find((frame) => frame.type === "channel.delivery.completed")).toMatchObject({
      source: "may-console",
      owner: "app:may",
      data: {
        channel: "may-console",
        appInboxItemId: "item-1",
        appInboxRequestId: "app-inbox-human:item-1",
      },
    });

    child.stdin.write("/steer s_worker use the smaller plan\n");
    await waitFor(() => frames.some((frame) => frame.type === "session.steer.requested"));
    expect(frames.find((frame) => frame.type === "session.steer.requested")).toMatchObject({
      data: { sessionId: "s_worker_123", message: "use the smaller plan" },
    });

    child.stdin.write("/watch s_worker\n");
    await waitFor(() => frames.filter((frame) => frame.type === "subscribe").length === 2);
    expect(frames.filter((frame) => frame.type === "subscribe")[1]?.sessions).toEqual(["s_worker_123"]);

    child.stdin.write("another May request\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.input.admit").length === 2);
    expect(frames.filter((frame) => frame.type === "subscribe")[2]?.sessions).toEqual([]);
    expect(frames.filter((frame) => frame.type === "app.input.admit")[1]?.appId).toBe("may");
    await waitFor(() => output.includes("\nmay> May response 2\n\nyou> "));

    child.stdin.write("/debug\n");
    await waitFor(() => frames.filter((frame) => frame.type === "subscribe").length === 4);
    expect(frames.filter((frame) => frame.type === "subscribe")[3]?.sessions).toEqual(["*"]);
    child.stdin.write("/debug\n");
    await waitFor(() => frames.filter((frame) => frame.type === "subscribe").length === 5);
    expect(frames.filter((frame) => frame.type === "subscribe")[4]?.sessions).toEqual([]);

    child.stdin.write("/exit\n");
    await once(child, "exit");
  }, 10_000);

  test("exits cleanly when stdin closes", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-console-eof-"));
    const instance = "test";
    const socketDir = join(root, "instances", instance);
    const socketPath = join(socketDir, "may.sock");
    mkdirSync(socketDir, { recursive: true });

    let client: Socket | null = null;
    const server: Server = createServer((socket) => {
      client = socket;
      socket.write(`${JSON.stringify({ type: "connected", agent: "may", instance, activeAgents: [] })}\n`);
    });
    server.listen(socketPath);
    await once(server, "listening");

    const consolePath = resolve(import.meta.dir, "../bin/may-console.cjs");
    const child: ChildProcessWithoutNullStreams = spawn("node", [consolePath], {
      env: { ...process.env, STATE_DIR: root, DAEMON_INSTANCE: instance, DAEMON_AGENT: "may" },
      stdio: "pipe",
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    cleanups.push(() => server.close());
    cleanups.push(() => client?.destroy());
    cleanups.push(() => child.kill("SIGKILL"));

    await waitFor(() => client !== null);
    child.stdin.end();
    const [code] = (await once(child, "exit")) as [number | null];
    expect(code).toBe(0);
    expect(stderr).not.toContain("ERR_USE_AFTER_CLOSE");
  });
});
