import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ProjectAppContext } from "@may-agent/sdk";
import mayCanary from "../gym/benchmarks/may-alignment/canary.json";
import gymApp, { resolveGymTask, routeGymEvent } from "./app.ts";

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

describe("gym app manifest", () => {
  test("owns the autonomous benchmark loop without replacing Gym", () => {
    expect(gymApp.id).toBe("gym");
    expect(gymApp.owner).toBe("gym");
    expect(gymApp.workspace.localPath).toBe("../gym");
    expect(gymApp.schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "may-improvement-weekly",
          enabled: true,
        }),
        expect.objectContaining({
          id: "codex-learning-daily",
          enabled: true,
        }),
      ]),
    );
    expect(
      gymApp.schedules.find(({ id }) => id === "may-improvement-weekly"),
    ).toMatchObject({
      intervalMs: 604_800_000,
      emits: [
        expect.objectContaining({
          type: "gym.improvement.requested",
          params: expect.objectContaining({
            agent: "may",
            benchmark: "may-alignment",
            reason: "weekly",
            scenarios: mayCanary.scenarios,
            trials: 3,
          }),
        }),
      ],
    });
    expect(gymApp.tasks?.resolve).toBe(resolveGymTask);
    expect(gymApp.tasks?.accepts).toHaveLength(9);
    expect(gymApp.taskRoutes).toBeUndefined();
    expect(gymApp.taskWorkflows).toBeUndefined();
    expect(gymApp.ownerEntry).toBeUndefined();
    expect(gymApp.eventGraph).toBeUndefined();
    expect(Object.keys(gymApp.actions)).toEqual([
      "improve-may-now",
      "run-regression",
      "report-incident",
      "collect-codex-learning",
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
      input: { reason: "daily", batchSize: 200, maxBatches: 1 },
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
    ]) {
      expect(resolveGymTask(event)).toMatchObject({
        id: "improve/may",
        mode: "maintain",
        workflow: "improve-agent",
        input: { agent: "may", benchmark: "may-alignment" },
      });
    }
  });

  test("preserves a requested learning benchmark on the shared task", () => {
    expect(
      resolveGymTask({
        type: "gym.improvement.requested",
        eventId: 304,
        params: {
          benchmark: "may-deputy-learning",
          scenarios: ["may-learn-select-skill-or-workflow"],
          trials: 3,
          reason: "approved-system-deputy-pilot",
        },
      }),
    ).toMatchObject({
      id: "improve/may",
      input: {
        agent: "may",
        benchmark: "may-deputy-learning",
        scenarios: ["may-learn-select-skill-or-workflow"],
        trials: 3,
        reason: "approved-system-deputy-pilot",
      },
    });
  });
});

describe("gym app event routing", () => {
  test("turns an actionable May evaluation into incident intake", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    await routeGymEvent(context(emitted), {
      type: "evaluation.reviewed",
      source: "evaluator-aftermath",
      agent: "may",
      lane: "needs_triage",
      reviewedVerdict: "needs_improvement",
      sessionId: "s_bad_may_run",
    });

    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toMatchObject({
      type: "gym.learning.evidence.observed",
      project: "gym",
      params: {
        polarity: "negative",
        evaluation: { sessionId: "s_bad_may_run" },
      },
    });
    expect(emitted[1]).toMatchObject({
      type: "gym.incident.detected",
      project: "gym",
      params: {
        reason: "may-evaluation-failure",
        evaluation: { sessionId: "s_bad_may_run" },
      },
    });
  });

  test("preserves good May evaluations as positive learning evidence", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const result = await routeGymEvent(context(emitted), {
      type: "evaluation.reviewed",
      agent: "may",
      lane: "success_candidate",
      reviewedVerdict: "good",
      sessionId: "s_good_may_run",
    });
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "gym.learning.evidence.observed",
        params: {
          polarity: "positive",
          evaluation: expect.objectContaining({ sessionId: "s_good_may_run" }),
        },
      }),
    ]);
    expect(result).toEqual({ recorded: "positive-learning-evidence" });
  });

  test("ignores non-May evaluations", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const result = await routeGymEvent(context(emitted), {
      type: "evaluation.reviewed",
      agent: "coder",
      lane: "needs_triage",
      reviewedVerdict: "needs_improvement",
    });
    expect(emitted).toHaveLength(0);
    expect(result).toEqual({ reason: "evaluation is not for May" });
  });
});
