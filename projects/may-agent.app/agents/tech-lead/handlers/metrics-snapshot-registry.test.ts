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
    expect(
      metricOperationalOwner({
        id: "scout.knowledge-practice-loaded",
        name: "Scout knowledge practice loaded",
        owner: "may",
        project: "scout-knowledge-lib.app",
        type: "health",
        target: 1,
        threshold: 1,
        unit: "boolean",
        alert_op: "<",
      }),
    ).toBe("scout");
  });
  it("keeps Scout metrics advisory and scoped to the current project", () => {
    const source = metricsSnapshotSource();
    const activeRegistry = source.slice(
      source.indexOf("const ALL_METRICS"),
      source.indexOf("const RETIRED_METRIC_IDS"),
    );
    const retiredRegistry = source.slice(
      source.indexOf("const RETIRED_METRIC_IDS"),
    );

    expect(activeRegistry).toContain('id: "scout.accepted-source-outputs-24h"');
    expect(activeRegistry).toContain('project: "scout-knowledge-lib.app"');
    const scoutContentMetrics = sourceBlock(
      activeRegistry,
      'id: "scout.knowledge-preamble-coverage"',
      'id: "handler.p95-duration"',
    );
    expect(scoutContentMetrics.match(/mode: "disabled"/g)).toHaveLength(2);
    expect(activeRegistry).not.toContain('id: "scout.sourced-artifacts-24h"');
    expect(activeRegistry).not.toContain(
      'id: "scout.downstream-reference-files-7d"',
    );
    expect(retiredRegistry).toContain('"scout.sourced-artifacts-24h"');
    expect(retiredRegistry).toContain('"scout.downstream-reference-files-7d"');
  });

  it("counts admitted outputs from converged Scout source reconciliations", () => {
    const source = metricsSnapshotSource();
    const block = sourceBlock(
      source,
      "function scoutAcceptedSourceOutputsSince",
      "function terminalSessionsWithoutEndEvent",
    );

    expect(block).toContain("event_type = 'project.task.reconciled'");
    expect(block).toContain("project_id = 'scout-knowledge-lib'");
    expect(block).toContain("task_id LIKE 'explore-%'");
    expect(block).toContain('data.disposition !== "converged"');
    expect(block).toContain('item.startsWith("output:/")');
  });

  it("measures preamble coverage only in canonical Scout knowledge", () => {
    const source = metricsSnapshotSource();
    const block = sourceBlock(
      source,
      "function scoutKnowledgePreambleCoverage",
      "function sessionJsonlPath",
    );

    expect(block).toContain('"scout-knowledge-lib", "knowledge"');
    expect(block).not.toContain('"shared", "knowledge"');
    expect(block).not.toContain('"agents", "scout", "knowledge"');
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
