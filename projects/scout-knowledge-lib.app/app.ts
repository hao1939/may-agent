import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
} from "@may-agent/sdk";

const projectId = "scout-knowledge-lib";
const appTaskContext =
  "app: /app/projects/scout-knowledge-lib.app\nproject: /app/projects/scout-knowledge-lib\npersistent-task: skip";

const taskTreeContext = [
  "projects/scout-knowledge-lib.app/project.json",
  "projects/scout-knowledge-lib.app/tasks/tree.json",
  "projects/scout-knowledge-lib/knowledge/INDEX.md",
];

const scoutContext = [
  "projects/scout-knowledge-lib.app/agents/scout/heartbeat.md",
  "projects/scout-knowledge-lib.app/project.json",
];

function ownerRequested(
  reason: string,
  params: unknown = {},
): Record<string, unknown> {
  return {
    type: "project.owner.requested",
    project: projectId,
    reason,
    params:
      params && typeof params === "object" && !Array.isArray(params)
        ? (params as Record<string, unknown>)
        : {},
  };
}

async function routeScoutEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  // Workflow-handled events — noop in onEvent, cron dispatches them
  if (
    event.type === "scout.heartbeat" ||
    event.type === "scout.explore" ||
    event.type === "scout.digest" ||
    event.type === "project.owner.requested" ||
    event.type === "project.planning.requested"
  ) {
    return ctx.noop(`${event.type} is handled by workflowHandlers`);
  }

  if (event.type === "project.comment.created") {
    return ctx.emit(ownerRequested("project-comment", eventDetails(event)));
  }

  if (event.type === "project.tick") {
    return ctx.emit(
      ownerRequested("scheduled-library-maintenance", eventDetails(event)),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(ownerRequested("project-action", eventDetails(event)));
  }

  if (event.type === "metric.breach") {
    return ctx.emit(ownerRequested("metric-breach", eventDetails(event)));
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
    "Scout research and knowledge app: discovers AI trends from arXiv, HN, XHS, GitHub; synthesizes findings into a source-grounded knowledge library; delivers daily digests.",
  workspace: {
    kind: "local",
    localPath: "../scout-knowledge-lib",
  },

  budget: {
    sessionsPerDay: 50,
    tokensPerDay: 800_000,
    maxConcurrent: 2,
  },

  schedules: [
    {
      id: "scout-heartbeat",
      enabled: false, // disabled 2026-06-14: app-driven model replaces blind heartbeat. Cross-source synthesis becomes a task, not a timer.
      intervalMs: 1_800_000, // 30min
      event: {
        type: "scout.heartbeat",
        project: projectId,
      },
    },
    {
      id: "owner-heartbeat",
      enabled: true,
      intervalMs: 14_400_000,
      event: ownerRequested("owner-heartbeat", {
        instruction:
          "Low-frequency knowledge-library owner heartbeat: look for missed synthesis, library-shape, source-coverage, or stale-assumption issues that routine source exploration and digest schedules did not catch. Check recent heartbeat/explore/digest findings before creating work. Prefer one to three task-tree actions or no-op with reason; do not create standalone projects.",
        reviewChecklist: [
          "Look for cross-source connections that should become library tasks, not ad hoc notes.",
          "Look for stale or duplicate findings, missing index coverage, and knowledge entries that need rollup.",
          "Look for source schedules that are producing noise or leaving useful gaps.",
          "Avoid duplicate heartbeat tasks by inspecting recent owner-review findings first.",
          "No-op is valid when existing exploration and maintenance tasks already cover the useful next work.",
        ],
      }),
    },
    {
      id: "scout-explore-arxiv",
      enabled: true,
      intervalMs: 14_400_000, // 4h
      event: {
        type: "scout.explore",
        project: projectId,
        source: "arxiv",
      },
    },
    {
      id: "scout-explore-hn",
      enabled: true,
      intervalMs: 3_600_000, // 1h
      event: {
        type: "scout.explore",
        project: projectId,
        source: "hn",
      },
    },
    {
      id: "scout-explore-xhs",
      enabled: true,
      intervalMs: 3_600_000, // 1h
      event: {
        type: "scout.explore",
        project: projectId,
        source: "xhs",
      },
    },
    {
      id: "scout-explore-github",
      enabled: true,
      intervalMs: 3_600_000, // 1h
      event: {
        type: "scout.explore",
        project: projectId,
        source: "github",
      },
    },
    {
      id: "scout-daily-digest",
      enabled: true,
      intervalMs: 86_400_000, // 24h
      event: {
        type: "scout.digest",
        project: projectId,
      },
    },
  ],

  workflowHandlers: [
    {
      name: "scout-heartbeat",
      type: "job",
      enabled: true,
      description: "Scout creative heartbeat — synthesize, connect, discover.",
      on: ["scout.heartbeat"],
      handler: {
        workflow: "scout-heartbeat",
        agent: "scout",
        includeEvent: true,
        task: `${appTaskContext}\n[heartbeat] You are scout. Read your heartbeat.md and do your work.`,
        timeoutMs: 1_800_000,
      },
      context: scoutContext,
    },
    {
      name: "scout-explore",
      type: "job",
      enabled: true,
      maxConcurrentTriggers: 2,
      description:
        "Scout routine discovery — explore a source (arXiv, HN, XHS, GitHub) for new findings.",
      on: ["scout.explore"],
      handler: {
        workflow: "scout-explore",
        agent: "scout",
        includeEvent: true,
        task: appTaskContext,
        timeoutMs: 1_200_000,
      },
      context: scoutContext,
    },
    {
      name: "scout-daily-digest",
      type: "job",
      enabled: true,
      description:
        "Scout daily digest — compile findings and send to human via Telegram.",
      on: ["scout.digest"],
      handler: {
        workflow: "scout-daily-digest",
        agent: "scout",
        includeEvent: true,
        task: `${appTaskContext}\nCompile today's research digest and send to Hao.`,
        timeoutMs: 300_000,
      },
      context: scoutContext,
    },
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
    "scout.heartbeat",
    "scout.explore",
    "scout.digest",
    { type: "project.comment.created", project: projectId },
    { type: "project.tick", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "project.owner.requested", project: projectId },
    { type: "project.planning.requested", project: projectId },
    { type: "metric.breach", metricIds: ["scout.knowledge-preamble-coverage"] },
  ],

  eventGraph: {
    handlers: {
      "scout-heartbeat": {
        emits: ["project.knowledge.maintained"],
        description: "Scout creative session — synthesizes across sources.",
      },
      "scout-explore": {
        emits: ["project.knowledge.maintained"],
        description:
          "Routine discovery from arXiv, HN, XHS, or GitHub. Writes findings to knowledge/.",
      },
      "scout-daily-digest": {
        emits: [],
        description:
          "Compiles daily digest from workspace/digest/today.md and sends to human.",
      },
      "scout-knowledge-lib-planner": {
        emits: ["project.knowledge.maintained"],
        description:
          "Reviews library task tree and updates the knowledge workspace.",
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
        id: "scout-continuous-research",
        events: ["scout.heartbeat", "scout.explore", "scout.digest"],
        reason:
          "Scout continuously explores sources and synthesizes findings. There is always new knowledge to discover.",
      },
    ],
  },

  actions: {
    "review-library": {
      type: "async",
      description:
        "Ask Scout to review the knowledge library and update it if useful.",
      event(params) {
        return ownerRequested("manual-library-review", params);
      },
    },
    "repair-index": {
      type: "async",
      description:
        "Ask Scout to repair knowledge/INDEX.md and related navigation.",
      event(params) {
        return ownerRequested("repair-index", params);
      },
    },
    "explore-now": {
      type: "async",
      description:
        "Trigger a scout exploration for a specific source (arxiv, hn, xhs, github).",
      event(params) {
        const source =
          params && typeof params === "object" && "source" in params
            ? (params as Record<string, unknown>).source
            : "arxiv";
        return {
          type: "scout.explore",
          project: projectId,
          source,
        };
      },
    },
  },

  async onEvent(ctx, event) {
    return routeScoutEvent(ctx, event);
  },
});
