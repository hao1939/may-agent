import { describe, expect, test } from "bun:test";
import app, { resolveAksReconciliationTask } from "../app.ts";

type WorkflowHandler = {
  name?: string;
  accepts?: EventSelector[];
  handler?: {
    workflow?: string;
    task?: string;
  };
  emits?: string[];
};

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
  workflowHandlers?: WorkflowHandler[];
  taskRoutes?: TaskRoute[];
  taskWorkflows?: Record<string, TaskWorkflow>;
  ownerEntry?: { workflow?: string; agent?: string };
  schedules?: Schedule[];
  eventGraph?: Record<string, unknown> & {
    externalEvents?: string[];
  };
  actions?: Record<string, ProjectAction>;
  onEvent?: unknown;
};

function handler(name: string): WorkflowHandler {
  const found = appManifest.workflowHandlers?.find(
    (entry) => entry.name === name,
  );
  if (!found) throw new Error(`Missing workflow handler ${name}`);
  return structuredClone(found);
}

function taskRoute(name: string): TaskRoute {
  const found = appManifest.taskRoutes?.find((entry) => entry.name === name);
  if (!found) throw new Error(`Missing task route ${name}`);
  return found;
}

function handlerEvents(name: string): string[] {
  return handlerSelectors(handler(name))
    .map((selector) =>
      typeof selector === "string" ? selector : selector.type,
    )
    .filter((type): type is string => Boolean(type));
}

function handlersForEvent(eventType: string): string[] {
  return (appManifest.workflowHandlers ?? [])
    .filter((entry) => handlerEvents(entry.name ?? "").includes(eventType))
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));
}

function handlerSelectors(entry: WorkflowHandler): EventSelector[] {
  return Array.isArray(entry.accepts) ? entry.accepts : [];
}

function scheduleEvents(schedule: Schedule): Array<Record<string, unknown>> {
  return Array.isArray(schedule.emits) ? schedule.emits : [];
}

