import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { metricOperationalOwner } from "./metrics-snapshot.ts";

function metricsSnapshotSource(): string {
  return readFileSync(resolve(__dirname, "./metrics-snapshot.ts"), "utf8");
}

function sourceBlock(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("metrics-snapshot registry and queries", () => {
  it("assigns former May operations metrics to the platform app owner", () => {
    expect(
      metricOperationalOwner({
        id: "runtime.daemon-heartbeat-stale",
        name: "Daemon heartbeat stale",
        owner: "may",
        type: "health",
        target: 0,
        threshold: 0,
        unit: "boolean",
        alert_op: ">",
      }),
    ).toBe("tech-lead");
  });
  it("does not reactivate the Scout-owned retired output metric", () => {
    const source = metricsSnapshotSource();
    const activeRegistry = source.slice(
      source.indexOf("const ALL_METRICS"),
      source.indexOf("const RETIRED_METRIC_IDS"),
    );
    const retiredRegistry = source.slice(
      source.indexOf("const RETIRED_METRIC_IDS"),
    );

    expect(activeRegistry).not.toContain(
      'id: "scout.accepted-source-outputs-24h"',
    );
    expect(activeRegistry).not.toContain(
      'id: "scout.knowledge-practice-loaded"',
    );
    expect(activeRegistry).not.toContain(
      'id: "scout.knowledge-preamble-coverage"',
    );
    expect(activeRegistry).not.toContain('id: "scout.sourced-artifacts-24h"');
    expect(activeRegistry).not.toContain(
      'id: "scout.downstream-reference-files-7d"',
    );
    expect(retiredRegistry).toContain('"scout.sourced-artifacts-24h"');
    expect(retiredRegistry).toContain('"scout.downstream-reference-files-7d"');
    expect(retiredRegistry).toContain('"scout.accepted-source-outputs-24h"');
    expect(retiredRegistry).toContain('"scout.knowledge-practice-loaded"');
  });

  it("leaves accepted-output semantics to Scout's replacement metric", () => {
    const source = metricsSnapshotSource();

    expect(source).not.toContain("function scoutAcceptedSourceOutputsSince");
    expect(source).not.toContain(
      'record(\n        "scout.accepted-source-outputs-24h"',
    );
  });

  it("leaves preamble coverage collection to Scout", () => {
    const source = metricsSnapshotSource();

    expect(source).not.toContain("function scoutKnowledgePreambleCoverage");
    expect(source).not.toContain(
      'record(\n        "scout.knowledge-preamble-coverage"',
    );
  });

  it("leaves LLM evaluation activity definitions and measurement to Evaluation", () => {
    const source = metricsSnapshotSource();
    const activeRegistry = source.slice(
      source.indexOf("const ALL_METRICS"),
      source.indexOf("const RETIRED_METRIC_IDS"),
    );

    expect(activeRegistry).not.toContain('id: "eval.llm-coverage-lag-h"');
    expect(activeRegistry).not.toContain('id: "eval.llm-evals-24h"');
    expect(activeRegistry).not.toContain(
      'id: "evaluator.low-quality-rate-24h"',
    );
    expect(activeRegistry).not.toContain(
      'id: "evaluator.substantive-low-quality-rate-24h"',
    );
    expect(activeRegistry).not.toContain(
      'id: "evaluator.meaningful-review-rate-24h"',
    );
    expect(source).not.toContain(
      'record("eval.llm-coverage-lag-h"',
    );
    expect(source).not.toContain('record(\n        "eval.llm-evals-24h"');
    expect(source).not.toContain(
      'record(\n        "evaluator.low-quality-rate-24h"',
    );
    expect(source).not.toContain(
      'record(\n        "evaluator.substantive-low-quality-rate-24h"',
    );
    expect(source).not.toContain(
      'record(\n        "evaluator.meaningful-review-rate-24h"',
    );
  });

  it("keeps the stale trace-completeness metric retired", () => {
    const source = metricsSnapshotSource();

    expect(source).toContain('"capability.session-trace-completeness"');
    expect(source).not.toContain(
      '{ id: "capability.session-trace-completeness", name: "Session trace completeness (24h)", project: "v2-conformance-and-visibility", type: "gauge", target: 1.0, threshold: 0.95, unit: "ratio", alert_op: "<", priority: "P2" }',
    );
  });

  it("keeps retired v2 spec coverage out of active metrics", () => {
    const source = metricsSnapshotSource();
    const activeRegistry = source.slice(
      source.indexOf("const ALL_METRICS"),
      source.indexOf("const RETIRED_METRIC_IDS"),
    );
    const retiredRegistry = source.slice(
      source.indexOf("const RETIRED_METRIC_IDS"),
    );

    expect(activeRegistry).not.toContain('id: "v2.spec-coverage-rate"');
    expect(retiredRegistry).toContain('"v2.spec-coverage-rate"');
  });

  it("counts only terminal sessions in the session.error-rate-6h denominator", () => {
    const source = metricsSnapshotSource();

    expect(source).toContain(
      "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')",
    );
    expect(source).not.toContain(
      'const total = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ?", sixH);',
    );
  });

  it("excludes Clean start (fresh) interruptions from the session.error-rate-6h numerator", () => {
    const source = metricsSnapshotSource();

    expect(source).toContain("status = 'error'");
    expect(source).toContain(
      "status = 'interrupted' AND COALESCE(error, '') != 'Clean start (fresh)'",
    );
    expect(source).not.toContain(
      "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('error','interrupted')",
    );
  });

  it("excludes Clean start (fresh) interruptions from session.failed-triage-rate-3h denominator and numerator", () => {
    const source = metricsSnapshotSource();
    const failedTriageBlock = sourceBlock(
      source,
      "const failedRows = db",
      "[metrics-snapshot] Error measuring session.failed-triage-rate-3h",
    );

    expect(
      failedTriageBlock.match(
        /COALESCE\(s\.error, ''\) != 'Clean start \(fresh\)'/g,
      ),
    ).toHaveLength(1);
    expect(failedTriageBlock).toContain("GROUP BY s.sessionId");
    expect(failedTriageBlock).toContain("const failed = failedRows.length");
  });

  it("counts any evaluated session as triaged for session.failed-triage-rate-3h (no verdict filter)", () => {
    const source = metricsSnapshotSource();
    const triageBlock = sourceBlock(
      source,
      "const failedRows = db",
      "[metrics-snapshot] Error measuring session.failed-triage-rate-3h",
    );
    // Any evaluation row in the grouped candidate set means triaged.
    // There must be NO verdict filter that would exclude acceptable/good sessions.
    expect(triageBlock).not.toContain("e.verdict IN");
    expect(triageBlock).toContain(
      "LEFT JOIN evaluations e ON e.sessionId = s.sessionId",
    );
  });

  it("suppresses session.failed-triage-rate-3h breaches when fewer than 5 failed sessions are in-window", () => {
    const source = metricsSnapshotSource();
    const failedTriageBlock = sourceBlock(
      source,
      "const failedRows = db",
      "[metrics-snapshot] Error measuring session.failed-triage-rate-3h",
    );

    expect(failedTriageBlock).toContain('"session.failed-triage-rate-3h"');
    expect(failedTriageBlock).toContain(
      "failed >= 5 ? parseFloat((triaged / failed).toFixed(4)) : 1",
    );
  });
});
