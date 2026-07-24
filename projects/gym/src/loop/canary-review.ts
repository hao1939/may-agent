import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type CanaryConfig = {
  schema_version: 1;
  benchmark: string;
  development_trials: number;
  release_trials: number;
  automatic_schedule_enabled: boolean;
  scenarios: string[];
};

type Label = {
  status: "draft" | "approved";
  source: string;
  rationale: string;
  approved_by: string | null;
  approved_at: string | null;
};

type LabelCatalog = {
  benchmark: string;
  labels: Record<string, Label>;
};

export type CanaryReview = {
  schema_version: 1;
  benchmark: string;
  approval_fingerprint: string;
  automatic_schedule_enabled: boolean;
  development_trials: number;
  release_trials: number;
  scenarios: Array<{
    id: string;
    status: Label["status"];
    source: string;
    rationale: string;
    approved_by: string | null;
    approved_at: string | null;
    human_answer: string;
  }>;
};

const scenarioFiles = [
  "task.md",
  "expected.json",
  "scenario.json",
  "success_criteria.js",
  "environment/system-state.md",
] as const;

function json<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function buildCanaryReview(
  root = resolve(import.meta.dirname, "../.."),
): CanaryReview {
  const benchmarkDir = join(root, "benchmarks", "may-alignment");
  const configPath = join(benchmarkDir, "canary.json");
  const config = json<CanaryConfig>(configPath);
  const suite = json<{ scenarios: string[] }>(join(benchmarkDir, "suite.json"));
  const labels = json<LabelCatalog>(join(benchmarkDir, "labels.json"));
  if (
    config.benchmark !== "may-alignment" ||
    labels.benchmark !== config.benchmark
  ) {
    throw new Error("Canary, benchmark directory, and label catalog disagree");
  }
  if (new Set(config.scenarios).size !== config.scenarios.length) {
    throw new Error("Canary scenarios must be unique");
  }

  const hash = createHash("sha256");
  const add = (relativePath: string, content: string | Buffer): void => {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  };
  for (const relativePath of [
    "canary.json",
    "suite.json",
    "score-decision.cjs",
  ]) {
    add(relativePath, readFileSync(join(benchmarkDir, relativePath)));
  }

  const selectedLabels: Record<
    string,
    Pick<Label, "source" | "rationale">
  > = {};
  const scenarios = config.scenarios.map((id) => {
    if (!suite.scenarios.includes(id))
      throw new Error(`Canary scenario is not in suite: ${id}`);
    const label = labels.labels[id];
    if (!label) throw new Error(`Canary scenario has no label: ${id}`);
    selectedLabels[id] = { source: label.source, rationale: label.rationale };
    const scenarioDir = join(root, "scenarios", id);
    for (const relativePath of scenarioFiles) {
      add(
        `scenarios/${id}/${relativePath}`,
        readFileSync(join(scenarioDir, relativePath)),
      );
    }
    const expected = json<{ human_answer?: unknown }>(
      join(scenarioDir, "expected.json"),
    );
    if (
      typeof expected.human_answer !== "string" ||
      !expected.human_answer.trim()
    ) {
      throw new Error(`Canary scenario has no human_answer: ${id}`);
    }
    return {
      id,
      status: label.status,
      source: label.source,
      rationale: label.rationale,
      approved_by: label.approved_by,
      approved_at: label.approved_at,
      human_answer: expected.human_answer,
    };
  });
  add("selected-labels.json", `${JSON.stringify(selectedLabels, null, 2)}\n`);

  return {
    schema_version: 1,
    benchmark: config.benchmark,
    approval_fingerprint: `sha256:${hash.digest("hex")}`,
    automatic_schedule_enabled: config.automatic_schedule_enabled,
    development_trials: config.development_trials,
    release_trials: config.release_trials,
    scenarios,
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(buildCanaryReview(), null, 2));
}
