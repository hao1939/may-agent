import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { listOwnedCases, readBenchmark } from "../cases/catalog";
import { fingerprintTree, fingerprintValue } from "../loop/store";
import type { BenchmarkSuite, LoopRunManifest } from "../loop/types";

export interface EvaluationPlan {
  schema_version: 1;
  revision: number;
  agent: string;
  owner: string;
  outcomes: string[];
  benchmarks: Array<{
    id: string;
    version: number;
    goal: string;
    baseline_run_id: string | null;
  }>;
  evaluation: {
    target: string;
    model: string;
    trials: number;
    timeout_minutes: number;
    max_runs_per_cycle: number;
  };
  improvement: {
    problem: string;
    evidence: string[];
    hypothesis: string;
    expected_benefit: string;
    unchanged_alternative: string;
    stop_when: string;
    next_action: string;
  };
  coverage_gaps: string[];
  decisions: string[];
}

// Small strict schema: reject unknown fields, including case filters/answer overrides.
type Shape =
  | "text"
  | "positive"
  | "nullable-id"
  | readonly Shape[]
  | { [key: string]: Shape }
  | 1;
const shape: Shape = {
  schema_version: 1,
  revision: "positive",
  agent: "text",
  owner: "text",
  outcomes: ["text"],
  benchmarks: [
    {
      id: "text",
      version: "positive",
      goal: "text",
      baseline_run_id: "nullable-id",
    },
  ],
  evaluation: {
    target: "text",
    model: "text",
    trials: "positive",
    timeout_minutes: "positive",
    max_runs_per_cycle: "positive",
  },
  improvement: {
    problem: "text",
    evidence: ["text"],
    hypothesis: "text",
    expected_benefit: "text",
    unchanged_alternative: "text",
    stop_when: "text",
    next_action: "text",
  },
  coverage_gaps: ["text"],
  decisions: ["text"],
};

function check(value: unknown, spec: Shape, path: string): void {
  if (spec === "text" || spec === "nullable-id") {
    if (spec === "nullable-id" && value === null) return;
    if (typeof value !== "string" || !value.trim())
      throw new Error(`${path}: expected nonempty string`);
  } else if (spec === "positive") {
    if (!Number.isSafeInteger(value) || (value as number) < 1)
      throw new Error(`${path}: expected positive integer`);
  } else if (spec === 1) {
    if (value !== 1) throw new Error(`${path}: unsupported schema version`);
  } else if (Array.isArray(spec)) {
    if (!Array.isArray(value)) throw new Error(`${path}: expected array`);
    value.forEach((v, i) => check(v, spec[0]!, `${path}[${i}]`));
  } else {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`${path}: expected object`);
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj))
      if (!Object.hasOwn(spec, key))
        throw new Error(`${path}.${key}: unknown field`);
    for (const [key, child] of Object.entries(spec))
      check(obj[key], child, `${path}.${key}`);
  }
}

export function evidencePath(repoRoot: string, value: string): string {
  const path = resolve(repoRoot, value),
    rel = relative(repoRoot, path);
  if (isAbsolute(value) || rel === ".." || rel.startsWith(`..${sep}`))
    throw new Error(`Evidence must be repository-relative: ${value}`);
  if (!existsSync(path)) throw new Error(`Missing evidence: ${value}`);
  return path;
}

export function parsePlan(value: unknown): EvaluationPlan {
  check(value, shape, "plan");
  const plan = value as EvaluationPlan;
  if (
    !plan.outcomes.length ||
    !plan.benchmarks.length ||
    !plan.improvement.evidence.length
  )
    throw new Error(
      "Plan needs outcomes, whole benchmarks and observed improvement evidence",
    );
  if (plan.evaluation.target !== plan.agent)
    throw new Error("Plan target must identify its agent");
  if (new Set(plan.benchmarks.map((b) => b.id)).size !== plan.benchmarks.length)
    throw new Error("Duplicate benchmark assignment");
  for (const id of [
    plan.agent,
    plan.owner,
    ...plan.benchmarks.map((b) => b.id),
    ...plan.benchmarks.flatMap((b) =>
      b.baseline_run_id ? [b.baseline_run_id] : [],
    ),
  ])
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id))
      throw new Error(`Invalid identity: ${id}`);
  return plan;
}

