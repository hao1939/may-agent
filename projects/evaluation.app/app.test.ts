import { describe, expect, test } from "bun:test";
import type { ProjectAppContext } from "@may-agent/sdk";
import app, { resolveEvaluationTask, routeEvaluationEvent } from "./app.ts";

function context(emitted: Array<Record<string, unknown>>): ProjectAppContext {
  return {
    emit(event: Record<string, unknown>) {
      emitted.push(event);
      return event;
    },
    noop(reason: string) {
      return { reason };
    },
  } as unknown as ProjectAppContext;
}

describe("evaluation app metric routing", () => {
  test("routes evaluation metric changes through the deterministic monitor", async () => {
    for (const type of ["metric.breach", "metric.recovered"]) {
      const emitted: Array<Record<string, unknown>> = [];
      await routeEvaluationEvent(context(emitted), {
        type,
        owner: "agent:evaluator",
        data: {
          metricId: "evaluator.project-finding-delivery-rate-24h",
          repeat: true,
          reason: "open-alert-updated",
        },
      });

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        type: "evaluation.pipeline.check",
        project: "evaluation",
        params: { reason: type },
      });
    }
  });

  test("does not route unrelated project metrics", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const result = await routeEvaluationEvent(context(emitted), {
      type: "metric.breach",
      owner: "agent:app-ops",
      data: {
        project: "aks-rp-e2e",
        metricId: "aks-rp-e2e.spec.blocked-count",
      },
    });

    expect(emitted).toHaveLength(0);
    expect(result).toMatchObject({
      reason:
        "ignored metric.breach for non-evaluation metric aks-rp-e2e.spec.blocked-count",
    });
  });
});

describe("evaluation app task reconciliation", () => {
  test("binds completed sessions to short-lived aftermath workflow tasks", () => {
    expect(
      resolveEvaluationTask({
        type: "session.end",
        data: { sessionId: "s/eval:42", status: "done" },
      }),
    ).toMatchObject({
      id: "runtime/session-aftermath/s-eval-42",
      parentId: "session-audit",
      mode: "achieve",
      workflow: "evaluator-aftermath",
      input: { sessionId: "s/eval:42" },
    });
  });

  test("uses standing maintain tasks for recurring responsibilities", () => {
    expect(
      resolveEvaluationTask({ type: "evaluation.pipeline.check" }),
    ).toMatchObject({
      id: "runtime/pipeline-monitor",
      mode: "maintain",
      workflow: "evaluator-pipeline-monitor",
    });
    expect(
      resolveEvaluationTask({
        type: "evaluation.project.review.requested",
        params: { targetProject: "aks-rp-e2e.app", reason: "scheduled" },
      }),
    ).toMatchObject({
      id: "runtime/project-audit/aks-rp-e2e.app",
      parentId: "project-app-audit",
      mode: "maintain",
      workflow: "project-health-evaluator",
    });
  });

  test("falls unfamiliar owner work back to the owner entry", () => {
    const task = resolveEvaluationTask({
      type: "evaluation.tick",
      lane: "owner-message",
    });
    expect(task).toMatchObject({
      id: "runtime/owner-review",
      mode: "maintain",
    });
    expect(task).not.toHaveProperty("workflow");
  });

  test("does not create malformed per-session tasks without a session id", () => {
    expect(resolveEvaluationTask({ type: "session.end" })).toBeNull();
    expect(
      resolveEvaluationTask({ type: "evaluation.deep.requested" }),
    ).toBeNull();
  });

  test("filters evaluator and judge session endings before task creation", () => {
    expect(
      resolveEvaluationTask({
        type: "session.end",
        data: { sessionId: "s-evaluator", agent: "evaluator" },
      }),
    ).toBeNull();
    expect(
      resolveEvaluationTask({
        type: "session.end",
        data: { sessionId: "s-judge", agent: "judge" },
      }),
    ).toBeNull();
  });

  test("declares capabilities and task routes instead of direct workflow handlers", () => {
    expect(app.workflowHandlers).toBeUndefined();
    expect(app.ownerEntry?.workflow).toBe("evaluator-heartbeat");
    expect(Object.keys(app.taskWorkflows ?? {})).toEqual([
      "evaluator-pipeline-monitor",
      "evaluator-aftermath",
      "evaluator-deep-eval",
      "project-health-evaluator",
    ]);
    expect(app.taskRoutes).toHaveLength(7);
  });
});
