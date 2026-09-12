import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import type { AppEvent, AppInput } from "@may-agent/sdk";
import { Check } from "typebox/value";
import app, {
  GROUPED_GOAL_ACCEPTANCE,
  OWNER_HEARTBEAT_INTERVAL_MS,
  OWNER_REVIEW_DELIVERY_ACCEPTANCE,
  OWNER_REVIEW_TASK_ID,
  PLATFORM_REVIEW_INTERVAL_MS,
  resolveMaintenanceTask,
  taskForMaintenanceInput,
  taskInputForEvent,
  validateMaintenanceCondition,
} from "./app.ts";

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return { type, data, ...extra };
}

function admittedInput(input: AppInput) {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
  };
}

describe("maintenance App", () => {
  it("owns one manifest and keeps addressed work separate from task wakes", () => {
    expect(app).toMatchObject({
      id: "may-agent",
      version: 1,
      agent: "tech-lead",
      tasks: { maxConcurrent: 2 },
    });
    expect(app).not.toHaveProperty("inbox");
    expect(app.task).toBe(taskForMaintenanceInput);
    expect(app.route).toBeUndefined();
    expect(app.tasks?.resolve).toBe(resolveMaintenanceTask);
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "project-comment",
      "project-owner-request",
    ]);
    expect(app.observations).not.toContain("project.task.reconciled");
    expect(app.observations).toContain("runtime.daemon.heartbeat");
    expect(app.observations).toContain("metric.recovered");
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(app).not.toHaveProperty("budget");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  it("does not turn unfinished maintenance work into a self-owned wait", () => {
    expect(
      validateMaintenanceCondition({
        id: "deploy-later",
        type: "deployment.completed",
        subject: "deployment:runtime-repair",
        expected: { health: "healthy" },
        owner: "may-agent",
        requestedAction: "Deploy the repair and prove it live.",
      }),
    ).toContain("perform or durably submit that work first");
    expect(
      validateMaintenanceCondition({
        id: "agent-does-it-later",
        type: "runtime.capability",
        subject: "runtime:repair",
        expected: { available: true },
        owner: "agent:may",
        requestedAction: "Implement the capability later.",
      }),
    ).toContain("perform or durably submit that work first");
    expect(
      validateMaintenanceCondition({
        id: "approval",
        type: "human-decision",
        subject: "human-decision:runtime-repair",
        expected: { anyOf: ["approve", "reject"] },
        owner: "human:Hao",
        requestedAction: "Approve or reject the repair.",
      }),
    ).toBeNull();
  });

  it("leaves cross-App started, skipped, and ambiguous task facts visible", () => {
    const observationAccepts = (
      selector: unknown,
      candidate: { type: string; source?: string },
    ): boolean => {
      if (typeof selector === "string") return selector === candidate.type;
      if (!selector || typeof selector !== "object") return false;
      const outer = selector as Record<string, unknown>;
      const nested =
        outer.event && typeof outer.event === "object"
          ? (outer.event as Record<string, unknown>)
          : outer;
      const type = nested.type;
      const source = nested.source;
      const typeMatches =
        type === undefined ||
        type === candidate.type ||
        (Array.isArray(type) && type.includes(candidate.type));
      const sourceMatches =
        source === undefined ||
        source === candidate.source ||
        (Array.isArray(source) && source.includes(candidate.source));
      return typeMatches && sourceMatches;
    };

    const visibleControls = [
      {
        type: "project.task.reconcile.started",
        source: "app-task:evaluation:task-reconciler",
        data: { route: "task-controller", attemptId: "r_nonterminal" },
      },
      {
        type: "project.task.reconcile.skipped",
        source: "app-task:gym:task-reconciler",
        data: { reason: "attention-required", summary: "timed out" },
      },
      {
        type: "project.task.reconcile.skipped",
        source: "app-task:aks-rp-e2e:task-reconciler",
        data: { reason: "children-open", childIds: ["live-child"] },
      },
      {
        type: "project.task.reconcile.skipped",
        source: "app-task:other:task-reconciler",
        data: { reason: "failed", error: "owner failed" },
      },
      {
        type: "project.task.reconcile.skipped",
        source: "app-task:other:task-reconciler",
        data: { malformed: true },
      },
      {
        type: "project.task.reconcile.started",
        source: "unknown-source",
        data: { route: "missing" },
      },
      {
        type: "project.unrelated.fact",
        source: "app-task:other:task-reconciler",
        data: { status: "unknown" },
      },
    ];

    for (const control of visibleControls) {
      expect(
        (app.observations as readonly unknown[]).some((selector) =>
          observationAccepts(selector, control),
        ),
      ).toBeFalse();
    }
    expect(app.observations).not.toContain("project.task.reconcile.started");
    expect(app.observations).not.toContain("project.task.reconcile.skipped");
  });

  it("publishes every periodic background wake as a fact", () => {
    expect(
      app.schedules?.find(({ id }) => id === "platform-review")?.intervalMs,
    ).toBe(PLATFORM_REVIEW_INTERVAL_MS);
    expect(
      app.schedules?.find(({ id }) => id === "platform-metrics"),
    ).toBeUndefined();
    expect(
      app.schedules?.find(({ id }) => id === "owner-heartbeat")?.intervalMs,
    ).toBe(OWNER_HEARTBEAT_INTERVAL_MS);
    for (const schedule of app.schedules ?? []) {
      expect(schedule).toHaveProperty("event");
      expect(schedule).not.toHaveProperty("input");
    }
  });

  it("turns the platform action into an addressed App input", () => {
    expect(
      app.actions?.["advance-project"]?.toInput({ scope: "runtime" }),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "manual-advance", params: { scope: "runtime" } },
    });
  });
});

