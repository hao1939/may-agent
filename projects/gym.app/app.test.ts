import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import type { AppEvent, AppInput, AppTaskInput } from "@may-agent/sdk";
import { Check } from "typebox/value";
import mayCanary from "./config/may-alignment-canary.json";
import benchmarkMayCanary from "../gym/benchmarks/may-alignment/canary.json";
import gymApp, { resolveGymTask, taskForGymInput } from "./app.ts";

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data,
    target: { appId: "gym", project: "gym" },
    ...extra,
  };
}

function admitted(input: AppInput, id = "request-1"): AppTaskInput {
  return {
    id,
    source: { kind: "system" as const, id: "test" },
    input,
  };
}

describe("canonical Gym App", () => {
  test("keeps the operational canary selection aligned with the Gym benchmark", () => {
    expect(mayCanary).toEqual(benchmarkMayCanary);
  });

  test("keeps May conversational while Gym owns standing operations", () => {
    const mayConfig = JSON.parse(
      readFileSync(
        new URL("../../agents/may/agent.json", import.meta.url),
        "utf8",
      ),
    ) as { tools: string[] };

    expect(mayConfig.tools).not.toContain("cron");
    expect(
      existsSync(new URL("../../agents/may/cron.json", import.meta.url)),
    ).toBe(false);
    expect(gymApp).toMatchObject({
      id: "gym",
      version: 1,
      agent: "gym",
      description: expect.stringContaining("May behavior learning"),
      workspace: { kind: "local", localPath: "../gym" },
      tasks: { maxConcurrent: 2 },
    });
    expect(gymApp).not.toHaveProperty("inbox");
    expect(gymApp.task).toBe(taskForGymInput);
    expect(gymApp.route).toBeUndefined();
    expect(gymApp.tasks?.resolve).toBe(resolveGymTask);
    expect(gymApp.tasks?.subscriptions).toHaveLength(11);
    expect(gymApp.tasks?.subscriptions).toContainEqual({
      type: "project.approval.submitted",
      project: "gym",
    });
    expect(gymApp).not.toHaveProperty("events");
    expect(gymApp).not.toHaveProperty("onEvent");
    expect(gymApp).not.toHaveProperty("taskRoutes");
    expect(gymApp).not.toHaveProperty("taskWorkflows");
    expect(gymApp).not.toHaveProperty("ownerEntry");
    expect(gymApp).not.toHaveProperty("eventGraph");
  });

  test("declares canonical schedules and no duplicate Telegram scanner", () => {
    expect(gymApp.schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "may-training-refill",
          enabled: true,
          intervalMs: 86_400_000,
          event: {
            type: "gym.improvement.requested",
            target: { appId: "gym", project: "gym" },
            data: expect.objectContaining({
              project: "gym",
              agent: "may",
              reason: "curriculum-refill",
              curriculumDrain: true,
            }),
          },
        }),
        expect.objectContaining({
          id: "codex-learning-drain",
          enabled: true,
          intervalMs: 3_600_000,
          event: {
            type: "gym.codex.learning.requested",
            target: { appId: "gym", project: "gym" },
            data: {
              project: "gym",
              reason: "continuous-source-drain",
              batchSize: 200,
              maxBatches: 5,
            },
          },
        }),
        expect.objectContaining({
          id: "design-alignment-review-daily",
          enabled: true,
          intervalMs: 86_400_000,
          event: {
            type: "gym.design-alignment.requested",
            target: { appId: "gym", project: "gym" },
            data: {
              project: "gym",
              reason: "daily-design-alignment-review",
            },
          },
        }),
      ]),
    );
    expect(gymApp.schedules).toHaveLength(3);
    expect(gymApp.schedules.some(({ id }) => id.includes("telegram"))).toBe(
      false,
    );
    expect(gymApp.tasks?.subscriptions).not.toContain(
      "gym.telegram.field-review.requested",
    );
  });

  test("translates actions into canonical App inputs", () => {
    expect(Object.keys(gymApp.actions)).toEqual([
      "improve-may-now",
      "run-regression",
      "report-incident",
      "collect-codex-learning",
      "review-telegram-field",
    ]);
    expect(gymApp.actions["improve-may-now"]?.toInput({})).toEqual({
      kind: "improve-may",
      data: { reason: "manual" },
    });
    expect(
      gymApp.actions["run-regression"]?.toInput({ scenario: "s1" }),
    ).toEqual({
      kind: "run-regression",
      data: { scenario: "s1" },
    });
    expect(
      gymApp.actions["report-incident"]?.toInput({ sessionId: "s1" }),
    ).toEqual({
      kind: "report-incident",
      data: { reason: "manual", sessionId: "s1" },
    });
    expect(
      gymApp.actions["collect-codex-learning"]?.toInput({ maxBatches: 1 }),
    ).toEqual({
      kind: "collect-codex-learning",
      data: {
        reason: "manual-backfill",
        batchSize: 200,
        maxBatches: 1,
      },
    });
    expect(
      gymApp.actions["review-telegram-field"]?.toInput({ batchSize: 40 }),
    ).toEqual({
      kind: "review-telegram-field",
      data: { reason: "manual-field-review", batchSize: 40 },
    });

    const ownerConfig = JSON.parse(
      readFileSync(new URL("./agents/gym/agent.json", import.meta.url), "utf8"),
    ) as { tools: string[] };
    expect(ownerConfig.tools).toEqual(["read-only", "finish"]);
  });

  test("models Telegram field review as one task with a typed Evaluation dependency", () => {
    expect(
      taskForGymInput(
        admitted({
          kind: "review-telegram-field",
          data: { reason: "manual-field-review", batchSize: 40 },
        }),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "input/request-1",
        input: {
          dependency: {
            id: "evaluation-review",
            appId: "evaluation",
            input: {
              kind: "deep-scan",
              data: { requestedBy: "gym", batchSize: 40 },
            },
          },
        },
      },
    });
  });
});

