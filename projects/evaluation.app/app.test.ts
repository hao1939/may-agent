import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { Check } from "typebox/value";
import {
  matchesEventSelector,
  type AppEvent,
  type AppInput,
  type AppTaskInput,
} from "@may-agent/sdk";
import app, {
  taskForEvaluationInput,
  taskInputForEvent,
  taskIntentForEvent,
  taskIntentForInput,
  validateEvaluationTaskAction,
} from "./app.ts";
import {
  PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE,
  projectHealthEvaluatorAgentPrompt,
} from "./agents/evaluator/workflows/project-health-evaluator.ts";
import { metricReviewTaskId } from "./agents/evaluator/workflows/lib/metric-selection.ts";
import { AppInboxHost } from "../may-agent/src/app/core/inbox/app-inbox-host.ts";
import { createAppInboxItem } from "../may-agent/src/app/core/state/app-inbox-store.ts";
import { admitTaskInput } from "../may-agent/src/app/core/state/inbox.ts";
import { appTaskTestContext } from "../may-agent/src/app/core/tasks/app-task-test-support.ts";
import {
  assertAppTaskClaimCurrent,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
} from "../may-agent/src/app/core/tasks/app-task-reconciler.ts";
import { applyDbSchema } from "../may-agent/src/lib/db/schema.ts";
import { canonicalAppEvent } from "../may-agent/src/app/canonical-app-event.ts";

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

function admitted(input: AppInput): AppTaskInput {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
  };
}

