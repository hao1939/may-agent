import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("session metrics queries", () => {
  it("counts only terminal sessions in the session.error-rate-6h denominator", () => {
    const source = readFileSync(resolve(__dirname, "../../may/handlers/metrics-snapshot.ts"), "utf8");

    expect(source).toContain(
      "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')",
    );
    expect(source).not.toContain(
      'const total = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ?", sixH);',
    );
  });

  it("excludes Clean start (fresh) interruptions from the session.error-rate-6h numerator", () => {
    const source = readFileSync(resolve(__dirname, "../../may/handlers/metrics-snapshot.ts"), "utf8");

    expect(source).toContain("status = 'error'");
    expect(source).toContain("status = 'interrupted' AND COALESCE(error, '') != 'Clean start (fresh)'");
    expect(source).not.toContain(
      "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('error','interrupted')",
    );
  });

  it("excludes Clean start (fresh) interruptions from session.failed-triage-rate-3h denominator and numerator", () => {
    const source = readFileSync(resolve(__dirname, "../../may/handlers/metrics-snapshot.ts"), "utf8");
    const failedTriageBlock = source.slice(
      source.indexOf('record("session.failed-triage-rate-3h"') - 1500,
      source.indexOf('record("session.failed-triage-rate-3h"') + 200,
    );

    expect(failedTriageBlock.match(/COALESCE\(s\.error, ''\) != 'Clean start \(fresh\)'/g)).toHaveLength(2);
    expect(failedTriageBlock).toContain("COUNT(*) as c");
    expect(failedTriageBlock).toContain("COUNT(DISTINCT s.sessionId) as c");
  });
});
