import { describe, expect, test } from "bun:test";
import app from "../app.ts";

type WorkflowHandler = {
  name?: string;
  on?: string[];
  handler?: {
    workflow?: string;
  };
};

type ProjectAction = {
  event?: (params?: unknown) => Record<string, unknown>;
};

const projectId = "aks-rp-e2e";
const appManifest = app as {
  workflowHandlers?: WorkflowHandler[];
  schedules?: Array<Record<string, unknown>>;
  eventGraph?: Record<string, unknown> & {
    externalEvents?: string[];
  };
  actions?: Record<string, ProjectAction>;
  onEvent?: {
    kind?: string;
    handlers?: WorkflowHandler[];
  };
};

function handler(name: string): WorkflowHandler {
  const found = appManifest.workflowHandlers?.find(
    (entry) => entry.name === name,
  );
  if (!found) throw new Error(`Missing workflow handler ${name}`);
  return found;
}

function handlerEvents(name: string): string[] {
  return handler(name).on ?? [];
}

function handlersForEvent(eventType: string): string[] {
  return (appManifest.workflowHandlers ?? [])
    .filter((entry) => entry.on?.includes(eventType))
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));
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
  test("onEvent is the event surface and workflowHandlers is generated sugar", () => {
    expect(appManifest.onEvent).toMatchObject({
      kind: "generated-workflow-handlers",
    });
    expect(appManifest.workflowHandlers).toBe(appManifest.onEvent?.handlers);
  });

  test("owner workflow directly subscribes to review and wake events", () => {
    expect(handler("aks-rp-e2e-project-planner").handler?.workflow).toBe(
      "project-planner",
    );

    expect(handlerEvents("aks-rp-e2e-project-planner")).toEqual(
      expect.arrayContaining([
        "project.owner.requested",
        "project.planning.requested",
        "project.comment.created",
        "project.tick",
        "project.action.invoked",
        "project.focus.approval.submitted",
        "project.task.completed",
        "project.problem.resolved",
        "project.problem.escalated",
        "project.problem.unknown",
        "task.requeued",
        "escalation.resolved",
        "escalation.dismissed",
        "metric.breach",
        "metric.recovered",
        "coverage.gap.detected",
      ]),
    );
  });

  test("worker and controllers own their targeted task events", () => {
    expect(handler("aks-rp-e2e-task-execution-worker")).toMatchObject({
      handler: { workflow: "task-worker" },
      on: ["project.task.assigned"],
    });
    expect(handler("aks-rp-e2e-spec-loop-controller")).toMatchObject({
      handler: { workflow: "spec-loop-controller" },
      on: ["project.spec-loop.tick"],
    });
    expect(
      handler("aks-rp-e2e-feature-reference-loop-controller"),
    ).toMatchObject({
      handler: { workflow: "feature-reference-loop-controller" },
      on: ["project.feature-reference-loop.tick"],
    });
    expect(handler("aks-rp-e2e-feature-compact-loop-controller")).toMatchObject(
      {
        handler: { workflow: "feature-compact-loop-controller" },
        on: ["project.feature-compact-loop.tick"],
      },
    );
  });

  test("problem and approval workflows use explicit request events", () => {
    expect(handler("aks-rp-e2e-problem-solver")).toMatchObject({
      handler: { workflow: "problem-solver" },
      on: ["project.problem.requested"],
    });
    expect(handler("aks-rp-e2e-approval-dispatch")).toMatchObject({
      handler: { workflow: "approval-dispatch" },
      on: [
        "project.approval.dispatch.requested",
        "project.approval.dispatch.submitted",
      ],
    });
  });

  test("handled events are declared by generated workflow handlers", () => {
    expect(appManifest).not.toHaveProperty("events");
    expect(handlersForEvent("project.task.completed")).toEqual([
      "aks-rp-e2e-project-planner",
    ]);
    expect(handlersForEvent("escalation.resolved")).toEqual([
      "aks-rp-e2e-project-planner",
    ]);
  });

  test("generated workflow handlers are event-only", () => {
    for (const entry of appManifest.workflowHandlers ?? []) {
      expect(entry).not.toHaveProperty("intervalMs");
      expect(entry).not.toHaveProperty("offsetMs");
    }
  });

  test("manifest schedules periodic blocked-frontier owner review", () => {
    const schedule = appManifest.schedules?.find(
      (entry) => entry.id === "blocked-frontier-owner-review",
    );

    expect(schedule).toMatchObject({
      enabled: true,
      intervalMs: 7_200_000,
      event: {
        type: "project.owner.requested",
        project: projectId,
        reason: "scheduled-blocked-frontier-review",
        urgency: "high",
      },
    });
    const params = (schedule?.event as { params?: { instruction?: string } })
      ?.params;
    expect(String(params?.instruction)).toContain(
      "Periodic blocked-frontier owner review",
    );
  });

  test("manual actions emit explicit target events", () => {
    expect(
      actionEvent("dispatch-approval-packet", {
        packetPath: "evidence/archive/example.md",
      }),
    ).toMatchObject({
      type: "project.approval.dispatch.requested",
      project: projectId,
      reason: "manual-approval-packet-dispatch-request",
      params: {
        packetPath: "evidence/archive/example.md",
      },
    });

    expect(actionEvent("request-focus-plan")).toMatchObject({
      type: "project.focus.plan.requested",
      project: projectId,
      reason: "manual-focus-plan-request",
    });

    expect(actionEvent("review-focus-progress")).toMatchObject({
      type: "project.focus.review.requested",
      project: projectId,
      reason: "manual-focus-progress-review",
    });

    expect(actionEvent("pulse-spec-loop", { taskId: "loop-a" })).toMatchObject({
      type: "project.spec-loop.tick",
      project: projectId,
      taskId: "loop-a",
      target: { taskId: "loop-a" },
    });
  });

  test("event graph keeps only non-derivable metadata", () => {
    expect(appManifest.eventGraph).not.toHaveProperty("handlers");
    expect(appManifest.eventGraph).not.toHaveProperty("adapters");
    expect(appManifest.eventGraph).toMatchObject({
      externalEvents: ["message.created", "escalation.created"],
    });
  });
});
