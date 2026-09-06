import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type CutoffRow = {
  id: string;
  paper_value: string;
  cutoff_score: string;
  transform: "direct" | "benchmark_div_score" | "reciprocal_minus_one";
  benchmark?: string;
  later_compatible_score?: string;
  later_commit_cost?: string;
  expected: "compatible" | "incompatible";
};

type Fixture = {
  schema: string;
  analysis_kind: string;
  source_tip: string;
  recovery_source: string;
  cutoff_rows: CutoffRow[];
  missing_cutoff_rows: string[];
};

const fixture = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dir,
      "fixtures/scout-swarmresearch-cutoff-cycle420.json",
    ),
    "utf8",
  ),
) as Fixture;

function decimalPlaces(value: string): number {
  return value.includes(".") ? value.length - value.indexOf(".") - 1 : 0;
}

function transform(row: CutoffRow, score: number): number {
  if (row.transform === "direct") return score;
  if (row.transform === "reciprocal_minus_one") return 1 / score - 1;
  if (row.benchmark === undefined)
    throw new Error(`${row.id}: missing benchmark`);
  return Number(row.benchmark) / score;
}

function intervalsOverlap(row: CutoffRow): boolean {
  const score = Number(row.cutoff_score);
  const scoreHalfUnit = 0.5 * 10 ** -decimalPlaces(row.cutoff_score);
  const transformed = [
    transform(row, score - scoreHalfUnit),
    transform(row, score + scoreHalfUnit),
  ].sort((left, right) => left - right);

  const paper = Number(row.paper_value);
  const paperHalfUnit = 0.5 * 10 ** -decimalPlaces(row.paper_value);
  const paperInterval = [paper - paperHalfUnit, paper + paperHalfUnit];
  return (
    Math.max(transformed[0], paperInterval[0]) <=
    Math.min(transformed[1], paperInterval[1])
  );
}

test("SwarmResearch public $50 cutoff rows support nine paper cells", () => {
  expect(fixture.schema).toBe("scout.swarmresearch-cutoff-audit/v1");
  expect(fixture.analysis_kind).toBe("producer-authored post-hoc regression");
  expect(fixture.source_tip).toBe("b5b714d976bd1b4725cf459d5bab3182f8669c22");
  expect(fixture.recovery_source).toBe(
    "1668e158c6907cd3aacf8c01d9751bfc669930f2",
  );
  expect(fixture.cutoff_rows).toHaveLength(10);
  expect(fixture.missing_cutoff_rows).toEqual([
    "ahc008",
    "ahc015",
    "ahc016",
    "ahc025",
    "ahc026",
  ]);

  const outcomes = Object.fromEntries(
    fixture.cutoff_rows.map((row) => [row.id, intervalsOverlap(row)]),
  );
  expect(Object.values(outcomes).filter(Boolean)).toHaveLength(9);
  expect(outcomes.third_autocorr_ineq).toBe(false);
  for (const row of fixture.cutoff_rows) {
    expect(intervalsOverlap(row)).toBe(row.expected === "compatible");
  }
});

test("Third-Autocorrelation needs an uncosted later trajectory score", () => {
  const row = fixture.cutoff_rows.find(
    (candidate) => candidate.id === "third_autocorr_ineq",
  );
  if (row === undefined) throw new Error("missing Third-Autocorrelation row");

  const cutoffDerived = transform(row, Number(row.cutoff_score));
  const paperImpliedScore = Number(row.benchmark) / Number(row.paper_value);
  expect(cutoffDerived).toBeCloseTo(1.4578295396840666, 12);
  expect(paperImpliedScore).toBeCloseTo(0.9994183244475008, 12);
  expect(
    intervalsOverlap({ ...row, cutoff_score: row.later_compatible_score! }),
  ).toBe(true);
  expect(row.later_commit_cost).toBe("unretained");
});
