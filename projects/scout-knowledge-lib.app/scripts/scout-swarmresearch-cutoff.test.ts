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
  cost_provenance: {
    analysis_kind: string;
    settings_sha256: string;
    declared_model: string;
    transcript_model: string;
    transcript_file_count: number;
    transcript_manifest_sha256: string;
    transcript_interval: string[];
    usage_rows: number;
    unique_message_ids: number;
    unique_message_usage_pairs: number;
    usage_keys: string[];
    deduplicated_token_totals: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      output_tokens: number;
    };
    monetary_cost_scalar_count: number;
    pricing_snapshot: string;
    cutoff_generation_code: string;
    cutoff_reference_files: string[];
    cutoff_commit_session_links: Record<string, string>;
    decision: string;
  };
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

test("Third-Autocorrelation token traces do not reconstruct dollar cost", () => {
  const cost = fixture.cost_provenance;
  expect(cost.analysis_kind).toBe("producer-authored post-hoc inventory");
  expect(cost.settings_sha256).toBe(
    "acc74784126df1912c69842774819bc6732aa9d633421b5f478e65265ec28dc3",
  );
  expect(cost.declared_model).toBe("us.anthropic.claude-opus-4-6-v1");
  expect(cost.transcript_model).toBe("claude-opus-4-6");
  expect(cost.transcript_file_count).toBe(50);
  expect(cost.transcript_manifest_sha256).toBe(
    "1082a0f18b20532e1b66bbd55c51b2608fb422e525f171d5154246e520258f0f",
  );
  expect(cost.transcript_interval).toEqual([
    "2026-05-21T00:32:38.049Z",
    "2026-05-21T07:03:58.975Z",
  ]);
  expect(cost.usage_rows).toBe(3659);
  expect(cost.unique_message_ids).toBe(1940);
  expect(cost.unique_message_usage_pairs).toBe(1940);
  expect(cost.usage_rows).toBeGreaterThan(cost.unique_message_ids);
  expect(cost.usage_keys).not.toContain("cost");
  expect(cost.deduplicated_token_totals).toEqual({
    input_tokens: 76543,
    cache_creation_input_tokens: 12818433,
    cache_read_input_tokens: 101200732,
    output_tokens: 2342017,
  });
  expect(cost.monetary_cost_scalar_count).toBe(0);
  expect(cost.pricing_snapshot).toBe("absent");
  expect(cost.cutoff_generation_code).toBe("absent");
  expect(cost.cutoff_reference_files).toEqual(["data/swarmresearch/README.md"]);
  expect(cost.cutoff_commit_session_links).toEqual({
    "3180635": "present",
    f018f27: "present",
  });
  expect(cost.decision).toContain("cannot assign");
});
