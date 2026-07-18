import { describe, expect, test } from "bun:test";
import app, { resolveAksReconciliationTask } from "../app.ts";

type TaskRoute = {
  name?: string;
  accepts?: EventSelector[];
};

type TaskWorkflow = {
  workflow?: string;
  agent?: string;
  task?: string;
};

type EventSelector =
  | string
  | {
      type?: string;
      target?: Record<string, unknown>;
      actions?: string[];
    };

type ProjectAction = {
  event?: (params?: unknown) => Record<string, unknown>;
};

type Schedule = {
  id?: string;
  emits?: Array<Record<string, unknown>>;
};

const projectId = "aks-rp-e2e";
const appManifest = app as {
  taskRoutes?: TaskRoute[];
  taskWorkflows?: Record<string, TaskWorkflow>;
  ownerEntry?: { workflow?: string; agent?: string; task?: string };
  schedules?: Schedule[];
  eventGraph?: Record<string, unknown> & {
    externalEvents?: string[];
  };
  actions?: Record<string, ProjectAction>;
  onEvent?: unknown;
};

function taskRoute(name: string): TaskRoute {
  const found = appManifest.taskRoutes?.find((entry) => entry.name === name);
  if (!found) throw new Error(`Missing task route ${name}`);
  return {
    ...found,
    accepts: structuredClone(found.accepts ?? []),
  };
}

function scheduleEvents(schedule: Schedule): Array<Record<string, unknown>> {
  return Array.isArray(schedule.emits) ? schedule.emits : [];
}

function allRouteSelectors(): EventSelector[] {
  return (appManifest.taskRoutes ?? []).flatMap((route) => route.accepts ?? []);
}

function eventTarget(event: Record<string, unknown>): Record<string, unknown> {
  return event.target && typeof event.target === "object"
    ? (event.target as Record<string, unknown>)
    : {};
}

function selectorMatchesEvent(
  selector: EventSelector,
  event: Record<string, unknown>,
): boolean {
  if (typeof selector === "string") return event.type === selector;
  if (selector.type !== event.type) return false;
  const selectorProject = selector.target?.project;
  if (
    typeof selectorProject === "string" &&
    eventTarget(event).project !== selectorProject
  ) {
    return false;
  }
  const selectorTaskId = selector.target?.taskId;
  if (
    typeof selectorTaskId === "string" &&
    eventTarget(event).taskId !== selectorTaskId
  ) {
    return false;
  }
  if (selector.actions?.length) {
    return (
      typeof event.action === "string" &&
      selector.actions.includes(event.action)
    );
  }
  return true;
}

function eventIsHandledOrBoundary(event: Record<string, unknown>): boolean {
  const type = typeof event.type === "string" ? event.type : "";
  if (!type) return false;
  const externalEvents = appManifest.eventGraph?.externalEvents;
  if (Array.isArray(externalEvents) && externalEvents.includes(type))
    return true;
  return allRouteSelectors().some((selector) =>
    selectorMatchesEvent(selector, event),
  );
}

function actionEvent(
  actionName: string,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  const action = appManifest.actions?.[actionName];
  if (!action?.event) throw new Error(`Missing event action ${actionName}`);
  return action.event(params);
}

