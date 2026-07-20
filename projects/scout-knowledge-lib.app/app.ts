import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

const projectId = "scout-knowledge-lib";

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
        input: { source },
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
        workflow: "knowledge-planner",
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

  tasks: {
    accepts: [
      { type: "scout.heartbeat", project: projectId },
      { type: "scout.explore", project: projectId },
      { type: "scout.digest", project: projectId },
      { type: "project.library_health.tick", project: projectId },
      { type: "project.owner.requested", project: projectId },
    ],
    resolve: resolveScoutTask,
  },

  events: [
    { type: "project.comment.created", project: projectId },
    { type: "project.tick", project: projectId },
    { type: "metric.breach", metricIds: ["scout.knowledge-preamble-coverage"] },
  ],

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
