import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

const projectId = "scout-knowledge-lib";
const appTaskContext =
  "app: /app/projects/scout-knowledge-lib.app\nproject: /app/projects/scout-knowledge-lib\npersistent-task: skip";

const taskTreeContext = [
  "projects/scout-knowledge-lib.app/project.json",
  "projects/scout-knowledge-lib.app/.state/tasks/tree.json",
  "projects/scout-knowledge-lib/knowledge/INDEX.md",
  "shared/knowledge/INDEX.md",
];

const scoutContext = [
  "projects/scout-knowledge-lib.app/agents/scout/heartbeat.md",
  "projects/scout-knowledge-lib.app/project.json",
];

function eventParams(params: unknown): Record<string, unknown> {
  return params && typeof params === "object" && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {};
}

function ownerRequested(reason: string, params: unknown = {}): ProjectAppEvent {
  return {
    type: "project.owner.requested",
    project: projectId,
    reason,
    params: eventParams(params),
  };
}

const scoutSources = new Set(["arxiv", "hn", "xhs", "github"]);

export function resolveScoutTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const details = eventDetails(event);
  switch (event.type) {
    case "scout.explore": {
      const source = String(
        details.researchSource ?? details.source ?? event.source ?? "",
      ).toLowerCase();
      if (!scoutSources.has(source)) return null;
      return {
        id: `explore-${source}`,
        parentId: "ongoing-research",
        outcome: `Continuously explore ${source} for source-grounded AI-agent signals and integrate useful findings into the Scout knowledge library.`,
        acceptance: [
          "The source is checked without simulated data and useful findings update an existing note or a source-grounded finding.",
        ],
        mode: "maintain",
        workflow: "scout-explore",
        input: { ...details, source },
        priority: source === "xhs" ? "P2" : "P1",
      };
    }
    case "scout.digest":
      return {
        id: "daily-digest",
        parentId: "ongoing-research",
        outcome:
          "Keep the daily Scout digest delivered and its working accumulator bounded.",
        acceptance: [
          "Current findings are delivered and archived, or the workflow records that there are no findings to send.",
        ],
        mode: "maintain",
        workflow: "scout-daily-digest",
        input: details,
        priority: "P1",
      };
    case "scout.heartbeat":
      return {
        id: "cross-source-synthesis",
        parentId: "ongoing-research",
        outcome:
          "Continuously connect source-grounded patterns across arXiv, HN, XHS, and GitHub into reusable knowledge.",
        acceptance: [
          "The workflow records a useful synthesis or a justified no-op without duplicating routine source exploration.",
        ],
        mode: "maintain",
        workflow: "scout-heartbeat",
        input: details,
        priority: "P2",
      };
    case "project.library_health.tick":
      return {
        id: "runtime/library-health-observer",
        parentId: "library-maintenance",
        outcome:
          "Keep a deterministic observation of the Scout library shape and wake its owner only for meaningful maintenance signals.",
        acceptance: [
          "A current library-health packet is recorded and meaningful signals produce one owner wake.",
        ],
        mode: "maintain",
        workflow: "library-health",
        input: details,
        priority: "P1",
      };
    case "project.owner.requested":
      return {
        id: "library-maintenance",
        parentId: "project",
        outcome:
          "Keep the Scout knowledge library coherent, source-grounded, navigable, and organized around its most useful next maintenance step.",
        acceptance: [
          "Scout performs one useful maintenance step or records an evidence-backed no-op without creating duplicate project work.",
        ],
        mode: "maintain",
        input: details,
        priority: "P1",
      };
    default:
      return null;
  }
}

