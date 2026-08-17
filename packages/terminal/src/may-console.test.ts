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
    let completedWorkId: string | null = null;
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
            const work = [
              {
                requestId: "item-working",
                message: "Review the May design",
                state: completedWorkId === "item-working" ? "done" : "analyzing",
                ...(completedWorkId === "item-working" ? {} : { progress: "Codex is reviewing the implementation." }),
                ...(frame.workRequestId === "item-working"
                  ? {
                      result: {
                        summary: "The review is complete.",
                        response: "The exact selected review result.",
                      },
                    }
                  : {}),
                createdAt: Date.UTC(2026, 7, 17, 8, 20, 0),
                updatedAt: Date.UTC(2026, 7, 17, 8, 25, 0),
              },
              {
                requestId: "item-queued",
                message: "Review AKS tasks",
                state: "queued",
                createdAt: Date.UTC(2026, 7, 17, 8, 10, 0),
                updatedAt: Date.UTC(2026, 7, 17, 8, 10, 0),
              },
              {
                requestId: "item-done",
                message: "Review the earlier release",
                state: "done",
                createdAt: Date.UTC(2026, 7, 17, 7, 0, 0),
                updatedAt: Date.UTC(2026, 7, 17, 7, 5, 0),
              },
            ]
              .filter(
                (item) => frame.allWork === true || item.state !== "done" || frame.workRequestId === item.requestId,
              )
              .filter((item) => !frame.workRequestId || item.requestId === frame.workRequestId);
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "app.conversation.get",
                conversation: {
                  id: "may:primary",
                  owner: "may",
                  version: 2,
                  messages: [
                    {
                      id: "human-history",
                      sequence: 1,
                      author: { kind: "human", id: "human-history" },
                      text: "Earlier question",
                      createdAt: 1,
                    },
                    {
                      id: "delivery:history",
                      sequence: 2,
                      author: { kind: "agent", id: "may" },
                      text: "Earlier answer",
                      createdAt: 2,
                    },
                  ],
                  work,
                },
              })}\n`,
            );
          } else if (
            frame.type === "publish" &&
            frame.event?.type === "conversation.message.created" &&
            frame.event?.data?.author?.kind === "human"
          ) {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type, eventId: 42 })}\n`);
            socket.write(
              `${JSON.stringify({
                type: "text",
                sessionId: "s_worker_123",
                text: "unrelated worker output",
              })}\n`,
            );
            const turn = frames.filter(
              (item) =>
                item.type === "publish" &&
                item.event?.type === "conversation.message.created" &&
                item.event?.data?.author?.kind === "human",
            ).length;
            const sessionId = `s_may_turn_${turn}`;
            if (turn > 1) {
              socket.write(
                `${JSON.stringify({
                  type: "session.start",
                  data: { sessionId, agent: "may", status: "running", kind: "job", task: "bounded May turn" },
                })}\n`,
              );
            }
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
    const humanFrames = () =>
      frames.filter(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.type === "conversation.message.created" &&
          frame.event?.data?.author?.kind === "human",
      );

    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    cleanups.push(() => server.close());
    cleanups.push(() => client?.destroy());
    cleanups.push(() => child.kill("SIGKILL"));

    await waitFor(() => frames.some((frame) => frame.type === "status"));
    await waitFor(() => output.includes("\nyou> Earlier question\n\n") && output.includes("\nmay> Earlier answer\n\n"));
    await waitFor(
      () =>
        output.includes("Active work:") &&
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
    await waitFor(() => frames.filter((frame) => frame.type === "app.conversation.get").length === 2);

    child.stdin.write("/work all\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.conversation.get").length === 3);
    expect(frames.filter((frame) => frame.type === "app.conversation.get")[2]).toMatchObject({ allWork: true });
    expect(frames.filter((frame) => frame.type === "app.conversation.get")[2]).not.toHaveProperty("limit");
    await waitFor(
      () => output.includes("All work (newest first):") && output.includes("Review the earlier release — Done"),
    );

    child.stdin.write("/work 1\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.conversation.get").length === 4);
    expect(frames.filter((frame) => frame.type === "app.conversation.get")[3]).toMatchObject({
      workRequestId: "item-working",
    });
    await waitFor(
      () =>
        output.includes("Work 1:") &&
        output.includes("Request: Review the May design") &&
        output.includes("Status: Analyzing") &&
        output.includes("Progress: Codex is reviewing the implementation.") &&
        output.includes("Result:\n    The exact selected review result.") &&
        output.includes("Created: 2026-08-17 08:20:00 UTC") &&
        output.includes("Updated: 2026-08-17 08:25:00 UTC"),
    );

    child.stdin.write("show me the result\n");
    await waitFor(() => humanFrames().length === 1);
    expect(humanFrames()[0]).toMatchObject({
      event: {
        type: "conversation.message.created",
        target: { appId: "may" },
        data: {
          conversationId: "may:primary",
          author: { kind: "human", id: expect.stringMatching(/^may-console:local-terminal:\d+$/) },
          text: "show me the result",
          metadata: { channel: "may-console", channelThreadId: "local-terminal" },
        },
      },
    });
    await waitFor(() => output.includes("\nmay> May response 1\n\nyou> "));
    expect(
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.type === "conversation.message.created" &&
          frame.event?.data?.metadata?.command === "/work 1" &&
          String(frame.event?.data?.text).includes("The exact selected review result."),
      ),
    ).toBe(true);

    child.stdin.write("/work 2\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.conversation.get").length === 5);
    await waitFor(
      () =>
        output.includes("Work 2:") &&
        output.includes("Request: Review AKS tasks") &&
        output.includes("Status: Queued") &&
        output.includes("Progress: No durable progress update yet."),
    );

    completedWorkId = "item-working";
    child.stdin.write("/work 1\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.conversation.get").length === 6);
    await waitFor(() => output.includes("Request: Review the May design") && output.includes("Status: Done"));

    child.stdin.write("/sessions\n");
    await waitFor(() => output.includes("focused work"));

    child.stdin.write("review Gym\n");
    await waitFor(() => humanFrames().length === 2);
    const input = humanFrames()[1];
    expect(input).toMatchObject({
      event: {
        target: { appId: "may" },
        data: {
          text: "review Gym",
          conversationId: "may:primary",
          metadata: { channel: "may-console", channelThreadId: "local-terminal" },
        },
      },
    });
    expect(
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.data?.metadata?.command === "/sessions" &&
          String(frame.event?.data?.text).includes("s_worker_1"),
      ),
    ).toBe(true);
    await waitFor(() => output.includes("\nmay> May response 2\n\nyou> "));
    expect(output).not.toContain("unrelated worker output");
    expect(output).not.toContain("[accepted");
    await waitFor(() => frames.some((frame) => frame.type === "channel.delivery.completed"));
    expect(
      frames.find((frame) => frame.type === "channel.delivery.completed" && frame.data?.appInboxItemId === "item-2"),
    ).toMatchObject({
      source: "may-console",
      owner: "app:may",
      data: {
        channel: "may-console",
        appInboxItemId: "item-2",
        appInboxRequestId: "app-inbox-human:item-2",
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
    await waitFor(() => humanFrames().length === 3);
    expect(frames.filter((frame) => frame.type === "subscribe")[2]?.sessions).toEqual([]);
    expect(humanFrames()[2]?.event?.target?.appId).toBe("may");
    await waitFor(() => output.includes("\nmay> May response 3\n\nyou> "));

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
