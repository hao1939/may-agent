import { describe, expect, test } from "bun:test";
import app, { resolveAksTask } from "../../../app.ts";

type EventSelector =
  | string
  | {
      type?: string;
      target?: Record<string, unknown>;
      project?: string;
      owner?: string;
      actions?: string[];
    };

type ProjectAction = {
  event?: (params?: unknown) => Record<string, unknown>;
};

type Schedule = {
  id?: string;
  enabled?: boolean;
  intervalMs?: number;
  emits?: Array<Record<string, unknown>>;
};

type AppManifest = {
  tasks?: {
    accepts?: EventSelector[];
    resolve?: (event: Record<string, unknown>) => unknown;
  };
  events?: EventSelector[];
  schedules?: Schedule[];
  actions?: Record<string, ProjectAction>;
  onEvent?: unknown;
};

const projectId = "aks-rp-e2e";
const appManifest = app as AppManifest;

function taskSelectors(): EventSelector[] {
  return Array.isArray(appManifest.tasks?.accepts)
    ? appManifest.tasks.accepts
    : [];
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

  const selectorProject = selector.target?.project ?? selector.project;
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

  if (typeof selector.owner === "string" && event.owner !== selector.owner) {
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

function isDirectRuntimeTaskEvent(event: Record<string, unknown>): boolean {
  return Boolean(
    typeof event.type === "string" &&
    event.type.startsWith("project.task.") &&
    typeof eventTarget(event).taskId === "string" &&
    eventTarget(event).taskId,
  );
}

function eventIsHandled(event: Record<string, unknown>): boolean {
  return (
    isDirectRuntimeTaskEvent(event) ||
    taskSelectors().some((selector) => selectorMatchesEvent(selector, event)) ||
    (appManifest.events ?? []).some((selector) =>
      selectorMatchesEvent(selector, event),
    )
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

function scheduleEvents(scheduleId: string): Record<string, unknown>[] {
  const schedule = appManifest.schedules?.find(
    (entry) => entry.id === scheduleId,
  );
  return Array.isArray(schedule?.emits) ? schedule.emits : [];
}

function selectorTypes(): string[] {
  return taskSelectors()
    .map((selector) =>
      typeof selector === "string" ? selector : selector.type,
    )
    .filter((type): type is string => Boolean(type));
}

describe("app event contract", () => {
  test("uses the current task resolver contract", () => {
    expect(appManifest.tasks?.accepts).toBeArray();
    expect(appManifest.tasks?.resolve).toBeFunction();
    expect(appManifest.onEvent).toBeFunction();
    expect(appManifest).not.toHaveProperty("workflowHandlers");
    expect(appManifest).not.toHaveProperty("taskRoutes");
    expect(appManifest).not.toHaveProperty("taskWorkflows");
    expect(appManifest).not.toHaveProperty("eventGraph");
  });

  test("every manifest-produced event is resolver-handled or a direct task wake", () => {
    const failures: string[] = [];

    for (const schedule of appManifest.schedules ?? []) {
      for (const event of schedule.emits ?? []) {
        if (!eventIsHandled(event)) {
          failures.push(
            `schedule ${schedule.id ?? "(unnamed)"} emits unhandled ${String(event.type)}`,
          );
        }
      }
    }

    for (const [name, action] of Object.entries(appManifest.actions ?? {})) {
      if (!action.event) continue;
      const event = action.event({ taskId: "loop-a" });
      if (!eventIsHandled(event)) {
        failures.push(`action ${name} emits unhandled ${String(event.type)}`);
      }
    }

    expect(failures).toEqual([]);
  });

  test("semantic project events are accepted by the task resolver", () => {
    expect(selectorTypes()).toEqual(
      expect.arrayContaining([
        "project.owner.requested",
        "project.comment.created",
        "project.approval.submitted",
        "project.test_run.completed",
        "project.stall.reviewed",
        "project.problem.investigation.requested",
        "project.problem.resolved",
        "project.problem.escalated",
        "project.problem.inconclusive",
        "project.stall.review.requested",
        "project.focus.review.requested",
        "project.approval.requested",
        "coverage.gap.detected",
        "metric.breach",
        "metric.recovered",
        "learning.feedback",
        "escalation.resolved",
        "escalation.dismissed",
      ]),
    );
  });

  test("keeps deterministic pipeline observation outside the task graph", () => {
    const event = {
      type: "aks.pipeline.check",
      target: { project: projectId },
    };
    expect(resolveAksTask(event)).toBeNull();
    expect(eventIsHandled(event)).toBe(true);
  });

  test("resolver maps semantic events to bounded workflows", () => {
    expect(
      resolveAksTask({
        type: "project.owner.requested",
        target: { project: projectId },
      })?.workflow,
    ).toBeUndefined();
    expect(
      resolveAksTask({
        type: "project.problem.investigation.requested",
        target: { project: projectId },
      })?.workflow,
    ).toBe("problem-solver");
    expect(
      resolveAksTask({
        type: "project.focus.review.requested",
        target: { project: projectId },
      })?.workflow,
    ).toBe("focus-plan");
    expect(
      resolveAksTask({
        type: "project.approval.requested",
        target: { project: projectId },
      })?.workflow,
    ).toBe("approval-dispatch");
  });

  test("durable-loop schedule emits direct targeted task wakes", () => {
    expect(scheduleEvents("durable-loop-pulse")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project.task.tick",
          action: "spec-loop",
          target: { project: projectId, taskId: "aks-spec-verification-loop" },
        }),
        expect.objectContaining({
          type: "project.task.tick",
          action: "feature-compact-loop",
          target: { project: projectId, taskId: "aks-feature-compact-loop" },
        }),
      ]),
    );
  });

  test("manual actions emit explicit target events", () => {
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
      actionEvent("investigate-problem", { problemKey: "staging-auth" }),
    ).toMatchObject({
      type: "project.problem.investigation.requested",
      target: { project: projectId },
    });

    expect(
      actionEvent("review-stall-risk", { taskId: "task-a" }),
    ).toMatchObject({
      type: "project.stall.review.requested",
      target: { project: projectId },
    });

    expect(actionEvent("dispatch-approval-packet")).toMatchObject({
      type: "project.approval.requested",
      target: { project: projectId },
    });

    expect(actionEvent("pulse-spec-loop", { taskId: "loop-a" })).toMatchObject({
      type: "project.task.tick",
      action: "spec-loop",
      target: { project: projectId, taskId: "loop-a" },
    });

    expect(
      actionEvent("pulse-feature-compact-loop", { taskId: "loop-c" }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "feature-compact-loop",
      target: { project: projectId, taskId: "loop-c" },
    });
  });

  test("supports multiple focus plans and multiple loop task instances", () => {
    const focusA = resolveAksTask({
      type: "project.focus.review.requested",
      target: { project: projectId },
      eventId: 101,
    });
    const focusB = resolveAksTask({
      type: "project.focus.review.requested",
      target: { project: projectId },
      eventId: 102,
    });
    expect(focusA?.workflow).toBe("focus-plan");
    expect(focusB?.workflow).toBe("focus-plan");
    expect(focusA?.id).not.toBe(focusB?.id);

    expect(actionEvent("pulse-spec-loop", { taskId: "spec-loop-a" })).toMatchObject({
      target: { taskId: "spec-loop-a" },
    });
    expect(actionEvent("pulse-spec-loop", { taskId: "spec-loop-b" })).toMatchObject({
      target: { taskId: "spec-loop-b" },
    });
  });

  test("blocked-frontier review remains scheduled", () => {
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
  });
});