describe("canonical evaluation App", () => {
  test("declares one canonical manifest and no legacy route authority", () => {
    expect(app).toMatchObject({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      description: expect.stringContaining(
        "read-reports with operation list/read",
      ),
      tasks: { maxConcurrent: 1 },
    });
    expect(app).not.toHaveProperty("inbox");
    expect(app.task).toBe(taskForEvaluationInput);
    expect(app.route).toBeUndefined();
    expect(app.tasks?.resolve).toBe(taskIntentForEvent);
    expect(app.tasks?.subscriptions).not.toBeEmpty();
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "metric.breach",
      "metric.recovered",
      "project-comment",
      "project-owner-request",
      "telegram-owner-reply",
      "task-incomplete-review",
    ]);
    // The installed rollout may intentionally enable the bounded selector.
    // Control the inherited manifest environment instead of treating that
    // configured schedule as candidate drift.
    const automaticEnabled =
      process.env.EVALUATION_AUTO_REVIEW_ENABLED?.trim().toLowerCase() ===
      "true";
    expect(app.schedules?.map(({ id }) => id)).toEqual(
      automaticEnabled ? ["task-outcome-selector"] : [],
    );
    for (const schedule of app.schedules ?? []) {
      expect(schedule).toMatchObject({
        input: { kind: "automatic-review", data: { reason: "scheduled" } },
        catchUp: "latest",
      });
      expect(schedule).not.toHaveProperty("event");
    }
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(app).not.toHaveProperty("budget");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  test("keeps subject generation a positive safe integer across App and action admission", () => {
    const actionSchema = app.actions?.["review-task-outcome"]?.inputSchema;
    expect(actionSchema).toBeDefined();

    const appInput = (subjectGeneration?: number) => ({
      kind: "review-task-outcome",
      data: {
        appId: "may",
        taskId: "goal/example",
        ...(subjectGeneration === undefined ? {} : { subjectGeneration }),
      },
    });
    const actionInput = (subjectGeneration?: number) => ({
      appId: "may",
      taskId: "goal/example",
      ...(subjectGeneration === undefined ? {} : { subjectGeneration }),
    });

    expect(Check(app.inputSchema, appInput())).toBeTrue();
    expect(Check(actionSchema!, actionInput())).toBeTrue();
    expect(Check(app.inputSchema, appInput(1))).toBeTrue();
    expect(Check(actionSchema!, actionInput(1))).toBeTrue();
    expect(taskIntentForInput(appInput(1))).toMatchObject({
      input: { subjectGeneration: 1 },
    });

    for (const invalid of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(Check(app.inputSchema, appInput(invalid))).toBeFalse();
      expect(Check(actionSchema!, actionInput(invalid))).toBeFalse();
    }
  });

  test("keeps canonical App-input actions without a legacy project-review alias", () => {
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

  test("retires the legacy Codex trial behind the guarded no-model workflow", () => {
    const input = app.actions?.["trial-codex-goal-review"]?.toInput?.({
      targetProject: "may-agent.app",
      focus: "Check whether the Task mental model matches current code.",
    });
    expect(input).toEqual({
      kind: "codex-goal-trial",
      data: {
        targetProject: "may-agent.app",
        focus: "Check whether the Task mental model matches current code.",
      },
    });
    expect(taskIntentForInput(input!)).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/compat\/codex-goal-trial\/may-agent\.app\/[a-f0-9]{12}$/,
      ),
      workflow: "executor-trial",
      input: { targetProject: "may-agent.app", trial: true, readOnly: true },
    });
    expect(taskIntentForInput(input!)).not.toHaveProperty("executor");
    expect(
      app.schedules?.some((schedule) => schedule.id.includes("codex-goal")),
    ).toBeFalse();
  });

  test("holds goal semantics constant across isolated executor trial siblings", () => {
    const data = {
      targetProject: "may-agent.app",
      focus: "Check whether the Task mental model matches current code.",
    };
    const codexInput =
      app.actions?.["trial-codex-goal-review"]?.toInput?.(data);
    const workflowInput =
      app.actions?.["trial-workflow-review"]?.toInput?.(data);
    const codex = taskIntentForInput(codexInput!);
    const workflow = taskIntentForInput(workflowInput!);

    expect(workflowInput).toEqual({ kind: "workflow-trial", data });
    expect(workflow).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/compat\/workflow-trial\/may-agent\.app\/[a-f0-9]{12}$/,
      ),
      workflow: "executor-trial",
      input: { targetProject: "may-agent.app", trial: true, readOnly: true },
    });
    expect(workflow?.outcome).toBe(codex?.outcome);
    expect(workflow?.acceptance).toEqual(codex?.acceptance);
    expect(workflow?.input).toEqual(codex?.input);
    expect(workflow?.id).not.toBe(codex?.id);
    expect(workflow).not.toHaveProperty("executor");
    expect(codex).not.toHaveProperty("executor");
    expect(codex?.workflow).toBe("executor-trial");
  });

  test("routes legacy Evaluation self-review trials to the zero-model guard", () => {
    const input = app.actions?.["trial-codex-goal-review"]?.toInput?.({
      targetProject: "evaluation.app",
      focus: "Assess Evaluation itself.",
    });
    expect(taskForEvaluationInput(admitted(input!))).toMatchObject({
      kind: "desired",
      intent: {
        workflow: "executor-trial",
        input: {
          targetProject: "evaluation.app",
          readOnly: true,
        },
      },
    });
    expect(taskForEvaluationInput(admitted(input!))).not.toHaveProperty(
      "intent.executor",
    );
  });

  test("resolves every admitted input to one task", () => {
    expect(
      taskForEvaluationInput(
        admitted({
          kind: "message",
          data: { message: "Please inspect the result" },
        }),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: {
        id: "runtime/compat/input/request-1",
        agent: "evaluator",
        executor: "codex-goal",
      },
    });
  });

  test("declaratively retires legacy metrics without a metric breach wake lane", () => {
    expect(app.tasks?.maxConcurrent).toBe(1);
    expect(app.metrics).toHaveLength(11);
    expect(
      app.metrics?.every((metric) => metric.status === "retired"),
    ).toBeTrue();
    expect(app.metrics?.map((metric) => metric.id)).toContain(
      "eval.llm-coverage-lag-h",
    );
    expect(app.metrics?.map((metric) => metric.id)).toContain(
      "eval.llm-evals-24h",
    );
    expect(app.tasks?.subscriptions).not.toContain("metric.breach");
    expect(app.tasks?.subscriptions).not.toContain("metric.recovered");
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
    expect(app).not.toHaveProperty("inbox");

    const ended = event("session.end", {
      sessionId: "s_route_audit",
      agent: "coder",
    });
    expect(
      (app.subscriptions ?? []).some((subscription) =>
        matchesEventSelector(subscription.event, ended),
      ),
    ).toBeFalse();
    expect(taskIntentForEvent(ended)).toBeNull();
  });

  test("does not route automatic session endings into retired semantic review", () => {
    for (const agent of [
      "may",
      "gym",
      "evaluator",
      "evaluator-deepseek",
      "judge",
    ]) {
      expect(
        taskIntentForEvent(
          event("session.end", {
            sessionId: `s-${agent}`,
            agent,
            status: "error",
          }),
        ),
      ).toBeNull();
    }
  });

  test("creates an independent correction task that cannot reuse the inaccurate evaluation", () => {
    expect(
      taskIntentForEvent(
        event("evaluation.session.requested", {
          sessionId: "s_resume_lifecycle",
          supersedeExisting: true,
          correctionId: "complete-terminal-lifecycle-v1",
        }),
      ),
    ).toMatchObject({
      id: "runtime/compat/session-aftermath-repair/s_resume_lifecycle/complete-terminal-lifecycle-v1",
      input: {
        sessionId: "s_resume_lifecycle",
        supersedeExisting: true,
        correctionId: "complete-terminal-lifecycle-v1",
      },
    });
  });

  test("rejects unscoped aftermath requests while concrete requests proceed", () => {
    expect(
      taskIntentForEvent(event("evaluation.session.requested")),
    ).toBeNull();
    expect(
      taskIntentForInput({ kind: "evaluate-session", data: {} }),
    ).toBeNull();
    expect(
      taskIntentForEvent(
        event("evaluation.session.requested", {
          sessionId: "s_concrete_request",
        }),
      ),
    ).toMatchObject({
      id: "runtime/compat/session-aftermath/s_concrete_request",
      workflow: "evaluator-aftermath",
      input: { sessionId: "s_concrete_request" },
    });
  });

  test("does not admit retired metric breach or recovery events", () => {
    for (const type of ["metric.breach", "metric.recovered"]) {
      expect(
        taskInputForEvent(
          event(
            type,
            { metricId: "eval.llm-coverage-lag-h" },
            { owner: "agent:evaluator" },
          ),
        ),
      ).toBeNull();
    }
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

  test("routes exact review failures as trigger evidence without revising standing owner input", () => {
    const input = taskInputForEvent(
      event("evaluation.review_failed", {
        sessionId: "s-1",
        reason: "artifact invalid",
      }),
    );
    expect(input).toMatchObject({
      kind: "owner-review",
      data: {
        reason: "review-failed",
        reviewFailure: { sessionId: "s-1", reason: "artifact invalid" },
      },
    });
    expect(taskIntentForInput(input!)).toMatchObject({
      id: "runtime/compat/owner-review",
      input: { scope: "evaluation.app" },
    });
    expect(taskIntentForInput(input!)).not.toHaveProperty(
      "input.reviewFailure",
    );
  });
});

