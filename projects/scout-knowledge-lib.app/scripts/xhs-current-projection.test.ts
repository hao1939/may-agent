import { describe, expect, it } from "bun:test";
import { inspectXhsCurrentProjection } from "./xhs-current-projection";

function fixture(cycle = 224): {
  ledger: string;
  topicMap: string;
  laneReport: string;
} {
  const observedThrough = "2026-09-03T14:59:11.279Z";
  return {
    ledger:
      "| Cycle | Standing tip | Supported observation | Exact reconciliation |\n" +
      "| --- | --- | --- | --- |\n" +
      `| ${cycle} | \`tip\` | \`2026-09-03T14:59:10.069Z–14:59:11.279Z\`; read-only | unchanged |\n` +
      `| ${cycle - 1} | \`old\` | \`2026-09-03T14:54:08.186Z–14:54:09.061Z\`; read-only | unchanged |\n`,
    topicMap:
      `<ai_context>\n` +
      `latest_seed_basis: "Cycle ${cycle} observational reconciliation through ${observedThrough}; exact access evidence is in seed-ledger row ${cycle}."\n` +
      `source_basis: "browser observations through Cycle ${cycle} at ${observedThrough}; retained evidence."\n` +
      `latest_seed_observation: "Cycle ${cycle} read-only XHS boundary through ${observedThrough}."\n` +
      `</ai_context>\n\nCycle ${cycle} used the established direct localhost Chrome connector.\n`,
    laneReport:
      `<ai_context>\n` +
      `summary: "Seed-first Scout continuity through Cycle ${cycle}: current."\n` +
      `latest_seed_basis: "Cycle ${cycle} observational reconciliation through ${observedThrough}; unchanged."\n` +
      `source_basis: "browser observations through Cycle ${cycle} at ${observedThrough}; retained evidence."\n` +
      `</ai_context>\n`,
  };
}

describe("XHS current-state projection", () => {
  it("binds both reader-facing projections to the latest exact ledger row", () => {
    expect(inspectXhsCurrentProjection(fixture())).toEqual({
      ok: true,
      cycle: 224,
      observedThrough: "2026-09-03T14:59:11.279Z",
      errors: [],
    });
  });

  it("reports stale topic and lane metadata independently", () => {
    const inputs = fixture();
    inputs.topicMap = inputs.topicMap.replaceAll("Cycle 224", "Cycle 223");
    inputs.laneReport = inputs.laneReport.replaceAll("Cycle 224", "Cycle 222");

    const result = inspectXhsCurrentProjection(inputs);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'topic latest_seed_basis does not include "Cycle 224 observational reconciliation through 2026-09-03T14:59:11.279Z"',
    );
    expect(result.errors).toContain(
      'report summary does not include "continuity through Cycle 224"',
    );
    expect(result.errors).toContain("topic lead does not project Cycle 224");
  });

  it("fails closed when the latest row lacks an exact observation range", () => {
    const inputs = fixture();
    inputs.ledger = inputs.ledger.replace(
      "2026-09-03T14:59:10.069Z–14:59:11.279Z",
      "unknown time",
    );

    expect(inspectXhsCurrentProjection(inputs)).toEqual({
      ok: false,
      cycle: null,
      observedThrough: null,
      errors: ["seed ledger has no current cycle with an exact UTC range"],
    });
  });

  it("preserves an exact observation that crosses UTC midnight", () => {
    const inputs = fixture();
    inputs.ledger = inputs.ledger.replace(
      "2026-09-03T14:59:10.069Z–14:59:11.279Z",
      "2026-09-03T23:59:59.900Z–00:00:00.100Z",
    );
    inputs.topicMap = inputs.topicMap.replaceAll(
      "2026-09-03T14:59:11.279Z",
      "2026-09-04T00:00:00.100Z",
    );
    inputs.laneReport = inputs.laneReport.replaceAll(
      "2026-09-03T14:59:11.279Z",
      "2026-09-04T00:00:00.100Z",
    );

    expect(inspectXhsCurrentProjection(inputs)).toMatchObject({
      ok: true,
      observedThrough: "2026-09-04T00:00:00.100Z",
    });
  });
});