describe("Gym task reconciliation", () => {
  test("reconciles design alignment through one stable agent task", () => {
    const first = resolveGymTask(
      event("gym.design-alignment.requested", {
        reason: "daily-design-alignment-review",
      }),
    );
    const next = resolveGymTask(
      event("gym.design-alignment.requested", {
        reason: "daily-design-alignment-review",
      }),
    );

    expect(first).toEqual(next);
    expect(first).toMatchObject({
      id: "runtime/design-alignment-review",
      mode: "maintain",
      agent: "gym",
      priority: "P2",
      acceptance: expect.arrayContaining([
        expect.stringContaining("latest accepted May behavior"),
        expect.stringContaining("observed sessions"),
        expect.stringContaining("owning App"),
      ]),
    });
    expect(first).not.toHaveProperty("workflow");
  });

  test("keeps periodic task concerns independent and stable", () => {
    const facts = [
      event("gym.improvement.requested", { reason: "daily" }),
      event("gym.codex.learning.requested", { reason: "daily" }),
      event("gym.design-alignment.requested", { reason: "daily" }),
    ];
    const first = facts.map(resolveGymTask);
    const next = facts.map(resolveGymTask);

    expect(first.map((intent) => intent?.id)).toEqual([
      "improve/may",
      "learning/codex-sessions",
      "runtime/design-alignment-review",
    ]);
    expect(next.map((intent) => intent?.id)).toEqual(
      first.map((intent) => intent?.id),
    );
    expect(new Set(first.map((intent) => intent?.id)).size).toBe(3);
  });

  test("keeps Codex learning incremental", () => {
    expect(
      resolveGymTask(
        event("gym.codex.learning.requested", {
          reason: "daily",
          batchSize: 200,
          maxBatches: 1,
        }),
      ),
    ).toMatchObject({
      id: "learning/codex-sessions",
      mode: "maintain",
      workflow: "codex-learning-intake",
      input: {
        contractRevision: 1,
        reason: "daily",
        batchSize: 200,
        maxBatches: 1,
      },
    });
  });

  test("deduplicates incident and learning evidence by semantic identity", () => {
    const firstIncident = resolveGymTask(
      event("gym.incident.detected", { evaluation: { sessionId: "s_failed" } }),
    );
    const duplicateIncident = resolveGymTask(
      event("gym.incident.detected", { evaluation: { sessionId: "s_failed" } }),
    );
    expect(firstIncident?.id).toBe(duplicateIncident?.id);
    expect(firstIncident).toMatchObject({
      parentId: "incident-learning",
      mode: "achieve",
      workflow: "incident-intake",
      input: { kind: "incident", sessionId: "s_failed" },
    });

    const firstEvidence = resolveGymTask(
      event("gym.learning.evidence.observed", {
        polarity: "positive",
        evaluation: { agent: "may", sessionId: "s_good" },
      }),
    );
    const duplicateEvidence = resolveGymTask(
      event("gym.learning.evidence.observed", {
        polarity: "positive",
        evaluation: { agent: "may", sessionId: "s_good" },
      }),
    );
    expect(firstEvidence?.id).toBe(duplicateEvidence?.id);
    expect(firstEvidence).toMatchObject({
      parentId: "incident-learning",
      mode: "achieve",
      workflow: "learning-evidence-intake",
      input: { kind: "learning-evidence", polarity: "positive" },
    });
  });

  test("deduplicates review work and gives explicit recoveries a new identity", () => {
    const original = resolveGymTask(
      event("gym.review.requested", { requestKey: "incident-s_failed" }),
    );
    const duplicate = resolveGymTask(
      event("gym.review.requested", { requestKey: "incident-s_failed" }),
    );
    const recovery = resolveGymTask(
      event("gym.review.requested", {
        requestKey: "incident-s_failed",
        recoveryId: "telegram-46020",
      }),
    );

    expect(duplicate?.id).toBe(original?.id);
    expect(original?.input).toEqual({
      kind: "unknown",
      requestKey: "incident-s_failed",
    });
    expect(recovery?.id).not.toBe(original?.id);
    expect(recovery?.input).toEqual({
      kind: "unknown",
      recoveryId: "telegram-46020",
      requestKey: "incident-s_failed",
    });
  });

  test("uses explicit request identity for each bounded regression run", () => {
    const first = resolveGymTask(
      event("gym.regression.requested", {
        requestId: "request-201",
        benchmark: "may-alignment",
      }),
    );
    const second = resolveGymTask(
      event("gym.regression.requested", {
        requestId: "request-202",
        benchmark: "may-alignment",
      }),
    );
    expect(first?.id).not.toBe(second?.id);
    expect(first).toMatchObject({
      parentId: "regression-assurance",
      mode: "achieve",
      workflow: "regression-run",
      input: { benchmark: "may-alignment", requestId: "request-201" },
    });
    expect(
      resolveGymTask(
        event("gym.regression.requested", { benchmark: "may-alignment" }),
      ),
    ).toBeNull();
  });

  test("binds the frozen comparison and correlation fields into the regression run", () => {
    const requestId = "appdep_42bceb440b8fcd47cf81241f";
    const data = {
      agent: "may",
      benchmark: "may-alignment",
      reason: "frozen-comparison-request",
      scenario: "may-align-proof-before-adopt",
      trials: 1,
      baseline: {
        artifact: "/app/.state/sessions/s_1787238379742_871/result.json",
        sha256:
          "e4d47ca876d70d8f24ec5896c33d4d1824acaced93d85b7ae128e92b8e870cff",
      },
      candidate: {
        commit: "0ff56f626cbfb3646a098deef4042c8b262d1bd3",
        patchSha256:
          "c09007f96d991be0714f7c500afb53a125a5560550fda3ca3a965a0dd3c4aab7",
        repo: "/app/projects/may-agent",
      },
      sampleScope: { scenarios: ["may-align-proof-before-adopt"], trials: 1 },
      requiredProof: ["result", "correlation"],
      constraints: ["do-not-execute-comparison"],
      returnPath:
        "/app/projects/gym/.state/proofs/run-regression-request-correlation/terminal.json",
    };

    expect(Check(gymApp.inputSchema, { kind: "run-regression", data })).toBe(
      true,
    );
    const attachment = taskForGymInput(
      admitted({ kind: "run-regression", data }, requestId),
    );
    expect(attachment).toMatchObject({
      kind: "desired",
      intent: {
        workflow: "regression-run",
        input: { ...data, requestId },
      },
    });
    if (attachment.kind !== "desired") {
      throw new Error("run-regression did not produce a desired task");
    }
    expect(attachment.intent.input).toEqual({ ...data, requestId });
    expect(attachment.intent.input).toHaveProperty(
      "returnPath",
      data.returnPath,
    );
  });

  test("rejects comparison aliases before they can reach the regression run", () => {
    const aliases = [
      "compare-regression",
      "run-comparison",
      "regression-run",
      "run-regression-comparison",
    ];

    for (const kind of aliases) {
      const input = { kind, data: { benchmark: "may-alignment" } };
      expect(Check(gymApp.inputSchema, input)).toBe(false);
      const bypassed = taskForGymInput(
        admitted(input as AppInput, "unrecognized-alias"),
      );
      if (bypassed.kind !== "desired") {
        throw new Error(`${kind} did not produce the defensive fallback task`);
      }
      expect(bypassed.intent.workflow).not.toBe("regression-run");
    }

    expect(
      Check(gymApp.inputSchema, {
        kind: "run-regression",
        data: { agent: "may", benchmark: "may-alignment", trials: 3 },
      }),
    ).toBe(true);
    expect(
      taskForGymInput(
        admitted(
          {
            kind: "run-regression",
            data: { agent: "may", benchmark: "may-alignment", trials: 3 },
          },
          "generic-regression-request",
        ),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        workflow: "regression-run",
        input: {
          agent: "may",
          benchmark: "may-alignment",
          trials: 3,
          requestId: "generic-regression-request",
        },
      },
    });
  });

  test("routes owner comments to request-correlated achieve carriers", () => {
    const subscription = gymApp.subscriptions?.find(
      ({ id }) => id === "project-comment",
    );
    if (!subscription) throw new Error("missing project-comment subscription");
    const input = subscription.toInput(
      event("project.comment.created", {
        comment:
          "Review the current training loop and decide what should happen next.",
        context: { source: "field", sequence: 7 },
      }),
    );
    expect(input).toMatchObject({ kind: "owner-review" });

    const first = taskForGymInput(admitted(input!, "owner request/17"));
    const duplicate = taskForGymInput(admitted(input!, "owner request/17"));
    const distinct = taskForGymInput(admitted(input!, "owner request/18"));

    expect(first).toEqual(duplicate);
    expect(first).toMatchObject({
      kind: "desired",
      intent: {
        mode: "achieve",
        agent: "gym",
        input: {
          requestId: "owner request/17",
          admittedInput: input,
        },
      },
    });
    if (first.kind !== "desired" || distinct.kind !== "desired") {
      throw new Error("owner review input did not produce desired tasks");
    }
    expect(first.intent.id).toMatch(
      /^owner-review\/owner-request-17-[a-f0-9]{16}$/,
    );
    expect(first.intent.id.startsWith("runtime/")).toBe(false);
    expect(distinct.intent.id).not.toBe(first.intent.id);
  });

  test("rejects malformed and unsupported inputs at the declared admission schema", () => {
    expect(
      Check(gymApp.inputSchema, {
        kind: "owner-review",
        data: { comment: "review this" },
      }),
    ).toBe(true);
    expect(Check(gymApp.inputSchema, { kind: "owner-review" })).toBe(false);
    expect(
      Check(gymApp.inputSchema, {
        kind: "owner-review",
        data: "not-an-object",
      }),
    ).toBe(false);
    expect(Check(gymApp.inputSchema, { kind: "unsupported", data: {} })).toBe(
      false,
    );
    expect(
      Check(gymApp.inputSchema, {
        kind: "owner-review",
        data: {},
        extra: true,
      }),
    ).toBe(false);
  });

  test("keeps every other supported input kind out of owner-review carriers", () => {
    const supportedNonOwnerInputs: AppInput[] = [
      { kind: "improve-may", data: {} },
      { kind: "run-regression", data: { benchmark: "may-alignment" } },
      { kind: "report-incident", data: { sessionId: "session-1" } },
      { kind: "collect-codex-learning", data: {} },
      { kind: "review-telegram-field", data: {} },
    ];

    for (const input of supportedNonOwnerInputs) {
      expect(Check(gymApp.inputSchema, input)).toBe(true);
      const attachment = taskForGymInput(admitted(input, "shared-request"));
      if (attachment.kind !== "desired") {
        throw new Error(`${input.kind} did not produce a desired task`);
      }
      expect(attachment.intent.id.startsWith("owner-review/")).toBe(false);
    }
  });

  test("reconciles typed improvement wakes into one maintain task", () => {
    for (const fact of [
      event("gym.improvement.requested", { reason: "manual", trials: 3 }),
      event("agent.revision.changed", {
        agent: "may",
        revision: "sha256:revision",
      }),
      event("project.approval.submitted", {
        taskId: "improve/may",
        approvalId: "approval-303",
      }),
    ]) {
      expect(resolveGymTask(fact)).toMatchObject({
        id: "improve/may",
        mode: "maintain",
        workflow: "improve-agent",
        input: { agent: "may", curriculumDrain: true },
      });
    }
    expect(
      resolveGymTask(
        event("project.approval.submitted", { taskId: "another/task" }),
      ),
    ).toBeNull();
  });

  test("keeps request-specific evidence out of the stable improvement spec", () => {
    const focused = resolveGymTask(
      event("gym.improvement.requested", {
        benchmark: "may-deputy-learning",
        scenarios: ["may-learn-select-skill-or-workflow"],
        trials: 3,
        reason: "approved-system-deputy-pilot",
      }),
    );
    const revision = resolveGymTask(
      event("agent.revision.changed", {
        agent: "may",
        revision: "sha256:new-may",
      }),
    );
    expect(focused).toEqual(revision);
    expect(focused?.input).toEqual({ agent: "may", curriculumDrain: true });
  });

  test("wakes May campaign only for genuine May metric identities", () => {
    expect(
      resolveGymTask(
        event(
          "metric.breach",
          { metricId: "may.telegram-follow-through-rate" },
          { owner: "agent:may" },
        ),
      ),
    ).toMatchObject({
      id: "improve/may",
      input: { agent: "may", curriculumDrain: true },
    });

    expect(
      resolveGymTask(
        event(
          "metric.breach",
          {
            metricId: "  AGENT.MAY.response-quality  ",
            agent: "app-ops",
          },
          { owner: "agent:app-ops" },
        ),
      ),
    ).toMatchObject({
      id: "improve/may",
      input: { agent: "may", curriculumDrain: true },
    });

    for (const breach of [
      event(
        "metric.breach",
        { metricId: "event.unhandled-signal-count-1h" },
        { owner: "agent:may" },
      ),
      event("metric.breach", {
        metricId: "system.unhandled-event-count-1h",
        agent: "may",
      }),
      event(
        "metric.breach",
        {
          metricId: "runtime.unhandled-signal-rate",
          agent: "may",
        },
        { owner: "may" },
      ),
      event(
        "metric.breach",
        { metricId: "aks.task-timeout-rate" },
        { owner: "agent:app-ops" },
      ),
    ]) {
      expect(resolveGymTask(breach)).toBeNull();
    }
  });
});

