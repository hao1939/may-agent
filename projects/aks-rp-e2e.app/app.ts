import type { ProjectApp, ProjectAppContext } from "./types/project-app.ts";

function defineProjectApp(app: ProjectApp): ProjectApp {
  return app;
}

const projectId = "aks-rp-e2e";
const appTaskContext =
  "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e";

const taskTreeContext = [
  "projects/aks-rp-e2e.app/project.json",
  "projects/aks-rp-e2e.app/tasks/tree.json",
  "projects/aks-rp-e2e.app/tasks/README.md",
];

const projectMetricIds = [
  "aks-rp-e2e.task.ready-count",
  "aks-rp-e2e.task.active-count",
  "aks-rp-e2e.task.blocked-count",
  "aks-rp-e2e.task.completed-24h",
  "aks-rp-e2e.task.no-work-with-gaps",
  "aks-rp-e2e.task.ready-starvation-with-gaps",
  "aks-rp-e2e.task.capacity-underfilled-with-gaps",
  "aks-rp-e2e.model.unknown-path-count",
  "aks-rp-e2e.model.failed-path-count",
  "aks-rp-e2e.model.blocked-path-count",
  "aks-rp-e2e.feature.unknown-count",
  "aks-rp-e2e.spec.total-count",
  "aks-rp-e2e.replay.script-count",
  "aks-rp-e2e.run.live-started-24h",
  "aks-rp-e2e.run.live-succeeded-24h",
  "aks-rp-e2e.run.live-failed-24h",
  "aks-rp-e2e.run.live-idle-with-runnable-work",
  "aks-rp-e2e.artifact.duplicate-group-count",
];

function projectPlanningEvent(
  reason: string,
  params: unknown = {},
): Record<string, unknown> {
  return {
    type: "project.planning.requested",
    project: projectId,
    reason,
    params: {
      maxConcurrent: 5,
      ...(params && typeof params === "object" && !Array.isArray(params)
        ? (params as Record<string, unknown>)
        : {}),
    },
  };
}

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

function problemKeyForTask(taskId: string): string {
  const safeTaskId =
    taskId.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "unknown-task";
  return `aks-rp-e2e:task-problem:${safeTaskId}`;
}

function isProblemClaim(event: Record<string, unknown>): boolean {
  const status = eventString(event, "status").toLowerCase();
  const result =
    eventString(event, "result").toLowerCase() ||
    eventString(event, "claim").toLowerCase() ||
    eventString(event, "outcome").toLowerCase();
  const verificationVerdict =
    eventString(event, "verification_verdict").toLowerCase() ||
    eventString(event, "verificationVerdict").toLowerCase();

  // Filter: when status=review and result=blocked, check whether the worker
  // summary indicates completed deliverables vs genuine inability to proceed.
  // Workers that completed all deliverables but report blocked due to external
  // gates (TLS provisioning, API version, patch availability) should go to
  // planner review, not problem-solver. Workers genuinely stuck (no ARM token,
  // crash, timeout without results) should still trigger problem solving.
  if (status === "review" && result === "blocked") {
    const summary = eventString(event, "summary").toLowerCase();
    const completionSignals = [
      "all artifacts",
      "assertions pass",
      "already exist",
      "acceptance criteria met",
      "cleaned up",
      "model path updated",
      "model updated",
      "model already",
      "check passes",
      "check mode passes",
      "check exit",
      "--check passes",
      "--check exit",
      "execution-gated",
      "superseded",
      "source-spec frontier",
      "frontier artifacts",
      "verified",
      "all .* assertions",
      "claims passed",
      "preflight assertions",
      "claim assertions",
      "failure classified",
      "diagnosis recorded",
      "classified as product_constraint",
      "classified as environment",
      "model-update proposal",
      "execution record",
    ];
    if (completionSignals.some((s) => summary.includes(s))) {
      return false;
    }
  }

  return (
    ["blocked", "failed", "failure", "error"].includes(result) ||
    ["blocked", "failed", "failure", "error"].includes(status) ||
    ["rejected", "failed", "failure"].includes(verificationVerdict)
  );
}

function projectProblemEvent(
  event: Record<string, unknown>,
  taskId: string,
): Record<string, unknown> {
  const problemKey =
    eventString(event, "problemKey") ||
    eventString(event, "problem_key") ||
    problemKeyForTask(taskId);
  return {
    type: "project.problem.requested",
    project: projectId,
    urgency: "high",
    problemKey,
    problem_key: problemKey,
    taskId,
    task_id: taskId,
    affectedTasks: taskId ? [taskId] : [],
    affected_tasks: taskId ? [taskId] : [],
    sourceEventType: event.type,
    source_event_type: event.type,
    params: {
      problemKey,
      taskId,
      task: eventDetails(event),
      reason: "task-blocked-or-failed",
    },
  };
}

