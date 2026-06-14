import { appendFileSync, mkdirSync } from "node:fs";
import {
  defineProjectApp,
  eventDetails,
  eventString,
  projectOwnerEvent as sdkProjectOwnerEvent,
  type ProjectAppContext,
} from "@may-agent/sdk";

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

function projectOwnerEvent(
  reason: string,
  params: unknown = {},
): Record<string, unknown> {
  return sdkProjectOwnerEvent(projectId, reason, params);
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
    return ctx.emit(projectOwnerEvent("project-comment", { commentId }));
  }

  if (event.type === "project.tick") {
    return ctx.emit(
      projectOwnerEvent("scheduled-project-review", eventDetails(event)),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(projectOwnerEvent("project-action", eventDetails(event)));
  }

  if (
    event.type === "metric.alerted" ||
    event.type === "metric.breach" ||
    event.type === "metric.stalled" ||
    event.type === "metric.recovered"
  ) {
    return ctx.emit(projectOwnerEvent("metric-signal", eventDetails(event)));
  }

  if (event.type === "project.tasks.ready") {
    return ctx.emit(
      projectOwnerEvent("ready-tasks-available", eventDetails(event)),
    );
  }

  if (
    event.type === "project.owner.requested" ||
    event.type === "project.planning.requested"
  ) {
    return ctx.noop("handled by may-agent owner workflow handler");
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
        "Wakes May as project owner to review the task tree, platform signals, and project-app design work.",
      on: ["project.owner.requested", "project.planning.requested"],
      handler: {
        workflow: "platform-owner-review",
        includeEvent: true,
        task: [
          appTaskContext,
          "persistent-task: skip",
          "",
          "You are entering the may-agent.app local owner-review workflow. It will build a platform system-review packet before waking May.",
          "",
          "Before claiming the platform is healthy, build a compact system-review packet from live evidence:",
          "- open metric alerts and recent metric judgments/recoveries",
          "- recent handler.failed, session.resume_failed, subscriber.failed, message.delivery_failed, and agent.config_invalid events",
          "- stale project DB rows versus project.json/task-tree state",
          "- task-tree runnable/active/review/blocked state",
          "- evaluator findings or human messages about shallow/misleading platform claims",
          "- app integrity checks that are relevant to the triggered branch",
          "",
          "The local workflow owns packet collection; May owns judgment, task-tree updates, fixes, verification, and escalation.",
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
    { type: "project.owner.requested", project: projectId },
    { type: "project.planning.requested", project: projectId },
    { type: "project.tasks.ready", project: projectId },
    { type: "metric.alerted" },
    { type: "metric.breach" },
    { type: "metric.stalled" },
    { type: "metric.recovered" },
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
        emits: ["project.owner.requested"],
        description: "Human steering wakes the May-agent project owner.",
      },
      {
        event: "project.tick",
        emits: ["project.owner.requested"],
        description: "Scheduled platform review wakes the owner.",
      },
      {
        event: "project.action.invoked",
        emits: ["project.owner.requested"],
        description: "UI/API action wakes the owner.",
      },
      {
        event: "metric.alerted",
        emits: ["project.owner.requested"],
        description: "Platform metric alert wakes May to inspect and react.",
      },
      {
        event: "metric.breach",
        emits: ["project.owner.requested"],
        description: "Platform metric breach wakes May to inspect and react.",
      },
      {
        event: "metric.stalled",
        emits: ["project.owner.requested"],
        description: "Platform metric stall wakes May to inspect and react.",
      },
      {
        event: "metric.recovered",
        emits: ["project.owner.requested"],
        description:
          "Platform metric recovery wakes May to close stale context or update task state.",
      },
      {
        event: "project.tasks.ready",
        emits: ["project.owner.requested"],
        description:
          "Reconciler signals ready task leaves; owner wakes to assign or advance them.",
      },
    ],
    externalEvents: ["project.reviewed"],
    intentionalCycles: [
      {
        id: "human-or-timer-to-platform-review",
        events: ["project.tick", "project.owner.requested"],
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
        return projectOwnerEvent("manual-advance", params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routeMayAgentEvent(ctx, event);
  },
});