describe("Gym evaluation frontier", () => {
  test("routes all May evaluations to one stable task", () => {
    const failure = resolveGymTask(
      event(
        "evaluation.recorded",
        {
          evaluation: {
            agent: "may",
            lane: "needs_triage",
            verdict: "needs_improvement",
            sessionId: "s_bad_may_run",
          },
        },
        { source: "evaluator-aftermath" },
      ),
    );
    const success = resolveGymTask(
      event("evaluation.recorded", {
        evaluation: {
          agent: "may",
          lane: "success_candidate",
          verdict: "good",
          sessionId: "s_good_may_run",
        },
      }),
    );
    expect(failure).toMatchObject({
      id: "runtime/evaluation-intake",
      mode: "maintain",
      workflow: "evaluation-intake",
    });
    expect(success?.id).toBe(failure?.id);
    expect(success?.input).toEqual({ contractRevision: 1 });
  });

  test("ignores non-May evaluations", () => {
    expect(
      resolveGymTask(
        event("evaluation.recorded", {
          evaluation: {
            agent: "coder",
            lane: "needs_triage",
            verdict: "needs_improvement",
          },
        }),
      ),
    ).toBeNull();
  });

  test("ignores structured skips because they contain no behavior evidence", () => {
    expect(
      resolveGymTask(
        event("evaluation.recorded", {
          evaluation: {
            agent: "may",
            verdict: "skipped",
            sessionId: "s_missing_evidence",
          },
        }),
      ),
    ).toBeNull();
  });
});
