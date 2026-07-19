import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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
      id: expect.stringMatching(
        /^runtime\/session-aftermath\/s-eval-42-[a-f0-9]{12}$/,
      ),
      parentId: "session-audit",
      mode: "achieve",
      workflow: "evaluator-aftermath",
      input: { sessionId: "s/eval:42" },
    });
  });

  test("uses collision-safe stable keys for normalized session ids", () => {
    const first = resolveEvaluationTask({
      type: "session.end",
      data: { sessionId: "s/eval:42" },
    });
    const second = resolveEvaluationTask({
      type: "session.end",
      data: { sessionId: "s:eval/42" },
    });

    expect(first?.id).not.toBe(second?.id);
    expect(first?.id.length).toBeLessThanOrEqual(
      "runtime/session-aftermath/".length + 120,
    );
  });

  test("keeps deterministic pipeline observation outside the task graph", () => {
    expect(resolveEvaluationTask({ type: "evaluation.pipeline.check" })).toBeNull();
    expect(app.events).toContainEqual({
      type: "evaluation.pipeline.check",
      project: "evaluation",
    });
  });

  test("uses standing maintain tasks for recurring agent responsibilities", () => {
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

  test("keeps wake observations out of standing task specifications", () => {
    const firstAudit = resolveEvaluationTask({
      type: "evaluation.project.review.requested",
      params: { targetProject: "aks-rp-e2e.app", reason: "scheduled" },
    });
    const secondAudit = resolveEvaluationTask({
      type: "evaluation.project.review.requested",
      params: { targetProject: "aks-rp-e2e.app", reason: "manual" },
    });
    expect(firstAudit?.input).toEqual(secondAudit?.input);
  });

  test("reuses the learned evaluation owner-review workflow", () => {
    const task = resolveEvaluationTask({
      type: "evaluation.tick",
      lane: "owner-message",
    });
    expect(task).toMatchObject({
      id: "runtime/owner-review",
      mode: "maintain",
      workflow: "evaluator-heartbeat",
    });
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

  test("declares one convention-first task resolver", () => {
    expect(app.tasks?.resolve).toBe(resolveEvaluationTask);
    expect(app.tasks?.accepts).toHaveLength(7);
    expect(app.ownerEntry).toBeUndefined();
    expect(app.taskWorkflows).toBeUndefined();
    expect(app.taskRoutes).toBeUndefined();
    expect(app.eventGraph).toBeUndefined();
  });

  test("seeds only durable maintenance responsibilities", () => {
    const seed = JSON.parse(
      readFileSync(new URL("./tasks/seed.json", import.meta.url), "utf8"),
    ) as { tasks: Record<string, Record<string, unknown>> };

    expect(Object.keys(seed.tasks)).toEqual([
      "evaluation-system",
      "session-audit",
      "project-app-audit",
      "finding-delivery",
      "evaluator-reliability",
      "pipeline-health",
      "criteria-and-calibration",
      "drift-detection",
      "system-integrity",
    ]);
    for (const task of Object.values(seed.tasks)) {
      expect(task.reconcile_mode).toBe("maintain");
      expect(task.acceptance).toBeArray();
      expect((task.acceptance as unknown[]).length).toBeGreaterThan(0);
    }
  });
});