function metricId(event: Record<string, unknown>): string {
  return eventString(event, "metricId") || eventString(event, "metric_id");
}

function isAksProjectMetric(event: Record<string, unknown>): boolean {
  return metricId(event).startsWith("aks-rp-e2e.");
}

function humanUnblockEscalation(
  event: Record<string, unknown>,
): Record<string, unknown> {
  const data = eventDetails(event);
  const id = `esc_aks_rp_e2e_metric_${Date.now()}`;
  return {
    type: "escalation.created",
    source: "project-app:aks-rp-e2e",
    owner: "human:operator",
    urgency: "high",
    project: projectId,
    data: {
      escalationId: id,
      projectId,
      sourceAgent: "aks-explorer",
      reason:
        "aks-rp-e2e has no ready or active task while knowledge-model gaps remain.",
      requestedAction:
        "Reply with steering, approval, missing context, or an unblock decision so the project owner can repair the task tree and continue.",
      severity: "P0",
      blockedOn: "metric breach aks-rp-e2e.task.no-work-with-gaps",
      evidence: {
        metric: data,
        appTaskTree: "/app/projects/aks-rp-e2e.app/tasks/tree.json",
        domainStatusCommand:
          "cd /app/projects/aks-rp-e2e && bun run status -- --gaps",
        kanban: "/projects/aks-rp-e2e.app/ui/kanban/",
      },
      resume: {
        kind: "project-planning",
        instruction:
          "Fold the human reply into the task tree, then emit project.planning.requested.",
      },
      dedupKey: "aks-rp-e2e:metric:no-work-with-gaps",
    },
  };
}

