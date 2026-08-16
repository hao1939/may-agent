import { describe, expect, test } from "bun:test";
import { taskInputForEvent } from "../../../app.ts";

const PLATFORM_OWNED_METRIC = "guard.triggered-count-24h";

function metricEvent(
  type: "metric.breach" | "metric.stalled" | "metric.recovered",
  owner: string,
  metricId: string,
) {
  return {
    type,
    owner,
    data: { metricId },
    target: { metricId },
  };
}

describe("may-agent.app metric routing", () => {
  test("foreign metric breaches do not wake the platform owner", () => {
    expect(
      taskInputForEvent(
        metricEvent(
          "metric.breach",
          "aks-explorer",
          "aks-rp-e2e.task.stalled-count",
        ),
      ),
    ).toBeNull();
  });

  test("platform-owned breach and stalled facts request owner review", () => {
    for (const owner of ["may", "agent:may"]) {
      expect(
        taskInputForEvent(
          metricEvent("metric.breach", owner, PLATFORM_OWNED_METRIC),
        ),
      ).toMatchObject({
        kind: "owner-review",
        data: { reason: "metric-signal", metricId: PLATFORM_OWNED_METRIC },
      });
    }
    expect(
      taskInputForEvent(
        metricEvent("metric.stalled", "may", "session.provider-error-count-1h"),
      ),
    ).toMatchObject({ kind: "owner-review" });
  });

  test("recovery facts stay informational", () => {
    expect(
      taskInputForEvent(
        metricEvent("metric.recovered", "may", PLATFORM_OWNED_METRIC),
      ),
    ).toBeNull();
  });

  test("self-referential platform metrics remain deferred", () => {
    for (const metricId of [
      "project.health.finding-count",
      "project.owner-incomplete-count",
      "project.owner-judgment-needed-count",
      "capability.zombie-session-count",
      "runtime.stale-running-session-count",
    ]) {
      expect(
        taskInputForEvent(metricEvent("metric.breach", "may", metricId)),
      ).toBeNull();
    }
  });

  test("actionable platform metrics are not silently deferred", () => {
    for (const metricId of [
      "guard.triggered-count-24h",
      "guard.warned-count-24h",
      "escalation.pending-count",
      "metric.stale-active-count",
      "session.first-turn-error-count-1h",
      "handler.heartbeat-coverage",
      "infra.persist.db-size-mb",
      "agent.config-invalid-count-1h",
      "session.provider-error-count-1h",
      "event.pair-orphan-count",
      "session.error-rate-6h",
    ]) {
      expect(
        taskInputForEvent(metricEvent("metric.breach", "may", metricId)),
      ).toMatchObject({ kind: "owner-review" });
    }
  });
});
