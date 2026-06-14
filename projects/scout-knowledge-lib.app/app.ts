import {
  defineProjectApp,
  eventDetails,
  projectOwnerEvent as sdkProjectOwnerEvent,
  type ProjectAppContext,
} from "@may-agent/sdk";

const projectId = "scout-knowledge-lib";
const appTaskContext =
  "app: /app/projects/scout-knowledge-lib.app\nproject: /app/projects/scout-knowledge-lib";

const taskTreeContext = [
  "projects/scout-knowledge-lib.app/project.json",
  "projects/scout-knowledge-lib.app/tasks/tree.json",
  "projects/scout-knowledge-lib.app/tasks/README.md",
  "projects/scout-knowledge-lib/README.md",
  "projects/scout-knowledge-lib/knowledge/INDEX.md",
];

function projectOwnerEvent(
  reason: string,
  params: unknown = {},
): Record<string, unknown> {
  return sdkProjectOwnerEvent(projectId, reason, params);
}

async function routeScoutKnowledgeEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (event.type === "project.comment.created") {
    return ctx.emit(projectOwnerEvent("project-comment", eventDetails(event)));
  }

  if (event.type === "project.tick") {
    return ctx.emit(
      projectOwnerEvent("scheduled-library-maintenance", eventDetails(event)),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(projectOwnerEvent("project-action", eventDetails(event)));
  }

  if (event.type === "metric.breach") {
    return ctx.emit(projectOwnerEvent("metric-breach", eventDetails(event)));
  }

  if (
    event.type === "project.owner.requested" ||
    event.type === "project.planning.requested"
  ) {
    return ctx.noop("handled by scout-knowledge-lib owner workflow handler");
  }

  if (event.type === "project.knowledge.maintained") {
    return ctx.noop("external event emitted by knowledge-planner workflow");
  }

  return undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  owner: "scout",
  description:
    "Scout knowledge library maintenance app: index health, dedupe, synthesis quality, and source-grounded reusable notes.",
  workspace: {
    kind: "local",
    localPath: "../scout-knowledge-lib",
  },

  budget: {
    sessionsPerDay: 4,
    tokensPerDay: 160_000,
    maxConcurrent: 1,
  },

  schedules: [
    {
      id: "library-maintenance",
      enabled: true,
      intervalMs: 21_600_000,
      event: {
        type: "project.tick",
        project: projectId,
        lane: "library-maintenance",
      },
    },
  ],

  workflowHandlers: [
    {
      name: "scout-knowledge-lib-planner",
      type: "job",
      enabled: true,
      description:
        "Wakes Scout as project owner to review the knowledge-library task tree and perform the smallest useful maintenance step.",
      on: ["project.owner.requested", "project.planning.requested"],
      handler: {
        workflow: "knowledge-planner",
        includeEvent: true,
        task: appTaskContext,
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
    { type: "metric.breach", metricIds: ["scout.knowledge-preamble-coverage"] },
  ],

  eventGraph: {
    handlers: {
      "scout-knowledge-lib-planner": {
        emits: ["project.knowledge.maintained"],
        description:
          "Scout reviews the library task tree and updates the knowledge workspace when useful.",
      },
    },
    adapters: [
      {
        event: "project.comment.created",
        emits: ["project.owner.requested"],
        description: "Human steering wakes the Scout knowledge-library owner.",
      },
      {
        event: "project.tick",
        emits: ["project.owner.requested"],
        description: "Scheduled library maintenance wakes the owner.",
      },
      {
        event: "project.action.invoked",
        emits: ["project.owner.requested"],
        description: "UI/API action wakes the owner.",
      },
      {
        event: "metric.breach",
        emits: ["project.owner.requested"],
        description:
          "Knowledge-library metric breach wakes Scout to inspect and repair.",
      },
    ],
    externalEvents: ["project.knowledge.maintained"],
    intentionalCycles: [
      {
        id: "human-or-timer-to-library-maintenance",
        events: ["project.tick", "project.owner.requested"],
        reason:
          "Timer and human events periodically wake Scout to maintain the library.",
      },
    ],
  },

  actions: {
    "review-library": {
      type: "async",
      description:
        "Ask Scout to review the knowledge library and update it if useful.",
      event(params) {
        return projectOwnerEvent("manual-library-review", params);
      },
    },
    "repair-index": {
      type: "async",
      description:
        "Ask Scout to repair knowledge/INDEX.md and related navigation.",
      event(params) {
        return projectOwnerEvent("repair-index", params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routeScoutKnowledgeEvent(ctx, event);
  },
});
