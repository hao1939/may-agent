import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../lib/db/connection.js";
import { storeNotificationMessage } from "../lib/db/notifications.js";
import { attachEventPersistence } from "./daemon-events.js";
import { EventBus } from "./event-bus.js";
import { attachHumanResultFollowThrough } from "./human-result-follow-through.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "human-result-follow-through-"));
  roots.push(root);
  const persistDir = join(root, ".state");
  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir });
  const runs: Array<{ agent: string; task: string; opts: Record<string, unknown> }> = [];
  const activeSessions = new Map<string, unknown>();
  const manager = {
    activeSessions,
    run: (agent: string, task: string, opts?: Record<string, unknown>) => {
      runs.push({ agent, task, opts: opts ?? {} });
      return `review-${runs.length}`;
    },
  };
  attachHumanResultFollowThrough({ bus, manager: manager as any, persistDir, interfaceAgent: "may" });
  return { root, persistDir, bus, runs, activeSessions };
}

function storeHumanInput(persistDir: string, traceId = "trace-human-cli") {
  storeNotificationMessage(persistDir, {
    telegram_msg_id: 700,
    event_type: "human.input.received",
    agent: "may",
    session_id: null,
    project_id: null,
    data: JSON.stringify({
      direction: "inbound",
      conversationId: "telegram:chat:123:topic:0:agent:may",
      traceId,
      text: "Use Codex to review the design and bring me a proposal.",
    }),
  });
}

describe("human result follow-through", () => {
  it("starts a fresh Telegram-owned May review when the source session is gone", () => {
    const { bus, persistDir, runs } = fixture();
    storeHumanInput(persistDir);

    bus.emit({
      type: "cli.task.completed",
      source: "cli-task-runner",
      owner: "agent:may",
      data: {
        taskId: "cli-review-1",
        tool: "codex",
        summary: "Review completed",
        resultPath: "/app/.state/cli-tasks/cli-review-1/result.md",
        sourceSessionId: "missing-session",
      },
      trace: { traceId: "trace-human-cli", parentEventId: 1 },
    } as any);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.agent).toBe("may");
    expect(runs[0]?.opts).toMatchObject({
      kind: "chat",
      autoClose: "never",
      source: "telegram",
      requestId: "human-result-review:cli:cli-review-1",
      conversationId: "telegram:chat:123:topic:0:agent:may",
      channelMessageId: 700,
    });
    expect((runs[0]?.opts.trace as any)?.traceId).toBe("trace-human-cli");
    expect(runs[0]?.task).toContain("Original human request");
    expect(runs[0]?.task).toContain("Use Codex to review the design");
    expect(runs[0]?.task).toContain("session that started this worker is gone");
    expect(runs[0]?.task).toContain("continues the same human request from the durable trace");
    expect(runs[0]?.task).toContain("Review the worker result before answering");
    expect(runs[0]?.task).toContain("Reply to Telegram message: 700");
  });

  it("reuses an available source session instead of starting a duplicate review", () => {
    const { bus, persistDir, runs, activeSessions } = fixture();
    storeHumanInput(persistDir);
    activeSessions.set("live-session", {});

    bus.emit({
      type: "cli.task.completed",
      source: "cli-task-runner",
      owner: "agent:may",
      data: { taskId: "cli-review-2", sourceSessionId: "live-session" },
      trace: { traceId: "trace-human-cli" },
    } as any);

    expect(runs).toHaveLength(0);
  });

  it("ignores non-human and non-May CLI results", () => {
    const { bus, runs } = fixture();

    bus.emit({
      type: "cli.task.completed",
      source: "cli-task-runner",
      owner: "agent:may",
      data: { taskId: "cli-no-human" },
      trace: { traceId: "trace-without-telegram-input" },
    } as any);
    bus.emit({
      type: "cli.task.completed",
      source: "cli-task-runner",
      owner: "agent:dev",
      data: { taskId: "cli-dev" },
      trace: { traceId: "trace-human-cli" },
    } as any);

    expect(runs).toHaveLength(0);
  });

  it("deduplicates repeated terminal delivery for the same CLI task", () => {
    const { bus, persistDir, runs } = fixture();
    storeHumanInput(persistDir);
    const event = {
      type: "cli.task.completed",
      source: "cli-task-runner",
      owner: "agent:may",
      data: { taskId: "cli-review-3" },
      trace: { traceId: "trace-human-cli" },
    } as any;

    bus.emit(event);
    bus.emit({ ...event });

    expect(runs).toHaveLength(1);
  });

  it("starts one fresh May review when a human-linked project task converges", () => {
    const { bus, persistDir, runs } = fixture();
    storeHumanInput(persistDir, "trace-human-project");
    bus.emit({
      type: "project.owner.reviewed",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: {
        openEventId: 1,
        taskRefs: [{ projectId: "gym", taskId: "learning/review" }],
      },
      trace: { traceId: "trace-human-project" },
    } as any);

    const terminal = {
      type: "project.task.reconciled",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: {
        project: "gym",
        taskId: "learning/review",
        generation: 3,
        disposition: "converged",
        summary: "The approved review completed.",
        evidence: ["run:telegram-field-123"],
      },
      trace: { traceId: "task-run-trace" },
    } as any;
    bus.emit(terminal);
    bus.emit({ ...terminal });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      agent: "may",
      opts: {
        kind: "chat",
        autoClose: "never",
        source: "telegram",
        requestId: "human-result-review:project:gym:learning/review:3",
        conversationId: "telegram:chat:123:topic:0:agent:may",
        channelMessageId: 700,
        trace: { traceId: "trace-human-project", parentEventId: expect.any(Number) },
      },
    });
    expect(runs[0]?.task).toContain("Original human request");
    expect(runs[0]?.task).toContain("The approved review completed.");
    expect(runs[0]?.task).toContain("Verify the terminal outcome");
  });

  it("keeps waiting project progress silent and ignores tasks without a human link", () => {
    const { bus, persistDir, runs } = fixture();
    storeHumanInput(persistDir, "trace-human-project");
    bus.emit({
      type: "project.owner.reviewed",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: { taskRefs: [{ projectId: "gym", taskId: "learning/review" }] },
      trace: { traceId: "trace-human-project" },
    } as any);
    for (const [taskId, disposition] of [
      ["learning/review", "waiting"],
      ["unlinked/task", "converged"],
    ] as const) {
      bus.emit({
        type: "project.task.reconciled",
        source: "project-app:gym:task-reconciler",
        owner: "agent:gym",
        data: { project: "gym", taskId, disposition, summary: "progress" },
      } as any);
    }

    expect(runs).toEqual([]);
  });
});
