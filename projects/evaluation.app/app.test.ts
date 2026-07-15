import { describe, expect, test } from "bun:test";
import type { ProjectAppContext } from "@may-agent/sdk";
import { routeEvaluationEvent } from "./app.ts";

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