export function loadPlan(
  path: string,
  gymRoot: string,
  repoRoot = resolve(gymRoot, "../.."),
): EvaluationPlan {
  // Root `bun run gym` enters the Gym package before forwarding its arguments.
  if (!isAbsolute(path) && !existsSync(path)) path = resolve(repoRoot, path);
  const plan = parsePlan(JSON.parse(readFileSync(path, "utf8")));
  const definitionPath = join(dirname(resolve(path)), "agent.json");
  const definition = JSON.parse(readFileSync(definitionPath, "utf8"));
  if (
    definition.name !== plan.agent ||
    definition.model !== plan.evaluation.model
  )
    throw new Error(
      "Plan agent/model must match the adjacent production agent.json",
    );
  const entries = listOwnedCases(gymRoot);
  for (const assignment of plan.benchmarks) {
    const { suite, benchmark } = readBenchmark(gymRoot, assignment.id);
    if (benchmark !== assignment.id)
      throw new Error("Plan assignments must use canonical benchmark IDs");
    if (suite.version !== assignment.version)
      throw new Error(
        `${assignment.id}: benchmark version changed; revise the plan`,
      );
    if (
      suite.subject_role !== plan.agent ||
      suite.output_contract !== "task-agent-result" ||
      !["judgment", "behavior"].includes(suite.evaluation_kind ?? "")
    )
      throw new Error(
        `${assignment.id}: incompatible whole-benchmark role/result contract for ${plan.agent}`,
      );
    for (const entry of entries.filter((e) => e.benchmark === assignment.id)) {
      const c =
        entry.inlineCase ??
        JSON.parse(readFileSync(join(entry.directory!, "case.json"), "utf8"));
      if (
        c.agent_type !== plan.agent ||
        (c.output_contract ?? suite.defaults?.output_contract) !==
          suite.output_contract ||
        (c.evaluation_kind ?? suite.evaluation_kind) !== suite.evaluation_kind
      )
        throw new Error(
          `${assignment.id}/${entry.id}: incompatible case contract`,
        );
    }
  }
  for (const ref of [...plan.improvement.evidence, ...plan.decisions])
    evidencePath(repoRoot, ref);
  return plan;
}

/** Includes case bodies, fixtures, rubrics, labels and the selected scorer. */
export function benchmarkFingerprint(root: string, id: string): string {
  const { suite } = readBenchmark(root, id),
    dir = join(root, "benchmarks", id);
  if (!suite.evaluator) throw new Error(`${id}: missing evaluator`);
  return fingerprintValue({
    definition: fingerprintTree(dir),
    evaluator: fingerprintTree(resolve(dir, suite.evaluator)),
  });
}

export function wholeRun(
  run: LoopRunManifest,
  suite: BenchmarkSuite,
  trials: number,
): boolean {
  if (
    !Number.isSafeInteger(trials) ||
    trials < 1 ||
    run.trials_per_scenario !== trials ||
    run.scenarios.length !== suite.scenarios.length ||
    new Set(run.scenarios).size !== suite.scenarios.length ||
    suite.scenarios.some((id) => !run.scenarios.includes(id))
  )
    return false;
  const expected = new Set(
    suite.scenarios.flatMap((id) =>
      Array.from({ length: trials }, (_, i) => `${id}\0${i + 1}`),
    ),
  );
  const actual = run.trials.map((t) => `${t.scenario}\0${t.trial}`);
  return (
    actual.length === expected.size &&
    new Set(actual).size === actual.length &&
    actual.every((key) => expected.has(key))
  );
}

export function commissionPlan(input: {
  path: string;
  root: string;
  benchmark: string;
  agent: string;
  trials: number;
  scenarios: string[];
  timeout?: number;
}) {
  const plan = loadPlan(input.path, input.root),
    assignment = plan.benchmarks.find((b) => b.id === input.benchmark);
  if (!assignment || plan.agent !== input.agent)
    throw new Error(
      "Run must match an assigned whole benchmark and plan agent",
    );
  const { suite } = readBenchmark(input.root, input.benchmark);
  if (
    input.trials !== plan.evaluation.trials ||
    input.scenarios.length !== suite.scenarios.length ||
    new Set(input.scenarios).size !== suite.scenarios.length ||
    suite.scenarios.some((id) => !input.scenarios.includes(id))
  )
    throw new Error(
      "Plan runs require the complete benchmark and planned trial count; diagnostic selections cannot commission a plan",
    );
  if (
    input.timeout !== undefined &&
    input.timeout !== plan.evaluation.timeout_minutes
  )
    throw new Error(
      "Plan run timeout must equal its finite per-trial allowance",
    );
  return {
    plan,
    timeout: plan.evaluation.timeout_minutes,
    metadata: {
      agent: plan.agent,
      revision: plan.revision,
      fingerprint: fingerprintValue(plan),
      snapshot: "commission/evaluation-plan.json",
      benchmark_fingerprint: benchmarkFingerprint(input.root, input.benchmark),
    },
  };
}
