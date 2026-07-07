import { appendFileSync, mkdirSync } from "node:fs";
import {
  defineProjectApp,
  eventDetails,
  eventString,
  type ProjectAppContext,
  type ProjectAppEvent,
} from "@may-agent/sdk";

const projectId = "may-agent";
const projectOwnerAgent = "tech-lead";
const appTaskContext =
  "app: /app/projects/may-agent.app\nproject: /app/projects/may-agent";

const taskTreeContext = [
  "projects/may-agent.app/project.json",
  "projects/may-agent.app/.state/tasks/tree.json",
  "projects/may-agent.app/docs/2a-design/project-app-v3.md",
  "projects/may-agent.app/docs/2a-design/events.md",
  "projects/may-agent.app/docs/2a-design/projects.md",
  "projects/may-agent/README.md",
];

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

  if (event.type === "project.ops_health.observed") {
    return ctx.noop(
      "ops-health observation recorded — no direct owner fallback",
    );
  }

  if (event.type === "project.ops_digest.created") {
    return ctx.noop(
      "daily ops digest recorded — owner wake is emitted by the digest workflow when needed",
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(ownerRequested("project-action", eventDetails(event)));
  }

  if (
    event.type === "metric.alerted" ||
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
      // Category 3: schedule-orphan — measurement fixed to count
      // handler.completed for the self-handler as valid follow-up proof.
      // Keeping deferred until next metrics-snapshot confirms value=0.
      // Remove once confirmed recovered.
      "runtime.project-app-schedule-orphan-count-1h",
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
    event.type === "project.owner.requested" ||
    event.type === "project.planning.requested"
  ) {
    return ctx.noop("handled by may-agent owner workflow handler");
  }

  if (event.type === "project.reviewed") {
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
      event: {
        type: "project.tick",
        project: projectId,
        lane: "platform-review",
      },
    },
    {
      id: "owner-heartbeat",
      enabled: true,
      intervalMs: 43_200_000, // 12h — budget-aware: platform-review (6h, 4/day) + heartbeat (12h, 2/day) = 6/day matching sessionsPerDay budget
      event: ownerRequested("owner-heartbeat", {
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
    },
    {
      id: "ops-health-review",
      enabled: true,
      intervalMs: 3_600_000,
      event: {
        type: "project.ops_health.tick",
        project: projectId,
        lane: "ops-health-review",
      },
    },
    {
      id: "daily-ops-digest",
      enabled: true,
      intervalMs: 86_400_000,
      event: {
        type: "project.ops_digest.tick",
        project: projectId,
        lane: "daily-ops-digest",
      },
    },
  ],

  workflowHandlers: [
    {
      name: "may-agent-daily-ops-digest",
      type: "job",
      enabled: true,
      description:
        "Builds the deterministic daily platform alert digest, notifies the human, and wakes the project owner for open/noisy conditions.",
      on: ["project.ops_digest.tick"],
      handler: {
        workflow: "daily-ops-digest",
        includeEvent: true,
        task: [
          appTaskContext,
          "persistent-task: skip",
          "",
          "You are entering the may-agent.app daily ops digest workflow.",
          "Build the deterministic alert digest, notify the human with context, and wake the project owner only when open/noisy/missing-owner conditions need judgment.",
        ].join("\n"),
        timeoutMs: 120_000,
      },
      context: [
        ...taskTreeContext,
        "projects/may-agent.app/docs/3-proposals/system-operations-model.md",
        "projects/may-agent.app/docs/2a-design/handler-audit.md",
      ],
    },
    {
      name: "may-agent-ops-health-review",
      type: "job",
      enabled: true,
      description:
        "Runs a deterministic ops-health observer packet and wakes the project owner only for meaningful signals.",
      on: ["project.ops_health.tick"],
      handler: {
        workflow: "ops-health-review",
        includeEvent: true,
        task: [
          appTaskContext,
          "persistent-task: skip",
          "",
          "You are entering the may-agent.app ops-health observer workflow.",
          "Build and record a deterministic health packet. Do not wake the project owner unless a meaningful signal needs owner judgment or closure.",
        ].join("\n"),
        timeoutMs: 120_000,
      },
      context: [
        ...taskTreeContext,
        "projects/may-agent.app/docs/3-proposals/system-operations-model.md",
      ],
    },
    {
      name: "may-agent-project-planner",
      type: "job",
      enabled: true,
      description:
        "Wakes tech-lead as project owner to review the task tree, platform signals, and project-app design work.",
      on: ["project.owner.requested", "project.planning.requested"],
      handler: {
        workflow: "platform-owner-review",
        includeEvent: true,
        task: [
          appTaskContext,
          "persistent-task: skip",
          "",
          "You are entering the may-agent.app local owner-review workflow. It will build a platform system-review packet before waking tech-lead.",
          "",
          "Before claiming the platform is healthy, build a compact system-review packet from live evidence:",
          "- open metric alerts and recent metric judgments/recoveries",
          "- recent handler.failed, session.resume_failed, subscriber.failed, message.delivery_failed, and agent.config_invalid events",
          "- stale project DB rows versus project.json/task-tree state",
          "- task-tree runnable/active/review/blocked state",
          "- evaluator findings or human messages about shallow/misleading platform claims",
          "- app integrity checks that are relevant to the triggered branch",
          "",
          "The local workflow owns packet collection; tech-lead owns judgment, task-tree updates, fixes, verification, and escalation.",
          "",
          "Scope discipline:",
          "- Only commit files that are directly tied to the diagnosed root cause or task-tree updates in THIS project (may-agent.app).",
          "- Do NOT commit unrelated files from other projects (aks-rp-e2e, scout, evaluation) just to clear guard dirtiness.",
          "- If dirty files exist in other projects, note them as informational — their project owners are responsible for commits.",
          "- Guard cleanup commits must be narrowly scoped: only .gitignore, project.json, or task tree files that THIS review session modified.",
        ].join("\n"),
        timeoutMs: 1_800_000,
      },
      context: taskTreeContext,
    },
  ],

  events: [
    { type: "project.comment.created", project: projectId },
    { type: "project.tick", project: projectId },
    { type: "project.ops_health.tick", project: projectId },
    { type: "project.ops_health.observed", project: projectId },
    { type: "project.ops_digest.tick", project: projectId },
    { type: "project.ops_digest.created", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "project.owner.requested", project: projectId },
    { type: "project.planning.requested", project: projectId },
    { type: "project.tasks.ready", project: projectId },
    { type: "project.reviewed", project: projectId },
    { type: "metric.alerted" },
    { type: "metric.breach" },
    { type: "metric.stalled" },
    { type: "metric.recovered" },
  ],

  eventGraph: {
    handlers: {
      "may-agent-daily-ops-digest": {
        emits: ["project.ops_digest.created", "project.owner.requested"],
        description:
          "Produces the daily alert digest, notifies the human, and wakes the project owner for open/noisy digest findings.",
      },
      "may-agent-ops-health-review": {
        emits: ["project.ops_health.observed", "project.owner.requested"],
        description:
          "Deterministically observes platform health and wakes the project owner only for meaningful signals.",
      },
      "may-agent-project-planner": {
        emits: ["project.reviewed"],
        description:
          "Tech-lead reviews platform project state and updates task tree, docs, or code when useful.",
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
        description:
          "Platform metric alert wakes the project owner to inspect and react.",
      },
      {
        event: "metric.breach",
        emits: ["project.owner.requested"],
        description:
          "Platform metric breach wakes the project owner to inspect and react. Deferred metrics (health-observation: project.health.*, project.owner-*; delegated: guard.*-count-24h; human-backlog: escalation.pending-count) are captured in scheduled project.tick instead of immediate wakes.",
      },
      {
        event: "metric.stalled",
        emits: ["project.owner.requested"],
        description:
          "Platform metric stall wakes the project owner to inspect and react.",
      },
      {
        event: "metric.recovered",
        emits: [],
        description:
          "Platform metric recovery is informational — nooped to prevent breach→recover→review loops from burning session budget.",
      },
      {
        event: "project.tasks.ready",
        emits: ["project.owner.requested"],
        description:
          "Reconciler signals ready task leaves; owner wakes to assign or advance them.",
      },
    ],
    externalEvents: [
      "project.reviewed",
      "project.ops_health.observed",
      "project.ops_digest.created",
    ],
    intentionalCycles: [
      {
        id: "human-or-timer-to-platform-review",
        events: ["project.tick", "project.owner.requested"],
        reason:
          "Timer and human events periodically wake tech-lead to maintain the May-agent platform project.",
      },
    ],
  },

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