async function routeScoutEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
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
      emits: [
        {
          type: "scout.heartbeat",
          project: projectId,
        },
      ],
    },
    {
      id: "owner-heartbeat",
      enabled: true,
      intervalMs: 14_400_000,
      emits: [
        ownerRequested("owner-heartbeat", {
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
      ],
    },
    {
      id: "scout-explore-arxiv",
      enabled: true,
      intervalMs: 14_400_000, // 4h
      emits: [
        {
          type: "scout.explore",
          project: projectId,
          source: "arxiv",
        },
      ],
    },
    {
      id: "scout-explore-hn",
      enabled: true,
      intervalMs: 3_600_000, // 1h
      emits: [
        {
          type: "scout.explore",
          project: projectId,
          source: "hn",
        },
      ],
    },
    {
      id: "scout-explore-xhs",
      enabled: true,
      intervalMs: 3_600_000, // 1h
      emits: [
        {
          type: "scout.explore",
          project: projectId,
          source: "xhs",
        },
      ],
    },
    {
      id: "scout-explore-github",
      enabled: true,
      intervalMs: 3_600_000, // 1h
      emits: [
        {
          type: "scout.explore",
          project: projectId,
          source: "github",
        },
      ],
    },
    {
      id: "scout-daily-digest",
      enabled: true,
      intervalMs: 86_400_000, // 24h
      emits: [
        {
          type: "scout.digest",
          project: projectId,
        },
      ],
    },
    {
      id: "library-health",
      enabled: true,
      intervalMs: 21_600_000, // 6h
      emits: [
        {
          type: "project.library_health.tick",
          project: projectId,
        },
      ],
    },
  ],

  ownerEntry: {
    workflow: "knowledge-planner",
    task: `${appTaskContext}\nReview the reconciled Scout library-maintenance responsibility and perform the smallest useful owner step.`,
    timeoutMs: 1_800_000,
    context: taskTreeContext,
  },

  taskWorkflows: {
    "scout-heartbeat": {
      workflow: "scout-heartbeat",
      agent: "scout",
      task: `${appTaskContext}\n[heartbeat] Synthesize useful cross-source knowledge without duplicating routine exploration.`,
      timeoutMs: 1_800_000,
      context: scoutContext,
    },
    "scout-explore": {
      workflow: "scout-explore",
      agent: "scout",
      task: `${appTaskContext}\nExplore the source named by the reconciliation input and update the Scout knowledge library when useful.`,
      timeoutMs: 1_200_000,
      context: scoutContext,
    },
    "scout-daily-digest": {
      workflow: "scout-daily-digest",
      agent: "scout",
      task: `${appTaskContext}\nCompile today's research digest and send it to Hao when there are findings.`,
      timeoutMs: 300_000,
      context: scoutContext,
    },
    "library-health": {
      workflow: "library-health",
      task: [
        appTaskContext,
        "sharedKnowledge: /app/shared/knowledge",
        "",
        "Build and record a deterministic library-health packet.",
        "Do not make content decisions here; wake Scout only when the packet contains signals that need owner judgment.",
      ].join("\n"),
      timeoutMs: 120_000,
      context: taskTreeContext,
    },
  },

  taskRoutes: [
    {
      name: "scout-task-heartbeat",
      enabled: true,
      maxConcurrentTriggers: 1,
      description: "Reconciles the standing cross-source synthesis task.",
      accepts: ["scout.heartbeat"],
      resolve: resolveScoutTask,
    },
    {
      name: "scout-task-explore",
      enabled: true,
      maxConcurrentTriggers: 2,
      description:
        "Reconciles one independent standing source-exploration task.",
      accepts: ["scout.explore"],
      resolve: resolveScoutTask,
    },
    {
      name: "scout-task-digest",
      enabled: true,
      maxConcurrentTriggers: 1,
      description: "Reconciles the standing daily digest task.",
      accepts: ["scout.digest"],
      resolve: resolveScoutTask,
    },
    {
      name: "scout-task-library-health",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Reconciles the deterministic standing library-health observer.",
      accepts: ["project.library_health.tick"],
      resolve: resolveScoutTask,
    },
    {
      name: "scout-task-owner",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Routes Scout library-maintenance exceptions through the accountable owner entry.",
      accepts: ["project.owner.requested"],
      resolve: resolveScoutTask,
    },
  ],

  events: [
    { type: "project.comment.created", project: projectId },
    { type: "project.tick", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "metric.breach", metricIds: ["scout.knowledge-preamble-coverage"] },
  ],

  eventGraph: {
    routes: {
      "scout-task-heartbeat": {
        emits: ["project.knowledge.maintained", "project.task.reconciled"],
        description: "Scout creative session — synthesizes across sources.",
      },
      "scout-task-explore": {
        emits: ["project.knowledge.maintained", "project.task.reconciled"],
        description:
          "Routine discovery from arXiv, HN, XHS, or GitHub. Writes findings to knowledge/.",
      },
      "scout-task-digest": {
        emits: ["project.task.reconciled"],
        description:
          "Compiles daily digest from workspace/digest/today.md and sends to human.",
      },
      "scout-task-owner": {
        emits: ["project.knowledge.maintained", "project.task.reconciled"],
        description:
          "Reviews library task tree and updates the knowledge workspace.",
      },
      "scout-task-library-health": {
        emits: [
          "project.library_health.observed",
          "project.owner.requested",
          "project.task.reconciled",
        ],
        description:
          "Observes library shape and wakes Scout for meaningful maintenance signals.",
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
    externalEvents: [
      "project.knowledge.maintained",
      "project.library_health.observed",
      "handler.workflow_dispatched",
      "project.task.reconcile.started",
      "project.task.reconcile.skipped",
      "project.task.handler.unavailable",
      "project.task.reconciled",
    ],
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
    "health-check": {
      type: "async",
      description:
        "Run the deterministic library-health observer and wake Scout if maintenance signals are found.",
      event(params) {
        return {
          type: "project.library_health.tick",
          project: projectId,
          params: eventParams(params),
        };
      },
    },
    "explore-now": {
      type: "async",
      description:
        "Trigger a scout exploration for a specific source (arxiv, hn, xhs, github).",
      event(params) {
        const source =
          params && typeof params === "object" && "source" in params
            ? String((params as Record<string, unknown>).source ?? "arxiv")
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
