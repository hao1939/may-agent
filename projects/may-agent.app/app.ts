import { appendFileSync, mkdirSync } from "node:fs";
import {
  defineProjectApp,
  eventDetails,
  eventString,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

const projectId = "may-agent";
const projectOwnerAgent = "tech-lead";

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
  const details = eventDetails(event);
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
        input: details,
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
        input: details,
        priority: "P1",
      };
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
        input: details,
        priority: "P1",
      };
    default:
      return null;
  }
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

async function routePlatformEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (event.type === "project.comment.created") {
    const commentId = appendDiscussionRecord(ctx, event);
    return ctx.emit(ownerRequested("project-comment", { commentId }));
  }

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
    // (4h interval) naturally captures the recovered state.
    // Without this guard, breach→review→recover→review loops consume the
    // entire 6-sessions/day budget for no actionable work.
    if (event.type === "metric.recovered") {
      return ctx.noop(
        "metric recovered — informational, captured in next scheduled review",
      );
    }

    // Deferred metrics: breaches for these metric IDs do NOT trigger immediate
    // owner wakes. They are captured in the next scheduled project.tick (4h).
    //
    // Two categories:
    // 1. Health-observation metrics that measure the RESULT of owner reviews
    //    (e.g. "are there active tasks?"). They create circular dependencies:
    //      no active task → breach → owner wake → review → recover → breach
    // 2. Known-root-cause metrics where the fix is delegated and repeated
    //    owner wakes are wasteful until the implementation lands.
    const DEFERRED_METRICS = new Set([
      // Category 1: health-observation oscillation
      "project.health.finding-count",
      "project.owner-incomplete-count",
      "project.owner-judgment-needed-count",
      // Category 2: guard noise — root cause is aks-rp-e2e beforeToolCall
      // churn (98% of triggers). Fix delegated to dev as KE-2000 Spec 3
      // (guard noise scoping). Remove these once the scoping fix lands.
      "guard.triggered-count-24h",
      "guard.warned-count-24h",
      // Category 3: (removed — measurement query fixed to not require owner
      // match on handler.completed events, since handler name already correlates)
      // Category 4: escalation pending count measures a human-action
      // backlog. All pending escalations require human-provided artifacts
      // (external files, clean git baselines) that the owner cannot self-service.
      // Waking the owner repeatedly to re-inspect escalations it already
      // triaged is wasteful. The scheduled project.tick (4h) surfaces the
      // count for awareness; the human gets notified via the daily ops digest.
      "escalation.pending-count",
      // Category 5: stale-active-count spikes transiently after daemon
      // restarts (all metrics appear stale until the first snapshot run).
      // Self-resolves within one measurement cycle (~5min). Not actionable.
      "metric.stale-active-count",
      // Category 6: first-turn-error-count measures provider errors across
      // ALL agents. ~80% of triggers are aks-rp-e2e planner burst failures
      // (opCount=0 instant errors during planner workflow restarts). Not
      // platform-actionable — aks-rp-e2e.app owns its planner reliability.
      // Kept in scheduled review (4h) for trend awareness.
      "session.first-turn-error-count-1h",
      // Category 7: heartbeat-coverage measures agents with heartbeat
      // sessions in 2h. Drops transiently when auto-heartbeat timers miss
      // a cycle (timer drift, provider errors, cron queue depth). The owner
      // review cannot restart cron timers — it self-corrects on the next
      // timer fire. Repeated breaches burn session budget with no actionable
      // fix. Captured in scheduled project.tick (4h) for trend awareness.
      "handler.heartbeat-coverage",
      // Category 8: DB size oscillates near threshold (2500MB) because
      // event ingestion (~3MB/5min) outpaces hourly retention (~8-10MB drop).
      // The owner cannot resolve this in a single session — it requires
      // retention window reduction or threshold adjustment (human decisions).
      // Waking on each breach creates breach→review→recover oscillation.
      // Captured in scheduled project.tick (4h) for trend awareness;
      // human notified via daily ops digest if sustained above threshold.
      "infra.persist.db-size-mb",
      // Category 9: agent config-invalid fires transiently during hot-reload
      // races (e.g. schedule timer fire coincides with project-app-loader
      // re-evaluating agents). The 1h window means events age out naturally.
      // The binary includes cli-delegation in VALID_TOOL_PRESETS; false
      // positives come from timing, not a code defect. Self-resolves.
      "agent.config-invalid-count-1h",
      // Category 10: provider-error-count measures provider errors at any
      // turn across ALL agents. Same class as first-turn-error-count: ~100%
      // of triggers are aks-rp-e2e planner/worker burst failures (opCount=0
      // instant errors during workflow restarts). Not platform-actionable —
      // aks-rp-e2e.app owns its session reliability. The platform cannot fix
      // upstream provider errors. Kept in scheduled review (4h) for trend.
      "session.provider-error-count-1h",
      // Category 11: event pair orphan count measures open event_pair_runs
      // rows past their expected_close_at. ~95% are project.task pairs from
      // aks-rp-e2e bulk task dispatch (100+ tasks assigned per planning
      // cycle with 4h TTL). These pairs orphan when tasks take longer than
      // expected — a normal aks-rp-e2e operational pattern, not a platform
      // defect. The platform owner cannot control task completion timing.
      // Breaches correlate with planning cycle size, not platform failures.
      // Captured in scheduled project.tick (6h) for trend awareness.
      "event.pair-orphan-count",
      // Category 12: zombie and stale-running session counts include the
      // platform-owner-review session itself (runs 5-30min). The owner
      // cannot fix its own running session from within — the metric
      // self-resolves when the session completes. Waking for this creates
      // a circular dependency: breach → owner wake → session runs →
      // counted as zombie → breach. Captured in scheduled review.
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

  budget: {
    sessionsPerDay: 6,
    tokensPerDay: 300_000,
    maxConcurrent: 2,
  },

  schedules: [
    {
      id: "platform-review",
      enabled: true,
      intervalMs: 21_600_000, // 6h — budget-aware: 4/day from this + 2/day from heartbeat = 6/day
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
      intervalMs: 43_200_000, // 12h — budget-aware: platform-review (6h, 4/day) + heartbeat (12h, 2/day) = 6/day matching sessionsPerDay budget
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
      { type: "project.owner.requested", project: projectId },
    ],
    resolve: resolveMayAgentTask,
  },

  events: [
    { type: "project.comment.created", project: projectId },
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
      event(params) {
        return ownerRequested("manual-advance", params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routePlatformEvent(ctx, event);
  },
});
