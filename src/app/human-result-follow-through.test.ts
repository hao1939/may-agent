import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../lib/db/connection.js";
import { checkEventTraceIntegrity } from "../lib/db/event-traces.js";
import { getDb } from "../lib/db/connection.js";
import { storeNotificationMessage } from "../lib/db/notifications.js";
import { attachEventPersistence } from "./daemon-events.js";
import { EVENT_ROW_ID, EventBus } from "./event-bus.js";
import { attachHumanResultFollowThrough } from "./human-result-follow-through.js";
import { claimAppInboxItem, createAppInboxItem, waitAppInboxClaim } from "./app-inbox-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(options: { admitAppReview?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "human-result-follow-through-"));
  roots.push(root);
  const persistDir = join(root, ".state");
  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir });
  const runs: Array<{ agent: string; task: string; opts: Record<string, unknown> }> = [];
  const activeSessions = new Map<string, unknown>();
  const appReviews: Array<Record<string, unknown>> = [];
  const manager = {
    activeSessions,
    run: (agent: string, task: string, opts?: Record<string, unknown>) => {
      runs.push({ agent, task, opts: opts ?? {} });
      return `review-${runs.length}`;
    },
  };
  attachHumanResultFollowThrough({
    bus,
    manager: manager as any,
    persistDir,
    interfaceAgent: "may",
    ...(options.admitAppReview
      ? {
          admitAppReview: (input) => {
            appReviews.push(input as unknown as Record<string, unknown>);
            return true;
          },
        }
      : {}),
  });
  return { root, persistDir, bus, runs, activeSessions, appReviews };
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
      conversationId: "telegram:chat:123:topic:42:agent:may",
      topicId: 42,
      traceId,
      text: "Use Codex to review the design and bring me a proposal.",
    }),
  });
}

