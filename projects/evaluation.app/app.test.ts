import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  matchesEventSelector,
  type AppEvent,
  type AppInput,
} from "@may-agent/sdk";
import app, {
  routeEvaluationRequest,
  taskInputForEvent,
  taskIntentForEvent,
  taskIntentForInput,
} from "./app.ts";
import {
  PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE,
  projectHealthEvaluatorAgentPrompt,
} from "./agents/evaluator/workflows/project-health-evaluator.ts";

function subscription(id: string) {
  const route = app.subscriptions?.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`missing subscription ${id}`);
  return route;
}

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return { type, data, ...extra };
}

function request(input: AppInput, dependency?: Record<string, unknown>) {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
    ...(dependency ? { dependency: dependency as never } : {}),
  };
}

describe("canonical evaluation App", () => {
  test("declares one canonical manifest and no legacy route authority", () => {
    expect(app).toMatchObject({
      id: "evaluation",
      version: 1,
      owner: "evaluator",
      inbox: { batch: "single", maxConcurrent: 5 },
      tasks: { attach: true, maxConcurrent: 5 },
    });
    expect(app.route).toBe(routeEvaluationRequest);
    expect(app.tasks?.resolve).toBe(taskIntentForEvent);
    expect(app.tasks?.subscriptions).not.toBeEmpty();
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "project-comment",
      "project-owner-request",
      "telegram-owner-reply",
    ]);
    expect(app.schedules).not.toBeEmpty();
    for (const schedule of app.schedules ?? []) {
      expect(schedule).toHaveProperty("event");
      expect(schedule).not.toHaveProperty("input");
    }
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(app).not.toHaveProperty("budget");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  test("keeps canonical App-input actions without a legacy project-review alias", () => {
    expect(
      app.actions?.["app-inbox-canary"]?.toInput?.({ prompt: "Probe" }),
    ).toEqual({
      kind: "canary-probe",
      data: { prompt: "Probe" },
    });
    expect(
      app.actions?.["app-runtime-canary"]?.toInput?.({ itemId: "probe-1" }),
    ).toEqual({
      kind: "runtime-canary",
      data: { itemId: "probe-1" },
    });
    expect(
      app.actions?.["evaluate-session"]?.toInput?.({ sessionId: "s-1" }),
    ).toEqual({
      kind: "evaluate-session",
      data: { sessionId: "s-1" },
    });
    expect(
      app.actions?.["review-agent-app"]?.toInput?.({ targetProject: "gym" }),
    ).toMatchObject({
      kind: "project-review",
      data: {
        targetProject: "gym.app",
      },
    });
    expect(app.actions?.["review-project-app"]).toBeUndefined();
  });

  test("handles configured work by policy and leaves human messages to owner judgment", () => {
    expect(
      routeEvaluationRequest(
        request({
          kind: "message",
          data: { message: "Please inspect the result" },
        }),
      ),
    ).toBeNull();

    expect(
      routeEvaluationRequest(
        request({
          kind: "canary-probe",
          data: { prompt: "Report the canary result" },
        }),
      ),
    ).toEqual({
      type: "delegate",
      appId: "evaluation-canary-worker",
      input: { kind: "probe", data: { prompt: "Report the canary result" } },
    });

    expect(
      routeEvaluationRequest(
        request({ kind: "aftermath-scan", data: { reason: "scheduled" } }),
      ),
    ).toMatchObject({
      type: "task",
      task: {
        kind: "desired",
        intent: {
          id: "runtime/aftermath-backfill",
          mode: "maintain",
          workflow: "evaluator-aftermath",
        },
      },
    });
  });

  test("completes the inbox request only after its exact dependency converges", () => {
    expect(
      routeEvaluationRequest(
        request(
          { kind: "owner-review", data: { reason: "metric.breach" } },
          {
            kind: "task",
            id: "runtime/owner-review",
            status: "done",
            summary: "Metric evidence reviewed",
            evidence: ["metric:reviewed"],
          },
        ),
      ),
    ).toEqual({
      type: "complete",
      summary: "Metric evidence reviewed",
      evidence: ["metric:reviewed"],
    });
  });
});

