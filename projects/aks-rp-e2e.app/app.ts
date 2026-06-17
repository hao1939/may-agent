import {
  defineProjectApp,
  eventData,
  eventDetails,
  eventString,
  projectOwnerEvent as sdkProjectOwnerEvent,
  type ProjectAppContext,
} from "@may-agent/sdk";

const projectId = "aks-rp-e2e";
const projectAppPath = "projects/aks-rp-e2e.app";
const appTaskContext =
  "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e";

const taskTreeContext = [
  "projects/aks-rp-e2e.app/project.json",
  "projects/aks-rp-e2e.app/tasks/tree.json",
  "projects/aks-rp-e2e.app/tasks/README.md",
];

function projectOwnerEvent(
  reason: string,
  params: unknown = {},
): Record<string, unknown> {
  return sdkProjectOwnerEvent(projectId, reason, {
    maxConcurrent: 5,
    ...(params && typeof params === "object" && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {}),
  });
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
  // owner review, not problem-solver. Workers genuinely stuck (no ARM token,
  // crash, timeout without results) should still trigger problem solving.
  if (status === "review" && result === "blocked") {
    // Check summary at multiple nesting levels — task completion events
    // nest summary under params.task.summary, not at the top level.
    const directSummary = eventString(event, "summary");
    const taskObj = (eventData(event).params as Record<string, unknown>)
      ?.task as Record<string, unknown> | undefined;
    const nestedSummary =
      typeof taskObj?.summary === "string" ? taskObj.summary : "";
    const summary = (directSummary || nestedSummary).toLowerCase();
    const completionSignals = [
      "all artifacts",
      "assertions pass",
      "already exist",
      "all complete",
      "acceptance criteria met",
      "cleaned up",
      "model path updated",
      "model updated",
      "model already",
      "check passes",
      "check mode passes",
      "check exit",
      "execution-gated",
      "environment-gate",
      "superseded",
      "source-spec frontier",
      "spec/replay frontier",
      "frontier artifacts",
      "frontier evidence",
      "verified",
      "verification",
      "claims passed",
      "preflights pass",
      "preflight assertions",
      "claim assertions",
      "failure classified",
      "classified as",
      "diagnosis recorded",
      "model-update proposal",
      "execution record",
      "no resources were created",
      "producing a complete run",
      "run result",
      "run completed",
      "runner artifacts",
      "infra_block",
      "product_constraint",
      "product-gap",
      "product gap",
      "product verdict",
      "environment_version_ceiling",
      "staging-inconclusive",
      "staging-verified",
      "ready for runner",
      "fully documented",
      "structurally sound",
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
        "aks-rp-e2e has no runnable backlog, active, or review task while knowledge-model gaps remain.",
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
        kind: "project-owner",
        instruction:
          "Fold the human reply into the task tree, then wake the project owner.",
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
    return ctx.emit({
      ...projectOwnerEvent("human-steering", eventDetails(event)),
      urgency: "high",
    });
  }

  if (event.type === "project.tick" && event.lane === "learning") {
    return ctx.emit(
      projectOwnerEvent("regular-learning-tick", eventData(event)),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(projectOwnerEvent("project-action", eventDetails(event)));
  }

  if (event.type === "project.focus.approval.submitted") {
    return ctx.emit(
      projectOwnerEvent("focus-approval-submitted", {
        approval: eventDetails(event),
        instruction:
          "Fold the human focus-plan approval/adjustment/hold decision into the current focus branch, then continue the owner/worker loop.",
      }),
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
      projectOwnerEvent("task-completed", {
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
      projectOwnerEvent(
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
      projectOwnerEvent("task-requeued", {
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
    const projectPath =
      eventString(event, "projectPath") || eventString(event, "project_path");
    const isAksProject =
      project === projectId ||
      project === `${projectId}.app` ||
      project === projectAppPath ||
      projectPath === projectAppPath ||
      escalationId.startsWith("esc_aks_rp_e2e_");
    if (!isAksProject) {
      return ctx.noop(
        `ignored ${event.type} without aks-rp-e2e project marker`,
      );
    }
    return ctx.emit(
      projectOwnerEvent(
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
      projectOwnerEvent("metric-breach", {
        metricId: id,
        metric: eventDetails(event),
      }),
    );
  }

  if (event.type === "metric.recovered" && isAksProjectMetric(event)) {
    return ctx.emit(
      projectOwnerEvent("metric-recovered", {
        metricId: metricId(event),
        metric: eventDetails(event),
      }),
    );
  }

  if (event.type === "coverage.gap.detected") {
    return ctx.emit(
      projectOwnerEvent("coverage-gap-detected", eventDetails(event)),
    );
  }

  return undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  description:
    "AKS RP e2e input/expectation knowledge-map, probe, evidence, and owner-review app.",
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
    {
      id: "focus-plan-proposal",
      enabled: true,
      intervalMs: 86_400_000,
      event: {
        type: "project.focus.plan.requested",
        project: projectId,
        reason: "scheduled-mid-term-focus-plan",
      },
    },
    {
      id: "focus-progress-review",
      enabled: true,
      intervalMs: 21_600_000,
      event: {
        type: "project.focus.review.requested",
        project: projectId,
        reason: "scheduled-focus-progress-review",
      },
    },
  ],

  workflowHandlers: [
    {
      name: "aks-rp-e2e-project-planner",
      type: "job",
      enabled: true,
      description:
        "Owner loop. Wakes the project owner, which updates tasks/tree.json and explicitly assigns worker tasks.",
      handler: {
        workflow: "project-planner",
        includeEvent: true,
        task: `${appTaskContext}\nmaxConcurrent: 5`,
        timeoutMs: 3_600_000,
      },
      on: ["project.owner.requested", "project.planning.requested"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-task-execution-worker",
      type: "job",
      enabled: true,
      description:
        "Worker execution. Executes one task assigned by the project owner and emits task completion.",
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
        "Focused problem resolver. Investigates blocked/failed work, fixes local causes when possible, and emits problem resolved/escalated for owner reconciliation.",
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
        "Five-minute liveness guard. Observes task/session state and wakes the owner when review is needed.",
      on: ["project.watchdog.tick"],
      handler: {
        workflow: "project-execution-watchdog",
        task: `${appTaskContext}\nmaxAttempts: 2\nmaxConcurrent: 5`,
        timeoutMs: 1_800_000,
      },
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-focus-plan",
      type: "job",
      enabled: true,
      description:
        "Mid-term focus review and progress review. Keeps a visible focus branch current and asks for human approval when direction/risk changes.",
      maxConcurrentTriggers: 1,
      handler: {
        workflow: "focus-plan",
        includeEvent: true,
        task: `${appTaskContext}\nagent: aks-explorer\nmaxConcurrent: 5`,
        timeoutMs: 1_800_000,
      },
      on: ["project.focus.plan.requested", "project.focus.review.requested"],
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e.app/project.json",
        "projects/aks-rp-e2e/README.md",
      ],
    },
  ],

  events: [
    { type: "project.comment.created", project: projectId },
    { type: "project.tick", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "project.owner.requested", project: projectId },
    { type: "project.planning.requested", project: projectId },
    { type: "project.focus.plan.requested", project: projectId },
    { type: "project.focus.review.requested", project: projectId },
    { type: "project.focus.approval.submitted", project: projectId },
    { type: "project.task.completed", project: projectId },
    { type: "project.problem.resolved", project: projectId },
    { type: "project.problem.escalated", project: projectId },
    { type: "task.requeued", project: projectId },
    "escalation.resolved",
    "escalation.dismissed",
    { type: "metric.breach", project: projectId },
    { type: "metric.recovered", project: projectId },
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
          "Problem solver diagnoses blocked/failed work and reports the result to the owner.",
      },
      "aks-rp-e2e-project-watchdog": {
        emits: ["project.owner.requested"],
        description:
          "Watchdog observes liveness and asks the owner to reconcile stale or underfilled work.",
      },
      "aks-rp-e2e-focus-plan": {
        emits: ["project.owner.requested", "message.created"],
        description:
          "Focus-plan workflow reviews mid-term progress, updates the focus branch, and asks for human approval when direction/risk changes or progress is off track.",
      },
    },
    adapters: [
      {
        event: "project.comment.created",
        emits: ["project.owner.requested"],
        description:
          "Human steering wakes the project owner with the comment context.",
      },
      {
        event: "project.tick",
        emits: ["project.owner.requested"],
        description: "Regular learning tick wakes the project owner.",
      },
      {
        event: "project.action.invoked",
        emits: ["project.owner.requested"],
        description: "UI or API project action becomes owner context.",
      },
      {
        event: "project.focus.approval.submitted",
        emits: ["project.owner.requested"],
        description:
          "A direct focus-plan approval/adjust/hold decision wakes the owner with the decision context.",
      },
      {
        event: "project.task.completed",
        emits: ["project.problem.requested", "project.owner.requested"],
        description:
          "Worker completion wakes the owner; blocked/failed claims also wake the problem solver.",
      },
      {
        event: "project.problem.resolved",
        emits: ["project.owner.requested"],
        description: "Resolved problem returns to owner reconciliation.",
      },
      {
        event: "project.problem.escalated",
        emits: ["project.owner.requested"],
        description: "Escalated problem returns to owner reconciliation.",
      },
      {
        event: "task.requeued",
        emits: ["project.owner.requested"],
        description: "Runtime requeue returns the task to owner review.",
      },
      {
        event: "escalation.resolved",
        emits: ["project.owner.requested"],
        description: "Human unblock result wakes the owner.",
      },
      {
        event: "escalation.dismissed",
        emits: ["project.owner.requested"],
        description: "Human dismissal wakes the owner for cleanup.",
      },
      {
        event: "metric.breach",
        emits: ["escalation.created", "project.owner.requested"],
        description:
          "Project metric breach wakes the owner; no-work-with-gaps also notifies a human.",
      },
      {
        event: "metric.recovered",
        emits: ["project.owner.requested"],
        description: "Metric recovery wakes the owner to close stale concern.",
      },
      {
        event: "coverage.gap.detected",
        emits: ["project.owner.requested"],
        description: "Coverage gaps become owner context.",
      },
    ],
    externalEvents: ["message.created", "escalation.created"],
    intentionalCycles: [
      {
        id: "owner-worker-review-loop",
        events: [
          "project.owner.requested",
          "project.task.assigned",
          "project.task.completed",
          "project.problem.requested",
          "project.problem.resolved",
          "project.problem.escalated",
          "project.focus.plan.requested",
          "project.focus.review.requested",
        ],
        reason:
          "This is the project control loop. The owner is the state-machine boundary and must review worker/problem-solver/focus-plan output before assigning more work.",
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
        return projectOwnerEvent("execute-run-action", {
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
        return projectOwnerEvent("manual-action", params);
      },
    },
    watch: {
      type: "async",
      description: "Start or resume owner review through the task tree.",
      event(params) {
        return projectOwnerEvent("watch-request", params);
      },
    },
    "request-focus-plan": {
      type: "async",
      description:
        "Ask the project owner to propose or refresh the next mid-term focus plan.",
      event(params) {
        return {
          type: "project.focus.plan.requested",
          project: projectId,
          reason: "manual-focus-plan-request",
          params: params && typeof params === "object" ? params : {},
        };
      },
    },
    "review-focus-progress": {
      type: "async",
      description:
        "Ask the project owner to review whether the current focus plan is on track.",
      event(params) {
        return {
          type: "project.focus.review.requested",
          project: projectId,
          reason: "manual-focus-progress-review",
          params: params && typeof params === "object" ? params : {},
        };
      },
    },
  },

  async onEvent(ctx, event) {
    return routeAksRpE2eEvent(ctx, event);
  },
});
