import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { expect, test } from "bun:test";

type Run = {
  id: string;
  model: string;
  rag_pass: number;
  memory_pass: number;
  wins: number;
  losses: number;
  ties: number;
};

type ScenarioPair = {
  id: string;
  wins: number;
  losses: number;
  ties: number;
  net: number;
};

type MetricFile = {
  id: string;
  model: string;
  path: string;
  sha256: string;
  rag: boolean[];
  memory: boolean[];
};

type Fixture = {
  schema: string;
  analysis_kind: string;
  research_source: string;
  canonical_parent_after_reconciliation: string;
  source: Record<string, string>;
  design: {
    models: number;
    runs_per_model: number;
    scenarios: number;
    matched_cells: number;
    create_scenarios: number;
    refuse_scenarios: number;
    designed_to_differentiate_conditions: boolean;
    s01_declares_memory_pass_rag_fail_expectation: boolean;
  };
  scenario_order: string[];
  metric_files: MetricFile[];
  runs: Run[];
  model_totals: Array<{
    model: string;
    rag_pass: number;
    memory_pass: number;
    net: number;
  }>;
  scenario_pairs: ScenarioPair[];
  paired_totals: {
    wins: number;
    losses: number;
    ties: number;
    net: number;
    positive_scenarios: number;
    negative_scenarios: number;
    tied_scenarios: number;
  };
  s01_concentration: Record<string, number>;
  decision: string;
};

const fixture = JSON.parse(
  readFileSync(
    join(import.meta.dir, "fixtures/scout-organizational-memory-cycle425.json"),
    "utf8",
  ),
) as Fixture;

test("Organizational Memory aggregate advantage is source-bound", () => {
  expect(fixture.schema).toBe("scout.organizational-memory-run-scenario/v1");
  expect(fixture.analysis_kind).toBe(
    "producer-authored post-hoc matched inventory",
  );
  expect(fixture.research_source).toBe(
    "5b730b02df83974c3bd33f55755d4278c01f49f0",
  );
  expect(fixture.canonical_parent_after_reconciliation).toBe(
    "c5f4d3153f066b5abea7346eab5db6fcdeea9c03",
  );
  expect(fixture.source).toEqual({
    revision: "11617e3191bf6307eea64476fcb1269b5ca3fb78",
    tree: "2ca92ed4b97236f80e48ba177a6642d05e626ba4",
    arxiv_v1_sha256:
      "058b6a6d2d53aaff8846641479a8be45dadf1ff59602c80081d42078db3ef189",
    repository_archive_sha256:
      "7e183ab73192b2ed748723147a544dc509ff1064543f09b5bedb39bbda8f6e7a",
    scenarios_sha256:
      "29a5d26caa1b791c8e54705e2d49c771fbeb91930ea81ba22384138820b0ba51",
    evaluator_sha256:
      "49e2c08cedbc80672836cc2597dfdf1a4a43e653aa9af49a9e4ff5187cf248d9",
    metrics_manifest_sha256:
      "be97df9f73649e324e5fabf8eb7e98176f75f04a1f3ff7905a14779cfd01eb0f",
  });
});

test("all eight fixed-suite run aggregates favor memory over RAG", () => {
  expect(fixture.design).toEqual({
    models: 2,
    runs_per_model: 4,
    scenarios: 10,
    matched_cells: 80,
    create_scenarios: 3,
    refuse_scenarios: 7,
    designed_to_differentiate_conditions: true,
    s01_declares_memory_pass_rag_fail_expectation: true,
  });
  expect(fixture.scenario_order).toEqual(
    Array.from(
      { length: 10 },
      (_, index) => `s${String(index + 1).padStart(2, "0")}`,
    ),
  );
  expect(fixture.metric_files).toHaveLength(8);
  expect(new Set(fixture.metric_files.map(({ path }) => path)).size).toBe(8);
  const manifest = fixture.metric_files
    .map(({ path, sha256 }) => `${sha256}  ${path}\n`)
    .join("");
  expect(createHash("sha256").update(manifest).digest("hex")).toBe(
    fixture.source.metrics_manifest_sha256,
  );
  const derivedRuns = fixture.metric_files.map(
    ({ id, model, rag, memory }): Run => {
      expect(rag).toHaveLength(fixture.scenario_order.length);
      expect(memory).toHaveLength(fixture.scenario_order.length);
      return {
        id,
        model,
        rag_pass: rag.filter(Boolean).length,
        memory_pass: memory.filter(Boolean).length,
        wins: memory.filter((value, index) => value && !rag[index]).length,
        losses: memory.filter((value, index) => !value && rag[index]).length,
        ties: memory.filter((value, index) => value === rag[index]).length,
      };
    },
  );
  expect(derivedRuns).toEqual(fixture.runs);
  expect(fixture.runs).toHaveLength(8);
  expect(fixture.runs.every((run) => run.memory_pass > run.rag_pass)).toBe(
    true,
  );
  expect(fixture.model_totals).toEqual([
    { model: "gpt-4.1", rag_pass: 28, memory_pass: 35, net: 7 },
    { model: "sonnet-4.5", rag_pass: 32, memory_pass: 38, net: 6 },
  ]);
  expect(fixture.runs.reduce((total, run) => total + run.memory_pass, 0)).toBe(
    73,
  );
  expect(fixture.runs.reduce((total, run) => total + run.rag_pass, 0)).toBe(60);
});

test("one designed scenario concentrates most of the net advantage", () => {
  const derivedScenarioPairs = fixture.scenario_order.map((id, index) => {
    const wins = fixture.metric_files.filter(
      ({ rag, memory }) => memory[index] && !rag[index],
    ).length;
    const losses = fixture.metric_files.filter(
      ({ rag, memory }) => !memory[index] && rag[index],
    ).length;
    return {
      id,
      wins,
      losses,
      ties: fixture.metric_files.length - wins - losses,
      net: wins - losses,
    };
  });
  expect(derivedScenarioPairs).toEqual(fixture.scenario_pairs);
  const totals = fixture.scenario_pairs.reduce(
    (result, row) => ({
      wins: result.wins + row.wins,
      losses: result.losses + row.losses,
      ties: result.ties + row.ties,
      net: result.net + row.net,
      positive_scenarios: result.positive_scenarios + Number(row.net > 0),
      negative_scenarios: result.negative_scenarios + Number(row.net < 0),
      tied_scenarios: result.tied_scenarios + Number(row.net === 0),
    }),
    {
      wins: 0,
      losses: 0,
      ties: 0,
      net: 0,
      positive_scenarios: 0,
      negative_scenarios: 0,
      tied_scenarios: 0,
    },
  );
  expect(totals).toEqual(fixture.paired_totals);
  expect(fixture.scenario_pairs.find(({ id }) => id === "s01")).toEqual({
    id: "s01",
    wins: 8,
    losses: 0,
    ties: 0,
    net: 8,
  });
  expect(fixture.s01_concentration).toEqual({
    net: 8,
    share_of_net: 8 / 13,
    without_s01_pairs: 72,
    without_s01_wins: 12,
    without_s01_losses: 7,
    without_s01_ties: 53,
    without_s01_net: 5,
    without_s01_positive_runs: 5,
    without_s01_tied_runs: 3,
    without_s01_negative_runs: 0,
  });
  expect(fixture.decision).toContain("does not establish broad task");
});