describe("evaluation fact admission", () => {
  test("keeps inbox and task selectors as exclusive routing authorities", () => {
    const inboxTypes = new Set(
      (app.subscriptions ?? []).map((subscription) =>
        typeof subscription.event === "string"
          ? subscription.event
          : subscription.event.type,
      ),
    );
    const taskTypes = new Set(
      (app.tasks?.subscriptions ?? []).map((selector) =>
        typeof selector === "string" ? selector : selector.type,
      ),
    );
    const observationTypes = new Set(
      (app.observations ?? []).map((selector) =>
        typeof selector === "string" ? selector : selector.type,
      ),
    );
    expect([...inboxTypes].filter((type) => taskTypes.has(type))).toEqual([]);
    expect(
      [...observationTypes].filter((type) => inboxTypes.has(type)),
    ).toEqual([]);
    expect([...observationTypes].filter((type) => taskTypes.has(type))).toEqual(
      [],
    );
    expect(observationTypes).toContain("evaluation.owner_reviewed");
    expect(app.inbox).not.toHaveProperty("accepts");

    const ended = event("session.end", {
      sessionId: "s_route_audit",
      agent: "coder",
    });
    expect(
      (app.subscriptions ?? []).some((subscription) =>
        matchesEventSelector(subscription.event, ended),
      ),
    ).toBeFalse();
    expect(taskIntentForEvent(ended)).toMatchObject({
      input: { sessionId: "s_route_audit" },
      workflow: "evaluator-aftermath",
    });
  });

  test("routes automatic session endings to their exact independently runnable task", () => {
    expect(
      taskIntentForEvent(
        event("session.end", {
          sessionId: "s/eval:42",
          agent: "may",
          task: "large payload",
        }),
      ),
    ).toMatchObject({
      id: expect.stringMatching(/^runtime\/session-aftermath\//),
      mode: "achieve",
      workflow: "evaluator-aftermath",
      input: { sessionId: "s/eval:42" },
    });
    expect(
      taskIntentForEvent(event("session.end", { agent: "may" })),
    ).toBeNull();
    for (const agent of ["evaluator", "judge"]) {
      expect(
        taskIntentForEvent(
          event("session.end", { sessionId: `s-${agent}`, agent }),
        ),
      ).toBeNull();
    }
  });

  test("admits only evaluation-owned metric changes", () => {
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "evaluator.project-finding-delivery-rate-24h" },
          { owner: "agent:evaluator" },
        ),
      ),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "metric.breach" },
    });
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { project: "aks-rp-e2e", metricId: "aks-rp-e2e.spec.blocked-count" },
          { owner: "agent:app-ops" },
        ),
      ),
    ).toBeNull();
  });

  test("admits only Telegram replies addressed to evaluation", () => {
    expect(
      subscription("telegram-owner-reply").toInput(
        event("telegram.reply", { to: "evaluator", message: "Review this" }),
      ),
    ).toEqual({
      kind: "message",
      data: {
        message: "Review this",
        context: { to: "evaluator", message: "Review this" },
      },
    });
    expect(
      subscription("telegram-owner-reply").toInput(
        event("telegram.reply", { to: "app-ops", message: "Unrelated" }),
      ),
    ).toBeNull();
  });

  test("turns review failures into evaluation's own project-health request", () => {
    expect(
      taskInputForEvent(
        event("evaluation.review_failed", {
          sessionId: "s-1",
          reason: "artifact invalid",
        }),
      ),
    ).toMatchObject({
      kind: "project-review",
      data: {
        targetProject: "evaluation.app",
        reason: "review-failed",
      },
    });
  });
});