async function routeAksRpE2eEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (event.type === "project.comment.created") {
    return ctx.emit(
      projectPlanningEvent("project-comment", eventDetails(event)),
    );
  }

  if (event.type === "project.tick" && event.lane === "learning") {
    return ctx.emit(
      projectPlanningEvent("regular-learning-tick", eventData(event)),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(
      projectPlanningEvent("project-action", eventDetails(event)),
    );
  }

  if (event.type === "project.task.completed") {
    const taskId =
      eventString(event, "taskId") || eventString(event, "task_id");
    const status = eventString(event, "status");
    const verificationVerdict =
      eventString(event, "verification_verdict") ||
      eventString(event, "verificationVerdict");
    if (isProblemClaim(event)) {
      ctx.emit(projectProblemEvent(event, taskId));
    }
    return ctx.emit(
      projectPlanningEvent("task-completed", {
        completedTaskId: taskId,
        status,
        verificationVerdict,
        task: eventDetails(event),
      }),
    );
  }

  if (
    event.type === "project.problem.resolved" ||
    event.type === "project.problem.escalated"
  ) {
    const problemKey =
      eventString(event, "problemKey") || eventString(event, "problem_key");
    return ctx.emit(
      projectPlanningEvent(
        event.type === "project.problem.resolved"
          ? "problem-resolved"
          : "problem-escalated",
        {
          problemKey,
          problem: eventDetails(event),
        },
      ),
    );
  }

  if (event.type === "task.requeued") {
    const taskId =
      eventString(event, "taskId") || eventString(event, "task_id");
    return ctx.emit(
      projectPlanningEvent("task-requeued", {
        task: {
          taskId,
          ...eventDetails(event),
        },
      }),
    );
  }

  if (
    event.type === "escalation.resolved" ||
    event.type === "escalation.dismissed"
  ) {
    const project =
      eventString(event, "project") || eventString(event, "projectId");
    const escalationId =
      eventString(event, "escalationId") || eventString(event, "escalation_id");
    if (!project && !escalationId.startsWith("esc_aks_rp_e2e_")) {
      return ctx.noop(
        `ignored ${event.type} without aks-rp-e2e project marker`,
      );
    }
    if (project && project !== projectId && project !== `${projectId}.app`) {
      return ctx.noop(`ignored ${event.type} for project ${project}`);
    }
    return ctx.emit(
      projectPlanningEvent(
        event.type === "escalation.resolved"
          ? "escalation-resolved"
          : "escalation-dismissed",
        eventDetails(event),
      ),
    );
  }

  if (event.type === "metric.breach" && isAksProjectMetric(event)) {
    const id = metricId(event);
    if (id === "aks-rp-e2e.task.no-work-with-gaps") {
      ctx.emit(humanUnblockEscalation(event));
    }
    return ctx.emit(
      projectPlanningEvent("metric-breach", {
        metricId: id,
        metric: eventDetails(event),
      }),
    );
  }

  if (event.type === "metric.recovered" && isAksProjectMetric(event)) {
    return ctx.emit(
      projectPlanningEvent("metric-recovered", {
        metricId: metricId(event),
        metric: eventDetails(event),
      }),
    );
  }

  if (event.type === "coverage.gap.detected") {
    return ctx.emit(
      projectPlanningEvent("coverage-gap-detected", eventDetails(event)),
    );
  }

  return undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  description:
    "AKS RP e2e input/expectation knowledge-map, probe, evidence, and replanning app.",
  workspace: {
    kind: "git",
    repo: "git@github.com:hao1939/aks-rp-e2e.git",
    localPath: "../aks-rp-e2e",
    branch: "main",
  },

  budget: {
    sessionsPerDay: 10,
    tokensPerDay: 500_000,
    maxConcurrent: 5,
  },

  schedules: [
    {
      id: "regular-learning",
      enabled: true,
      intervalMs: 3_600_000,
      event: {
        type: "project.tick",
        project: projectId,
        lane: "learning",
      },
    },
    {
      id: "project-execution-watchdog",
      enabled: true,
      intervalMs: 300_000,
      event: {
        type: "project.watchdog.tick",
        project: projectId,
      },
    },
  ],

  workflowHandlers: [
    {
      name: "aks-rp-e2e-project-planner",
      type: "job",
      enabled: true,
      description:
        "Planner loop. Wakes the project owner, which updates tasks/tree.json and explicitly assigns worker tasks.",
      handler: {
        workflow: "project-planner",
        includeEvent: true,
        task: `${appTaskContext}\nmaxConcurrent: 5`,
        timeoutMs: 3_600_000,
      },
      on: ["project.planning.requested"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-task-execution-worker",
      type: "job",
      enabled: true,
      description:
        "Worker execution. Executes one task assigned by the planner and emits task completion.",
      maxConcurrentTriggers: 5,
      handler: {
        workflow: "task-worker",
        includeEvent: true,
        task: `${appTaskContext}\nmaxAttempts: 1\nmaxConcurrent: 1`,
        timeoutMs: 3_600_000,
      },
      on: ["project.task.assigned"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-problem-solver",
      type: "job",
      enabled: true,
      description:
        "Focused problem resolver. Investigates blocked/failed work, fixes local causes when possible, and emits problem resolved/escalated for planner reconciliation.",
      maxConcurrentTriggers: 2,
      handler: {
        workflow: "problem-solver",
        includeEvent: true,
        task: `${appTaskContext}\nmaxAttempts: 1`,
        timeoutMs: 1_800_000,
      },
      on: ["project.problem.requested"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-project-watchdog",
      type: "job",
      enabled: true,
      intervalMs: 300_000,
      offsetMs: 120_000,
      description:
        "Five-minute liveness guard. Observes task/session state and wakes planning when the planner should review.",
      on: ["project.watchdog.tick"],
      handler: {
        workflow: "project-execution-watchdog",
        task: `${appTaskContext}\nmaxAttempts: 2\nmaxConcurrent: 5`,
        timeoutMs: 1_800_000,
      },
      context: taskTreeContext,
    },
  ],

  events: [
    { type: "project.comment.created", project: projectId },
    { type: "project.tick", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "project.task.completed", project: projectId },
    { type: "project.problem.resolved", project: projectId },
    { type: "project.problem.escalated", project: projectId },
    { type: "task.requeued", project: projectId },
    "escalation.resolved",
    "escalation.dismissed",
    { type: "metric.breach", metricIds: projectMetricIds },
    { type: "metric.recovered", metricIds: projectMetricIds },
    { type: "coverage.gap.detected", project: projectId },
  ],

  eventGraph: {
    handlers: {
      "aks-rp-e2e-project-planner": {
        emits: ["project.task.assigned"],
        description:
          "Planner reviews task state and assigns executable leaves when capacity is available.",
      },
      "aks-rp-e2e-task-execution-worker": {
        emits: ["project.task.completed"],
        description:
          "Worker executes one assigned leaf and returns a reviewable completion claim.",
      },
      "aks-rp-e2e-problem-solver": {
        emits: ["project.problem.resolved", "project.problem.escalated"],
        description:
          "Problem solver diagnoses blocked/failed work and reports the result to planning.",
      },
      "aks-rp-e2e-project-watchdog": {
        emits: ["project.planning.requested"],
        description:
          "Watchdog observes liveness and asks the planner to reconcile stale or underfilled work.",
      },
    },
    adapters: [
      {
        event: "project.comment.created",
        emits: ["project.planning.requested"],
        description: "Human steering wakes planning with the comment context.",
      },
      {
        event: "project.tick",
        emits: ["project.planning.requested"],
        description: "Regular learning tick wakes planning.",
      },
      {
        event: "project.action.invoked",
        emits: ["project.planning.requested"],
        description: "UI or API project action becomes planner context.",
      },
      {
        event: "project.task.completed",
        emits: ["project.problem.requested", "project.planning.requested"],
        description:
          "Worker completion wakes planning; blocked/failed claims also wake the problem solver.",
      },
      {
        event: "project.problem.resolved",
        emits: ["project.planning.requested"],
        description: "Resolved problem returns to planner reconciliation.",
      },
      {
        event: "project.problem.escalated",
        emits: ["project.planning.requested"],
        description: "Escalated problem returns to planner reconciliation.",
      },
      {
        event: "task.requeued",
        emits: ["project.planning.requested"],
        description: "Runtime requeue returns the task to planner review.",
      },
      {
        event: "escalation.resolved",
        emits: ["project.planning.requested"],
        description: "Human unblock result wakes planning.",
      },
      {
        event: "escalation.dismissed",
        emits: ["project.planning.requested"],
        description: "Human dismissal wakes planning for cleanup.",
      },
      {
        event: "metric.breach",
        emits: ["escalation.created", "project.planning.requested"],
        description:
          "Project metric breach wakes planning; no-work-with-gaps also notifies a human.",
      },
      {
        event: "metric.recovered",
        emits: ["project.planning.requested"],
        description: "Metric recovery wakes planning to close stale concern.",
      },
      {
        event: "coverage.gap.detected",
        emits: ["project.planning.requested"],
        description: "Coverage gaps become planner context.",
      },
    ],
    externalEvents: ["escalation.created"],
    intentionalCycles: [
      {
        id: "planner-worker-review-loop",
        events: [
          "project.planning.requested",
          "project.task.assigned",
          "project.task.completed",
          "project.problem.requested",
          "project.problem.resolved",
          "project.problem.escalated",
        ],
        reason:
          "This is the project control loop. The planner is the state-machine boundary and must review worker/problem-solver output before assigning more work.",
      },
    ],
    limits: {
      maxDirectHandlersPerEvent: 1,
      maxAdapterEmits: 3,
    },
  },

  actions: {
    "list-paths": {
      type: "sync",
      readOnly: true,
      description: "List normalized feature paths and available test specs.",
      async run(ctx) {
        const replan = await ctx.importModule<{
          loadJsonFile<T>(path: string): T;
        }>(ctx.projectPath("model/tools/src/replan-feature-paths.ts"));
        const pathSummary = replan.loadJsonFile(
          ctx.projectPath("model/knowledge-map/views/path-summary.json"),
        );
        const specs = replan.loadJsonFile(ctx.projectPath("specs/index.json"));
        return { pathSummary, specs };
      },
    },
    replan: {
      type: "sync",
      readOnly: true,
      description: "Compute a dry-run-safe replan for selected feature paths.",
      async run(ctx, params) {
        const selectedPathIds = Array.isArray(
          (params as { selectedPathIds?: unknown })?.selectedPathIds,
        )
          ? (params as { selectedPathIds: unknown[] }).selectedPathIds.filter(
              (item): item is string => typeof item === "string",
            )
          : [];
        if (!selectedPathIds.length)
          throw new Error("selectedPathIds required");

        const replan = await ctx.importModule<{
          loadJsonFile<T>(path: string): T;
          createReplan(input: {
            pathSummary: unknown;
            specs: unknown[];
            selectedPathIds: string[];
          }): unknown;
        }>(ctx.projectPath("model/tools/src/replan-feature-paths.ts"));
        const pathSummary = replan.loadJsonFile(
          ctx.projectPath("model/knowledge-map/views/path-summary.json"),
        );
        const index = replan.loadJsonFile<{
          specFiles?: Array<string | { file?: string | null }>;
        }>(ctx.projectPath("specs/index.json"));
        const specs = (index.specFiles ?? [])
          .map((entry) => (typeof entry === "string" ? entry : entry.file))
          .filter((file): file is string => Boolean(file))
          .map((file) => replan.loadJsonFile(ctx.projectPath(`specs/${file}`)));
        return replan.createReplan({ pathSummary, specs, selectedPathIds });
      },
    },
    "execute-run": {
      type: "async",
      description: "Request live execution for selected replanned paths.",
      event(params) {
        return projectPlanningEvent("execute-run-action", {
          action: "execute-run",
          params,
        });
      },
    },
    "advance-project": {
      type: "async",
      description:
        "Advance the project task tree until genuinely blocked, complete, or interrupted by an infra guard.",
      event(params) {
        return projectPlanningEvent("manual-action", params);
      },
    },
    watch: {
      type: "async",
      description: "Start or resume project planning through the task tree.",
      event(params) {
        return projectPlanningEvent("watch-request", params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routeAksRpE2eEvent(ctx, event);
  },
});
