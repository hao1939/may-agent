import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type XhsCurrentProjectionInputs = {
  ledger: string;
  topicMap: string;
  laneReport: string;
};

export type XhsCurrentProjectionResult = {
  ok: boolean;
  cycle: number | null;
  observedThrough: string | null;
  errors: string[];
};

function contextValue(document: string, key: string): string | null {
  const match = document.match(new RegExp(`^${key}: "([^"]*)"$`, "m"));
  return match?.[1] ?? null;
}

function latestLedgerObservation(ledger: string): {
  cycle: number;
  observedThrough: string;
} | null {
  const row = ledger.match(/^\| (\d+)\s+\|[^\n]+$/m);
  if (!row) return null;

  const range = row[0].match(
    /(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)–(\d\d:\d\d:\d\d\.\d{3}Z)/,
  );
  if (!range) return null;

  const observedAt = new Date(range[1]);
  const endClock = new Date(`${range[1].slice(0, 11)}${range[2]}`);
  if (endClock < observedAt) endClock.setUTCDate(endClock.getUTCDate() + 1);

  return {
    cycle: Number(row[1]),
    observedThrough: endClock.toISOString(),
  };
}

export function inspectXhsCurrentProjection(
  inputs: XhsCurrentProjectionInputs,
): XhsCurrentProjectionResult {
  const latest = latestLedgerObservation(inputs.ledger);
  if (!latest) {
    return {
      ok: false,
      cycle: null,
      observedThrough: null,
      errors: ["seed ledger has no current cycle with an exact UTC range"],
    };
  }

  const { cycle, observedThrough } = latest;
  const errors: string[] = [];
  const ledgerSummary = contextValue(inputs.ledger, "summary");
  const ledgerSources = contextValue(inputs.ledger, "source_basis");
  const ledgerCurrentState = inputs.ledger.match(
    /^## Current reconciliation state\s*$([\s\S]*?)(?=^## |(?![\s\S]))/mu,
  )?.[1];
  const topicBasis = contextValue(inputs.topicMap, "latest_seed_basis");
  const topicObservation = contextValue(
    inputs.topicMap,
    "latest_seed_observation",
  );
  const topicSources = contextValue(inputs.topicMap, "source_basis");
  const reportSummary = contextValue(inputs.laneReport, "summary");
  const reportBasis = contextValue(inputs.laneReport, "latest_seed_basis");
  const reportSources = contextValue(inputs.laneReport, "source_basis");

  const requireValue = (
    label: string,
    value: string | null,
    fragments: string[],
  ): void => {
    if (!value) {
      errors.push(`${label} is missing`);
      return;
    }
    for (const fragment of fragments) {
      if (!value.includes(fragment)) {
        errors.push(`${label} does not include ${JSON.stringify(fragment)}`);
      }
    }
  };

  requireValue("ledger summary", ledgerSummary, [`Cycle ${cycle}`]);
  requireValue("ledger source_basis", ledgerSources, [
    `through ${observedThrough}`,
  ]);
  requireValue("ledger current state", ledgerCurrentState ?? null, [
    `Cycle ${cycle} bounded access pass`,
    observedThrough.slice(11),
  ]);
  requireValue("topic latest_seed_basis", topicBasis, [
    `Cycle ${cycle} observational reconciliation through ${observedThrough}`,
    `seed-ledger row ${cycle}`,
  ]);
  requireValue("topic latest_seed_observation", topicObservation, [
    `Cycle ${cycle} read-only XHS boundary through ${observedThrough}`,
  ]);
  requireValue("topic source_basis", topicSources, [
    `through Cycle ${cycle} at ${observedThrough}`,
  ]);
  requireValue("report summary", reportSummary, [
    `continuity through Cycle ${cycle}`,
  ]);
  requireValue("report latest_seed_basis", reportBasis, [
    `Cycle ${cycle} observational reconciliation through ${observedThrough}`,
  ]);
  requireValue("report source_basis", reportSources, [
    `through Cycle ${cycle} at ${observedThrough}`,
  ]);

  if (
    !inputs.topicMap.includes(
      `Cycle ${cycle} used the established direct localhost Chrome`,
    )
  ) {
    errors.push(`topic lead does not project Cycle ${cycle}`);
  }

  return {
    ok: errors.length === 0,
    cycle,
    observedThrough,
    errors,
  };
}

if (import.meta.main) {
  const projectDir = resolve(import.meta.dir, "../../scout-knowledge-lib");
  const result = inspectXhsCurrentProjection({
    ledger: readFileSync(
      resolve(projectDir, "knowledge/xhs-seed-ledger.md"),
      "utf8",
    ),
    topicMap: readFileSync(
      resolve(projectDir, "knowledge/xhs-topic-map.md"),
      "utf8",
    ),
    laneReport: readFileSync(
      resolve(
        projectDir,
        "reports/research/xhs-seed-first-memory-lanes-2026-09-01.md",
      ),
      "utf8",
    ),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}