describe("evaluation task policy", () => {
  test("keeps explicit session task identities collision-safe", () => {
    const first = taskIntentForInput({
      kind: "evaluate-session",
      data: { sessionId: "s/eval:42" },
    });
    const second = taskIntentForInput({
      kind: "evaluate-session",
      data: { sessionId: "s:eval/42" },
    });
    expect(first?.id).not.toBe(second?.id);
    expect(first?.id.length).toBeLessThanOrEqual(
      "runtime/session-aftermath/".length + 120,
    );
  });

  test("uses standing maintain tasks for recurring responsibilities", () => {
    expect(
      taskIntentForInput({
        kind: "owner-review",
        data: { reason: "metric.breach" },
      }),
    ).toMatchObject({
      id: "runtime/owner-review",
      parentId: "evaluator-reliability",
      mode: "maintain",
      workflow: "evaluator-heartbeat",
    });
    const evaluation = {
      sessionId: "s_feedback",
      agent: "may",
      quality: 0.6,
      verdict: "needs_improvement",
      issues: ["Verify the result."],
      createdAt: 1_700_000_000_000,
    };
    expect(
      taskIntentForInput({
        kind: "feedback-record",
        data: { evaluation },
      }),
    ).toMatchObject({
      id: "runtime/evaluation-feedback/may",
      parentId: "finding-delivery",
      mode: "maintain",
      workflow: "evaluation-feedback-projection",
      input: { evaluation, feedbackKey: "may" },
    });
    expect(
      taskIntentForInput({
        kind: "owner-review",
        data: { reason: "scheduled" },
      }),
    ).toMatchObject({
      id: "runtime/owner-review",
      mode: "maintain",
      workflow: "evaluator-heartbeat",
    });
  });

  test("routes recorded shallow and deep evaluations directly to per-agent feedback tasks", () => {
    const evaluation = {
      sessionId: "s_feedback",
      agent: "app/ops",
      quality: 0.5,
      verdict: "needs_improvement",
      issues: ["Missing evidence."],
    };
    const shallow = taskIntentForEvent(
      event(
        "evaluation.recorded",
        { evaluation },
        { target: { project: "evaluation" } },
      ),
    );
    const deep = taskIntentForEvent(
      event(
        "evaluation.deep_recorded",
        { evaluation },
        { target: { project: "evaluation" } },
      ),
    );
    expect(shallow).toEqual(deep);
    expect(shallow).toMatchObject({
      id: "runtime/evaluation-feedback/app-ops-bae9bad818b6",
      mode: "maintain",
      workflow: "evaluation-feedback-projection",
      input: {
        evaluation,
        feedbackKey: "app-ops-bae9bad818b6",
      },
    });
    expect(app.tasks?.subscriptions).toEqual(
      expect.arrayContaining([
        { type: "evaluation.recorded", project: "evaluation" },
        { type: "evaluation.deep_recorded", project: "evaluation" },
      ]),
    );
  });

  test("keeps gym.app in standing project-health coverage", () => {
    expect(
      taskIntentForInput({
        kind: "project-review",
        data: { targetProject: "gym.app" },
      }),
    ).toMatchObject({
      id: "runtime/project-audit/gym.app",
      mode: "maintain",
      workflow: "project-health-evaluator",
      input: {
        targetProject: "gym.app",
      },
    });
    expect(app.schedules).toContainEqual(
      expect.objectContaining({ id: "project-health-loop-gym.app" }),
    );
  });

  test("keeps wake observations out of standing project-health specifications", () => {
    const scheduled = taskIntentForInput({
      kind: "project-review",
      data: { targetProject: "aks-rp-e2e.app", reason: "scheduled" },
    });
    const manual = taskIntentForInput({
      kind: "project-review",
      data: { targetProject: "aks-rp-e2e.app", reason: "manual" },
    });
    expect(scheduled?.input).toEqual(manual?.input);
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
});
