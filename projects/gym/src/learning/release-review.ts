import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type ReleaseSuite = {
  name: string;
  version: number;
  labels_file?: string;
  evaluator: string;
  scenarios: string[];
};

type ReleaseLabel = {
  status: "draft" | "approved";
  source: string;
  rationale: string;
  approved_by: string | null;
  approved_at: string | null;
};

type ReleaseLabels = {
  benchmark: string;
  labels: Record<string, ReleaseLabel>;
};

export type LearningReleaseReview = {
  schema_version: 1;
  benchmark: string;
  suite: string;
  version: number;
  approval_fingerprint: string;
  scenarios: Array<{
    id: string;
    status: ReleaseLabel["status"];
    source: string;
    rationale: string;
    approved_by: string | null;
    approved_at: string | null;
    approval_case: {
      title: string;
      situation: string;
      hao_request: string;
      correct_behavior: string;
    };
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

export function buildLearningReleaseReview(
  gymRoot = resolve(import.meta.dirname, "../.."),
  benchmark = "may-learning-transfer",
): LearningReleaseReview {
  const benchmarkDir = join(gymRoot, "benchmarks", benchmark);
  const suitePath = join(benchmarkDir, "suite.json");
  const suite = json<ReleaseSuite>(suitePath);
  const labelsPath = join(benchmarkDir, suite.labels_file ?? "labels.json");
  const labels = json<ReleaseLabels>(labelsPath);
  if (labels.benchmark !== benchmark) {
    throw new Error(`Release suite and label catalog disagree: ${benchmark}`);
  }
  if (!suite.scenarios.length) throw new Error("Release suite is empty");
  if (new Set(suite.scenarios).size !== suite.scenarios.length) {
    throw new Error("Release scenarios must be unique");
  }

  const hash = createHash("sha256");
  const add = (logicalPath: string, content: string | Buffer): void => {
    hash.update(logicalPath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  };
  add(`benchmarks/${benchmark}/suite.json`, readFileSync(suitePath));
  const evaluatorPath = resolve(benchmarkDir, suite.evaluator);
  add(
    `evaluator/${relative(gymRoot, evaluatorPath)}`,
    readFileSync(evaluatorPath),
  );

  const selectedLabels: Record<
    string,
    Pick<ReleaseLabel, "source" | "rationale">
  > = {};
  const scenarios = suite.scenarios.map((id) => {
    const label = labels.labels[id];
    if (!label) throw new Error(`Release scenario has no label: ${id}`);
    selectedLabels[id] = { source: label.source, rationale: label.rationale };
    const scenarioDir = join(gymRoot, "scenarios", id);
    for (const scenarioFile of scenarioFiles) {
      add(
        `scenarios/${id}/${scenarioFile}`,
        readFileSync(join(scenarioDir, scenarioFile)),
      );
    }
    const expected = json<{
      human_answer?: unknown;
      approval_case?: {
        title?: unknown;
        situation?: unknown;
        hao_request?: unknown;
        correct_behavior?: unknown;
      };
    }>(
      join(scenarioDir, "expected.json"),
    );
    if (
      typeof expected.human_answer !== "string" ||
      !expected.human_answer.trim()
    ) {
      throw new Error(`Release scenario has no human_answer: ${id}`);
    }
    const approvalCase = expected.approval_case;
    if (
      !approvalCase ||
      typeof approvalCase.title !== "string" ||
      typeof approvalCase.situation !== "string" ||
      typeof approvalCase.hao_request !== "string" ||
      typeof approvalCase.correct_behavior !== "string" ||
      approvalCase.correct_behavior.trim() !== expected.human_answer.trim()
    ) {
      throw new Error(
        `Release scenario needs a complete plain-language approval_case matching human_answer: ${id}`,
      );
    }
    return {
      id,
      status: label.status,
      source: label.source,
      rationale: label.rationale,
      approved_by: label.approved_by,
      approved_at: label.approved_at,
      approval_case: {
        title: approvalCase.title,
        situation: approvalCase.situation,
        hao_request: approvalCase.hao_request,
        correct_behavior: approvalCase.correct_behavior,
      },
      human_answer: expected.human_answer,
    };
  });
  add("selected-labels.json", `${JSON.stringify(selectedLabels, null, 2)}\n`);

  return {
    schema_version: 1,
    benchmark,
    suite: suite.name,
    version: suite.version,
    approval_fingerprint: `sha256:${hash.digest("hex")}`,
    scenarios,
  };
}
