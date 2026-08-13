import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ProjectAppContext } from "@may-agent/sdk";
import app, {
  appInboxCanaryRequested,
  resolveEvaluationTask,
  routeEvaluationEvent,
} from "./app.ts";
import {
  PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE,
  projectHealthEvaluatorAgentPrompt,
} from "./agents/evaluator/workflows/project-health-evaluator.ts";

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

describe("evaluation App inbox canary", () => {
  test("keeps the manual probe on one explicit new-runtime event path", () => {
    expect(
      appInboxCanaryRequested({ prompt: "Report the canary result." }),
    ).toEqual({
      type: "app.input.requested",
      data: {
        appId: "evaluation-canary",
        input: {
          kind: "probe",
          data: { prompt: "Report the canary result." },
        },
        source: { kind: "system", id: "evaluation.app:manual-canary" },
      },
    });
    expect(app.actions?.["app-inbox-canary"]).toMatchObject({
      type: "async",
      description: expect.stringContaining("manual probe"),
    });
    expect(app.tasks?.accepts).not.toContain("app.input.requested");
    expect(app.events).not.toContain("app.input.requested");
  });
});

describe("evaluation app task reconciliation", () => {
  test("routes concrete session endings into explicit per-session aftermath work", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    expect(
      resolveEvaluationTask({
        type: "evaluation.aftermath.scan",
        params: { reason: "session-end-backfill" },
      }),
    ).toMatchObject({
      id: "runtime/aftermath-backfill",
      parentId: "pipeline-health",
      mode: "maintain",
      workflow: "evaluator-aftermath",
      input: { scope: "session-aftermath-frontier" },
    });

    await routeEvaluationEvent(context(emitted), {
      type: "session.end",
      data: {
        sessionId: "s/eval:42",
        agent: "may",
        task: "large session text that must not enter task state",
      },
    });
    expect(emitted).toEqual([
      {
        type: "evaluation.session.requested",
        project: "evaluation",
        params: { sessionId: "s/eval:42", reason: "session-end" },
      },
    ]);
  });

  test("falls back to compact frontier scan only when session.end lacks a session id", async () => {
    const emitted: Array<Record<string, unknown>> = [];

    await routeEvaluationEvent(context(emitted), {
      type: "session.end",
      data: {
        agent: "may",
      },
    });
    expect(emitted).toEqual([
      {
        type: "evaluation.aftermath.scan",
        project: "evaluation",
        params: { reason: "session-end-missing-session-id" },
      },
    ]);
  });

  test("keeps explicit session requests collision-safe and independently auditable", () => {
    const first = resolveEvaluationTask({
      type: "evaluation.session.requested",
      params: { sessionId: "s/eval:42" },
    });
    const second = resolveEvaluationTask({
      type: "evaluation.session.requested",
      params: { sessionId: "s:eval/42" },
    });

    expect(first?.id).not.toBe(second?.id);
    expect(first?.id.length).toBeLessThanOrEqual(
      "runtime/session-aftermath/".length + 120,
    );
  });

  test("keeps deterministic pipeline observation outside the task graph", () => {
    expect(
      resolveEvaluationTask({ type: "evaluation.pipeline.check" }),
    ).toBeNull();
    expect(app.events).toContainEqual({
      type: "evaluation.pipeline.check",
      project: "evaluation",
    });
  });

  test("keeps deterministic feedback projection outside the task graph", () => {
    expect(
      resolveEvaluationTask({ type: "evaluation.feedback.project" }),
    ).toBeNull();
    expect(app.events).toContainEqual({
      type: "evaluation.feedback.project",
      project: "evaluation",
    });
    expect(app.schedules).toContainEqual(
      expect.objectContaining({ id: "evaluation-feedback-projection" }),
    );
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

  test("keeps reliability parents structural", () => {
    const seed = JSON.parse(
      readFileSync(new URL("./tasks/seed.json", import.meta.url), "utf8"),
    ) as { groups: Record<string, Record<string, unknown>> };

    expect(seed.groups["evaluator-reliability"]).toMatchObject({
      id: "evaluator-reliability",
      parent_id: "evaluation-system",
      owner: "evaluator",
    });
    expect(seed.groups["pipeline-health"]).toMatchObject({
      id: "pipeline-health",
      parent_id: "evaluator-reliability",
      owner: "evaluator",
    });
    expect(seed.groups["evaluator-reliability"]).not.toHaveProperty("workflow");
    expect(seed.groups["pipeline-health"]).not.toHaveProperty("workflow");
  });

  test("keeps gym.app in standing project-health coverage", () => {
    const task = resolveEvaluationTask({
      type: "evaluation.project.review.requested",
      params: { targetProject: "gym.app", reason: "scheduled" },
    });

    expect(task).toMatchObject({
      id: "runtime/project-audit/gym.app",
      parentId: "project-app-audit",
      mode: "maintain",
      workflow: "project-health-evaluator",
      input: {
        targetProject: "gym.app",
        targetAppDir: "/app/projects/gym.app",
        targetDomainDir: "/app/projects/gym",
      },
    });
    expect(app.schedules).toContainEqual(
      expect.objectContaining({ id: "project-health-loop-gym.app" }),
    );
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

  test("marks project-health inner evaluator calls as persistent-task guard exempt", () => {
    expect(PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE).toBe(
      "persistent-task: skip",
    );
    expect(
      projectHealthEvaluatorAgentPrompt(
        { targetProject: "scout-knowledge-lib.app", reason: "scheduled" },
        {},
      ),
    ).toStartWith("persistent-task: skip\n\n");
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

  test("leaves ordinary owner messages to the shared lifecycle", () => {
    expect(app.events).not.toContain("message.created");
    expect(app.events).toContain("telegram.reply");
    expect(
      resolveEvaluationTask({
        type: "project.owner.requested",
        project: "evaluation",
        reason: "owner-message",
        inputEventId: 9002,
        inputEventType: "message.created",
      }),
    ).toMatchObject({
      id: "runtime/owner-review",
      workflow: "evaluator-heartbeat",
    });
  });

  test("does not create malformed explicit per-session tasks without a session id", () => {
    expect(
      resolveEvaluationTask({ type: "evaluation.session.requested" }),
    ).toBeNull();
    expect(
      resolveEvaluationTask({ type: "evaluation.deep.requested" }),
    ).toBeNull();
  });

  test("filters evaluator and judge session endings before a frontier wake", async () => {
    for (const agent of ["evaluator", "judge"]) {
      const emitted: Array<Record<string, unknown>> = [];
      const result = await routeEvaluationEvent(context(emitted), {
        type: "session.end",
        data: { sessionId: `s-${agent}`, agent },
      });
      expect(emitted).toHaveLength(0);
      expect(result).toMatchObject({
        reason: `ignored ${agent} session aftermath`,
      });
    }
  });

  test("declares one convention-first task resolver", () => {
    expect(app.tasks?.resolve).toBe(resolveEvaluationTask);
    expect(app.tasks?.accepts).toHaveLength(8);
    expect(app.tasks?.accepts).not.toContain("session.end");
    expect(app.events).toContain("session.end");
    expect(app.ownerEntry).toBeUndefined();
    expect(app.taskWorkflows).toBeUndefined();
    expect(app.taskRoutes).toBeUndefined();
    expect(app.eventGraph).toBeUndefined();
  });

  test("seeds only durable maintenance responsibilities", () => {
    const seed = JSON.parse(
      readFileSync(new URL("./tasks/seed.json", import.meta.url), "utf8"),
    ) as { groups: Record<string, Record<string, unknown>> };

    expect(Object.keys(seed.groups)).toEqual([
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
    for (const group of Object.values(seed.groups)) {
      expect(group.owner).toBe("evaluator");
      expect(group).not.toHaveProperty("reconcile_mode");
      expect(group).not.toHaveProperty("acceptance");
    }
    expect(seed.groups["evaluator-reliability"]).not.toHaveProperty("workflow");
    expect(seed.groups["pipeline-health"]).not.toHaveProperty("workflow");
  });
});
