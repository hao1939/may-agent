import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ProjectAppContext } from "@may-agent/sdk";
import gymApp, { routeGymEvent } from "./app.ts";

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
    expect(gymApp.workflowHandlers?.map((handler) => handler.name)).toEqual([
      "gym-incident-intake",
      "gym-regression-run",
      "gym-review-and-propose",
    ]);
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