describe("human result follow-through", () => {
  it("admits a late legacy result to the durable May App instead of launching a session", () => {
    const { bus, persistDir, runs, appReviews } = fixture({ admitAppReview: true });
    storeHumanInput(persistDir);

    bus.emit({
      type: "cli.task.completed",
      source: "cli-task-runner",
      owner: "agent:may",
      data: {
        taskId: "cli-review-app-owned",
        tool: "codex",
        summary: "Review completed",
        sourceSessionId: "missing-session",
      },
      trace: { traceId: "trace-human-cli", parentEventId: 1 },
    } as any);

    expect(runs).toEqual([]);
    expect(appReviews).toHaveLength(1);
    expect(appReviews[0]).toMatchObject({
      appId: "may",
      source: { kind: "human", id: "telegram:700" },
      input: {
        kind: "message",
        data: {
          context: {
            compatibility: "legacy-human-result",
            eventType: "cli.task.completed",
            requestId: "human-result-review:cli:cli-review-app-owned",
            traceId: "trace-human-cli",
            taskId: "cli-review-app-owned",
          },
        },
      },
      conversationId: "telegram:chat:123:topic:42:agent:may",
      channel: "telegram",
      channelThreadId: "42",
      channelMessageId: 700,
      idempotencyKey: "human-result-review:cli:cli-review-app-owned",
      trace: { traceId: "trace-human-cli" },
    });
    expect((appReviews[0]?.input as any).data.message).toContain("Review the worker result before answering");
  });

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
      conversationId: "telegram:chat:123:topic:42:agent:may",
      channelMessageId: 700,
    });
    expect((runs[0]?.opts.trace as any)?.traceId).toBe("trace-human-cli");
    expect(runs[0]?.task).toContain("Original human request");
    expect(runs[0]?.task).toContain("Use Codex to review the design");
    expect(runs[0]?.task).toContain("session that started this worker is gone");
    expect(runs[0]?.task).toContain("continues the same human request from the durable trace");
    expect(runs[0]?.task).toContain("Review the worker result before answering");
    expect(runs[0]?.task).toContain("Durable request view");
    expect(runs[0]?.task).toContain("Trace: trace-human-cli");
    expect(runs[0]?.task).toContain("Linked task: cli-review-1");
    expect(runs[0]?.task).toContain("Evidence #");
    expect(runs[0]?.task).toContain("cli.task.completed");
    expect(runs[0]?.task).toContain("Nearby Telegram messages");
    expect(runs[0]?.task).toContain("Hao: Use Codex to review the design");
    expect(runs[0]?.task).toContain("Reply to Telegram message: 700");
  });

  it("does not readmit a legacy result already owned by a persisted May inbox item", () => {
    const { bus, persistDir, runs, appReviews } = fixture({ admitAppReview: true });
    storeHumanInput(persistDir);
    createAppInboxItem(getDb(persistDir), {
      id: "existing-review",
      appId: "may",
      source: { kind: "human", id: "event:1" },
      input: { kind: "message", data: { message: "Review this result." } },
      idempotencyKey: "human-result-review:cli:cli-review-existing",
    });

    bus.emit({
      type: "cli.task.completed",
      source: "cli-task-runner",
      owner: "agent:may",
      data: { taskId: "cli-review-existing", sourceSessionId: "missing-session" },
      trace: { traceId: "trace-human-cli" },
    } as any);

    expect(appReviews).toEqual([]);
    expect(runs).toEqual([]);
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
        conversationId: "telegram:chat:123:topic:42:agent:may",
        channelMessageId: 700,
        trace: { traceId: "trace-human-project", parentEventId: expect.any(Number) },
      },
    });
    expect(runs[0]?.task).toContain("Original human request");
    expect(runs[0]?.task).toContain("The approved review completed.");
    expect(runs[0]?.task).toContain("Verify the terminal outcome");
    expect(runs[0]?.task).toContain("Durable request view");
    expect(runs[0]?.task).toContain("Trace: trace-human-project");
    expect(runs[0]?.task).toContain("Linked task: learning/review");
    expect(runs[0]?.task).toContain("Nearby Telegram messages");
  });

  it("leaves an explicitly App-owned task result to its durable inbox parent", () => {
    const { bus, persistDir, runs } = fixture();
    storeHumanInput(persistDir, "trace-human-project");
    bus.emit({
      type: "project.owner.reviewed",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: { taskRefs: [{ projectId: "gym", taskId: "learning/review" }] },
      trace: { traceId: "trace-human-project" },
    } as any);

    const db = getDb(persistDir);
    const item = createAppInboxItem(db, {
      id: "may-parent",
      appId: "may",
      source: { kind: "human", id: "event:1" },
      input: { kind: "message", data: { message: "Finish the review." } },
    }).item;
    const claim = claimAppInboxItem(db, item.id, "app-host:test", 60_000);
    expect(claim).not.toBeNull();
    expect(waitAppInboxClaim(db, claim!, { kind: "task", id: "learning/review" })).toBe(true);

    bus.emit({
      type: "project.task.reconciled",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: {
        project: "gym",
        taskId: "learning/review",
        generation: 3,
        disposition: "converged",
        summary: "The approved review completed.",
      },
      trace: { traceId: "task-run-trace" },
    } as any);

    expect(runs).toEqual([]);
  });

  it("starts one fresh May review for a direct app-owner answer without exposing its carrier task", () => {
    const { bus, persistDir, runs } = fixture();
    storeHumanInput(persistDir, "trace-human-project");
    const directResult = {
      type: "project.owner.reviewed",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: {
        openEventId: 1,
        projectId: "gym",
        disposition: "answered",
        taskDisposition: "converged",
        summary: "No change is needed because the requested state already holds.",
        taskRefs: [],
      },
      trace: { traceId: "trace-human-project" },
    } as any;

    bus.emit(directResult);
    bus.emit({ ...directResult });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      agent: "may",
      opts: {
        kind: "chat",
        autoClose: "never",
        source: "telegram",
        requestId: "human-result-review:project:gym:owner:1",
        conversationId: "telegram:chat:123:topic:42:agent:may",
        channelMessageId: 700,
        trace: { traceId: "trace-human-project", parentEventId: expect.any(Number) },
      },
    });
    expect(runs[0]?.task).toContain("Original human request");
    expect(runs[0]?.task).toContain("Use Codex to review the design");
    expect(runs[0]?.task).toContain("No change is needed");
    expect(runs[0]?.task).not.toContain("runtime/owner-review");
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

  it("starts one fresh May review after a human-linked Condition checkpoint stays waiting", () => {
    const { bus, persistDir, runs } = fixture();
    storeHumanInput(persistDir, "trace-human-project");
    bus.emit({
      type: "project.owner.reviewed",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: { taskRefs: [{ projectId: "gym", taskId: "learning/review" }] },
      trace: { traceId: "trace-human-project" },
    } as any);

    const checkpoint = {
      type: "project.task.reconciled",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: {
        project: "gym",
        taskId: "learning/review",
        generation: 3,
        attemptId: "attempt-checkpoint-2",
        disposition: "waiting",
        reason: "condition-review-checkpoint-missed",
        summary: "The bounded recheck found no new evidence.",
        evidence: ["review:no-new-evidence"],
      },
      trace: { traceId: "task-run-trace" },
    } as any;
    bus.emit(checkpoint);
    bus.emit({ ...checkpoint });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      agent: "may",
      opts: {
        requestId: "human-result-review:project:gym:learning/review:3:checkpoint:attempt-checkpoint-2",
        trace: { traceId: "trace-human-project", parentEventId: expect.any(Number) },
      },
    });
    expect(runs[0]?.task).toContain("checkpoint review");
    expect(runs[0]?.task).toContain("same task is still waiting");
    expect(runs[0]?.task).toContain("changed execution");
    expect(runs[0]?.task).toContain("Send Hao nothing unless");
  });

  it("reports a terminal human-linked task until May's closeout is delivered", () => {
    const { bus, persistDir } = fixture();
    storeHumanInput(persistDir, "trace-human-project");
    bus.emit({
      type: "human.input.received",
      source: "telegram",
      owner: "agent:may",
      data: { text: "Finish the review.", conversation: { channel: "telegram" } },
      trace: { traceId: "trace-human-project" },
    } as any);
    bus.emit({
      type: "project.owner.reviewed",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: { taskRefs: [{ projectId: "gym", taskId: "learning/review" }] },
      trace: { traceId: "trace-human-project" },
    } as any);
    const terminal = bus.emit({
      type: "project.task.reconciled",
      source: "project-app:gym:task-reconciler",
      owner: "agent:gym",
      data: {
        project: "gym",
        taskId: "learning/review",
        generation: 4,
        disposition: "converged",
        summary: "Review complete.",
      },
    } as any);
    expect(checkEventTraceIntegrity(getDb(persistDir)).humanLinkedTaskWithoutCloseoutCount).toBe(1);

    const reviewStart = bus.emit({
      type: "session.start",
      source: "telegram",
      owner: "agent:may",
      data: {
        sessionId: "review-closeout-1",
        agent: "may",
        task: "Review the terminal result",
        trigger: "human-result-follow-through",
        firedAt: Date.now(),
      },
      trace: { traceId: "trace-human-project", parentEventId: terminal[EVENT_ROW_ID] },
    } as any);
    bus.emit({
      type: "session.idle",
      source: "runtime",
      owner: "agent:may",
      data: {
        sessionId: "review-closeout-1",
        agent: "may",
        summary: "Verified closeout.",
        durationMs: 1,
        status: "idle",
      },
      trace: { traceId: "trace-human-project", parentEventId: reviewStart[EVENT_ROW_ID] },
    } as any);
    bus.emit({
      type: "channel.delivery.completed",
      source: "telegram",
      owner: "agent:may",
      data: { channel: "telegram", sessionId: "review-closeout-1", resultEventType: "session.idle" },
      trace: { traceId: "trace-human-project" },
    } as any);

    expect(checkEventTraceIntegrity(getDb(persistDir)).humanLinkedTaskWithoutCloseoutCount).toBe(0);
  });
});