describe("app event contract", () => {
  test("every manifest-produced event has a handler or boundary declaration", () => {
    const failures: string[] = [];

    for (const schedule of appManifest.schedules ?? []) {
      for (const event of scheduleEvents(schedule)) {
        if (!eventIsHandledOrBoundary(event)) {
          failures.push(
            `schedule ${schedule.id ?? "(unnamed)"} emits unhandled ${String(event.type)}`,
          );
        }
      }
    }

    for (const [name, action] of Object.entries(appManifest.actions ?? {})) {
      if (!action.event) continue;
      const event = action.event({ taskId: "loop-a" });
      if (!eventIsHandledOrBoundary(event)) {
        failures.push(`action ${name} emits unhandled ${String(event.type)}`);
      }
    }

    const consumedTypes = new Set(
      allRouteSelectors()
        .map((selector) =>
          typeof selector === "string" ? selector : selector.type,
        )
        .filter((type): type is string => Boolean(type)),
    );
    expect(failures).toEqual([]);
  });

  test("task routes use the declarative canonical event surface", () => {
    expect(appManifest.onEvent).toBeUndefined();
  });

  test("owner and reviewed-task reconciliation use the planner workflow", () => {
    expect(appManifest.ownerEntry).toMatchObject({
      workflow: "project-planner",
      agent: "app-ops",
    });
    expect(appManifest.taskWorkflows?.["reviewed-task-applier"]).toMatchObject({
      workflow: "project-planner",
      agent: "app-ops",
    });
    expect(taskRoute("aks-rp-e2e-task-reviewed-application")).toMatchObject({
      accepts: [
        { type: "project.task.reviewed", target: { project: projectId } },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-condition-fallback")).toMatchObject({
      accepts: [
        {
          type: "project.condition.fallback.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(appManifest.ownerEntry).toMatchObject({
      workflow: "project-planner",
      agent: "app-ops",
    });
    expect(
      (taskRoute("aks-rp-e2e-task-owner-event").accepts ?? []).map(
        (selector) => (typeof selector === "string" ? selector : selector.type),
      ),
    ).toEqual(
      expect.arrayContaining([
        "project.owner.requested",
        "project.comment.created",
        "project.approval.submitted",
        "project.test_run.completed",
        "project.stall.reviewed",
        "project.problem.resolved",
        "project.problem.escalated",
        "project.problem.inconclusive",
        "escalation.resolved",
        "escalation.dismissed",
        "metric.breach",
        "metric.recovered",
        "learning.feedback",
        "coverage.gap.detected",
      ]),
    );
  });

  test("manifest explicitly opts only the bounded exact ADO Condition writers into V2", () => {
    expect(appManifest.taskWorkflows?.["project-watchdog"]?.task).toContain(
      "conditionV2: exact-ado-revisioned",
    );
    expect(appManifest.taskWorkflows?.["project-watchdog"]?.task).not.toContain(
      "conditionAdoptionV2:",
    );
    expect(appManifest.ownerEntry?.task).toContain(
      "conditionV2: exact-ado-revisioned",
    );
    expect(appManifest.ownerEntry?.task).not.toContain("conditionAdoptionV2:");
    expect(
      appManifest.taskWorkflows?.["reviewed-task-applier"]?.task,
    ).toContain("conditionV2: exact-ado-revisioned");
    expect(appManifest.ownerEntry?.task).not.toContain("revisionV2:");
    expect(appManifest.ownerEntry?.task).not.toContain("revisionV2RunId:");
    expect(
      appManifest.taskWorkflows?.["reviewed-task-applier"]?.task,
    ).not.toContain("revisionV2:");
    expect(
      appManifest.taskWorkflows?.["reviewed-task-applier"]?.task,
    ).not.toContain("revisionV2RunId:");
  });

  test("manifest opts only revisioned review handoffs into PendingAction V2 delivery", () => {
    expect(appManifest.taskWorkflows?.["task-reviewer"]?.task).toContain(
      "pendingActionV2: review-application-revisioned",
    );
    expect(appManifest.taskWorkflows?.["task-execution"]?.task).toContain(
      "pendingActionV2: completion-review-revisioned",
    );
    expect(appManifest.taskWorkflows?.["task-reviewer"]?.task).not.toContain(
      "pendingActionV2: completion-review-revisioned",
    );
    expect(appManifest.taskWorkflows?.["project-watchdog"]?.task).not.toContain(
      "pendingActionV2:",
    );
    expect(appManifest.ownerEntry?.task).not.toContain("pendingActionV2:");
    expect(
      appManifest.taskWorkflows?.["reviewed-task-applier"]?.task,
    ).not.toContain("pendingActionV2:");
    expect(appManifest.taskWorkflows?.["project-watchdog"]?.task).toContain(
      "pendingActionRedeliveryV2: review-application-revisioned",
    );
    expect(appManifest.taskWorkflows?.["project-watchdog"]?.task).not.toContain(
      "pendingActionRedeliveryV2: review-handoffs-revisioned",
    );
  });

  test("worker and controllers own their targeted task events", () => {
    expect(taskRoute("aks-rp-e2e-task-execution")).toMatchObject({
      accepts: [
        { type: "project.task.assigned", target: { project: projectId } },
      ],
    });
    expect(appManifest.taskWorkflows?.["task-execution"]).toMatchObject({
      workflow: "task-worker",
      agent: "aks-explorer",
    });
    expect(taskRoute("aks-rp-e2e-task-completion-review")).toMatchObject({
      accepts: [
        { type: "project.task.completed", target: { project: projectId } },
      ],
    });
    expect(appManifest.taskWorkflows?.["task-reviewer"]).toMatchObject({
      workflow: "task-reviewer",
      agent: "aks-reviewer",
    });
    expect(taskRoute("aks-rp-e2e-task-spec-loop")).toMatchObject({
      accepts: expect.arrayContaining([
        expect.objectContaining({
          type: "project.task.tick",
          target: expect.objectContaining({ project: projectId }),
          actions: ["spec-loop"],
        }),
      ]),
    });
    expect(appManifest.taskWorkflows?.["spec-loop-controller"]).toMatchObject({
      workflow: "spec-loop-controller",
      agent: "aks-explorer",
    });
    expect(taskRoute("aks-rp-e2e-task-feature-compact-loop")).toMatchObject({
      accepts: expect.arrayContaining([
        expect.objectContaining({
          type: "project.task.tick",
          target: expect.objectContaining({ project: projectId }),
          actions: ["feature-compact-loop"],
        }),
      ]),
    });
    expect(taskRoute("aks-rp-e2e-task-reviewed-application")).toMatchObject({
      accepts: [
        { type: "project.task.reviewed", target: { project: projectId } },
      ],
    });
    expect(appManifest.taskWorkflows?.["reviewed-task-applier"]).toMatchObject({
      workflow: "project-planner",
      agent: "app-ops",
    });
    expect(
      appManifest.taskWorkflows?.["feature-compact-loop-controller"],
    ).toMatchObject({
      workflow: "feature-compact-loop-controller",
      agent: "aks-explorer",
    });
    expect(appManifest.ownerEntry).toMatchObject({
      workflow: "project-planner",
      agent: "app-ops",
    });
  });

  test("spec and feature compact wakes resolve to stable maintain tasks", () => {
    expect(
      resolveAksReconciliationTask({
        type: "project.task.tick",
        action: "spec-loop",
        target: { project: projectId, taskId: "aks-spec-verification-loop" },
        data: { reason: "test-wake" },
      }),
    ).toMatchObject({
      id: "aks-spec-verification-loop",
      parentId: "project",
      mode: "maintain",
      owner: "aks-explorer",
      workflow: "spec-loop-controller",
      input: { maxConcurrent: 80 },
    });
    expect(
      resolveAksReconciliationTask({
        type: "project.task.tick",
        action: "feature-compact-loop",
        target: { project: projectId, taskId: "aks-feature-compact-loop" },
        data: { reason: "test-wake" },
      }),
    ).toMatchObject({
      id: "aks-feature-compact-loop",
      parentId: "project",
      mode: "maintain",
      owner: "aks-explorer",
      workflow: "feature-compact-loop-controller",
      input: { maxConcurrent: 20 },
    });
  });

  test("stall-review wakes resolve to one standing maintain task", () => {
    const first = resolveAksReconciliationTask({
      type: "project.stall.review.requested",
      target: { project: projectId },
      data: { reason: "watchdog-durable-loop-stall", mode: "fallback" },
    });
    const later = resolveAksReconciliationTask({
      type: "project.stall.review.requested",
      target: { project: projectId },
      data: { reason: "watchdog-risk-review", mode: "risk-review" },
    });

    expect(first).toMatchObject({
      id: "aks-project-stall-review",
      parentId: "project",
      mode: "maintain",
      owner: "app-ops",
      workflow: "project-stall-review",
      input: { maxLoopPulses: 3 },
      priority: "P0",
    });
    expect(later?.id).toBe(first?.id);
  });

  test("watchdog wakes resolve to one compatibility health task", () => {
    const first = resolveAksReconciliationTask({
      type: "project.watchdog.check.requested",
      target: { project: projectId },
      data: { reason: "scheduled" },
    });
    const later = resolveAksReconciliationTask({
      type: "project.watchdog.check.requested",
      target: { project: projectId },
      data: { reason: "manual-recheck" },
    });

    expect(first).toMatchObject({
      id: "aks-project-runtime-health",
      parentId: "project",
      mode: "maintain",
      owner: "app-ops",
      workflow: "project-watchdog",
      input: {
        supervisor: "review-handoff-revisioned",
        condition: "exact-ado-revisioned",
      },
      priority: "P0",
    });
    expect(later?.id).toBe(first?.id);
    expect(appManifest.taskWorkflows?.["project-watchdog"]).toMatchObject({
      workflow: "project-execution-watchdog",
      agent: "aks-explorer",
    });
  });

  test("focus strategy and progress wakes reconcile independently", () => {
    const proposal = resolveAksReconciliationTask({
      type: "project.focus.review.requested",
      target: { project: projectId },
      data: { reason: "scheduled-mid-term-focus-plan", mode: "plan" },
    });
    const progress = resolveAksReconciliationTask({
      type: "project.focus.review.requested",
      target: { project: projectId },
      data: { reason: "scheduled-focus-progress-review", mode: "progress" },
    });

    expect(proposal).toMatchObject({
      id: "aks-focus-plan-strategy-review",
      parentId: "project",
      mode: "maintain",
      owner: "aks-explorer",
      workflow: "focus-plan",
      input: { kind: "proposal" },
      priority: "P1",
    });
    expect(progress).toMatchObject({
      id: "aks-focus-plan-progress-review",
      parentId: "project",
      mode: "maintain",
      owner: "aks-explorer",
      workflow: "focus-plan",
      input: { kind: "review" },
      priority: "P1",
    });
    expect(progress?.id).not.toBe(proposal?.id);
  });

  test("Condition fallbacks resolve once to the accountable owner", () => {
    const event = {
      type: "project.condition.fallback.requested",
      target: { project: projectId },
      data: {
        conditionId: "condition:pipeline:ado:172669197:terminal",
        taskId: "verify-network-cni",
        taskRevision: 2,
        recoveryKey:
          "condition-fallback:condition:pipeline:ado:172669197:terminal:2",
        fallbackAction: "Refresh or escalate this exact Condition.",
        observation: { status: "inProgress" },
      },
    };
    const first = resolveAksReconciliationTask(event);

    expect(first).toMatchObject({
      parentId: "project",
      mode: "achieve",
      owner: "app-ops",
      priority: "P0",
      input: {
        conditionId: "condition:pipeline:ado:172669197:terminal",
        subjectTaskId: "verify-network-cni",
        taskRevision: 2,
        recoveryKey:
          "condition-fallback:condition:pipeline:ado:172669197:terminal:2",
        fallbackAction: "Refresh or escalate this exact Condition.",
      },
    });
    expect(first).not.toHaveProperty("workflow");
    expect(resolveAksReconciliationTask(structuredClone(event))?.id).toBe(
      first?.id,
    );
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: {
          ...event.data,
          taskRevision: 3,
          recoveryKey:
            "condition-fallback:condition:pipeline:ado:172669197:terminal:3",
        },
      })?.id,
    ).not.toBe(first?.id);

    for (const missing of ["conditionId", "taskId"] as const) {
      const data = { ...event.data };
      delete data[missing];
      expect(resolveAksReconciliationTask({ ...event, data })).toBeNull();
    }
  });

  test("durable semantic events resolve independently to owner tasks", () => {
    const first = resolveAksReconciliationTask({
      type: "project.comment.created",
      eventId: 3494001,
      target: { project: projectId },
      data: { comment: "Prioritize the exact recovery path." },
    });
    const second = resolveAksReconciliationTask({
      type: "project.comment.created",
      eventId: 3494002,
      target: { project: projectId },
      data: { comment: "Then verify its evidence." },
    });

    expect(first).toMatchObject({
      id: "runtime/owner-event/project.comment.created-3494001",
      parentId: "project",
      mode: "achieve",
      owner: "app-ops",
      input: {
        eventType: "project.comment.created",
        eventId: 3494001,
      },
      priority: "P1",
    });
    expect(first).not.toHaveProperty("workflow");
    expect(second?.id).not.toBe(first?.id);
    expect(
      resolveAksReconciliationTask({
        type: "project.comment.created",
        target: { project: projectId },
        data: { comment: "Missing durable identity." },
      }),
    ).toBeNull();
  });

  test("assignment events resolve to stable bounded execution tasks", () => {
    const event = {
      type: "project.task.assigned",
      target: { project: projectId },
      data: {
        taskId: "domain/network-cni",
        attemptId: "attempt-7",
        taskRevision: 12,
        worker: "aks-explorer",
      },
    };
    const first = resolveAksReconciliationTask(event);

    expect(first).toMatchObject({
      parentId: "project",
      mode: "achieve",
      owner: "app-ops",
      workflow: "task-execution",
      priority: "P0",
      input: {
        assignedTaskId: "domain/network-cni",
        attemptId: "attempt-7",
        taskRevision: 12,
        worker: "aks-explorer",
      },
    });
    expect(resolveAksReconciliationTask(structuredClone(event))?.id).toBe(
      first?.id,
    );
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: { ...event.data, attemptId: "attempt-8" },
      })?.id,
    ).not.toBe(first?.id);
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: { ...event.data, taskRevision: 13 },
      })?.id,
    ).not.toBe(first?.id);

    for (const missing of ["taskId", "attemptId"] as const) {
      const data = { ...event.data };
      delete data[missing];
      expect(resolveAksReconciliationTask({ ...event, data })).toBeNull();
    }
  });

  test("approval requests resolve to stable bounded dispatch tasks", () => {
    const event = {
      type: "project.approval.requested",
      target: { project: projectId },
      data: {
        packetPath: "evidence/archive/network-cni-approval.md",
        pathId: "path.network-cni",
        requestedAction: "Approve one bounded replay",
        approvalId: "approval-network-cni",
        waitId: "wait-network-cni",
      },
    };
    const first = resolveAksReconciliationTask(event);

    expect(first).toMatchObject({
      parentId: "project",
      mode: "achieve",
      owner: "app-ops",
      workflow: "approval-dispatch",
      priority: "P1",
      input: event.data,
      outputs: [".state/approval-dispatch-runs.jsonl"],
    });
    expect(resolveAksReconciliationTask(structuredClone(event))?.id).toBe(
      first?.id,
    );
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: {
          ...event.data,
          packetPath:
            "/app/projects/aks-rp-e2e/evidence/archive/network-cni-approval.md",
        },
      })?.id,
    ).toBe(first?.id);
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: { ...event.data, pathId: "path.network-cni.changed" },
      })?.id,
    ).not.toBe(first?.id);

    for (const missing of [
      "packetPath",
      "pathId",
      "requestedAction",
    ] as const) {
      const data = { ...event.data };
      delete data[missing];
      expect(resolveAksReconciliationTask({ ...event, data })).toBeNull();
    }
  });

  test("completion events resolve to stable bounded review tasks", () => {
    const event = {
      type: "project.task.completed",
      target: { project: projectId },
      data: {
        taskId: "domain/network-cni",
        attemptId: "attempt-7",
        taskRevision: 12,
        completion: { result: "done", summary: "Verified live." },
      },
    };
    const first = resolveAksReconciliationTask(event);

    expect(first).toMatchObject({
      parentId: "project",
      mode: "achieve",
      owner: "app-ops",
      workflow: "task-reviewer",
      priority: "P0",
      input: {
        completedTaskId: "domain/network-cni",
        attemptId: "attempt-7",
        taskRevision: 12,
      },
    });
    expect(resolveAksReconciliationTask(structuredClone(event))?.id).toBe(
      first?.id,
    );
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: { ...event.data, attemptId: "attempt-8" },
      })?.id,
    ).not.toBe(first?.id);
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: { ...event.data, taskRevision: 13 },
      })?.id,
    ).not.toBe(first?.id);

    for (const missing of ["taskId", "attemptId"] as const) {
      const data = { ...event.data };
      delete data[missing];
      expect(resolveAksReconciliationTask({ ...event, data })).toBeNull();
    }
  });

  test("review events resolve to stable bounded achieve tasks", () => {
    const event = {
      type: "project.task.reviewed",
      target: { project: projectId },
      data: {
        taskId: "domain/network-cni",
        attemptId: "attempt-7",
        reviewId: "review-42",
        decision: "accept",
        taskRevision: 12,
      },
    };
    const first = resolveAksReconciliationTask(event);
    const replay = resolveAksReconciliationTask(structuredClone(event));

    expect(first).toMatchObject({
      parentId: "project",
      mode: "achieve",
      owner: "app-ops",
      workflow: "reviewed-task-applier",
      priority: "P0",
      input: {
        reviewedTaskId: "domain/network-cni",
        attemptId: "attempt-7",
        reviewId: "review-42",
        decision: "accept",
        taskRevision: 12,
      },
    });
    expect(replay?.id).toBe(first?.id);
    expect(
      resolveAksReconciliationTask({
        ...event,
        data: { ...event.data, reviewId: "review-43" },
      })?.id,
    ).not.toBe(first?.id);

    for (const missing of ["taskId", "attemptId", "decision"] as const) {
      const data = { ...event.data };
      delete data[missing];
      expect(resolveAksReconciliationTask({ ...event, data })).toBeNull();
    }
  });

  test("problem requests resolve to independently replay-safe achieve tasks", () => {
    const event = {
      id: 42,
      type: "project.problem.investigation.requested",
      target: { project: projectId },
      data: {
        problemKey: "aks-rp-e2e:staging-arm-auth",
        affectedTasks: ["task-b", "task-a"],
      },
    };
    const first = resolveAksReconciliationTask(event);

    expect(first).toMatchObject({
      parentId: "project",
      mode: "achieve",
      owner: "app-ops",
      workflow: "problem-solver",
      priority: "P0",
      input: {
        problemKey: "aks-rp-e2e:staging-arm-auth",
        affectedTasks: ["task-a", "task-b"],
      },
    });
    expect(resolveAksReconciliationTask(structuredClone(event))?.id).toBe(
      first?.id,
    );
    expect(resolveAksReconciliationTask({ ...event, id: 43 })?.id).not.toBe(
      first?.id,
    );
    expect(
      resolveAksReconciliationTask({
        type: event.type,
        data: event.data,
      })?.id,
    ).toBe(
      resolveAksReconciliationTask({
        type: event.type,
        data: structuredClone(event.data),
      })?.id,
    );
    expect(
      resolveAksReconciliationTask({
        type: event.type,
        data: { affectedTasks: ["task-a"] },
      }),
    ).toBeNull();
    expect(
      resolveAksReconciliationTask(
        actionEvent("investigate-problem", {
          problemKey: "manual-problem",
          affectedTasks: ["task-a"],
        }),
      ),
    ).toMatchObject({
      workflow: "problem-solver",
      input: {
        problemKey: "manual-problem",
        affectedTasks: ["task-a"],
      },
    });
  });

  test("stall review, problem, and approval workflows use explicit request events", () => {
    expect(taskRoute("aks-rp-e2e-task-owner-event")).toBeDefined();
    expect(appManifest.ownerEntry?.workflow).toBe("project-planner");
    expect(taskRoute("aks-rp-e2e-task-problem-investigation")).toMatchObject({
      accepts: [
        {
          type: "project.problem.investigation.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(appManifest.taskWorkflows?.["problem-solver"]).toMatchObject({
      workflow: "problem-solver",
      agent: "aks-explorer",
    });
    expect(taskRoute("aks-rp-e2e-task-stall-review")).toMatchObject({
      accepts: [
        {
          type: "project.stall.review.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(appManifest.taskWorkflows?.["project-stall-review"]).toMatchObject({
      workflow: "project-stall-review",
      agent: "app-ops",
    });
    expect(taskRoute("aks-rp-e2e-task-approval-dispatch")).toMatchObject({
      accepts: [
        {
          type: "project.approval.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(appManifest.taskWorkflows?.["approval-dispatch"]).toMatchObject({
      workflow: "approval-dispatch",
      agent: "aks-explorer",
    });
    expect(taskRoute("aks-rp-e2e-task-focus-review")).toMatchObject({
      accepts: [
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(appManifest.taskWorkflows?.["focus-plan"]).toMatchObject({
      workflow: "focus-plan",
      agent: "aks-explorer",
    });
  });

  test("handled events are declared by task routes", () => {
    expect(appManifest).not.toHaveProperty("events");
    expect(taskRoute("aks-rp-e2e-task-execution")).toMatchObject({
      accepts: [
        { type: "project.task.assigned", target: { project: projectId } },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-completion-review")).toMatchObject({
      accepts: [
        { type: "project.task.completed", target: { project: projectId } },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-reviewed-application")).toMatchObject({
      accepts: [
        { type: "project.task.reviewed", target: { project: projectId } },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-problem-investigation")).toMatchObject({
      accepts: [
        {
          type: "project.problem.investigation.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-condition-fallback")).toMatchObject({
      accepts: [
        {
          type: "project.condition.fallback.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-approval-dispatch")).toMatchObject({
      accepts: [
        {
          type: "project.approval.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-focus-review")).toMatchObject({
      accepts: [
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-stall-review")).toMatchObject({
      accepts: [
        {
          type: "project.stall.review.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-runtime-health")).toMatchObject({
      accepts: [
        {
          type: "project.watchdog.check.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(taskRoute("aks-rp-e2e-task-owner-event").accepts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "project.stall.reviewed" }),
        expect.objectContaining({ type: "escalation.resolved" }),
        expect.objectContaining({ type: "learning.feedback" }),
      ]),
    );
  });

  test("manifest schedules periodic blocked-frontier app-ops review", () => {
    const schedule = appManifest.schedules?.find(
      (entry) => entry.id === "blocked-frontier-app-ops-review",
    );

    expect(schedule).toMatchObject({
      enabled: true,
      intervalMs: 7_200_000,
      emits: [
        {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-blocked-frontier-review",
          },
          urgency: "high",
        },
      ],
    });
    const params = (
      schedule?.emits as Array<{ data?: { params?: { instruction?: string } } }>
    )?.at(0)?.data?.params;
    expect(String(params?.instruction)).toContain(
      "Periodic blocked-frontier app-ops review",
    );
  });

  test("completed feature-reference work has no live controller wake", () => {
    const durableLoopSchedule = appManifest.schedules?.find(
      (entry) => entry.id === "durable-loop-pulse",
    );
    expect(durableLoopSchedule).toBeDefined();
    expect(
      scheduleEvents(durableLoopSchedule!).map((event) => event.action),
    ).not.toContain("feature-reference-loop");
    expect(appManifest.actions).not.toHaveProperty(
      "pulse-feature-reference-loop",
    );
  });

  test("manual actions emit explicit target events", () => {
    expect(
      actionEvent("dispatch-approval-packet", {
        packetPath: "evidence/archive/example.md",
      }),
    ).toMatchObject({
      type: "project.approval.requested",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "manual-approval-packet-dispatch-request",
        params: {
          packetPath: "evidence/archive/example.md",
        },
      },
    });

    expect(actionEvent("request-focus-plan")).toMatchObject({
      type: "project.focus.review.requested",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "manual-focus-plan-request",
        mode: "plan",
      },
    });

    expect(actionEvent("review-focus-progress")).toMatchObject({
      type: "project.focus.review.requested",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "manual-focus-progress-review",
        mode: "progress",
      },
    });

    expect(
      actionEvent("investigate-problem", {
        problemKey: "staging-auth",
        affectedTasks: ["task-a"],
      }),
    ).toMatchObject({
      type: "project.problem.investigation.requested",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "manual-problem-investigation-request",
        params: {
          problemKey: "staging-auth",
          affectedTasks: ["task-a"],
        },
      },
    });

    expect(
      actionEvent("review-stall-risk", { taskId: "task-a" }),
    ).toMatchObject({
      type: "project.stall.review.requested",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "manual-stall-risk-review",
        mode: "risk-review",
        params: {
          taskId: "task-a",
        },
      },
    });

    expect(actionEvent("pulse-spec-loop", { taskId: "loop-a" })).toMatchObject({
      type: "project.task.tick",
      action: "spec-loop",
      target: { project: projectId, taskId: "loop-a" },
      data: {
        project: projectId,
        action: "spec-loop",
        taskId: "loop-a",
      },
    });

    expect(appManifest.actions).not.toHaveProperty(
      "pulse-feature-reference-loop",
    );

    expect(
      actionEvent("pulse-feature-compact-loop", { taskId: "loop-c" }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "feature-compact-loop",
      target: { project: projectId, taskId: "loop-c" },
      data: {
        project: projectId,
        action: "feature-compact-loop",
        taskId: "loop-c",
      },
    });
  });

  test("event graph keeps only non-derivable metadata", () => {
    expect(appManifest.eventGraph).not.toHaveProperty("routes");
    expect(appManifest.eventGraph).not.toHaveProperty("adapters");
    expect(appManifest.eventGraph?.externalEvents).toEqual(
      expect.arrayContaining([
        "message.created",
        "project.comment.created",
        "project.approval.submitted",
        "project.test_run.completed",
        "metric.breach",
        "metric.recovered",
        "escalation.resolved",
        "escalation.dismissed",
        "coverage.gap.detected",
      ]),
    );
  });
});
