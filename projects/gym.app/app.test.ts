import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ProjectAppContext } from "@may-agent/sdk";
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
        expect.objectContaining({ id: "may-alignment-nightly", enabled: true }),
      ]),
    );
    expect(gymApp.workflowHandlers).toBeUndefined();
    expect(gymApp.taskRoutes?.map((route) => route.name)).toEqual([
      "gym-task-incident-intake",
      "gym-task-regression-run",
      "gym-task-review-and-propose",
    ]);
    expect(Object.keys(gymApp.taskWorkflows ?? {})).toEqual([
      "incident-intake",
      "regression-run",
      "review-and-propose",
    ]);
    expect(gymApp.ownerEntry?.workflow).toBe("owner-review");
    expect(Object.keys(gymApp.actions)).toEqual([
      "run-regression",
      "report-incident",
    ]);
    const ownerConfig = JSON.parse(
      readFileSync(new URL("./agents/gym/agent.json", import.meta.url), "utf8"),
    );
    expect(ownerConfig.tools).toEqual(["read-only", "finish"]);
  });
});

describe("gym task reconciliation", () => {
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

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "gym.incident.detected",
      project: "gym",
      params: {
        reason: "may-evaluation-failure",
        evaluation: { sessionId: "s_bad_may_run" },
      },
    });
  });

  test("ignores good and non-May evaluations", async () => {
    for (const event of [
      {
        type: "evaluation.reviewed",
        agent: "may",
        lane: "success_candidate",
        reviewedVerdict: "good",
      },
      {
        type: "evaluation.reviewed",
        agent: "coder",
        lane: "needs_triage",
        reviewedVerdict: "needs_improvement",
      },
    ]) {
      const emitted: Array<Record<string, unknown>> = [];
      const result = await routeGymEvent(context(emitted), event);
      expect(emitted).toHaveLength(0);
      expect(result).toEqual({
        reason: "evaluation is not an actionable May failure",
      });
    }
  });
});
