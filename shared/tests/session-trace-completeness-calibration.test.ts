import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("capability.session-trace-completeness calibration", () => {
  it("keeps the stale trace-completeness metric retired", () => {
    const source = readFileSync(resolve(__dirname, "../../agents/may/handlers/metrics-snapshot.ts"), "utf8");

    expect(source).toContain('"capability.session-trace-completeness"');
    expect(source).not.toContain(
      '{ id: "capability.session-trace-completeness", name: "Session trace completeness (24h)", project: "v2-conformance-and-visibility", type: "gauge", target: 1.0, threshold: 0.95, unit: "ratio", alert_op: "<", priority: "P2" }',
    );
  });
});