describe("may-agent task routing", () => {
  it("routes App-owned platform facts to the runnable canonical owner", () => {
    const intent = resolveMaintenanceTask(
      event("project.tick", { reason: "scheduled" }),
    );
    expect(intent).toMatchObject({
      id: OWNER_REVIEW_TASK_ID,
      mode: "maintain",
      agent: "tech-lead",
      input: { scope: "may-agent-platform" },
    });
    expect(intent).not.toHaveProperty("workflow");
    expect(
      resolveMaintenanceTask(event("project.ops_health.tick")),
    ).toBeNull();
    expect(
      resolveMaintenanceTask(event("project.ops_digest.tick")),
    ).toBeNull();
  });

  it("keeps mechanical session recovery and one-time state migration in Runtime", () => {
    expect(
      resolveMaintenanceTask(
        event("session.recovery.requested", { sessionId: "s_failed/17" }),
      ),
    ).toBeNull();
    expect(
      resolveMaintenanceTask(
        event("may-agent.resource-migration.requested"),
      ),
    ).toBeNull();
  });

  it("filters recovered, deferred, and foreign metric observations", () => {
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "runtime.some-platform-metric" },
          { owner: "agent:may" },
        ),
      ),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "metric-signal" },
    });
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "project.health.finding-count" },
          { owner: "agent:may" },
        ),
      ),
    ).toBeNull();
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "other.metric" },
          { owner: "agent:other-app" },
        ),
      ),
    ).toBeNull();
    expect(taskInputForEvent(event("metric.recovered"))).toBeNull();
  });

  it("golden-traces subscriber-failure alerts to the accountable platform owner task", () => {
    const sourceFailure = event(
      "metric.breach",
      {
        metricId: "infra.bus.subscriber-failed-count-1h",
        alertId: 4657,
        current: 5,
        message: "Event bus subscriber failures (1h) is above threshold",
      },
      { owner: "agent:tech-lead" },
    );

    expect(taskInputForEvent(sourceFailure)).toMatchObject({
      kind: "owner-review",
      data: {
        reason: "metric-signal",
        metricId: "infra.bus.subscriber-failed-count-1h",
        metric: { alertId: 4657, current: 5 },
      },
    });
    expect(resolveMaintenanceTask(sourceFailure)).toMatchObject({
      id: OWNER_REVIEW_TASK_ID,
      mode: "maintain",
      agent: "tech-lead",
      input: { scope: "may-agent-platform" },
    });
  });

  it("attaches repeated item-level owner-review inputs to one retained platform goal", () => {
    const inputs: AppInput[] = [
      { kind: "owner-review", data: { reason: "timer", finding: "f-1" } },
      { kind: "owner-review", data: { reason: "event", check: "c-1" } },
      { kind: "owner-review", data: { reason: "refill", proposal: "p-1" } },
      {
        kind: "owner-review",
        data: { reason: "owner-review", sessionAudit: "s-1" },
      },
      {
        kind: "owner-review",
        data: { reason: "reconciliation", workItem: "w-1" },
      },
    ];

    const attachments = inputs.map((input, index) =>
      taskForMaintenanceInput({
        ...admittedInput(input),
        id: `request-${index + 1}`,
      }),
    );

    expect(attachments.map(({ intent }) => intent.id)).toEqual(
      Array(inputs.length).fill(OWNER_REVIEW_TASK_ID),
    );
    for (const attachment of attachments) {
      expect(attachment).toMatchObject({
        kind: "desired",
        intent: {
          id: OWNER_REVIEW_TASK_ID,
          mode: "maintain",
          input: { scope: "may-agent-platform" },
        },
      });
      expect(attachment.intent.acceptance).toEqual([
        "The owner performs one useful platform step or records an evidence-backed no-op, with task-resource changes proposed as typed actions.",
        ...OWNER_REVIEW_DELIVERY_ACCEPTANCE,
        ...GROUPED_GOAL_ACCEPTANCE,
      ]);
    }
  });

  it("permits a separate Task only for an explicit independent goal and reuses its key", () => {
    const independent: AppInput = {
      kind: "owner-review",
      data: {
        independentGoal: true,
        goalKey: "deploy-runtime-candidate-abc",
        outcome: "Deploy one independently approved runtime candidate.",
        acceptance: ["Return the correlated activation receipt."],
        externalWait: "approval:candidate-abc",
      },
    };
    const first = taskForMaintenanceInput({
      ...admittedInput(independent),
      id: "request-independent-1",
    });
    const replay = taskForMaintenanceInput({
      ...admittedInput(independent),
      id: "request-independent-2",
    });
    const other = taskForMaintenanceInput({
      ...admittedInput({
        ...independent,
        data: { ...independent.data, goalKey: "deploy-runtime-candidate-def" },
      }),
      id: "request-independent-3",
    });

    expect(first.intent.id).toStartWith("goal/deploy-runtime-candidate-abc-");
    expect(first.intent.id).toBe(replay.intent.id);
    expect(first.intent.id).not.toBe(other.intent.id);
    expect(first.intent).toMatchObject({
      mode: "achieve",
      outcome: "Deploy one independently approved runtime candidate.",
      input: {
        kind: "owner-review",
        data: {
          goalKey: "deploy-runtime-candidate-abc",
          externalWait: "approval:candidate-abc",
        },
      },
    });
    expect(first.intent.acceptance).toEqual([
      "Return the correlated activation receipt.",
      ...OWNER_REVIEW_DELIVERY_ACCEPTANCE,
      ...GROUPED_GOAL_ACCEPTANCE,
    ]);
  });

  it("golden-traces the stable Host obligation contracts through schema and task handling", () => {
    const inputs: AppInput[] = [
      {
        kind: "runtime-deployment.adjudicate-current-host-state",
        data: {
          outcome: "Adjudicate current host state.",
          currentEvidence: { health: "healthy" },
        },
      },
      {
        kind: "runtime-capability-request",
        data: {
          outcome: "Expose a bounded runtime capability.",
          acceptance: ["Prove propagation and default compatibility."],
          evidence: ["sdk-current/src/workflow.ts"],
        },
      },
    ];

    for (const [index, input] of inputs.entries()) {
      expect(Check(app.inputSchema, input)).toBeTrue();
      expect(
        taskForMaintenanceInput({
          ...admittedInput(input),
          id: `aks-request-${index + 1}`,
        }),
      ).toMatchObject({
        kind: "desired",
        intent: {
          id: `app-request/aks-request-${index + 1}`,
          agent: "tech-lead",
          mode: "achieve",
          outcome: input.data.outcome,
          input: { kind: input.kind },
        },
      });
    }
  });

  it("keeps unknown, generic, malformed, and cross-App deployment inputs rejected", () => {
    const rejected = [
      { kind: "unknown-platform-request", data: { outcome: "do anything" } },
      { kind: "request", data: { outcome: "generic catch-all" } },
      {
        kind: "runtime-capability-request",
        data: { outcome: "missing proof" },
      },
      {
        kind: "app-deployment-adjudication",
        data: {
          outcome: "wrong producer",
          requestingApp: "other-app",
          requestingTaskId: "task",
          historicalArtifact: "/tmp/example",
        },
      },
      {
        kind: "protected-agent-config-repair",
        data: {
          outcome: "mutate an unrelated protected config",
          acceptance: ["claim success"],
          requestCorrelation: "appdep_69d1bbe3d001c5aeec77b979",
          targetApp: "other-app",
          targetAgent: "owner",
          configPath: "/app/agents/owner/agent.json",
          field: "model",
          currentValue: "gpt-5.6-sol",
          proposedValue: "claude-opus-5",
          credentialMutation: false,
          requiresHaoApproval: true,
        },
      },
    ];
    for (const input of rejected) {
      expect(Check(app.inputSchema, input)).toBeFalse();
    }
    expect(() =>
      taskForMaintenanceInput({
        id: "wrong-source",
        source: { kind: "system", id: "test" },
        input: {
          kind: "protected-agent-config-repair",
          data: {
            outcome: "request protected mutation",
            acceptance: ["return a terminal result"],
            requestCorrelation: "appdep_69d1bbe3d001c5aeec77b979",
            targetApp: "evaluation",
            targetAgent: "evaluator",
            configPath:
              "/app/projects/evaluation.app/agents/evaluator/agent.json",
            field: "model",
            currentValue: "gpt-5.6-sol",
            proposedValue: "claude-opus-5",
            credentialMutation: false,
            requiresHaoApproval: true,
          },
        },
      }),
    ).toThrow(
      "Unsupported maintenance input kind: protected-agent-config-repair",
    );
    expect(() =>
      taskForMaintenanceInput(
        admittedInput({ kind: "request", data: { outcome: "generic" } }),
      ),
    ).toThrow("Unsupported maintenance input kind: request");
  });
});
