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
    let taskTerminal = false;
    let humanActionActive = false;
    let dropNextTaskCommandRead = false;
    let taskProgress: { stage: string; message: string; updatedAt: number } | undefined;
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
                conversation: {
                  id: "may:primary",
                  owner: "may",
                  version: 2,
                  topics: [
                    {
                      id: "topic_0df0c0edbf95b5bbc5c87598",
                      title: "Review the design",
                      openedBy: "human",
                      originMessageId: "human-history",
                      taskRefs: [{ appId: "evaluation", taskId: "review/docs", ref: "8f12ac90" }],
                    },
                  ],
                  messages: [
                    {
                      id: "human-history",
                      sequence: 1,
                      author: { kind: "human", id: "human-history" },
                      text: "Earlier question",
                      metadata: { topicId: "topic_0df0c0edbf95b5bbc5c87598" },
                      createdAt: 1,
                    },
                    {
                      id: "delivery:history",
                      sequence: 2,
                      author: { kind: "agent", id: "may" },
                      text: `Earlier answer\n${"detail ".repeat(20).trim()}`,
                      metadata: { topicId: "topic_0df0c0edbf95b5bbc5c87598" },
                      createdAt: 2,
                    },
                    ...remoteConversationMessages,
                  ],
                },
              })}\n`,
            );
          } else if (frame.type === "apps.list") {
            const appId = typeof frame.appId === "string" ? frame.appId : "evaluation";
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "apps.list",
                apps: [
                  {
                    id: appId,
                    owner: appId === "may" ? "may" : "evaluator",
                    description: appId === "may" ? "Handles human conversation" : "Reviews project behavior",
                    activeTasks: appId === "may" || taskTerminal ? 0 : 1,
                    runningTasks: appId === "may" || taskTerminal ? 0 : 1,
                    waitingTasks: 0,
                    attentionTasks: 0,
                  },
                ],
              })}\n`,
            );
          } else if (frame.type === "tasks.list") {
            if (dropNextTaskCommandRead && !frame.humanActionOnly) {
              dropNextTaskCommandRead = false;
              socket.destroy();
              continue;
            }
            if (frame.humanActionOnly) {
              const task = frame.cursor
                ? {
                    appId: "evaluation",
                    taskId: "review/second-approval",
                    ref: "6d22bc11",
                    status: "waiting",
                    outcome: "Approve the second change",
                    summary: "Approve or reject the second change.",
                    resourceVersion: 1,
                    updatedAt: Date.UTC(2026, 7, 17, 9, 1, 0),
                    terminal: false,
                    cancellable: true,
                    humanAction: { requestedAction: "Approve or reject the second change." },
                  }
                : {
                    appId: "evaluation",
                    taskId: "review/docs",
                    ref: "8f12ac90",
                    status: "waiting",
                    outcome: "Review the docs",
                    summary: "Approve deployment or ask for another verification pass.",
                    resourceVersion: 4,
                    updatedAt: Date.UTC(2026, 7, 17, 9, 0, 0),
                    terminal: false,
                    cancellable: true,
                    humanAction: {
                      requestedAction: "Approve deployment or ask for another verification pass.",
                      since: Date.UTC(2026, 7, 17, 9, 0, 0),
                    },
                  };
              socket.write(
                `${JSON.stringify({
                  type: "ok",
                  command: "tasks.list",
                  tasks: {
                    items: humanActionActive && !taskTerminal ? [task] : [],
                    total: humanActionActive && !taskTerminal ? 2 : 0,
                    ...(!frame.cursor && humanActionActive && !taskTerminal ? { nextCursor: "todo-page-2" } : {}),
                  },
                })}\n`,
              );
              continue;
            }
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
                  acceptance: ["Report the exact findings.", "Show the verification evidence."],
                  statusDetail: taskTerminal ? "Completed." : "An attempt is working on it now.",
                  summary: taskTerminal ? "Review complete" : "Reviewing current behavior",
                  response: taskTerminal ? "The design and implementation now align." : undefined,
                  updatedAt: Date.UTC(2026, 7, 17, 9, 0, 0),
                  terminal: taskTerminal,
                  cancellable: !taskTerminal,
                  ...(!taskTerminal && humanActionActive
                    ? {
                        humanAction: {
                          requestedAction: "Approve deployment or ask for another verification pass.",
                          since: Date.UTC(2026, 7, 17, 9, 0, 0),
                        },
                      }
                    : {}),
                  ...(!taskTerminal && taskProgress ? { progress: taskProgress } : {}),
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
    await waitFor(() => output.includes("\nyou> Earlier question\n\n") && output.includes("\nmay> Earlier answer\n"));
    expect(output.split("\n").filter((line) => line.startsWith("     detail")).length).toBeGreaterThan(1);
    expect(frames.some((frame) => frame.type === "status")).toBe(false);
    expect(output).not.toContain("Active work:");
    expect(frames.find((frame) => frame.type === "subscribe")).toMatchObject({
      sessions: [],
      conversations: ["may:primary"],
      taskApps: ["may"],
    });
    expect(output).not.toContain("focused work");

    child.stdin.write("/topics\n");
    await waitFor(
      () =>
        output.includes("Recent Topics:") &&
        output.includes("0df0c0ed  Review the design · 1 Task") &&
        output.includes("Task progress remains under /task and /watch."),
    );
    child.stdin.write("/topic 0df0c0ed\n");
    await waitFor(
      () =>
        output.includes("Following 0df0c0ed: Review the design") &&
        output.includes("8f12ac90 · evaluation") &&
        output.includes("you[may · 0df0c0ed]>"),
    );

    // A human may paste the context switch and the next command together.
    // The Console must preserve that input order even though both reads are
    // asynchronous on the control socket.
    child.stdin.write("/apps evaluation\n/tasks\n");
    await waitFor(() => output.includes("Selected App: evaluation") && output.includes("Reviews project behavior"));
    await waitFor(
      () =>
        output.includes("Active Tasks for evaluation:") &&
        output.includes("8f12ac90") &&
        output.includes("Review the docs"),
    );
    expect(output).toContain("Active Tasks for evaluation:\n\n  8f12ac90 · evaluation · working ·");
    expect(output).toContain("    Review the docs\n    You: Nothing needed right now.\n\n");
    expect(
      frames.some((frame) => frame.type === "tasks.list" && frame.appId === "evaluation" && frame.limit === 10),
    ).toBe(true);
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
        output.includes("Task 8f12ac90 · evaluation") &&
        output.includes("  Goal\n    Review the docs") &&
        output.includes("  State\n    working. An attempt is working on it now.") &&
        output.includes("Current") &&
        output.includes("Reviewing current behavior") &&
        output.includes("  Expected result\n    - Report the exact findings.\n    - Show the verification evidence.") &&
        output.includes("  You\n    Nothing needed right now."),
    );

    const taskReadsBeforeReconnect = frames.filter(
      (frame) => frame.type === "tasks.list" && frame.appId === "evaluation" && !frame.humanActionOnly,
    ).length;
    const taskViewsBeforeReconnect = output.split("Active Tasks for evaluation:").length - 1;
    dropNextTaskCommandRead = true;
    child.stdin.write("/tasks\n");
    await waitFor(
      () =>
        frames.filter((frame) => frame.type === "tasks.list" && frame.appId === "evaluation" && !frame.humanActionOnly)
          .length >=
          taskReadsBeforeReconnect + 2 &&
        output.split("Active Tasks for evaluation:").length - 1 === taskViewsBeforeReconnect + 1,
    );

    humanActionActive = true;
    client?.write(
      `${JSON.stringify({ type: "app.task.updated", data: { appId: "evaluation", taskId: "review/docs" } })}\n`,
    );
    await waitFor(
      () =>
        output.includes("[todo] 2 Tasks need you in evaluation. Run /todo.") &&
        output.includes("you[evaluation · 0df0c0ed · 2 todo]>"),
    );
    const todoNoticeCount = output.split("[todo] 2 Tasks need you in evaluation. Run /todo.").length - 1;
    client?.write(
      `${JSON.stringify({ type: "app.task.updated", data: { appId: "evaluation", taskId: "review/docs" } })}\n`,
    );
    await Bun.sleep(30);
    expect(output.split("[todo] 2 Tasks need you in evaluation. Run /todo.").length - 1).toBe(todoNoticeCount);

    child.stdin.write("/todo\n");
    await waitFor(
      () =>
        output.includes("Actions needed for evaluation:") &&
        output.includes("8f12ac90") &&
        output.includes("Run /todo more."),
    );
    expect(
      frames.some(
        (frame) =>
          frame.type === "tasks.list" &&
          frame.appId === "evaluation" &&
          frame.humanActionOnly === true &&
          frame.limit === 50,
      ),
    ).toBe(true);
    child.stdin.write("/todo more\n");
    await waitFor(() => output.includes("6d22bc11") && output.includes("Approve or reject the second change."));
    expect(
      frames.some(
        (frame) =>
          frame.type === "tasks.list" &&
          frame.humanActionOnly === true &&
          frame.appId === "evaluation" &&
          frame.cursor === "todo-page-2",
      ),
    ).toBe(true);
    expect(
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.data?.metadata?.command === "/todo" &&
          frame.event?.data?.metadata?.taskRefs?.[0]?.taskId === "review/docs",
      ),
    ).toBe(true);

    const activityMessage = {
      id: "task-activity-1",
      sequence: 3,
      author: { kind: "tool", id: "runtime" },
      text: "Accepted durable work: Review the docs",
      metadata: {
        command: "task-admitted",
        taskRefs: [{ appId: "evaluation", taskId: "review/docs", ref: "8f12ac90" }],
        followTask: { appId: "evaluation", taskId: "review/docs", ref: "8f12ac90" },
      },
      createdAt: 3,
    };
    remoteConversationMessages.push(activityMessage);
    client?.write(
      `${JSON.stringify({
        type: "conversation.updated",
        source: "app-inbox",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      })}\n`,
    );
    await waitFor(() =>
      output.includes("[task]\n  Accepted durable work: Review the docs\n  Task 8f12ac90 (evaluation)"),
    );
    await waitFor(() => frames.some((frame) => frame.type === "subscribe" && frame.task?.taskId === "review/docs"));
    await waitFor(() => output.includes("  Task 8f12ac90 · evaluation · working ·"));
    expect(output).toContain("Reviewing current behavior\n\n  Task 8f12ac90 · evaluation · working ·");
    expect(output).toContain("  You: Approve deployment or ask for another verification pass.\n\n");
    child.stdin.write("/unwatch\n");
    await waitFor(() => output.includes("[watch] Watch ended. The Task continues.\n\n"));

    const assignmentMessage = {
      id: "assignment-1",
      sequence: 4,
      author: { kind: "agent", id: "may" },
      text: "Assigned to evaluation.",
      metadata: {
        channel: "may-console",
        taskRefs: [
          { appId: "may", taskId: "conversation/turn-1", ref: "1a2b3c4d" },
          { appId: "evaluation", taskId: "review/docs", ref: "8f12ac90" },
        ],
        followTask: { appId: "evaluation", taskId: "review/docs", ref: "8f12ac90" },
      },
      createdAt: 4,
    };
    remoteConversationMessages.push(assignmentMessage);
    // A durable message can arrive as a raw event before the Conversation
    // wake. It must still be rendered exactly once from Conversation truth.
    client?.write(
      `${JSON.stringify({
        type: "conversation.message.created",
        source: "app-inbox",
        owner: "app:may",
        data: {
          appId: "may",
          conversationId: "may:primary",
          author: assignmentMessage.author,
          text: assignmentMessage.text,
          metadata: assignmentMessage.metadata,
        },
      })}\n`,
    );
    client?.write(
      `${JSON.stringify({
        type: "conversation.updated",
        source: "app-inbox",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      })}\n`,
    );
    await waitFor(() => frames.some((frame) => frame.type === "subscribe" && frame.task?.taskId === "review/docs"));
    await waitFor(() => output.includes("[watch] Following 8f12ac90 · evaluation (from 1a2b3c4d · may).\n\n"));
    expect(output.split("Assigned to evaluation.").length - 1).toBe(1);

    child.stdin.write("please keep the compatibility alias\n");
    await waitFor(() => humanFrames().length === 1);
    const input = humanFrames()[0];
    expect(input).toMatchObject({
      event: {
        target: { appId: "may" },
        data: {
          text: "please keep the compatibility alias",
          conversationId: "may:primary",
          replyTo: "assignment-1",
          context: {
            focusedApp: "evaluation",
            focusedTask: { appId: "evaluation", taskId: "review/docs" },
          },
          metadata: { channel: "may-console", channelThreadId: "local-terminal" },
        },
      },
    });
    expect(input.event.data.metadata.topicId).toBe("topic_0df0c0edbf95b5bbc5c87598");
    expect(
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.data?.metadata?.command === "/task 8f12ac90" &&
          frame.event?.data?.metadata?.taskRefs?.[0]?.taskId === "review/docs",
      ),
    ).toBe(true);
    await waitFor(() => output.includes("\nmay> May response 1\n\nyou[evaluation:8f12ac90 · 0df0c0ed]> "));
    expect(output).not.toContain("unrelated worker output");
    expect(output).not.toContain("[accepted");
    expect(frames.some((frame) => frame.type === "channel.delivery.completed")).toBe(false);

    taskProgress = {
      stage: "intermediate",
      message: "Inspecting exact evidence",
      updatedAt: Date.UTC(2026, 7, 17, 9, 3, 4),
    };
    client?.write(
      `${JSON.stringify({
        type: "app.task.updated",
        data: { appId: "evaluation", taskId: "review/docs" },
      })}\n`,
    );
    await waitFor(() => output.includes("Inspecting exact evidence\n\n  Task 8f12ac90 · evaluation · working ·"));
    client?.write(
      `${JSON.stringify({
        type: "app.task.updated",
        data: { appId: "evaluation", taskId: "review/docs" },
      })}\n`,
    );
    await Bun.sleep(30);
    expect(output.split("Inspecting exact evidence").length - 1).toBe(1);

    child.stdin.write("/apps may\n");
    await waitFor(
      () =>
        output.includes("Selected App: may") &&
        output.includes("Stopped following 8f12ac90; the Task continues unchanged."),
    );
    await waitFor(() => frames.filter((frame) => frame.type === "subscribe").at(-1)?.task === null);

    taskProgress = {
      stage: "intermediate",
      message: "Checking the final evidence",
      updatedAt: Date.UTC(2026, 7, 17, 9, 4, 5),
    };
    client?.write(
      `${JSON.stringify({
        type: "app.task.updated",
        data: { appId: "evaluation", taskId: "review/docs" },
      })}\n`,
    );
    await Bun.sleep(20);
    expect(output).not.toContain("Checking the final evidence");

    child.stdin.write("/watch 8f12ac90\n");
    await waitFor(
      () =>
        output.includes("[catch-up] 8f12ac90 changed while it was not followed.") &&
        output.includes("Checking the final evidence"),
    );
    client?.write(
      `${JSON.stringify({
        type: "app.task.updated",
        data: { appId: "evaluation", taskId: "review/docs" },
      })}\n`,
    );
    await Bun.sleep(30);
    expect(output.split("Checking the final evidence").length - 1).toBe(1);

    taskTerminal = true;
    remoteConversationMessages.push({
      id: "result:review-docs",
      sequence: 5,
      author: { kind: "agent", id: "may" },
      text: "The design and implementation now align.",
      metadata: {
        taskRefs: [{ appId: "evaluation", taskId: "review/docs", ref: "8f12ac90" }],
      },
      createdAt: 5,
    });
    client?.write(
      `${JSON.stringify({
        type: "conversation.updated",
        source: "app-inbox",
        owner: "app:may",
        data: { appId: "may", conversationId: "may:primary" },
      })}\n`,
    );
    await waitFor(() => output.includes("\nmay> The design and implementation now align."));
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
        output.includes("[watch] 8f12ac90 finished; watch ended."),
    );
    expect(output.split("The design and implementation now align.").length - 1).toBe(1);

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

    child.stdin.write("/topic\n");
    await waitFor(() => output.includes("Topic 0df0c0ed: Review the design"));
    child.stdin.write("/topic clear\n");
    await waitFor(
      () =>
        output.includes("Stopped following Topic 0df0c0ed. Its Tasks continue unchanged.") &&
        output.includes("you[may]>"),
    );

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

  test("queues early input until the initial Conversation view arrives", async () => {
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
      messages: [
        {
          id: "historical-task-assignment",
          sequence: 1,
          author: { kind: "tool", id: "runtime" },
          text: "Accepted durable work: old review",
          metadata: {
            command: "task-admitted",
            taskRefs: [{ appId: "evaluation", taskId: "old/review", ref: "deadbeef" }],
            followTask: { appId: "evaluation", taskId: "old/review" },
          },
          createdAt: 1,
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
          if (frame.type !== "app.conversation.get") {
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

    await waitFor(() => frames.some((frame) => frame.type === "app.conversation.get"));
    expect(frames.filter((frame) => frame.type === "app.conversation.get")).toHaveLength(1);

    child.stdin.write("/apps gym\n");
    await waitFor(() => frames.some((frame) => frame.type === "apps.list" && frame.appId === "gym"));

    child.stdin.write("hello\n");
    await waitFor(() => output.includes("[waiting for May; input queued]"));
    expect(output).toContain("[waiting for May; input queued]");

    client?.write(
      `${JSON.stringify({
        type: "ok",
        command: "app.conversation.get",
        conversation,
      })}\n`,
    );
    await Bun.sleep(25);
    expect(frames.some((frame) => frame.type === "task.get" && frame.taskId === "old/review")).toBe(false);
    await waitFor(() =>
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.type === "conversation.message.created" &&
          frame.event?.data?.text === "hello",
      ),
    );

    child.stdin.write("/exit\n");
    await once(child, "exit");
  });

  test("runs disconnected read commands without waiting for Conversation startup", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-console-disconnected-commands-"));
    const instance = "test";
    const socketDir = join(root, "instances", instance);
    const socketPath = join(socketDir, "may.sock");
    mkdirSync(socketDir, { recursive: true });

    const frames: Array<Record<string, any>> = [];
    let client: Socket | null = null;
    const server: Server = createServer((socket) => {
      client = socket;
      socket.write(`${JSON.stringify({ type: "connected", agent: "may", instance, activeAgents: [] })}\n`);
      let inputBuffer = "";
      socket.on("data", (chunk) => {
        inputBuffer += chunk.toString();
        const lines = inputBuffer.split("\n");
        inputBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const frame = JSON.parse(line) as Record<string, any>;
          frames.push(frame);
          if (frame.type === "apps.list") {
            socket.write(
              `${JSON.stringify({
                type: "ok",
                command: "apps.list",
                apps: [
                  {
                    id: frame.appId,
                    owner: "gym",
                    description: "Evaluates behavior",
                    activeTasks: 0,
                    runningTasks: 0,
                    waitingTasks: 0,
                    attentionTasks: 0,
                  },
                ],
              })}\n`,
            );
          } else if (frame.type === "tasks.list") {
            socket.write(
              `${JSON.stringify({ type: "ok", command: "tasks.list", tasks: { items: [], nextCursor: null } })}\n`,
            );
          } else if (frame.type !== "app.conversation.get") {
            socket.write(`${JSON.stringify({ type: "ok", command: frame.type })}\n`);
          }
        }
      });
    });

    const consolePath = resolve(import.meta.dir, "../bin/may-console.cjs");
    const child: ChildProcessWithoutNullStreams = spawn("node", [consolePath], {
      env: { ...process.env, STATE_DIR: root, DAEMON_INSTANCE: instance, DAEMON_AGENT: "may" },
      stdio: "pipe",
    });
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    cleanups.push(() => server.close());
    cleanups.push(() => client?.destroy());
    cleanups.push(() => child.kill("SIGKILL"));

    child.stdin.write("/apps gym\n/tasks\nhello\n/reload\n");
    await Bun.sleep(25);
    server.listen(socketPath);
    await once(server, "listening");

    await waitFor(() => frames.some((frame) => frame.type === "apps.list" && frame.appId === "gym"));
    await waitFor(() =>
      frames.some((frame) => frame.type === "tasks.list" && frame.appId === "gym" && !frame.humanActionOnly),
    );
    expect(frames.findIndex((frame) => frame.type === "apps.list")).toBeLessThan(
      frames.findIndex((frame) => frame.type === "tasks.list" && !frame.humanActionOnly),
    );
    expect(
      frames.some(
        (frame) =>
          frame.type === "publish" &&
          frame.event?.type === "conversation.message.created" &&
          frame.event?.data?.author?.kind === "human" &&
          frame.event?.data?.text === "hello",
      ),
    ).toBe(false);
    await waitFor(() =>
      frames.some((frame) => frame.type === "publish" && frame.event?.type === "runtime.reload.requested"),
    );

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
