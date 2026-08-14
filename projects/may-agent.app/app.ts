import {
  defineProjectApp,
  eventDetails,
  eventString,
  Type,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk/legacy";

const projectId = "may-agent";
const projectOwnerAgent = "tech-lead";
const actionInputSchema = Type.Object({}, { additionalProperties: true });

const DAY_MS = 86_400_000;

/** Stable task resource every owner review (scheduled or reactive) routes to. */
export const OWNER_REVIEW_TASK_ID = "runtime/platform-owner-review";

/** Total owner sessions available per day. */
export const OWNER_SESSIONS_PER_DAY = Infinity;

/** Owner sessions/day reserved for reactive event-owner reviews. */
export const RESERVED_REACTIVE_SESSIONS_PER_DAY = 2;

export const PLATFORM_REVIEW_INTERVAL_MS = 28_800_000; // 8h
export const OWNER_HEARTBEAT_INTERVAL_MS = 86_400_000; // 24h

/** Owner sessions/day booked in advance by schedules. */
export const SCHEDULED_OWNER_SESSIONS_PER_DAY =
  DAY_MS / PLATFORM_REVIEW_INTERVAL_MS + DAY_MS / OWNER_HEARTBEAT_INTERVAL_MS;

function ownerRequested(reason: string, params: unknown = {}): ProjectAppEvent {
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

export function resolveMayAgentTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  switch (event.type) {
    case "project.ops_digest.tick":
      return {
        id: "runtime/daily-ops-digest",
        parentId: "ops-health",
        outcome:
          "Keep a current deterministic daily platform alert digest, notify the human, and request owner judgment only for actionable conditions.",
        acceptance: [
          "A current digest is recorded and delivered, with any actionable open, noisy, or ownerless condition routed to the platform owner.",
        ],
        mode: "maintain",
        workflow: "daily-ops-digest",
        priority: "P1",
      };
    case "project.ops_health.tick":
      return {
        id: "runtime/ops-health-observer",
        parentId: "ops-health",
        outcome:
          "Keep a deterministic observation of platform operational health and request owner judgment only for meaningful signals.",
        acceptance: [
          "A current ops-health packet is recorded and meaningful signals produce one owner request without making owner judgments in the observer.",
        ],
        mode: "maintain",
        workflow: "ops-health-review",
        priority: "P1",
      };
    case "may-agent.resource-migration.requested":
      return {
        id: "runtime/unified-resource-migration-v1",
        parentId: "project",
        outcome:
          "Retire the fixed set of pre-contract May Agent task resources whose outcomes are now implemented or superseded.",
        acceptance: [
          "Only the named version-1 legacy resources are closed, dependent work before its dependency, and every closure leaves a completion receipt.",
          "The unresolved evidence-archive secret-redaction task remains live until its archive-wide guarantee is proven.",
        ],
        mode: "achieve",
        workflow: "unified-resource-migration",
        input: { migration: "unified-resource-v1" },
        priority: "P0",
      };
    case "project.comment.created":
    case "project.owner.requested":
      return {
        id: "runtime/platform-owner-review",
        parentId: "platform-system-review-feedback-loop",
        outcome:
          "Keep platform state reviewed by its accountable owner and organize the smallest useful follow-up from current evidence.",
        acceptance: [
          "The owner performs one useful platform step or records an evidence-backed no-op, with task-tree changes proposed as typed actions.",
        ],
        mode: "maintain",
        workflow: "platform-owner-review",
        priority: "P1",
      };
    default:
      return null;
  }
}

export async function routePlatformEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (event.type === "project.tick") {
    return ctx.emit(
      ownerRequested("scheduled-project-review", eventDetails(event)),
    );
  }

  if (
    event.type === "metric.breach" ||
    event.type === "metric.stalled" ||
    event.type === "metric.recovered"
  ) {
    // Only wake the platform owner for platform-owned metrics.
    // Project-specific metrics (e.g. aks-rp-e2e.task.*) are owned by their
    // respective project apps and should not trigger a full platform review.
    // Accept legacy May-owned platform metrics during migration, but the wake
    // still routes to this app owner (tech-lead).
    const metricOwner = eventString(event, "owner");
    const platformMetricOwners = new Set([
      projectOwnerAgent,
      `agent:${projectOwnerAgent}`,
      "may",
      "agent:may",
    ]);
    if (metricOwner && !platformMetricOwners.has(metricOwner)) {
      return ctx.noop(
        `metric owned by ${metricOwner}, not platform — skipping owner wake`,
      );
    }

    // metric.recovered is informational — the problem resolved itself.
    // Don't spend session budget on a wake; the next scheduled project.tick
    // (8h interval) naturally captures the recovered state.
    // Without this guard, breach→review→recover→review loops consume the
    // entire 6-sessions/day budget for no actionable work.
    if (event.type === "metric.recovered") {
      return ctx.noop(
        "metric recovered — informational, captured in next scheduled review",
      );
    }

    // Deferred metrics: breaches for these IDs do NOT trigger an immediate
    // owner wake; they are captured by the scheduled project.tick (8h).
    //
    // Retention rule (platform-local invariant only): a metric may be deferred
    // only when an owner wake is structurally self-defeating, i.e. the metric
    // measures the result or the act of the platform owner review itself.
    // Cross-project incident narratives (e.g. another app's burst failures)
    // are NOT a valid reason to defer here — those are excluded by the
    // metric-owner filter above, or must be re-owned to the owning app.
    const DEFERRED_METRICS = new Set([
      // Measures the RESULT of owner reviews: no active finding -> breach ->
      // owner wake -> review -> recover -> breach. Circular by construction.
      "project.health.finding-count",
      "project.owner-incomplete-count",
      "project.owner-judgment-needed-count",
      // Counts running sessions, which includes the owner-review session that
      // a wake would start: breach -> wake -> session -> counted -> breach.
      "capability.zombie-session-count",
      "runtime.stale-running-session-count",
    ]);
    const metricId = eventString(event, "metricId");
    if (metricId && DEFERRED_METRICS.has(metricId)) {
      return ctx.noop(
        `deferred metric ${metricId} — captured in scheduled project.tick review, not immediate wake`,
      );
    }

    return ctx.emit(ownerRequested("metric-signal", eventDetails(event)));
  }

  if (event.type === "project.tasks.ready") {
    return ctx.emit(
      ownerRequested("ready-tasks-available", eventDetails(event)),
    );
  }

  if (
    event.type === "project.owner.reviewed" ||
    event.type === "project.reviewed"
  ) {
    return ctx.noop(
      "terminal signal — review cycle complete, no further routing needed",
    );
  }

  return undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  owner: projectOwnerAgent,
  description:
    "May-agent platform app: runtime contracts, event/session/task execution, persistence, SDK, shared web UI, and project-app conventions.",
  workspace: {
    kind: "local",
    localPath: "../may-agent",
  },

  // Owner session budget policy (project-local, no global handlers):
  //
  //   sessionsPerDay = 6
  //   scheduled owner sessions/day = platform-review (8h -> 3) +
  //                                  owner-heartbeat (24h -> 1) = 4
  //   reactive headroom/day        = 6 - 4 = 2
  //
  // The reserved headroom exists so reactive owner wakes — project comments
  // (project.comment.created), platform-owned metric breach/stall signals, and
  // other abnormal runtime events — can still reach the owner on the day they
  // happen. Previously the schedules booked 4 + 2 = 6/day, i.e. 100% of the
  // budget, so any reactive signal competed with an already-full calendar.
  // All of these paths (scheduled and reactive) converge on the stable
  // runtime/platform-owner-review task resource, so headroom is spent on the
  // same owner review contract rather than a parallel mechanism.
  //
  // Invariant checked by app.test.ts: SCHEDULED_OWNER_SESSIONS_PER_DAY <
  // budget.sessionsPerDay, with at least RESERVED_REACTIVE_SESSIONS_PER_DAY
  // left over.
  budget: {
    maxConcurrent: 2,
  },

  schedules: [
    {
      id: "platform-review",
      enabled: true,
      intervalMs: PLATFORM_REVIEW_INTERVAL_MS, // 8h -> 3 owner sessions/day
      emits: [
        {
          type: "project.tick",
          project: projectId,
          lane: "platform-review",
        },
      ],
    },
    {
      id: "owner-heartbeat",
      enabled: true,
      intervalMs: OWNER_HEARTBEAT_INTERVAL_MS, // 24h -> 1 owner session/day
      emits: [
        ownerRequested("owner-heartbeat", {
          instruction:
            "Low-frequency platform owner heartbeat: look for missed platform integrity, runtime, UI, or app-design issues that fixed ops-health metrics did not catch. Check recent heartbeat/platform-review/ops-health findings before creating work. Prefer one to three task-tree actions or no-op with reason; do not run multi-step implementation work from the owner session.",
          reviewChecklist: [
            "Look for stale assumptions in the app/project design docs versus current runtime behavior.",
            "Look for repeated alerts, failed handlers, unclosed owner loops, or app manifests that drifted from the event-owner model.",
            "Look for task-tree bloat or done work that should be rolled up with durable meaning preserved.",
            "Avoid duplicate heartbeat tasks by inspecting recent owner-review findings first.",
            "No-op is valid when existing tasks already cover the useful next work.",
          ],
        }),
      ],
    },
    {
      id: "ops-health-review",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        {
          type: "project.ops_health.tick",
          project: projectId,
          lane: "ops-health-review",
        },
      ],
    },
    {
      id: "daily-ops-digest",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        {
          type: "project.ops_digest.tick",
          project: projectId,
          lane: "daily-ops-digest",
        },
      ],
    },
  ],

  tasks: {
    accepts: [
      { type: "project.ops_digest.tick", project: projectId },
      { type: "project.ops_health.tick", project: projectId },
      { type: "may-agent.resource-migration.requested", project: projectId },
      { type: "project.owner.requested", project: projectId },
      { type: "project.comment.created", project: projectId },
    ],
    resolve: resolveMayAgentTask,
  },

  events: [
    { type: "project.tick", project: projectId },
    { type: "metric.breach" },
    { type: "metric.stalled" },
    { type: "metric.recovered" },
  ],

  actions: {
    "advance-project": {
      type: "async",
      description:
        "Ask tech-lead to review and advance the May-agent platform project.",
      inputSchema: actionInputSchema,
      event(params) {
        return ownerRequested("manual-advance", params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routePlatformEvent(ctx, event);
  },
});
