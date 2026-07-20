import {
  defineProjectApp,
  eventDetails,
  Type,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";
import { observeXhsCredential } from "./watchers/xhs-credential.js";

const projectId = "scout-knowledge-lib";
const appDir = "/app/projects/scout-knowledge-lib.app";
const projectDir = "/app/projects/scout-knowledge-lib";
const actionInputSchema = Type.Object({}, { additionalProperties: true });

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
const ownerReviewReasons = new Set([
  "experience-review",
  "library-health-signal",
  "project-comment",
  "manual-library-review",
  "repair-index",
]);

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
          "The current source is checked without simulated data; useful findings update an existing note or a source-grounded finding, otherwise the workflow records an evidence-backed no-op.",
        ],
        mode: "maintain",
        workflow: "scout-explore",
        input: { source },
        outputs: [
          `${projectDir}/knowledge`,
          `${appDir}/agents/scout/workspace/digest/today.md`,
        ],
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
        outputs: [`${appDir}/agents/scout/workspace/digest`],
        priority: "P1",
      };
    case "project.library_health.tick":
      return {
        id: "runtime/library-health-observer",
        parentId: "library-operations",
        outcome:
          "Keep a deterministic observation of the Scout library shape and wake its owner only for meaningful maintenance signals.",
        acceptance: [
          "A current library-health packet is recorded and meaningful signals produce one owner wake.",
        ],
        mode: "maintain",
        workflow: "library-health",
        outputs: [`${appDir}/.state/library-health-packets.jsonl`],
        priority: "P1",
      };
    case "project.comment.created":
    case "project.owner.requested": {
      const reason = String(details.reason ?? "");
      if (
        event.type === "project.owner.requested" &&
        !ownerReviewReasons.has(reason)
      )
        return null;
      return {
        id: "library-maintenance",
        parentId: "library-operations",
        outcome:
          "Keep the Scout knowledge library coherent, source-grounded, navigable, and organized around its most useful next maintenance step.",
        acceptance: [
          "Scout performs one useful maintenance step or records an evidence-backed no-op without creating duplicate project work.",
        ],
        mode: "maintain",
        workflow: "knowledge-planner",
        outputs: [
          `${projectDir}/knowledge`,
          `${projectDir}/reports`,
          `${appDir}/agents/scout/workspace/digest/today.md`,
        ],
        priority: "P1",
      };
    }
    default:
      return null;
  }
}

async function routeScoutEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (event.type === "project.xhs_credential.check") {
    return observeXhsCredential(ctx);
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
    // All source lanes share one knowledge tree and one digest accumulator.
    maxConcurrent: 1,
  },

  schedules: [
    {
      id: "owner-review",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        ownerRequested("experience-review", {
          instruction:
            "Daily knowledge-library owner review: inspect current library needs and the bounded reconciliation-history packet. Choose ordinary maintenance, at most one finite process improvement or investigation task, or an evidence-backed no-op. Do not create standalone projects.",
          reviewChecklist: [
            "When useful, read recent findings, connect sources, identify one non-obvious implication, update canonical knowledge, and verify the output. Synthesis is optional; do not manufacture it.",
            "Look for stale or duplicate findings, missing index coverage, and knowledge entries that need rollup.",
            "Look for exact repeated failures, owner handoffs, or evidence-backed no-ops that may justify one reusable improvement.",
            "Check the current tree before proposing work and do not duplicate a live task.",
            "No-op is valid when existing exploration and maintenance tasks already cover the useful next work.",
          ],
        }),
      ],
    },
    {
      id: "xhs-credential-watcher",
      enabled: true,
      intervalMs: 300_000,
      emits: [
        {
          type: "project.xhs_credential.check",
          project: projectId,
        },
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
      intervalMs: 7_200_000, // 2h
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
      intervalMs: 14_400_000, // 4h
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
      intervalMs: 7_200_000, // 2h
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
      { type: "scout.explore", project: projectId },
      { type: "scout.digest", project: projectId },
      { type: "project.library_health.tick", project: projectId },
      { type: "project.owner.requested", project: projectId },
      { type: "project.comment.created", project: projectId },
    ],
    resolve: resolveScoutTask,
  },

  events: [{ type: "project.xhs_credential.check", project: projectId }],

  actions: {
    "review-library": {
      type: "async",
      description:
        "Ask Scout to review the knowledge library and update it if useful.",
      inputSchema: actionInputSchema,
      event(params) {
        return ownerRequested("manual-library-review", params);
      },
    },
    "repair-index": {
      type: "async",
      description:
        "Ask Scout to repair knowledge/INDEX.md and related navigation.",
      inputSchema: actionInputSchema,
      event(params) {
        return ownerRequested("repair-index", params);
      },
    },
    "health-check": {
      type: "async",
      description:
        "Run the deterministic library-health observer and wake Scout if maintenance signals are found.",
      inputSchema: actionInputSchema,
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
      inputSchema: Type.Object(
        {
          source: Type.Optional(
            Type.Union([
              Type.Literal("arxiv"),
              Type.Literal("hn"),
              Type.Literal("xhs"),
              Type.Literal("github"),
            ]),
          ),
        },
        { additionalProperties: false },
      ),
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
