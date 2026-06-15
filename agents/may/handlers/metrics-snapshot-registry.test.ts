import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function metricsSnapshotSource(): string {
  return readFileSync(resolve(__dirname, "./metrics-snapshot.ts"), "utf8");
}

describe("metrics-snapshot registry and queries", () => {
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
    const retiredRegistry = source.slice(source.indexOf("const RETIRED_METRIC_IDS"));

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
    expect(source).toContain("status = 'interrupted' AND COALESCE(error, '') != 'Clean start (fresh)'");
    expect(source).not.toContain(
      "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('error','interrupted')",
    );
  });

  it("excludes Clean start (fresh) interruptions from session.failed-triage-rate-3h denominator and numerator", () => {
    const source = metricsSnapshotSource();
    const failedTriageBlock = source.slice(
      source.indexOf('record("session.failed-triage-rate-3h"') - 1500,
      source.indexOf('record("session.failed-triage-rate-3h"') + 200,
    );

    expect(failedTriageBlock.match(/COALESCE\(s\.error, ''\) != 'Clean start \(fresh\)'/g)).toHaveLength(2);
    expect(failedTriageBlock).toContain("COUNT(*) as c");
    expect(failedTriageBlock).toContain("COUNT(DISTINCT s.sessionId) as c");
  });

  it("counts any evaluated session as triaged for session.failed-triage-rate-3h (no verdict filter)", () => {
    const source = metricsSnapshotSource();
    const triageBlock = source.slice(
      source.indexOf('record("session.failed-triage-rate-3h"') - 1500,
      source.indexOf('record("session.failed-triage-rate-3h"') + 200,
    );
    // The numerator JOIN guarantees an evaluation row exists — that alone means triaged.
    // There must be NO verdict filter that would exclude acceptable/good sessions.
    expect(triageBlock).not.toContain("e.verdict IN");
    expect(triageBlock).toContain("JOIN evaluations e ON e.sessionId = s.sessionId");
  });

  it("suppresses session.failed-triage-rate-3h breaches when fewer than 5 failed sessions are in-window", () => {
    const source = metricsSnapshotSource();

    expect(source).toContain('record("session.failed-triage-rate-3h", failed >= 5 ? parseFloat((triaged / failed).toFixed(4)) : 1, failed);');
  });
});
