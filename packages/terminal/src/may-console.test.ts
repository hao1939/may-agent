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
  test("shares Conversation context and manages stable Tasks instead of sessions", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-console-"));
    const instance = "test";
    const socketDir = join(root, "instances", instance);
    const socketPath = join(socketDir, "may.sock");
    mkdirSync(socketDir, { recursive: true });

    const frames: Array<Record<string, any>> = [];
    const remoteConversationMessages: Array<Record<string, any>> = [];
    let completedWorkId: string | null = null;
    let taskTerminal = false;
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
                startedAt: Date.UTC(2026, 7, 17, 8, 21, 0),
                changedAt: Date.UTC(2026, 7, 17, 8, 25, 0),
                dependency: { kind: "analysis", id: "analysis-review" },
              },
              {
                requestId: "item-queued",
                message: "Review AKS tasks",
                state: "queued",
                createdAt: Date.UTC(2026, 7, 17, 8, 10, 0),
                changedAt: Date.UTC(2026, 7, 17, 8, 10, 0),
              },
              {
                requestId: "item-done",
                message: "Review the earlier release",
                state: "done",
                result: {
                  summary: "The earlier release is healthy.",
                  response: "The earlier release passed every required check.",
                },
                createdAt: Date.UTC(2026, 7, 17, 7, 0, 0),
                startedAt: Date.UTC(2026, 7, 17, 7, 1, 0),
                changedAt: Date.UTC(2026, 7, 17, 7, 5, 0),
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
                    ...remoteConversationMessages,
                  ],
                  work,
                },
              })}\n`,
            );
          } else if (frame.type === "apps.list") {
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "apps.list",
                apps: [
                  {
                    id: "evaluation",
                    owner: "evaluator",
                    description: "Reviews project behavior",
                    activeTasks: taskTerminal ? 0 : 1,
                    runningTasks: taskTerminal ? 0 : 1,
                    waitingTasks: 0,
                    attentionTasks: 0,
                  },
                ],
              })}\n`,
            );
          } else if (frame.type === "tasks.list") {
            const task = frame.cursor
              ? {
                  appId: "evaluation",
                  taskId: "review/follow-up",
                  ref: "7e11ab22",
                  status: "waiting",
                  outcome: "Review the follow-up",
                  summary: "Waiting for evidence",
                  updatedAt: Date.UTC(2026, 7, 17, 9, 5, 0),
                  terminal: false,
                  cancellable: true,
                }
              : {
                  appId: "evaluation",
                  taskId: "review/docs",
                  ref: "8f12ac90",
                  status: taskTerminal ? "done" : "running",
                  outcome: "Review the docs",
                  summary: taskTerminal ? "Review complete" : "Reviewing current behavior",
                  response: taskTerminal ? "The design and implementation now align." : undefined,
                  updatedAt: Date.UTC(2026, 7, 17, 9, 0, 0),
                  terminal: taskTerminal,
                  cancellable: !taskTerminal,
                };
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "tasks.list",
                tasks: {
                  items: [task],
                  ...(frame.cursor ? {} : { nextCursor: "tasks-page-2" }),
                },
              })}\n`,
            );
          } else if (frame.type === "task.get") {
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "task.get",
                task: {
                  appId: "evaluation",
                  taskId: "review/docs",
                  ref: "8f12ac90",
                  status: taskTerminal ? "done" : "running",
                  outcome: "Review the docs",
                  summary: taskTerminal ? "Review complete" : "Reviewing current behavior",
                  response: taskTerminal ? "The design and implementation now align." : undefined,
                  updatedAt: Date.UTC(2026, 7, 17, 9, 0, 0),
                  terminal: taskTerminal,
                  cancellable: !taskTerminal,
                },
              })}\n`,
            );
          } else if (frame.type === "publish" && frame.event?.type === "runtime.reload.requested") {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type, eventId: 43 })}\n`);
            socket.write(
              `${JSON.stringify({
                type: "runtime.reload.finished",
                source: "runtime",
                owner: "agent:may",
                data: {
                  requestId: frame.event.data.requestId,
                  ok: true,
                  summary: "[reload] 6 task-enabled App(s)",
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
            remoteConversationMessages.push({
              id: `may-turn-${turn}`,
              sequence: turn + 2,
              author: { kind: "agent", id: "may" },
              text: `May response ${turn}`,
              metadata: { channel: "may-console" },
              createdAt: turn + 2,
            });
            socket.write(
              `${JSON.stringify({
                type: "conversation.updated",
                owner: "app:may",
                data: { appId: "may", conversationId: "may:primary" },
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

    await waitFor(() => frames.some((frame) => frame.type === "app.conversation.get"));
    await waitFor(() => output.includes("\nyou> Earlier question\n\n") && output.includes("\nmay> Earlier answer\n\n"));
    expect(frames.some((frame) => frame.type === "status")).toBe(false);
    expect(output).not.toContain("Active work:");
    expect(frames.find((frame) => frame.type === "subscribe")).toMatchObject({
      sessions: [],
      conversations: ["may:primary"],
    });
    expect(output).not.toContain("focused work");

    child.stdin.write("/work\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.conversation.get").length === 2);
    await waitFor(
      () =>
        output.includes("Active work:") &&
        output.includes("Review the May design — Analyzing") &&
        output.includes(" · changed ") &&
        output.includes("Codex is reviewing the implementation.") &&
        output.includes("Review AKS tasks — Queued"),
    );

    child.stdin.write("/work all\n");
    await waitFor(() => frames.filter((frame) => frame.type === "app.conversation.get").length === 3);
    expect(frames.filter((frame) => frame.type === "app.conversation.get")[2]).toMatchObject({ allWork: true });
    expect(frames.filter((frame) => frame.type === "app.conversation.get")[2]).not.toHaveProperty("limit");
    await waitFor(
      () =>
        output.includes("All work (newest first):") &&
        output.includes("Review the earlier release — Done") &&
        output.includes("Result:\n       The earlier release passed every required check."),
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
        output.includes("Started: 2026-08-17 08:21:00 UTC") &&
        output.includes("Changed: 2026-08-17 08:25:00 UTC") &&
        output.includes("Waiting on: analysis:analysis-review"),
    );

    child.stdin.write("show me the result\n");
    await waitFor(() => humanFrames().length === 1);
    expect(humanFrames()[0]).toMatchObject({
      event: {
        type: "conversation.message.created",
        target: { appId: "may" },
        data: {
          conversationId: "may:primary",
          author: {
            kind: "human",
            id: expect.stringMatching(/^may-console:[0-9a-f-]{36}:\d+$/),
          },
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
          frame.event?.data?.metadata?.requestIds?.[0] === "item-working" &&
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

    child.stdin.write("/apps evaluation\n");
    await waitFor(() => output.includes("App evaluation:") && output.includes("Reviews project behavior"));
    child.stdin.write("/tasks evaluation\n");
    await waitFor(
      () => output.includes("Active Tasks:") && output.includes("8f12ac90") && output.includes("Review the docs"),
    );
    expect(output).toContain("run /tasks more for the next page");
    child.stdin.write("/tasks more\n");
    await waitFor(() => output.includes("7e11ab22") && output.includes("Review the follow-up"));
    expect(
      frames.some(
        (frame) => frame.type === "tasks.list" && frame.appId === "evaluation" && frame.cursor === "tasks-page-2",
      ),
    ).toBe(true);
    child.stdin.write("/task 8f12ac90\n");
    await waitFor(
      () =>
        output.includes("Task 8f12ac90:") &&
        output.includes("Progress:") &&
        output.includes("Reviewing current behavior"),
    );

    child.stdin.write("/watch 8f12ac90\n");
    await waitFor(() => frames.some((frame) => frame.type === "subscribe" && frame.task?.taskId === "review/docs"));
    await waitFor(() => output.includes("[watch] Watching 8f12ac90"));

    child.stdin.write("please keep the compatibility alias\n");
    await waitFor(() => humanFrames().length === 2);
    const input = humanFrames()[1];
    expect(input).toMatchObject({
      event: {
        target: { appId: "may" },
        data: {
          text: "please keep the compatibility alias",
          conversationId: "may:primary",
          context: { focusedTask: { appId: "evaluation", taskId: "review/docs" } },
          metadata: { channel: "may-console", channelThreadId: "local-terminal" },
        },
      },
    });
    expect(
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.data?.metadata?.command === "/task 8f12ac90" &&
          frame.event?.data?.metadata?.taskRefs?.[0]?.taskId === "review/docs",
      ),
    ).toBe(true);
    await waitFor(() => output.includes("\nmay> May response 2\n\nyou[task 8f12ac90]> "));
    expect(output).not.toContain("unrelated worker output");
    expect(output).not.toContain("[accepted");
    expect(frames.some((frame) => frame.type === "channel.delivery.completed")).toBe(false);

    taskTerminal = true;
    client?.write(
      `${JSON.stringify({
        type: "app.task.updated",
        data: { appId: "evaluation", taskId: "review/docs" },
      })}\n`,
    );
    await waitFor(() => output.includes("The design and implementation now align."));
    await waitFor(
      () =>
        frames.filter((frame) => frame.type === "subscribe").at(-1)?.task === null &&
        output.includes("[watch] Task finished; watch ended."),
    );

    const beforeTelegramSync = frames.filter((frame) => frame.type === "app.conversation.get").length;
    remoteConversationMessages.push({
      id: "telegram-human-1",
      sequence: 3,
      author: { kind: "human", id: "telegram:123:1" },
      text: "Message sent from Telegram",
      metadata: { channel: "telegram", requestId: "telegram-work-1" },
      createdAt: 3,
    });
    client?.write(
      `${JSON.stringify({
        type: "conversation.updated",
        source: "app-inbox",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      })}\n`,
    );
    await waitFor(
      () => frames.filter((frame) => frame.type === "app.conversation.get").length === beforeTelegramSync + 1,
    );
    await waitFor(() => output.includes("\nyou[telegram]> Message sent from Telegram\n\n"));

    const beforeConsoleSync = frames.filter((frame) => frame.type === "app.conversation.get").length;
    remoteConversationMessages.push({
      id: "may-console:another-process:4",
      sequence: 4,
      author: { kind: "human", id: "may-console:another-process:4" },
      text: "Message sent from another Console",
      metadata: { channel: "may-console", requestId: "console-work-1" },
      createdAt: 4,
    });
    client?.write(
      `${JSON.stringify({
        type: "conversation.updated",
        source: "app-inbox",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      })}\n`,
    );
    await waitFor(
      () => frames.filter((frame) => frame.type === "app.conversation.get").length === beforeConsoleSync + 1,
    );
    await waitFor(() => output.includes("\nyou> Message sent from another Console\n\n"));

    child.stdin.write("/reload\n");
    await waitFor(() =>
      frames.some((frame) => frame.type === "publish" && frame.event?.type === "runtime.reload.requested"),
    );
    const reload = frames.find((frame) => frame.type === "publish" && frame.event?.type === "runtime.reload.requested");
    expect(reload).toMatchObject({
      type: "publish",
      event: {
        type: "runtime.reload.requested",
        data: {
          requestId: expect.stringMatching(/^may-console:[0-9a-f-]{36}:[0-9a-f-]{36}$/),
        },
        idempotencyKey: expect.stringMatching(/^may-console:[0-9a-f-]{36}:[0-9a-f-]{36}$/),
      },
    });
    await waitFor(() => output.includes("[reload] 6 task-enabled App(s)"));
    await waitFor(() =>
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.type === "conversation.message.created" &&
          frame.event?.data?.metadata?.command === "/reload" &&
          frame.event?.data?.text === "[reload] 6 task-enabled App(s)",
      ),
    );

    child.stdin.write("/exit\n");
    await once(child, "exit");
  }, 10_000);

  test("queues early work commands until the initial Conversation view arrives", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-console-early-input-"));
    const instance = "test";
    const socketDir = join(root, "instances", instance);
    const socketPath = join(socketDir, "may.sock");
    mkdirSync(socketDir, { recursive: true });

    const frames: Array<Record<string, any>> = [];
    let client: Socket | null = null;
    let inputBuffer = "";
    const conversation = {
      id: "may:primary",
      owner: "may",
      version: 1,
      messages: [],
      work: [
        {
          requestId: "work-one",
          message: "Inspect the first item",
          state: "working",
          createdAt: 1,
          changedAt: 2,
        },
      ],
    };
    const server: Server = createServer((socket) => {
      client = socket;
      socket.write(`${JSON.stringify({ type: "connected", agent: "may", instance, activeAgents: [] })}\n`);
      socket.on("data", (chunk) => {
        inputBuffer += chunk.toString();
        const lines = inputBuffer.split("\n");
        inputBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const frame = JSON.parse(line) as Record<string, any>;
          frames.push(frame);
          if (frame.type === "app.conversation.get" && frame.includeWork !== false) {
            socket.write(`${JSON.stringify({ type: "ok", command: "app.conversation.get", conversation })}\n`);
          } else if (frame.type !== "app.conversation.get") {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type })}\n`);
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

    child.stdin.write("/work\n");
    await waitFor(() => frames.some((frame) => frame.type === "app.conversation.get" && frame.includeWork === false));
    expect(frames.filter((frame) => frame.type === "app.conversation.get")).toHaveLength(1);
    await waitFor(() => output.includes("[waiting for May; input queued]"));
    expect(output).toContain("[waiting for May; input queued]");

    client?.write(
      `${JSON.stringify({
        type: "ok",
        command: "app.conversation.get",
        conversation: { ...conversation, work: [] },
      })}\n`,
    );
    await waitFor(
      () =>
        frames.filter((frame) => frame.type === "app.conversation.get").length === 2 &&
        frames.at(-1)?.includeWork === undefined,
    );
    await waitFor(() => output.includes("Active work:") && output.includes("Inspect the first item"));

    child.stdin.write("/exit\n");
    await once(child, "exit");
  });

  test("uses a distinct durable message identity for each Console process", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-console-identity-"));
    const instance = "test";
    const socketDir = join(root, "instances", instance);
    const socketPath = join(socketDir, "may.sock");
    mkdirSync(socketDir, { recursive: true });

    const clients = new Set<Socket>();
    const humanIds: string[] = [];
    const server: Server = createServer((socket) => {
      clients.add(socket);
      socket.write(`${JSON.stringify({ type: "connected", agent: "may", instance, activeAgents: [] })}\n`);
      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const frame = JSON.parse(line) as Record<string, any>;
          if (frame.event?.type === "conversation.message.created" && frame.event?.data?.author?.kind === "human") {
            humanIds.push(frame.event.data.author.id);
          }
          if (frame.type === "status") {
            socket.write(`${JSON.stringify({ type: "status", command: "status", activeAgents: [] })}\n`);
          } else if (frame.type === "app.conversation.get") {
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "app.conversation.get",
                conversation: { id: "may:primary", owner: "may", version: 0, messages: [], work: [] },
              })}\n`,
            );
          } else {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type })}\n`);
          }
        }
      });
      socket.on("close", () => clients.delete(socket));
    });
    server.listen(socketPath);
    await once(server, "listening");

    const consolePath = resolve(import.meta.dir, "../bin/may-console.cjs");
    const children = [0, 1].map(() =>
      spawn("node", [consolePath], {
        env: { ...process.env, STATE_DIR: root, DAEMON_INSTANCE: instance, DAEMON_AGENT: "may" },
        stdio: "pipe",
      }),
    );
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    cleanups.push(() => server.close());
    cleanups.push(() => clients.forEach((client) => client.destroy()));
    cleanups.push(() => children.forEach((child) => child.kill("SIGKILL")));

    await waitFor(() => clients.size === 2);
    children[0]!.stdin.write("first process\n");
    children[1]!.stdin.write("second process\n");
    await waitFor(() => humanIds.length === 2);

    expect(humanIds[0]).toMatch(/^may-console:[0-9a-f-]{36}:\d+$/);
    expect(humanIds[1]).toMatch(/^may-console:[0-9a-f-]{36}:\d+$/);
    expect(new Set(humanIds).size).toBe(2);
  });

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
