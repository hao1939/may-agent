import { describe, expect, test } from "bun:test";
import {
  collectSnapshot,
  decidePipelineWake,
  metricAnomalyFamily,
  metricIsBreached,
  workflowRunIsFailure,
  type PipelineSnapshot,
} from "./evaluation-pipeline.ts";

function snapshot(overrides: Partial<PipelineSnapshot> = {}): PipelineSnapshot {
  return {
    sampledAt: 1,
    missingAftermathCount: 0,
    breachedMetrics: [],
    failedWorkflowFamilies: [],
    reviewFailureCount: 0,
    ...overrides,
  };
}

describe("evaluation pipeline monitor", () => {
  test("does not wake the owner for unchanged healthy state", () => {
    expect(
      decidePipelineWake(snapshot(), { anomalyFingerprint: "healthy" }),
    ).toMatchObject({
      changed: false,
      recovered: false,
      fingerprint: "healthy",
    });
  });

  test("wakes once when an anomaly family changes", () => {
    expect(
      decidePipelineWake(
        snapshot({
          missingAftermathCount: 2,
          failedWorkflowFamilies: ["evaluator-aftermath"],
        }),
        { anomalyFingerprint: "healthy" },
      ),
    ).toMatchObject({
      changed: true,
      recovered: false,
      anomalyFamilies: ["aftermath-backlog", "workflow:evaluator-aftermath"],
    });
  });

  test("wakes once on recovery", () => {
    expect(
      decidePipelineWake(snapshot(), {
        anomalyFingerprint: "metric:eval.llm-coverage-lag-h",
      }),
    ).toMatchObject({ changed: true, recovered: true, fingerprint: "healthy" });
  });

  test("counts only the live aftermath coverage window as missing backlog", () => {
    const now = 10 * 60 * 60_000;
    const snapshot = collectSnapshot(
      {
        query: {
          sql: (_statement: string, params?: unknown[]) => {
            expect(params).toEqual([now - 3 * 60 * 60_000, now - 7 * 60_000]);
            return { rows: [{ count: 0 }] };
          },
          metrics: () => [],
          workflowRuns: () => [],
          events: () => [],
        },
      } as never,
      now,
    );

    expect(snapshot.missingAftermathCount).toBe(0);
    expect(decidePipelineWake(snapshot).fingerprint).toBe("healthy");
  });

  test("evaluates metric thresholds without waking on retired metrics", () => {
    expect(
      metricIsBreached({
        status: "active",
        current: 5,
        threshold: 4,
        alert_op: ">",
      }),
    ).toBe(true);
    expect(
      metricIsBreached({
        status: "retired",
        current: 5,
        threshold: 4,
        alert_op: ">",
      }),
    ).toBe(false);
  });

  test("collapses correlated finding-delivery metrics into one anomaly family", () => {
    expect(
      decidePipelineWake(
        snapshot({
          breachedMetrics: [
            {
              id: "evaluator.project-finding-delivery-rate-24h",
              current: 0.3,
              threshold: 0.5,
              alertOp: "<",
            },
            {
              id: "evaluator.project-feedback-pending-age-h",
              current: 22,
              threshold: 12,
              alertOp: ">",
            },
          ],
        }),
        { anomalyFingerprint: "healthy" },
      ),
    ).toMatchObject({
      changed: true,
      anomalyFamilies: ["metric:finding-delivery"],
      fingerprint: "metric:finding-delivery",
    });
    expect(metricAnomalyFamily("eval.llm-coverage-lag-h")).toBe(
      "metric:eval.llm-coverage-lag-h",
    );
  });

  test("does not classify deployment interruptions as workflow failures", () => {
    expect(
      workflowRunIsFailure({
        status: "interrupted",
        result_reason: "Process restarted",
      }),
    ).toBe(false);
    expect(
      workflowRunIsFailure({
        status: "interrupted",
        result_reason: "worker lost",
      }),
    ).toBe(true);
    expect(workflowRunIsFailure({ status: "error" })).toBe(true);
  });

  test("requests review-failed events directly so limited event pages cannot hide the anomaly", () => {
    let eventsFilter: Record<string, unknown> | undefined;
    const snapshot = collectSnapshot(
      {
        query: {
          sql: () => ({ rows: [{ count: 0 }] }),
          metrics: () => [],
          workflowRuns: () => [],
          events: (filter: Record<string, unknown>) => {
            eventsFilter = filter;
            return {
              rows: [
                { event_type: "evaluation.review_failed" },
                { event_type: "evaluation.routed" },
              ],
            };
          },
        },
      } as never,
      900_000,
    );

    expect(eventsFilter).toMatchObject({
      type: "evaluation.review_failed",
      since: 0,
      limit: 200,
    });
    expect(snapshot.reviewFailureCount).toBe(1);
    expect(decidePipelineWake(snapshot).anomalyFamilies).toContain(
      "review-failed",
    );
  });
});
