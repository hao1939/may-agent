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
  readJson<T = unknown>(path: string): Promise<T>;
  importModule<T = Record<string, unknown>>(path: string): Promise<T>;
  startSession(input: { agent: string; task: string; timeoutMs?: number }): unknown;
  emit(event: Record<string, unknown>): unknown;
  noop(reason: string): unknown;
};

type ProjectApp = {
  id: string;
  version: 1;
  description: string;
  workspace: {
    kind: "git";
    repo: string;
    localPath: string;
    branch: string;
  };
  budget: {
    sessionsPerDay: number;
    tokensPerDay: number;
    maxConcurrent: number;
  };
  schedules: Array<{
    id: string;
    enabled: boolean;
    intervalMs?: number;
    cron?: string;
    event: Record<string, unknown>;
  }>;
  events: EventSelector[];
  actions: Record<
    string,
    | {
        type: "sync";
        readOnly: true;
        description: string;
        run(ctx: ProjectAppContext, params: unknown): Promise<unknown>;
      }
    | {
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

function selectedPathList(params: unknown): string {
  const selectedPathIds = Array.isArray((params as { selectedPathIds?: unknown })?.selectedPathIds)
    ? ((params as { selectedPathIds: unknown[] }).selectedPathIds.filter((item): item is string => typeof item === "string"))
    : [];
  return selectedPathIds.length ? selectedPathIds.map((id) => `- ${id}`).join("\n") : "- none supplied";
}

function projectExecutionEvent(reason: string, params: unknown = {}): Record<string, unknown> {
  return {
    type: "project.execution.requested",
    project: "aks-rp-e2e",
    reason,
    params: {
      maxConcurrent: 5,
      ...(params && typeof params === "object" && !Array.isArray(params) ? params as Record<string, unknown> : {}),
    },
  };
}

export default defineProjectApp({
  id: "aks-rp-e2e",
  version: 1,
  description: "AKS RP e2e input/expectation knowledge-map, probe, evidence, and replanning app.",
  workspace: {
    kind: "git",
    repo: "git@github.com:hao1939/aks-rp-e2e.git",
    localPath: "../aks-rp-e2e",
    branch: "main",
  },

  budget: {
    sessionsPerDay: 10,
    tokensPerDay: 500_000,
    maxConcurrent: 5,
  },

  schedules: [
    {
      id: "regular-learning",
      enabled: true,
      intervalMs: 3_600_000,
      event: {
        type: "project.tick",
        project: "aks-rp-e2e",
        lane: "learning",
      },
    },
    {
      id: "project-execution-watchdog",
      enabled: true,
      intervalMs: 300_000,
      event: {
        type: "project.watchdog.tick",
        project: "aks-rp-e2e",
      },
    },
    {
      id: "weekly-replan-review",
      enabled: false,
      intervalMs: 604_800_000,
      event: {
        type: "project.tick",
        project: "aks-rp-e2e",
        lane: "replan-review",
      },
    },
  ],

  events: [
    { type: "project.comment.created", project: "aks-rp-e2e" },
    { type: "project.tick", project: "aks-rp-e2e" },
    { type: "project.watchdog.tick", project: "aks-rp-e2e" },
    { type: "project.execution.requested", project: "aks-rp-e2e" },
    { type: "project.tasks.ready", project: "aks-rp-e2e" },
    { type: "project.task.execution.requested", project: "aks-rp-e2e" },
    { type: "project.task.completed", project: "aks-rp-e2e" },
    { type: "project.task.steer", project: "aks-rp-e2e" },
    "escalation.resolved",
    "escalation.dismissed",
    { type: "project.action.invoked", project: "aks-rp-e2e", actions: ["execute-run", "advance-project"] },
    { type: "metric.recovered", metricIds: ["aks-rp-e2e.frontier-ready"] },
    { type: "coverage.gap.detected", project: "aks-rp-e2e" },
  ],

  actions: {
    "list-paths": {
      type: "sync",
      readOnly: true,
      description: "List normalized feature paths and available test specs.",
      async run(ctx) {
        const replan = await ctx.importModule<{
          loadJsonFile<T>(path: string): T;
        }>(ctx.projectPath("model/tools/src/replan-feature-paths.ts"));
        const pathSummary = replan.loadJsonFile(ctx.projectPath("model/knowledge-map/views/path-summary.json"));
        const specs = replan.loadJsonFile(ctx.projectPath("specs/index.json"));
        return { pathSummary, specs };
      },
    },
    replan: {
      type: "sync",
      readOnly: true,
      description: "Compute a dry-run-safe replan for selected feature paths.",
      async run(ctx, params) {
        const selectedPathIds = Array.isArray((params as { selectedPathIds?: unknown })?.selectedPathIds)
          ? (params as { selectedPathIds: unknown[] }).selectedPathIds.filter((item): item is string => typeof item === "string")
          : [];
        if (!selectedPathIds.length) throw new Error("selectedPathIds required");

        const replan = await ctx.importModule<{
          loadJsonFile<T>(path: string): T;
          createReplan(input: { pathSummary: unknown; specs: unknown[]; selectedPathIds: string[] }): unknown;
        }>(ctx.projectPath("model/tools/src/replan-feature-paths.ts"));
        const pathSummary = replan.loadJsonFile(ctx.projectPath("model/knowledge-map/views/path-summary.json"));
        const index = replan.loadJsonFile<{ specFiles?: Array<string | { file?: string | null }> }>(ctx.projectPath("specs/index.json"));
        const specs = (index.specFiles ?? [])
          .map((entry) => (typeof entry === "string" ? entry : entry.file))
          .filter((file): file is string => Boolean(file))
          .map((file) => replan.loadJsonFile(ctx.projectPath(`specs/${file}`)));
        return replan.createReplan({ pathSummary, specs, selectedPathIds });
      },
    },
    "execute-run": {
      type: "async",
      description: "Request a gated live execution for selected replanned paths.",
      event(params) {
        return {
          type: "project.action.invoked",
          project: "aks-rp-e2e",
          action: "execute-run",
          params,
        };
      },
    },
    "advance-project": {
      type: "async",
      description: "Advance the project task tree until genuinely blocked, gated, complete, or interrupted by an infra guard.",
      event(params) {
        return projectExecutionEvent("manual-action", params);
      },
    },
    watch: {
      type: "async",
      description: "Start or resume the project watcher through the task-tree execution event.",
      event(params) {
        return projectExecutionEvent("watch-request", params);
      },
    },
  },

  async onEvent(ctx, event) {
    if (event.type === "project.comment.created") {
      const commentId = appendDiscussionRecord(ctx, event);
      return ctx.emit(projectExecutionEvent("project-comment", { commentId }));
    }

    if (event.type === "project.tick" && event.lane === "learning") {
      return ctx.emit(projectExecutionEvent("regular-learning-tick", eventData(event)));
    }

    if (event.type === "project.tick" && event.lane === "replan-review") {
      return ctx.emit(projectExecutionEvent("replan-review-tick", eventData(event)));
    }

    if (event.type === "project.watchdog.tick") {
      return ctx.noop("project.watchdog.tick is consumed by the aks-rp-e2e project-execution-watchdog workflow trigger");
    }

    if (event.type === "project.action.invoked" && event.action === "execute-run") {
      return ctx.emit(projectExecutionEvent("execute-run-action", {
        selectedPaths: selectedPathList(event.params),
        params: event.params,
      }));
    }

    if (event.type === "project.task.steer") {
      appendDiscussionRecord(ctx, {
        ...event,
        text: [
          `[task-steer] ${eventString(event, "task_id") || "project"}`,
          eventString(event, "action") ? `action: ${eventString(event, "action")}` : "",
          eventString(event, "comment"),
        ].filter(Boolean).join("\n"),
      });
      return ctx.emit(projectExecutionEvent("task-steer", eventData(event)));
    }

    if (event.type === "project.task.completed") {
      const taskId = eventString(event, "taskId") || eventString(event, "task_id");
      const status = eventString(event, "status");
      const verificationVerdict = eventString(event, "verification_verdict");
      if (verificationVerdict === "rejected" && /(?:rework-review|rollup-review|blocker-review)$/.test(taskId)) {
        return ctx.noop(`suppressed continuation for rejected review task ${taskId}`);
      }
      return ctx.emit(projectExecutionEvent("task-completed", {
        completedTaskId: taskId,
        status,
        verificationVerdict,
      }));
    }

    if (event.type === "escalation.resolved" || event.type === "escalation.dismissed") {
      const data = eventData(event);
      const project = eventString(event, "project") || eventString(event, "projectId");
      const escalationId = eventString(event, "escalationId") || eventString(event, "escalation_id");
      if (!project && !escalationId.startsWith("esc_aks_rp_e2e_")) {
        return ctx.noop(`ignored ${event.type} without aks-rp-e2e project marker`);
      }
      if (project && project !== "aks-rp-e2e" && project !== "aks-rp-e2e.app") {
        return ctx.noop(`ignored ${event.type} for project ${project}`);
      }
      appendDiscussionRecord(ctx, {
        ...event,
        text: [
          `[${event.type}] ${escalationId || "unknown"}`,
          eventString(event, "taskId") ? `task: ${eventString(event, "taskId")}` : "",
          eventString(event, "outcome") ? `outcome: ${eventString(event, "outcome")}` : "",
          eventString(event, "summary") || eventString(event, "comment"),
        ].filter(Boolean).join("\n"),
      });
      return ctx.emit(projectExecutionEvent(event.type === "escalation.resolved" ? "escalation-resolved" : "escalation-dismissed", data));
    }

    if (event.type === "project.execution.requested") {
      return ctx.noop("project.execution.requested is consumed by the aks-rp-e2e project-planner workflow trigger");
    }

    if (event.type === "project.tasks.ready") {
      return ctx.noop("project.tasks.ready is consumed by the aks-rp-e2e task-worker workflow trigger");
    }

    if (event.type === "project.task.execution.requested") {
      return ctx.noop("project.task.execution.requested is consumed by the aks-rp-e2e task-worker workflow trigger");
    }

    return ctx.noop(`no aks-rp-e2e handler for event ${String(event.type)}`);
  },
});
