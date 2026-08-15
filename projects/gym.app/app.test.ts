import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import type { AppDependencyObservation, AppEvent, AppInput } from "@may-agent/sdk";
import mayCanary from "../gym/benchmarks/may-alignment/canary.json";
import gymApp, { resolveGymTask, routeGymRequest } from "./app.ts";

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

function request(input: AppInput, dependency?: AppDependencyObservation) {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
    ...(dependency ? { dependency } : {}),
  };
}

describe("canonical Gym App", () => {
  test("keeps May conversational while Gym owns standing operations", () => {
    const mayConfig = JSON.parse(
      readFileSync(new URL("../../agents/may/agent.json", import.meta.url), "utf8"),
    ) as { tools: string[] };

    expect(mayConfig.tools).not.toContain("cron");
    expect(existsSync(new URL("../../agents/may/cron.json", import.meta.url))).toBe(false);
    expect(gymApp).toMatchObject({
      id: "gym",
      version: 1,
      owner: "gym",
      workspace: { kind: "local", localPath: "../gym" },
      inbox: { batch: "single", maxConcurrent: 2 },
      tasks: { attach: true, maxConcurrent: 2 },
    });
    expect(gymApp.route).toBe(routeGymRequest);
    expect(gymApp.tasks?.resolve).toBe(resolveGymTask);
    expect(gymApp.tasks?.subscriptions).toHaveLength(12);
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
              benchmark: "may-alignment",
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
    expect(gymApp.schedules.some(({ id }) => id.includes("telegram"))).toBe(false);
    expect(gymApp.tasks?.subscriptions).not.toContain("gym.telegram.field-review.requested");
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
    expect(gymApp.actions["run-regression"]?.toInput({ scenario: "s1" })).toEqual({
      kind: "run-regression",
      data: { scenario: "s1" },
    });
    expect(gymApp.actions["report-incident"]?.toInput({ sessionId: "s1" })).toEqual({
      kind: "report-incident",
      data: { reason: "manual", sessionId: "s1" },
    });
    expect(gymApp.actions["collect-codex-learning"]?.toInput({ maxBatches: 1 })).toEqual({
      kind: "collect-codex-learning",
      data: {
        reason: "manual-backfill",
        batchSize: 200,
        maxBatches: 1,
      },
    });
    expect(gymApp.actions["review-telegram-field"]?.toInput({ batchSize: 40 })).toEqual({
      kind: "review-telegram-field",
      data: { reason: "manual-field-review", batchSize: 40 },
    });

    const ownerConfig = JSON.parse(
      readFileSync(new URL("./agents/gym/agent.json", import.meta.url), "utf8"),
    ) as { tools: string[] };
    expect(ownerConfig.tools).toEqual(["read-only", "finish"]);
  });

  test("delegates Telegram field review to Evaluation", () => {
    expect(
      routeGymRequest(
        request({
          kind: "review-telegram-field",
          data: { reason: "manual-field-review", batchSize: 40 },
        }),
      ),
    ).toEqual({
      type: "delegate",
      appId: "evaluation",
      input: {
        kind: "deep-scan",
        data: {
          reason: "manual-field-review",
          requestedBy: "gym",
          batchSize: 40,
        },
      },
    });
  });

  test("completes an inbox request only after its exact dependency converges", () => {
    expect(
      routeGymRequest(
        request(
          { kind: "improve-may", data: {} },
          {
            kind: "task",
            id: "improve/may",
            status: "done",
            summary: "May campaign reconciled",
            evidence: ["run:verified"],
          },
        ),
      ),
    ).toEqual({
      type: "complete",
      summary: "May campaign reconciled",
      evidence: ["run:verified"],
    });
  });
});

describe("Gym task reconciliation", () => {
  test("reconciles design alignment through one stable owner task", () => {
    const first = resolveGymTask(
      event("gym.design-alignment.requested", { reason: "daily-design-alignment-review" }),
    );
    const next = resolveGymTask(
      event("gym.design-alignment.requested", { reason: "daily-design-alignment-review" }),
    );

    expect(first).toEqual(next);
    expect(first).toMatchObject({
      id: "runtime/design-alignment-review",
      mode: "maintain",
      owner: "gym",
      priority: "P2",
      acceptance: expect.arrayContaining([
        expect.stringContaining("latest accepted design"),
        expect.stringContaining("stable resource identity"),
        expect.stringContaining("fresh fingerprint-scoped evidence"),
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
    expect(next.map((intent) => intent?.id)).toEqual(first.map((intent) => intent?.id));
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

  test("represents invalid migration recovery as one finite resource", () => {
    expect(resolveGymTask(event("gym.resource-migration.requested"))).toMatchObject({
      id: "runtime/unified-resource-migration-v3",
      mode: "achieve",
      workflow: "unified-resource-migration",
      input: { migration: "unified-resource-v3" },
      priority: "P0",
      acceptance: [expect.stringContaining("No standing runtime resource is mutated")],
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
      input: { benchmark: "may-alignment" },
    });
    expect(resolveGymTask(event("gym.regression.requested", { benchmark: "may-alignment" }))).toBeNull();
  });

  test("routes owner comments through the inbox rather than task fact admission", () => {
    const subscription = gymApp.subscriptions?.find(({ id }) => id === "project-comment");
    if (!subscription) throw new Error("missing project-comment subscription");
    const input = subscription.toInput(
      event("project.comment.created", {
        comment: "Review the current training loop and decide what should happen next.",
      }),
    );
    expect(input).toMatchObject({ kind: "owner-review" });
    expect(routeGymRequest(request(input!))).toMatchObject({
      type: "task",
      task: {
        kind: "desired",
        intent: {
          id: "runtime/owner-review",
          mode: "maintain",
          owner: "gym",
        },
      },
    });
  });

  test("reconciles typed improvement wakes into one maintain task", () => {
    for (const fact of [
      event("gym.improvement.requested", { reason: "manual", trials: 3 }),
      event("agent.revision.changed", { agent: "may", revision: "sha256:revision" }),
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
      resolveGymTask(event("project.approval.submitted", { taskId: "another/task" })),
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
      event("agent.revision.changed", { agent: "may", revision: "sha256:new-may" }),
    );
    expect(focused).toEqual(revision);
    expect(focused?.input).toEqual({ agent: "may", curriculumDrain: true });
  });

  test("wakes May campaign only for May-owned metric breaches", () => {
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
        event("metric.breach", { metricId: "aks.task-timeout-rate" }, { owner: "agent:app-ops" }),
      ),
    ).toBeNull();
  });
});

describe("Gym evaluation frontier", () => {
  test("routes all May evaluations to one stable task", () => {
    const failure = resolveGymTask(
      event(
        "evaluation.reviewed",
        {
          agent: "may",
          lane: "needs_triage",
          reviewedVerdict: "needs_improvement",
          sessionId: "s_bad_may_run",
        },
        { source: "evaluator-aftermath" },
      ),
    );
    const success = resolveGymTask(
      event("evaluation.reviewed", {
        agent: "may",
        lane: "success_candidate",
        reviewedVerdict: "good",
        sessionId: "s_good_may_run",
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
        event("evaluation.reviewed", {
          agent: "coder",
          lane: "needs_triage",
          reviewedVerdict: "needs_improvement",
        }),
      ),
    ).toBeNull();
  });
});
