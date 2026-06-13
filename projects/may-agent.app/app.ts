import { appendFileSync, mkdirSync } from "node:fs";
import type { ProjectApp, ProjectAppContext } from "./types/project-app.ts";

function defineProjectApp(app: ProjectApp): ProjectApp {
  return app;
}

const projectId = "may-agent";
const appTaskContext =
  "app: /app/projects/may-agent.app\nproject: /app/projects/may-agent";

const taskTreeContext = [
  "projects/may-agent.app/project.json",
  "projects/may-agent.app/tasks/tree.json",
  "projects/may-agent.app/docs/2a-design/project-app-v3.md",
  "projects/may-agent.app/docs/2a-design/events.md",
  "projects/may-agent.app/docs/2a-design/projects.md",
  "projects/may-agent/README.md",
];

function eventData(event: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of ["data", "payload", "params"]) {
    const value = event[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(merged, value);
    }
  }
  return merged;
}

function eventString(event: Record<string, unknown>, key: string): string {
  const data = eventData(event);
  const value = data[key] ?? event[key];
  return typeof value === "string" ? value : "";
}

function eventDetails(event: Record<string, unknown>): Record<string, unknown> {
  return {
    ...eventData(event),
    ...Object.fromEntries(
      Object.entries(event).filter(
        ([key, value]) =>
          !["data", "payload", "params"].includes(key) &&
          value !== undefined &&
          typeof value !== "function",
      ),
    ),
  };
}

function projectPlanningEvent(
  reason: string,
  params: unknown = {},
): Record<string, unknown> {
  return {
    type: "project.planning.requested",
    project: projectId,
    reason,
    params: params && typeof params === "object" ? params : {},
  };
}

function appendDiscussionRecord(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): string | null {
  const text =
    eventString(event, "comment") ||
    eventString(event, "commentText") ||
    eventString(event, "text");
  if (!text.trim()) return null;

  const now = new Date().toISOString();
  const id =
    eventString(event, "id") ||
    `c_${now.replace(/\D/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
  mkdirSync(ctx.appPath(".state"), { recursive: true });
  appendFileSync(
    ctx.appPath(".state/discussion.jsonl"),
    `${JSON.stringify({
      id,
      ts: now,
      author: eventString(event, "author") || "human",
      kind: "comment",
      status: "unread",
      source: typeof event.source === "string" ? event.source : "event",
      text: text.trim(),
    })}\n`,
  );
  return id;
}

async function routeMayAgentEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (event.type === "project.comment.created") {
    const commentId = appendDiscussionRecord(ctx, event);
    return ctx.emit(projectPlanningEvent("project-comment", { commentId }));
  }

  if (event.type === "project.tick") {
    return ctx.emit(
      projectPlanningEvent("scheduled-project-review", eventDetails(event)),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(
      projectPlanningEvent("project-action", eventDetails(event)),
    );
  }

  if (event.type === "metric.alerted" || event.type === "metric.breach") {
    return ctx.emit(projectPlanningEvent("metric-signal", eventDetails(event)));
  }

  if (event.type === "project.planning.requested") {
    return ctx.noop("handled by may-agent-project-planner workflow handler");
  }

  return undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  owner: "may",
  description:
    "May-agent platform app: runtime contracts, event/session/task execution, persistence, SDK, shared web UI, and project-app conventions.",
  workspace: {
    kind: "local",
    localPath: "../may-agent",
  },

  budget: {
    sessionsPerDay: 6,
    tokensPerDay: 300_000,
    maxConcurrent: 2,
  },

  schedules: [
    {
      id: "platform-review",
      enabled: true,
      intervalMs: 3_600_000,
      event: {
        type: "project.tick",
        project: projectId,
        lane: "platform-review",
      },
    },
  ],

  workflowHandlers: [
    {
      name: "may-agent-project-planner",
      type: "job",
      enabled: true,
      description:
        "Wakes May to review the May-agent task tree, platform signals, and project-app design work.",
      on: ["project.planning.requested"],
      handler: {
        workflow: "verify-wrap",
        includeEvent: true,
        task: [
          appTaskContext,
          "",
          "You are the May-agent project owner. Review the trigger event, project.json, and tasks/tree.json.",
          "Update the task tree or project artifacts when useful, keep the May-agent platform moving, and verify any code/doc change before claiming completion.",
        ].join("\n"),
        timeoutMs: 1_800_000,
      },
      context: taskTreeContext,
    },
  ],

  events: [
    { type: "project.comment.created", project: projectId },
    { type: "project.tick", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "project.planning.requested", project: projectId },
    {
      type: "metric.alerted",
      metricIds: [
        "handler.success-rate",
        "capability.session-trace-completeness",
        "v2.spec-coverage-rate",
      ],
    },
    {
      type: "metric.breach",
      metricIds: [
        "handler.success-rate",
        "capability.session-trace-completeness",
        "v2.spec-coverage-rate",
      ],
    },
  ],

  eventGraph: {
    handlers: {
      "may-agent-project-planner": {
        emits: ["project.reviewed"],
        description:
          "May reviews platform project state and updates task tree, docs, or code when useful.",
      },
    },
    adapters: [
      {
        event: "project.comment.created",
        emits: ["project.planning.requested"],
        description: "Human steering wakes May-agent project planning.",
      },
      {
        event: "project.tick",
        emits: ["project.planning.requested"],
        description: "Scheduled platform review wakes planning.",
      },
      {
        event: "project.action.invoked",
        emits: ["project.planning.requested"],
        description: "UI/API action wakes planning.",
      },
      {
        event: "metric.alerted",
        emits: ["project.planning.requested"],
        description: "Platform metric alert wakes May to inspect and react.",
      },
      {
        event: "metric.breach",
        emits: ["project.planning.requested"],
        description: "Platform metric breach wakes May to inspect and react.",
      },
    ],
    externalEvents: ["project.reviewed"],
    intentionalCycles: [
      {
        id: "human-or-timer-to-platform-review",
        events: ["project.tick", "project.planning.requested"],
        reason:
          "Timer and human events periodically wake May to maintain the May-agent platform project.",
      },
    ],
  },

  actions: {
    "advance-project": {
      type: "async",
      description:
        "Ask May to review and advance the May-agent platform project.",
      event(params) {
        return projectPlanningEvent("manual-advance", params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routeMayAgentEvent(ctx, event);
  },
});