describe("evaluation task policy", () => {
  test("keeps owner generation stable and replays durable wake evidence after active work", () => {
    const root = mkdtempSync(join(tmpdir(), "evaluation-owner-evidence-"));
    const config = appTaskTestContext({
      appDir: root,
      appId: "evaluation",
      agent: "evaluator",
      maxConcurrent: 1,
      tree: {
        groups: {
          "evaluation-system": {
            id: "evaluation-system",
            parent_id: null,
          },
        },
      },
    });
    const reviewFailure = (
      eventId: number,
      taskId: string,
      error: string,
    ): Record<string, unknown> => ({
      ...event(
        "evaluation.review_failed",
        {
          reason: "automatic-evidence-acquisition-failed",
          stage: "subject-evidence-acquisition",
          appId: "may",
          taskId,
          error,
        },
        { target: { appId: "evaluation", project: "evaluation" } },
      ),
      eventId,
    });
    const tick: Record<string, unknown> = {
      ...event(
        "evaluation.tick",
        { reason: "scheduled" },
        { target: { appId: "evaluation", project: "evaluation" } },
      ),
      eventId: 103,
    };
    const observe = (trigger: Record<string, unknown>) => {
      const intent = taskIntentForEvent(
        trigger as AppEvent<Record<string, unknown>>,
      );
      if (!intent) throw new Error("expected owner intent");
      return observeAppTaskIntent(config, {
        intent,
        appAgent: "evaluator",
        trigger,
      });
    };

    try {
      const failureA = reviewFailure(101, "goal/a", "catalog unavailable A");
      const failureB: Record<string, unknown> = {
        ...event("project.task.reconciled", {
          project: "evaluation",
          taskId: "runtime/task-outcome/example",
          generation: 1,
          attemptId: "failed-review-attempt",
          disposition: "incomplete",
        }),
        eventId: 102,
      };
      const failureAReplay = reviewFailure(
        104,
        "goal/a",
        "catalog unavailable A",
      );
      expect(observe(failureA)).toMatchObject({
        taskId: "runtime/compat/owner-review",
        generation: 1,
      });
      let firstClaim = claimObservedAppTask(config, {
        taskId: "runtime/compat/owner-review",
        appAgent: "evaluator",
        handler: "agent:evaluator",
      });
      if (firstClaim.kind !== "claimed")
        throw new Error("expected first owner claim");
      expect(firstClaim.intent.input).toEqual({ scope: "evaluation.app" });
      expect(firstClaim.events.map(({ event }) => event)).toEqual([failureA]);

      const failed = failAppTaskAttempt(config, firstClaim, "Owner provider unavailable");
      expect(failed.status).toBe("retrying");
      expect(config.resourceStore.readTask(firstClaim.taskId)?.status.phase).toBe("pending");
      const realNow = Date.now;
      try {
        Date.now = () => failed.retryAt! + 1;
        firstClaim = claimObservedAppTask(config, {
          taskId: "runtime/compat/owner-review",
          appAgent: "evaluator",
          handler: "agent:evaluator",
        });
      } finally {
        Date.now = realNow;
      }
      if (firstClaim.kind !== "claimed") throw new Error("expected owner retry claim");
      expect(firstClaim.generation).toBe(1);
      expect(firstClaim.events.map(({ event }) => event)).toEqual([failureA]);

      for (const trigger of [failureB, tick, failureAReplay]) {
        expect(observe(trigger)).toMatchObject({ generation: 1 });
        expect(() =>
          assertAppTaskClaimCurrent(config, firstClaim),
        ).not.toThrow();
      }
      expect(config.resourceStore.readTask(firstClaim.taskId)).toMatchObject({
        metadata: { generation: 1 },
        spec: { input: { scope: "evaluation.app" } },
        status: {
          phase: "running",
          currentAttemptId: firstClaim.attemptId,
        },
      });

      expect(
        completeAppTask(config, firstClaim, {
          summary: "Handled the first failure; newer wakes remain pending.",
          facts: ["owner-reviewed:event-101"],
        }),
      ).toMatchObject({ status: "applied", taskContinues: true });
      const secondClaim = claimObservedAppTask(config, {
        taskId: firstClaim.taskId,
        appAgent: "evaluator",
        handler: "agent:evaluator",
      });
      if (secondClaim.kind !== "claimed")
        throw new Error("expected replay owner claim");
      expect(secondClaim.generation).toBe(1);
      expect(secondClaim.intent.input).toEqual({ scope: "evaluation.app" });
      expect(secondClaim.events.map(({ event }) => event)).toEqual([
        failureB,
        tick,
        failureAReplay,
      ]);
      expect(
        config.resourceStore.readAttempt(secondClaim.attemptId)?.events,
      ).toEqual(secondClaim.events);
      const secondCompletion = completeAppTask(config, secondClaim, {
        summary: "Consumed the retained owner wake batch.",
        facts: ["owner-reviewed:events-102-104"],
      });
      expect(secondCompletion).toMatchObject({ status: "applied" });
      expect(secondCompletion).not.toHaveProperty("taskContinues");
      expect(config.resourceStore.readTask(firstClaim.taskId)).toMatchObject({
        metadata: { generation: 1 },
        status: { phase: "converged", observedGeneration: 1 },
      });
    } finally {
      config.resourceStore.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

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
      "runtime/compat/session-aftermath/".length + 120,
    );
  });

  test("uses the complete normalized assessment contract as review identity", () => {
    const review = (data: Record<string, unknown>) =>
      taskIntentForInput({
        kind: "review-task-outcome",
        data: { appId: "may", taskId: "goal/example", ...data },
      });
    const omittedPurpose = review({});
    const explicitOutcome = review({ assessmentPurpose: "outcome" });
    const generationOnly = review({ subjectGeneration: 3 });
    const evidenceOnly = review({ evidenceHash: "a".repeat(64) });
    const full = review({
      subjectGeneration: 3,
      evidenceHash: "a".repeat(64),
    });
    const duplicate = review({
      assessmentPurpose: "outcome",
      subjectGeneration: 3,
      evidenceHash: "a".repeat(64),
    });
    const changedEvidence = review({
      subjectGeneration: 3,
      evidenceHash: "b".repeat(64),
    });
    const ongoing = review({ assessmentPurpose: "ongoing" });
    const automatic = review({ automatic: true });

    expect(omittedPurpose).toEqual(explicitOutcome);
    expect(automatic?.id).not.toBe(omittedPurpose?.id);
    expect(automatic?.input).toMatchObject({ automatic: true });
    expect(full).toEqual(duplicate);
    expect(review({ taskId: "goal/example" })?.id).not.toBe(
      review({ taskId: "goal-example-96ccaaaa0f4c" })?.id,
    );
    expect(
      new Set([
        omittedPurpose?.id,
        generationOnly?.id,
        evidenceOnly?.id,
        full?.id,
        changedEvidence?.id,
        ongoing?.id,
      ]).size,
    ).toBe(6);
    expect(omittedPurpose).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/task-outcome\/v2\/may\/goal-example-[a-f0-9]{12}\/outcome\/contract-[a-f0-9]{64}$/,
      ),
      input: { assessmentPurpose: "outcome" },
    });
    expect(generationOnly?.id).toContain("/outcome/generation-3/contract-");
    expect(evidenceOnly?.id).toContain(`/outcome/evidence-${"a".repeat(64)}`);
    expect(full?.id).toContain(
      `/outcome/generation-3/evidence-${"a".repeat(64)}`,
    );
    expect(ongoing).toMatchObject({
      id: expect.stringMatching(
        /^runtime\/task-outcome\/v2\/may\/goal-example-[a-f0-9]{12}\/ongoing\/contract-[a-f0-9]{64}$/,
      ),
      workflow: "task-outcome-review",
      input: { assessmentPurpose: "ongoing" },
    });
  });

  test("recovers saved unpinned reviews without changing the historical collided Task", async () => {
    const root = mkdtempSync(join(tmpdir(), "evaluation-v2-admission-"));
    const config = appTaskTestContext({
      appDir: root,
      appId: "evaluation",
      agent: "evaluator",
      maxConcurrent: 1,
      tree: {
        groups: {
          "evaluation-system": { id: "evaluation-system", parent_id: null },
        },
      },
    });
    applyDbSchema(config.resourceStore.db);
    const subject = {
      appId: "may",
      taskId: "goal/historical-subject",
      assessmentPurpose: "ongoing",
    } as const;
    const currentPinned = taskIntentForInput({
      kind: "review-task-outcome",
      data: { ...subject, subjectGeneration: 1 },
    })!;
    const historicalPinned = {
      ...currentPinned,
      id: currentPinned.id
        .replace("runtime/task-outcome/v2/", "runtime/task-outcome/")
        .replace("/generation-1", "")
        .replace(/\/contract-[a-f0-9]{64}$/, ""),
    };
    const callerAdmissionKey = "task:historical-caller";
    observeAppTaskIntent(config, {
      appAgent: "evaluator",
      intent: historicalPinned,
      creator: { appId: "may", taskId: subject.taskId },
      admissionKey: callerAdmissionKey,
    });
    const claim = claimObservedAppTask(config, {
      taskId: historicalPinned.id,
      appAgent: "evaluator",
      handler: "workflow:task-outcome-review",
    });
    if (claim.kind !== "claimed") throw new Error("expected historical claim");
    const reviewAt = Date.now() + 86_400_000;
    deferAppTask(config, claim, {
      disposition: "waiting",
      report: true,
      summary: "Semantic allowance is exhausted",
      facts: ["allowance:budget-deferred"],
      reviewAt,
    });
    const before = config.resourceStore.readTask(historicalPinned.id);
    const beforeAttempt = config.resourceStore.readAttempt(claim.attemptId);
    const beforeCallerAdmission = config.resourceStore.readTaskContext({
      taskIds: [],
      admissionIds: [callerAdmissionKey],
    }).appTaskAdmissions?.[callerAdmissionKey];

    const requestIds = ["periodic-a", "periodic-b", "periodic-c"];
    for (const id of requestIds) {
      createAppInboxItem(config.resourceStore.db, {
        id,
        appId: "evaluation",
        source: { kind: "system", id: "periodic-review" },
        input: { kind: "review-task-outcome", data: subject },
      });
    }
    const failures: string[] = [];
    const host = new AppInboxHost({
      db: config.resourceStore.db,
      apps: [app],
      attachTask: (input) => admitTaskInput(config, input),
      onFailure: (failure) => failures.push(failure.error),
    });
    try {
      await host.recoverAdmissions();
      const recoveredId = taskIntentForInput({
        kind: "review-task-outcome",
        data: subject,
      })!.id;
      expect(recoveredId).not.toBe(historicalPinned.id);
      expect(requestIds.map((id) => host.get(id)?.waitingOn)).toEqual(
        requestIds.map(() => ({ kind: "task", id: recoveredId })),
      );
      expect(failures).toEqual([]);
      expect(config.resourceStore.readTask(historicalPinned.id)).toEqual(
        before,
      );
      expect(config.resourceStore.readAttempt(claim.attemptId)).toEqual(
        beforeAttempt,
      );
      expect(before).toMatchObject({
        metadata: {
          creator: { appId: "may", taskId: subject.taskId },
          generation: 1,
        },
        status: {
          phase: "waiting",
          facts: ["allowance:budget-deferred"],
          reviewAt,
        },
      });
      expect(
        config.resourceStore.readTaskContext({
          taskIds: [],
          admissionIds: [callerAdmissionKey],
        }).appTaskAdmissions?.[callerAdmissionKey],
      ).toEqual(beforeCallerAdmission);

      const recoveredContext = config.resourceStore.readTaskContext({
        taskIds: [recoveredId],
        admissionIds: requestIds.map((id) => `task:${id}`),
      });
      expect(
        requestIds.map(
          (id) => recoveredContext.appTaskAdmissions?.[`task:${id}`]?.taskId,
        ),
      ).toEqual(requestIds.map(() => recoveredId));
      expect(
        Object.values(recoveredContext.attempts ?? {}).filter(
          (attempt) => attempt.taskId === recoveredId,
        ),
      ).toEqual([]);
      expect(config.resourceStore.readTask(recoveredId)).toMatchObject({
        metadata: { creator: { appId: "evaluation" }, generation: 1 },
        spec: {
          input: { ...subject },
          workflow: "task-outcome-review",
        },
        status: { phase: "pending" },
      });

      const recoveredBeforeReplay = config.resourceStore.readTask(recoveredId);
      await host.recoverAdmissions();
      expect(config.resourceStore.readTask(recoveredId)).toEqual(
        recoveredBeforeReplay,
      );
      expect(requestIds.map((id) => host.get(id)?.waitingOn)).toEqual(
        requestIds.map(() => ({ kind: "task", id: recoveredId })),
      );
    } finally {
      host.close();
      config.resourceStore.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("canonical metric signals preserve an exact target, cut and configured reviewer", () => {
    const previousEnabled = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    const previousReviewer = process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
    try {
      process.env.EVALUATION_AUTO_REVIEW_ENABLED = "true";
      process.env.EVALUATION_AUTO_REVIEW_REVIEWER = "evaluator-deepseek";
      const measuredAt = 1_790_882_300_000;
      const canonical = canonicalAppEvent({
        type: "metric.breach",
        source: "metrics",
        owner: "host",
        timestamp: measuredAt + 999,
        data: {
          metricId: "may.daemon-sql-time-percent",
          measuredAt,
          alertId: 7,
        },
      });
      expect(canonical).not.toHaveProperty("timestamp");
      const input = subscription("metric.breach").toInput(canonical);
      expect(input).toEqual({
        kind: "review-metric",
        data: {
          metricId: "may.daemon-sql-time-percent",
          end: measuredAt + 1,
          reviewer: "evaluator-deepseek",
          automatic: true,
          alertId: 7,
        },
      });
      expect(Check(app.inputSchema, input)).toBeTrue();
      const sqlIntent = taskIntentForInput(input!);
      expect(sqlIntent).toMatchObject({
        id: metricReviewTaskId(
          "may.daemon-sql-time-percent",
          "evaluator-deepseek",
        ),
        workflow: "metric-review",
        input: {
          metricId: "may.daemon-sql-time-percent",
          end: measuredAt + 1,
          reviewer: "evaluator-deepseek",
          automatic: true,
          alertId: 7,
        },
      });
      expect(sqlIntent?.priority).toBe("P1");
      expect(
        taskInputForEvent({
          ...canonical,
          data: { ...canonical.data, repeat: true },
        }),
      ).toBeNull();

      const otherInput = taskInputForEvent(
        event("metric.recovered", {
          alertId: 8,
          metricId: "sample.other",
          measuredAt: measuredAt + 10,
        }),
      )!;
      const otherIntent = taskIntentForInput(otherInput);
      const scheduledIntent = taskIntentForInput({
        kind: "automatic-review",
        data: { reason: "scheduled" },
      });
      expect(otherIntent?.id).toBe(
        metricReviewTaskId("sample.other", "evaluator-deepseek"),
      );
      expect(otherIntent?.id).not.toBe(sqlIntent?.id);
      expect(otherIntent).toMatchObject({
        priority: "P1",
        input: { alertId: 8 },
      });
      expect(scheduledIntent?.id).toBe("runtime/task-outcome-selector");
      expect(scheduledIntent?.id).not.toBe(sqlIntent?.id);

      const failed = canonicalAppEvent({
        type: "metric.measurement.failed",
        source: "metrics",
        owner: "host",
        timestamp: measuredAt + 20,
        data: {
          metricId: "may.daemon-sql-time-percent",
          reason: "read failed",
          triggerEventId: "trigger-1",
        },
      });
      expect(failed).not.toHaveProperty("timestamp");
      expect(taskInputForEvent(failed)).toBeNull();
      expect(
        taskInputForEvent(
          event("metric.stalled", { metricId: "sample.other", measuredAt }),
        ),
      ).toBeNull();
    } finally {
      if (previousEnabled === undefined)
        delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      else process.env.EVALUATION_AUTO_REVIEW_ENABLED = previousEnabled;
      if (previousReviewer === undefined)
        delete process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
      else process.env.EVALUATION_AUTO_REVIEW_REVIEWER = previousReviewer;
    }
  });

  test("routes production failure dispositions only when automatic review is enabled", () => {
    const previousEnabled = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    const previousReviewer = process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
    try {
      delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      delete process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
      const failed = event("project.task.reconciled", {
        project: "may",
        taskId: "goal/example",
        generation: 3,
        disposition: "retrying",
      });
      expect(taskInputForEvent(failed)).toBeNull();
      process.env.EVALUATION_AUTO_REVIEW_ENABLED = "true";
      for (const disposition of ["incomplete", "retrying"]) {
        expect(
          taskInputForEvent(
            event("project.task.reconciled", {
              project: "may",
              taskId: "goal/example",
              generation: 3,
              disposition,
            }),
          ),
        ).toEqual({
          kind: "review-task-outcome",
          data: {
            appId: "may",
            taskId: "goal/example",
            assessmentPurpose: "ongoing",
            automatic: true,
          },
        });
      }
      expect(
        taskInputForEvent(
          event("project.task.reconciled", {
            project: "may",
            taskId: "goal/example",
            generation: 3,
            disposition: "converged",
          }),
        ),
      ).toBeNull();
    } finally {
      if (previousEnabled === undefined)
        delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      else process.env.EVALUATION_AUTO_REVIEW_ENABLED = previousEnabled;
      if (previousReviewer === undefined)
        delete process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
      else process.env.EVALUATION_AUTO_REVIEW_REVIEWER = previousReviewer;
    }
  });

  test("returns Evaluation execution failures to its existing owner without self-assessment or recursive owner wakes", () => {
    const previous = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    try {
      delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      for (const disposition of ["incomplete", "retrying"]) {
        const failure = {
          project: "evaluation",
          taskId: "runtime/task-outcome/example",
          generation: 3,
          attemptId: "failed-attempt",
          disposition,
        };
        const input = taskInputForEvent(event("project.task.reconciled", failure));
        expect(input).toEqual({
          kind: "owner-review",
          data: { reason: "task-execution-failed", reviewFailure: failure },
        });
        expect(taskIntentForInput(input!)).toMatchObject({
          id: "runtime/compat/owner-review",
          agent: "evaluator",
          input: { scope: "evaluation.app" },
        });
        expect(taskInputForEvent(event("project.task.reconciled", {
          ...failure, project: "evaluation.app",
        }))?.kind).toBe("owner-review");
        expect(taskInputForEvent(event("project.task.reconciled", {
          ...failure, project: "evaluator-deepseek",
        }))).toBeNull();
        expect(taskInputForEvent(event("project.task.reconciled", {
          ...failure, taskId: "runtime/compat/owner-review",
        }))).toBeNull();
        expect(taskInputForEvent(event("project.task.reconciled", {
          ...failure, taskId: "",
        }))).toBeNull();
      }
      for (const disposition of ["converged", "waiting", "progress"]) {
        expect(taskInputForEvent(event("project.task.reconciled", {
          project: "evaluation", taskId: "runtime/task-outcome/example", disposition,
        }))).toBeNull();
      }
    } finally {
      if (previous === undefined) delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      else process.env.EVALUATION_AUTO_REVIEW_ENABLED = previous;
    }
  });

  test("routes new automatic failure reviews through the configured DeepSeek reviewer", () => {
    const previousEnabled = process.env.EVALUATION_AUTO_REVIEW_ENABLED;
    const previousReviewer = process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
    try {
      process.env.EVALUATION_AUTO_REVIEW_ENABLED = "true";
      process.env.EVALUATION_AUTO_REVIEW_REVIEWER = "evaluator-deepseek";
      expect(
        taskInputForEvent(
          event("project.task.reconciled", {
            project: "may",
            taskId: "goal/example",
            generation: 3,
            disposition: "incomplete",
          }),
        ),
      ).toEqual({
        kind: "review-task-outcome",
        data: {
          appId: "may",
          taskId: "goal/example",
          assessmentPurpose: "ongoing",
          automatic: true,
          reviewer: "evaluator-deepseek",
        },
      });
    } finally {
      if (previousEnabled === undefined)
        delete process.env.EVALUATION_AUTO_REVIEW_ENABLED;
      else process.env.EVALUATION_AUTO_REVIEW_ENABLED = previousEnabled;
      if (previousReviewer === undefined)
        delete process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
      else process.env.EVALUATION_AUTO_REVIEW_REVIEWER = previousReviewer;
    }
  });

  test("preserves assessment purpose from a review request into workflow input", () => {
    const input = taskInputForEvent(
      event("evaluation.task.review.requested", {
        appId: "may",
        taskId: "goal/example",
        subjectGeneration: 7,
        evidenceHash: "b".repeat(64),
        assessmentPurpose: "ongoing",
      }),
    );
    expect(input).toEqual({
      kind: "review-task-outcome",
      data: {
        appId: "may",
        taskId: "goal/example",
        subjectGeneration: 7,
        evidenceHash: "b".repeat(64),
        assessmentPurpose: "ongoing",
        automatic: true,
      },
    });
    expect(taskIntentForInput(input!)).toMatchObject({
      workflow: "task-outcome-review",
      input: {
        subjectGeneration: 7,
        evidenceHash: "b".repeat(64),
        assessmentPurpose: "ongoing",
        automatic: true,
      },
    });
  });

  test("keeps every supported input independent of retired legacy grouping parents", () => {
    const inputs: AppInput[] = [
      {
        kind: "review-task-outcome",
        data: { appId: "may", taskId: "goal/example" },
      },
      { kind: "read-reports", data: { operation: "list" } },
      { kind: "automatic-review", data: {} },
      { kind: "evaluate-session", data: { sessionId: "s-example" } },
      { kind: "deep-eval", data: { sessionId: "s-example" } },
      { kind: "deep-scan", data: {} },
      { kind: "project-review", data: { targetProject: "may.app" } },
      {
        kind: "codex-goal-trial",
        data: { targetProject: "may.app", focus: "bounded check" },
      },
      {
        kind: "workflow-trial",
        data: { targetProject: "may.app", focus: "bounded check" },
      },
      {
        kind: "feedback-record",
        data: {
          evaluation: {
            sessionId: "s-example",
            agent: "may",
            quality: 0.5,
            verdict: "needs_improvement",
            issues: ["Missing evidence."],
          },
        },
      },
      { kind: "owner-review", data: {} },
    ];
    const intents = inputs.map((input) => taskIntentForInput(input));
    for (const intent of intents) {
      expect(intent).not.toBeNull();
      expect(intent?.parentId).toBe("evaluation-system");
    }
    expect(intents.slice(0, 3).map((intent) => intent?.id)).toEqual([
      expect.stringMatching(
        /^runtime\/task-outcome\/v2\/may\/goal-example-[a-f0-9]{12}\/outcome\/contract-[a-f0-9]{64}$/,
      ),
      "runtime/report-reader/latest",
      "runtime/task-outcome-selector",
    ]);
    for (const intent of intents.slice(3)) {
      expect(intent?.id).toStartWith("runtime/compat/");
    }
    expect(
      taskForEvaluationInput({
        id: "app_message",
        input: { kind: "message", data: { message: "Review this" } },
      } as AppTaskInput).intent,
    ).toMatchObject({
      id: "runtime/compat/input/app_message",
      parentId: "evaluation-system",
    });
  });

  test("uses standing maintain tasks for recurring responsibilities", () => {
    expect(
      taskIntentForInput({
        kind: "owner-review",
        data: { reason: "metric.breach" },
      }),
    ).toMatchObject({
      id: "runtime/compat/owner-review",
      agent: "evaluator",
      executor: "codex-goal",
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
      id: "runtime/compat/evaluation-feedback/may",
      workflow: "evaluation-feedback-projection",
      input: { evaluation, feedbackKey: "may" },
    });
    expect(
      taskIntentForInput({
        kind: "owner-review",
        data: { reason: "scheduled" },
      }),
    ).toMatchObject({
      id: "runtime/compat/owner-review",
      executor: "codex-goal",
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
      id: "runtime/compat/evaluation-feedback/app-ops-bae9bad818b6",
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
      id: "runtime/compat/project-audit/gym.app",
      workflow: "project-health-evaluator",
      input: {
        targetProject: "gym.app",
      },
    });
    expect(app.schedules).not.toContainEqual(
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

  test("requires canonical typed subjects for evaluator-owned Conditions", () => {
    const instructions = readFileSync(
      new URL("./agents/evaluator/AGENTS.md", import.meta.url),
      "utf8",
    );
    expect(instructions).toContain("exact `<type>:<id>` form");
    expect(instructions).toContain("event:project.task.child-transitioned");
    expect(instructions).toContain("Put target filters");
  });

  test("keeps Task actions inside open-ended Evaluation work", () => {
    expect(
      validateEvaluationTaskAction({
        kind: "unblock-task",
        taskId: "runtime/compat/project-audit/may-agent.app",
        expectedGeneration: 1,
        reason: "Retry the reconciler-owned task",
      }),
    ).toContain("cannot mutate reconciler-owned task");
    expect(
      validateEvaluationTaskAction({
        kind: "unblock-task",
        taskId: "bounded-child",
        expectedGeneration: 1,
        reason: "New evidence arrived",
      }),
    ).toBeNull();
  });
});
