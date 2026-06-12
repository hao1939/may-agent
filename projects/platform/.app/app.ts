import { appendFileSync } from "node:fs";

type EventSelector =
  | string
  | {
      type: string;
      project?: string;
      actions?: string[];
      metricIds?: string[];
    };

type ProjectAppContext = {
  projectPath(path: string): string;
  appPath(path: string): string;
  emit(event: Record<string, unknown>): unknown;
  noop(reason: string): unknown;
};

type ProjectApp = {
  id: string;
  version: 1;
  description: string;
  budget: {
    sessionsPerDay: number;
    tokensPerDay: number;
    maxConcurrent: number;
  };
  schedules: Array<{
    id: string;
    enabled: boolean;
    intervalMs?: number;
    event: Record<string, unknown>;
  }>;
  events: EventSelector[];
  actions: Record<
    string,
    {
      type: "async";
      description: string;
      event(params: unknown): Record<string, unknown>;
    }
  >;
  onEvent(ctx: ProjectAppContext, event: Record<string, unknown>): Promise<unknown>;
};

function defineProjectApp(app: ProjectApp): ProjectApp {
  return app;
}

function eventData(event: Record<string, unknown>): Record<string, unknown> {
  const data = event.data;
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
}

function eventString(event: Record<string, unknown>, key: string): string {
  const data = eventData(event);
  const value = data[key] ?? event[key];
  return typeof value === "string" ? value : "";
}

function appendDiscussionRecord(ctx: ProjectAppContext, event: Record<string, unknown>): string | null {
  const text = eventString(event, "comment") || eventString(event, "commentText") || eventString(event, "text");
  if (!text.trim()) return null;

  const now = new Date().toISOString();
  const id = eventString(event, "id") || `c_${now.replace(/\D/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
  appendFileSync(ctx.appPath("discussion.jsonl"), `${JSON.stringify({
    id,
    ts: now,
    author: eventString(event, "author") || "human",
    kind: "comment",
    status: "unread",
    source: typeof event.source === "string" ? event.source : "event",
    text: text.trim(),
  })}\n`);
  return id;
}

function projectExecutionEvent(reason: string, params: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "project.execution.requested",
    project: "platform",
    reason,
    params: {
      maxConcurrent: 2,
      ...params,
    },
  };
}

export default defineProjectApp({
  id: "platform",
  version: 1,
  description: "Shared May-agent runtime, SDK, persistence, event/session/task execution, read models, and web UI project.",

  budget: {
    sessionsPerDay: 6,
    tokensPerDay: 300_000,
    maxConcurrent: 2,
  },

  schedules: [
    {
      id: "signal-intake",
      enabled: true,
      intervalMs: 3_600_000,
      event: {
        type: "project.tick",
        project: "platform",
        lane: "signal-intake",
      },
    },
  ],

  events: [
    { type: "project.comment.created", project: "platform" },
    { type: "project.tick", project: "platform" },
    { type: "project.execution.requested", project: "platform" },
    { type: "project.tasks.ready", project: "platform" },
    { type: "project.task.execution.requested", project: "platform" },
    { type: "project.task.completed", project: "platform" },
    { type: "project.action.invoked", project: "platform", actions: ["advance-project"] },
    { type: "metric.alerted", metricIds: ["handler.success-rate", "capability.session-trace-completeness", "v2.spec-coverage-rate"] },
  ],

  actions: {
    "advance-project": {
      type: "async",
      description: "Wake the platform planner/reviewer loop.",
      event(params) {
        return {
          type: "project.action.invoked",
          project: "platform",
          action: "advance-project",
          params,
        };
      },
    },
  },

  async onEvent(ctx, event) {
    if (event.type === "project.comment.created") {
      const commentId = appendDiscussionRecord(ctx, event);
      return ctx.emit(projectExecutionEvent("comment-created", { commentId }));
    }

    if (event.type === "project.tick") {
      return ctx.emit(projectExecutionEvent("scheduled-signal-intake", { lane: eventString(event, "lane") }));
    }

    if (event.type === "project.task.completed") {
      return ctx.emit(projectExecutionEvent("task-completed", { taskId: eventString(event, "taskId") }));
    }

    if (event.type === "metric.alerted") {
      return ctx.emit(projectExecutionEvent("platform-metric-alert", { metricId: eventString(event, "metricId") }));
    }

    if (event.type === "project.action.invoked" && eventString(event, "action") === "advance-project") {
      return ctx.emit(projectExecutionEvent("manual-advance", eventData(event).params as Record<string, unknown> || {}));
    }

    return ctx.noop(`platform app has no direct handler for ${String(event.type)}`);
  },
});