function allHandlerSelectors(): EventSelector[] {
  return [
    ...(appManifest.workflowHandlers ?? []).flatMap(handlerSelectors),
    ...(appManifest.taskRoutes ?? []).flatMap((route) => route.accepts ?? []),
  ];
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
  return allHandlerSelectors().some((selector) =>
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
      allHandlerSelectors()
        .map((selector) =>
          typeof selector === "string" ? selector : selector.type,
        )
        .filter((type): type is string => Boolean(type)),
    );
    const boundaryTypes = new Set(appManifest.eventGraph?.externalEvents ?? []);
    for (const entry of appManifest.workflowHandlers ?? []) {
      for (const emitted of entry.emits ?? []) {
        if (!consumedTypes.has(emitted) && !boundaryTypes.has(emitted)) {
          failures.push(
            `handler ${entry.name ?? "(unnamed)"} emits unhandled ${emitted}`,
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test("workflow handlers use the direct canonical event surface", () => {
    expect(appManifest.workflowHandlers).toBeArray();
    expect(appManifest.onEvent).toBeUndefined();
  });

  test("owner and reviewed-task reconciliation use the planner workflow", () => {
    expect(handler("aks-rp-e2e-project-planner").handler?.workflow).toBe(
      "project-planner",
    );
    expect(appManifest.taskWorkflows?.["reviewed-task-applier"]).toMatchObject({
      workflow: "project-planner",
      agent: "app-ops",
    });
    expect(taskRoute("aks-rp-e2e-task-reviewed-application")).toMatchObject({
      accepts: [
        { type: "project.task.reviewed", target: { project: projectId } },
      ],
    });
    expect(
      handler("aks-rp-e2e-condition-fallback-planner").handler?.workflow,
    ).toBe("project-planner");
    expect(handlerEvents("aks-rp-e2e-condition-fallback-planner")).toEqual([
      "project.condition.fallback.requested",
    ]);
    expect(handlerEvents("aks-rp-e2e-project-planner")).toEqual(
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
    for (const name of [
      "aks-rp-e2e-project-planner",
      "aks-rp-e2e-condition-fallback-planner",
      "aks-rp-e2e-project-watchdog",
    ]) {
      expect(handler(name).handler?.task).toContain(
        "conditionV2: exact-ado-revisioned",
      );
    }
    for (const name of [
      "aks-rp-e2e-project-planner",
      "aks-rp-e2e-condition-fallback-planner",
      "aks-rp-e2e-project-watchdog",
    ]) {
      expect(handler(name).handler?.task).not.toContain("conditionAdoptionV2:");
    }
    expect(
      appManifest.taskWorkflows?.["reviewed-task-applier"]?.task,
    ).toContain("conditionV2: exact-ado-revisioned");
    expect(handler("aks-rp-e2e-project-planner").handler?.task).not.toContain(
      "revisionV2:",
    );
    expect(handler("aks-rp-e2e-project-planner").handler?.task).not.toContain(
      "revisionV2RunId:",
    );
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
    expect(handler("aks-rp-e2e-task-execution-worker").handler?.task).toContain(
      "pendingActionV2: completion-review-revisioned",
    );
    expect(appManifest.taskWorkflows?.["task-reviewer"]?.task).not.toContain(
      "pendingActionV2: completion-review-revisioned",
    );
    for (const name of [
      "aks-rp-e2e-project-planner",
      "aks-rp-e2e-project-watchdog",
    ]) {
      expect(handler(name).handler?.task).not.toContain("pendingActionV2:");
    }
    expect(
      appManifest.taskWorkflows?.["reviewed-task-applier"]?.task,
    ).not.toContain("pendingActionV2:");
    expect(handler("aks-rp-e2e-project-watchdog").handler?.task).toContain(
      "pendingActionRedeliveryV2: review-application-revisioned",
    );
    expect(handler("aks-rp-e2e-project-watchdog").handler?.task).not.toContain(
      "pendingActionRedeliveryV2: review-handoffs-revisioned",
    );
  });

  test("worker and controllers own their targeted task events", () => {
    expect(handler("aks-rp-e2e-task-execution-worker")).toMatchObject({
      handler: { workflow: "task-worker" },
      accepts: [{ type: "project.task.assigned" }],
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
    expect(handler("aks-rp-e2e-spec-loop-controller")).toMatchObject({
      handler: { workflow: "spec-loop-controller" },
      accepts: expect.arrayContaining([
        expect.objectContaining({
          type: "project.task.tick",
          target: expect.objectContaining({ project: projectId }),
          actions: ["spec-loop"],
        }),
      ]),
    });
    expect(
      handler("aks-rp-e2e-feature-reference-loop-controller"),
    ).toMatchObject({
      handler: { workflow: "feature-reference-loop-controller" },
      accepts: expect.arrayContaining([
        expect.objectContaining({
          type: "project.task.tick",
          target: expect.objectContaining({ project: projectId }),
          actions: ["feature-reference-loop"],
        }),
      ]),
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

  test("feature compact wakes resolve to one stable maintain task", () => {
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
    expect(
      resolveAksReconciliationTask({
        type: "project.task.tick",
        action: "spec-loop",
      }),
    ).toBeNull();
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
    expect(handler("aks-rp-e2e-project-planner").emits).toEqual(
      expect.arrayContaining([
        "project.task.assigned",
        "project.problem.investigation.requested",
      ]),
    );
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
    expect(handler("aks-rp-e2e-project-stall-review")).toMatchObject({
      handler: { workflow: "project-stall-review" },
      accepts: [{ type: "project.stall.review.requested" }],
      emits: ["project.stall.reviewed", "project.task.tick"],
    });
    expect(handler("aks-rp-e2e-approval-dispatch")).toMatchObject({
      handler: { workflow: "approval-dispatch" },
      accepts: [{ type: "project.approval.requested" }],
    });
  });

  test("handled events are declared by generated workflow handlers", () => {
    expect(appManifest).not.toHaveProperty("events");
    expect(handlersForEvent("project.task.completed")).toEqual([]);
    expect(taskRoute("aks-rp-e2e-task-completion-review")).toMatchObject({
      accepts: [
        { type: "project.task.completed", target: { project: projectId } },
      ],
    });
    expect(handlersForEvent("project.task.reviewed")).toEqual([]);
    expect(taskRoute("aks-rp-e2e-task-reviewed-application")).toMatchObject({
      accepts: [
        { type: "project.task.reviewed", target: { project: projectId } },
      ],
    });
    expect(handlersForEvent("project.problem.investigation.requested")).toEqual(
      [],
    );
    expect(taskRoute("aks-rp-e2e-task-problem-investigation")).toMatchObject({
      accepts: [
        {
          type: "project.problem.investigation.requested",
          target: { project: projectId },
        },
      ],
    });
    expect(handlersForEvent("project.stall.reviewed")).toEqual([
      "aks-rp-e2e-project-planner",
    ]);
    expect(handlersForEvent("project.stall.review.requested")).toEqual([
      "aks-rp-e2e-project-stall-review",
    ]);
    expect(handlersForEvent("escalation.resolved")).toEqual([
      "aks-rp-e2e-project-planner",
    ]);
    expect(handlersForEvent("learning.feedback")).toEqual([
      "aks-rp-e2e-project-planner",
    ]);
  });

  test("generated workflow handlers are event-only", () => {
    for (const entry of appManifest.workflowHandlers ?? []) {
      expect(entry).not.toHaveProperty("intervalMs");
      expect(entry).not.toHaveProperty("offsetMs");
    }
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

    expect(
      actionEvent("pulse-feature-reference-loop", { taskId: "loop-b" }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "feature-reference-loop",
      target: { project: projectId, taskId: "loop-b" },
      data: {
        project: projectId,
        action: "feature-reference-loop",
        taskId: "loop-b",
      },
    });

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
    expect(appManifest.eventGraph).not.toHaveProperty("handlers");
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
