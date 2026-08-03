import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import mayCanary from "../gym/benchmarks/may-alignment/canary.json";
import gymApp, { resolveGymTask } from "./app.ts";

describe("gym app manifest", () => {
  test("owns the autonomous benchmark loop without replacing Gym", () => {
    expect(gymApp.id).toBe("gym");
    expect(gymApp.owner).toBe("gym");
    expect(gymApp.workspace.localPath).toBe("../gym");
    expect(gymApp.schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "may-training-refill",
          enabled: true,
        }),
        expect.objectContaining({
          id: "codex-learning-drain",
          enabled: true,
          intervalMs: 3_600_000,
          emits: [
            expect.objectContaining({
              type: "gym.codex.learning.requested",
              params: {
                reason: "continuous-source-drain",
                batchSize: 200,
                maxBatches: 5,
              },
            }),
          ],
        }),
        expect.objectContaining({
          id: "telegram-field-review-daily",
          enabled: true,
          intervalMs: 86_400_000,
          emits: [
            expect.objectContaining({
              type: "gym.telegram.field-review.requested",
              params: {
                reason: "daily-field-review",
                batchSize: 40,
              },
            }),
          ],
        }),
        expect.objectContaining({
          id: "design-alignment-review-daily",
          enabled: true,
          intervalMs: 86_400_000,
          emits: [
            expect.objectContaining({
              type: "gym.design-alignment.requested",
              params: { reason: "daily-design-alignment-review" },
            }),
          ],
        }),
      ]),
    );
    expect(
      gymApp.schedules.find(({ id }) => id === "may-training-refill"),
    ).toMatchObject({
      intervalMs: 86_400_000,
      emits: [
        expect.objectContaining({
          type: "gym.improvement.requested",
          params: expect.objectContaining({
            agent: "may",
            benchmark: "may-alignment",
            reason: "curriculum-refill",
            curriculumDrain: true,
          }),
        }),
      ],
    });
    expect(gymApp.tasks?.resolve).toBe(resolveGymTask);
    expect(gymApp.tasks?.accepts).toHaveLength(15);
    expect(gymApp.tasks?.accepts).toContainEqual({
      type: "project.approval.submitted",
      project: "gym",
    });
    expect(gymApp.taskRoutes).toBeUndefined();
    expect(gymApp.taskWorkflows).toBeUndefined();
    expect(gymApp.ownerEntry).toBeUndefined();
    expect(gymApp.eventGraph).toBeUndefined();
    expect(Object.keys(gymApp.actions)).toEqual([
      "improve-may-now",
      "run-regression",
      "report-incident",
      "collect-codex-learning",
      "review-telegram-field",
    ]);
    const improveAction = gymApp.actions["improve-may-now"]!;
    if (improveAction.type !== "async") throw new Error("unexpected action");
    expect(improveAction.event({})).toMatchObject({
      type: "gym.improvement.requested",
      params: {
        agent: "may",
        benchmark: "may-alignment",
        trials: 3,
        scenarios: mayCanary.scenarios,
      },
    });
    const ownerConfig = JSON.parse(
      readFileSync(new URL("./agents/gym/agent.json", import.meta.url), "utf8"),
    );
    expect(ownerConfig.tools).toEqual(["read-only", "finish"]);
  });

  test("routes the daily Telegram field review into one maintain task", () => {
    const intent = resolveGymTask({
      type: "gym.telegram.field-review.requested",
      eventId: 94,
      params: { reason: "daily-field-review", batchSize: 40 },
    });
    expect(intent).toMatchObject({
      id: "learning/telegram-field-review",
      mode: "maintain",
      workflow: "telegram-field-review",
      input: { reason: "daily-field-review", batchSize: 40 },
      outputs: [".state/learning/telegram"],
    });
  });

  test("reconciles regular design alignment through one stable owner task", () => {
    const first = resolveGymTask({
      type: "gym.design-alignment.requested",
      eventId: 95,
      params: { reason: "daily-design-alignment-review" },
    });
    const next = resolveGymTask({
      type: "gym.design-alignment.requested",
      eventId: 96,
      params: { reason: "daily-design-alignment-review" },
    });
    expect(first).toEqual(next);
    expect(first).toMatchObject({
      id: "runtime/design-alignment-review",
      mode: "maintain",
      owner: "gym",
      priority: "P2",
      acceptance: expect.arrayContaining([
        expect.stringContaining("latest accepted design"),
        expect.stringContaining("historical evidence, not desired state"),
        expect.stringContaining("stable resource identity"),
        expect.stringContaining("resource-local checkpoint coherence"),
        expect.stringContaining("source code and tests alone cannot prove"),
        expect.stringContaining("fresh fingerprint-scoped evidence"),
        expect.stringContaining(
          "never call an intentional newer accepted change drift",
        ),
        expect.stringContaining("never turn missing live proof"),
      ]),
    });
    expect(first).not.toHaveProperty("workflow");
  });

  test("keeps periodic concerns as independent stable resources", () => {
    const eventTypes = [
      "gym.improvement.requested",
      "gym.codex.learning.requested",
      "gym.telegram.field-review.requested",
      "gym.design-alignment.requested",
    ];
    const first = eventTypes.map((type, index) =>
      resolveGymTask({ type, eventId: 200 + index, params: {} }),
    );
    const next = eventTypes.map((type, index) =>
      resolveGymTask({ type, eventId: 300 + index, params: {} }),
    );

    expect(first.map((intent) => intent?.id)).toEqual([
      "improve/may",
      "learning/codex-sessions",
      "learning/telegram-field-review",
      "runtime/design-alignment-review",
    ]);
    expect(next.map((intent) => intent?.id)).toEqual(
      first.map((intent) => intent?.id),
    );
    expect(new Set(first.map((intent) => intent?.id)).size).toBe(4);
  });

  test("keeps Codex learning incremental and separate from automatic improvement", () => {
    const intent = resolveGymTask({
      type: "gym.codex.learning.requested",
      eventId: 93,
      params: { reason: "daily", batchSize: 200, maxBatches: 1 },
    });
    expect(intent).toMatchObject({
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

  test("represents legacy cleanup as one finite resource", () => {
    expect(
      resolveGymTask({
        type: "gym.resource-migration.requested",
        eventId: 97,
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-v1",
      mode: "achieve",
      workflow: "unified-resource-migration",
      input: { migration: "unified-resource-v1" },
      priority: "P0",
    });
  });
});

describe("gym task reconciliation", () => {
  test("turns each reviewed session into idempotent learning evidence intake", () => {
    const first = resolveGymTask({
      type: "gym.learning.evidence.observed",
      eventId: 91,
      params: {
        polarity: "positive",
        evaluation: { agent: "may", sessionId: "s_good" },
      },
    });
    const duplicate = resolveGymTask({
      type: "gym.learning.evidence.observed",
      eventId: 92,
      params: {
        polarity: "positive",
        evaluation: { agent: "may", sessionId: "s_good" },
      },
    });

    expect(first?.id).toBe(duplicate?.id);
    expect(first).toMatchObject({
      parentId: "incident-learning",
      mode: "achieve",
      workflow: "learning-evidence-intake",
      input: { kind: "learning-evidence", polarity: "positive" },
    });
  });

  test("deduplicates incident and review work by semantic identity", () => {
    const firstIncident = resolveGymTask({
      type: "gym.incident.detected",
      eventId: 101,
      params: { evaluation: { sessionId: "s_failed" } },
    });
    const duplicateIncident = resolveGymTask({
      type: "gym.incident.detected",
      eventId: 102,
      params: { evaluation: { sessionId: "s_failed" } },
    });
    expect(firstIncident?.id).toBe(duplicateIncident?.id);
    expect(firstIncident?.input).toEqual({
      kind: "incident",
      sessionId: "s_failed",
    });
    expect(duplicateIncident?.input).toEqual(firstIncident?.input);
    expect(firstIncident).toMatchObject({
      parentId: "incident-learning",
      mode: "achieve",
      workflow: "incident-intake",
    });

    const firstReview = resolveGymTask({
      type: "gym.review.requested",
      eventId: 103,
      requestKey: "incident-s_failed",
    });
    const duplicateReview = resolveGymTask({
      type: "gym.review.requested",
      eventId: 104,
      requestKey: "incident-s_failed",
    });
    expect(firstReview?.id).toBe(duplicateReview?.id);
    expect(firstReview?.input).toEqual({
      kind: "unknown",
      requestKey: "incident-s_failed",
    });
    expect(duplicateReview?.input).toEqual(firstReview?.input);
  });

  test("replays a completed review without changing its artifact key", () => {
    const original = resolveGymTask({
      type: "gym.review.requested",
      eventId: 105,
      requestKey: "incident-s_failed",
    });
    const recovery = resolveGymTask({
      type: "gym.review.requested",
      eventId: 106,
      requestKey: "incident-s_failed",
      recoveryId: "telegram-46020",
    });

    expect(recovery?.id).not.toBe(original?.id);
    expect(recovery?.input).toEqual({
      kind: "unknown",
      recoveryId: "telegram-46020",
      requestKey: "incident-s_failed",
    });
  });

  test("treats each regression request as a distinct bounded run", () => {
    const first = resolveGymTask({
      type: "gym.regression.requested",
      eventId: 201,
      params: { benchmark: "may-alignment" },
    });
    const second = resolveGymTask({
      type: "gym.regression.requested",
      eventId: 202,
      params: { benchmark: "may-alignment" },
    });
    expect(first?.id).not.toBe(second?.id);
    expect(first).toMatchObject({
      parentId: "regression-assurance",
      mode: "achieve",
      workflow: "regression-run",
    });
  });

  test("requires a durable event identity", () => {
    expect(resolveGymTask({ type: "gym.regression.requested" })).toBeNull();
  });

  test("reconciles every improvement wake into one maintain task", () => {
    for (const event of [
      {
        type: "gym.improvement.requested",
        eventId: 301,
        params: { reason: "manual", trials: 3 },
      },
      {
        type: "agent.revision.changed",
        eventId: 302,
        agent: "may",
        revision: "sha256:revision",
      },
      {
        type: "project.comment.created",
        eventId: 303,
        project: "gym",
      },
      {
        type: "project.approval.submitted",
        eventId: 304,
        taskId: "improve/may",
        approvalId: "approval-304",
      },
    ]) {
      expect(resolveGymTask(event)).toMatchObject({
        id: "improve/may",
        mode: "maintain",
        workflow: "improve-agent",
        input: { agent: "may", curriculumDrain: true },
      });
    }
    expect(
      resolveGymTask({
        type: "project.approval.submitted",
        eventId: 305,
        taskId: "another/task",
      }),
    ).toBeNull();
  });

  test("keeps request-specific evidence out of the stable task spec", () => {
    const focused = resolveGymTask({
      type: "gym.improvement.requested",
      eventId: 304,
      params: {
        benchmark: "may-deputy-learning",
        scenarios: ["may-learn-select-skill-or-workflow"],
        trials: 3,
        reason: "approved-system-deputy-pilot",
      },
    });
    const revision = resolveGymTask({
      type: "agent.revision.changed",
      eventId: 305,
      agent: "may",
      revision: "sha256:new-may",
    });
    expect(focused).toEqual(revision);
    expect(focused?.input).toEqual({
      agent: "may",
      curriculumDrain: true,
    });
  });

  test("keeps frozen checkpoint facts in wake evidence rather than desired state", () => {
    const intent = resolveGymTask({
      type: "gym.improvement.requested",
      eventId: 306,
      params: {
        benchmark: "may-admission-review-closure",
        baselineRunId: "may-admission-review-closure-test-frozen",
        focusScenarios: ["incident-replay"],
        failureFamily: "admission-disposition-before-repair",
      },
    });
    expect(intent?.input).toEqual({ agent: "may", curriculumDrain: true });
    expect(intent?.input).not.toHaveProperty("baselineRunId");
  });

  test("May-owned metric breaches wake the campaign without changing its goal", () => {
    expect(
      resolveGymTask({
        type: "metric.breach",
        eventId: 307,
        owner: "agent:may",
        metricId: "may.telegram-follow-through-rate",
      }),
    ).toMatchObject({
      id: "improve/may",
      input: { agent: "may", curriculumDrain: true },
    });
    expect(
      resolveGymTask({
        type: "metric.breach",
        eventId: 308,
        owner: "agent:app-ops",
        metricId: "aks.task-timeout-rate",
      }),
    ).toBeNull();
  });
});

describe("gym evaluation frontier", () => {
  test("routes all May evaluations to one stable sequential task", () => {
    const failure = resolveGymTask({
      type: "evaluation.reviewed",
      eventId: 401,
      source: "evaluator-aftermath",
      agent: "may",
      lane: "needs_triage",
      reviewedVerdict: "needs_improvement",
      sessionId: "s_bad_may_run",
    });
    const success = resolveGymTask({
      type: "evaluation.reviewed",
      eventId: 402,
      agent: "may",
      lane: "success_candidate",
      reviewedVerdict: "good",
      sessionId: "s_good_may_run",
    });
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
      resolveGymTask({
        type: "evaluation.reviewed",
        eventId: 403,
        agent: "coder",
        lane: "needs_triage",
        reviewedVerdict: "needs_improvement",
      }),
    ).toBeNull();
  });
});
