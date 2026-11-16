import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { readBenchmark } from "../cases/catalog";
import { assertFrozenInputs, currentHarnessFingerprint } from "../loop/run";
import { compareRuns } from "../loop/report";
import {
  fingerprintTree,
  fingerprintValue,
  machineVerdict,
} from "../loop/store";
import type {
  BenchmarkSuite,
  GroundTruthCatalog,
  LoopRunManifest,
} from "../loop/types";
import {
  benchmarkFingerprint,
  evidencePath,
  loadPlan,
  parsePlan,
  wholeRun,
  type EvaluationPlan,
} from "./plan";

export interface HistoryEntry {
  run: LoopRunManifest;
  directory: string;
  current: boolean;
  harness_matches_current: boolean;
  limit: string;
  series: string | null;
  counts: { pass: number; fail: number; invalid: number };
  duration_ms: number | null;
  total_tokens: number | null;
  ops: number | null;
  gate: string;
}
export interface OwnerDecision {
  schema_version: 1;
  agent: string;
  owner: string;
  run_id: string;
  benchmark: string;
  benchmark_version: number;
  candidate_fingerprint: string;
  input_fingerprint: string;
  disposition: "adopt" | "reject" | "defer" | "no-change";
  evidence: string;
  source_readiness: "verified" | "unverified";
  integration: "applied" | "not-applied" | "unknown";
  activation: "active" | "inactive" | "unknown";
  created_at: string;
}
export interface PlanReport {
  generated_at: string;
  plan: EvaluationPlan;
  plan_fingerprint: string;
  history: HistoryEntry[];
  decisions: OwnerDecision[];
  issues: string[];
}

function retainedPath(directory: string, value: string): string {
  const path = resolve(directory, value),
    rel = relative(directory, path);
  if (rel === ".." || rel.startsWith(`..${sep}`))
    throw new Error("Retained evidence path escapes its run");
  if (!existsSync(path)) throw new Error(`Missing retained evidence: ${value}`);
  return path;
}

function readRun(directory: string): LoopRunManifest {
  const value = JSON.parse(
    readFileSync(join(directory, "manifest.json"), "utf8"),
  );
  const strings = (v: unknown) =>
    v === undefined ||
    (Array.isArray(v) && v.every((i) => typeof i === "string"));
  if (
    !value ||
    value.schema_version !== 2 ||
    typeof value.run_id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.run_id) ||
    typeof value.agent !== "string" ||
    typeof value.benchmark !== "string" ||
    !Number.isSafeInteger(value.benchmark_version) ||
    value.benchmark_version < 1 ||
    !Number.isSafeInteger(value.trials_per_scenario) ||
    value.trials_per_scenario < 1 ||
    !Array.isArray(value.scenarios) ||
    !value.scenarios.every((id: unknown) => typeof id === "string") ||
    !Array.isArray(value.trials) ||
    !value.proof ||
    !value.source ||
    typeof value.started_at !== "string" ||
    (value.completed_at !== null && typeof value.completed_at !== "string") ||
    !strings(value.proof.models) ||
    !strings(value.proof.framework_revisions) ||
    !strings(value.proof.agent_prompt_fingerprints) ||
    !["test", "verify"].includes(value.phase) ||
    !value.trials.every(
      (t: any) =>
        t &&
        typeof t.scenario === "string" &&
        Number.isSafeInteger(t.trial) &&
        ["pass", "fail", "invalid"].includes(t.machine_verdict) &&
        typeof t.result_path === "string" &&
        t.provenance,
    )
  )
    throw new Error("Malformed or unsupported retained manifest");
  return value;
}

function assertRetained(directory: string, run: LoopRunManifest): void {
  // Reading history never calls the existing renderer, rescorer or writer.
  if (
    fingerprintTree(retainedPath(directory, "inputs")) !==
    run.proof.input_fingerprint
  )
    throw new Error("Retained input fingerprint mismatch");
  if (
    run.candidate !== "baseline" &&
    (!run.source.candidate_snapshot ||
      !run.proof.candidate_fingerprint ||
      fingerprintTree(
        retainedPath(directory, run.source.candidate_snapshot),
      ) !== run.proof.candidate_fingerprint)
  )
    throw new Error("Retained candidate fingerprint mismatch");
  const labels: GroundTruthCatalog | null = run.source.labels_snapshot
    ? JSON.parse(
        readFileSync(
          retainedPath(directory, run.source.labels_snapshot),
          "utf8",
        ),
      )
    : null;
  for (const trial of run.trials) {
    if (
      trial.machine_verdict !== "invalid" &&
      (!trial.artifact_path || !trial.transcript_path)
    )
      throw new Error("Missing retained task artifact or transcript");
    for (const ref of [
      trial.result_path,
      trial.artifact_path,
      trial.transcript_path,
    ])
      if (ref) retainedPath(directory, ref);
    const result = JSON.parse(
      readFileSync(retainedPath(directory, trial.result_path), "utf8"),
    );
    if (result.scenario !== trial.scenario || result.agent !== run.agent)
      throw new Error("Retained result identity mismatch");
    if (machineVerdict(result).verdict !== trial.machine_verdict)
      throw new Error("Retained result contradicts the manifest verdict");
    if (
      trial.label_status !==
      (labels?.labels[trial.scenario]?.status ?? "missing")
    )
      throw new Error("Retained truth status contradicts the manifest");
    if (
      trial.duration_ms !== (result.duration_ms ?? null) ||
      fingerprintValue(trial.usage ?? null) !==
        fingerprintValue(result.usage ?? null)
    )
      throw new Error("Retained resource telemetry contradicts the manifest");
    if (
      trial.provenance.model !== (result.model ?? null) ||
      trial.provenance.framework_revision !== (result.framework_sha ?? null) ||
      trial.provenance.prompt_fingerprint !== (result.prompt_hash ?? null)
    )
      throw new Error("Retained subject identity contradicts the manifest");
  }
}

function currentEvidence(
  directory: string,
  run: LoopRunManifest,
  plan: EvaluationPlan,
  root: string,
): string {
  const assignment = plan.benchmarks.find((b) => b.id === run.benchmark);
  if (!assignment || run.benchmark_version !== assignment.version)
    return "historical benchmark/version; fresh baseline required";
  const { suite } = readBenchmark(root, assignment.id);
  if (
    !run.completed_at ||
    !Number.isFinite(Date.parse(run.started_at)) ||
    !Number.isFinite(Date.parse(run.completed_at)) ||
    Date.parse(run.completed_at) < Date.parse(run.started_at)
  )
    return "incomplete run";
  if (!wholeRun(run, suite, plan.evaluation.trials))
    return "partial, duplicate or mismatched trial grid";
  const binding = run.evaluation_plan;
  if (!binding)
    return "historical run without a commissioning plan; current coverage unmeasured";
  const commissioned = parsePlan(
    JSON.parse(readFileSync(retainedPath(directory, binding.snapshot), "utf8")),
  );
  if (
    fingerprintValue(commissioned) !== binding.fingerprint ||
    commissioned.agent !== plan.agent ||
    binding.agent !== plan.agent ||
    binding.revision !== commissioned.revision ||
    fingerprintValue(commissioned.evaluation) !==
      fingerprintValue(plan.evaluation) ||
    !commissioned.benchmarks.some(
      (b) => b.id === assignment.id && b.version === assignment.version,
    )
  )
    return "commissioning plan identity/setup mismatch";
  if (
    binding.benchmark_fingerprint !== benchmarkFingerprint(root, assignment.id)
  ) {
    // Older commissions captured the entire owner directory, including review
    // prose. Authenticate that original capture before comparing the actual
    // executed inputs below; never rewrite its fingerprint or retained files.
    if (binding.benchmark_fingerprint !== benchmarkFingerprint(
      join(directory, "inputs"), assignment.id,
    )) return "benchmark definition changed or commissioning fingerprint inconsistent; fresh baseline required";
  }
  if (
    fingerprintValue(run.evaluation_kinds) !==
    fingerprintValue(
      Object.fromEntries(
        suite.scenarios.map((id) => [id, suite.evaluation_kind]),
      ),
    )
  )
    return "evaluation kind identity mismatch";
  if (
    run.proof.models?.length !== 1 ||
    run.proof.models[0] !== plan.evaluation.model ||
    run.proof.framework_revisions?.length !== 1 ||
    !run.proof.agent_prompt_fingerprints?.length ||
    run.trials.some(
      (t) =>
        t.provenance.model !== plan.evaluation.model ||
        t.provenance.framework_revision !== run.proof.framework_revisions[0] ||
        !t.provenance.prompt_fingerprint ||
        !run.proof.agent_prompt_fingerprints.includes(
          t.provenance.prompt_fingerprint,
        ),
    )
  )
    return "missing or mismatched observed model/framework/prompt identity";
  assertRetained(directory, run);
  assertFrozenInputs(directory, run, "history");
  return "";
}

function sum(
  run: LoopRunManifest,
  field: "duration_ms" | "total_tokens" | "ops",
): number | null {
  if (
    !run.trials.length ||
    !wholeRun(
      run,
      { scenarios: run.scenarios } as BenchmarkSuite,
      run.trials_per_scenario,
    )
  )
    return null;
  const values = run.trials.map((t) =>
    field === "duration_ms"
      ? t.duration_ms
      : (field === "ops" ? t.usage?.ops_measured : t.usage?.tokens_measured) ===
          false
        ? null
        : t.usage?.[field],
  );
  if (
    values.some(
      (v) =>
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        (field !== "duration_ms" && !Number.isSafeInteger(v)),
    )
  )
    return null;
  const total = (values as number[]).reduce((a, b) => a + b, 0);
  return Number.isFinite(total) ? total : null;
}

function series(run: LoopRunManifest): string {
  return fingerprintValue({
    agent: run.agent,
    benchmark: run.benchmark,
    version: run.benchmark_version,
    inputs: run.proof.input_fingerprint,
    truth: run.proof.label_catalog_fingerprint,
    harness: run.proof.harness_fingerprint,
    judges: run.proof.semantic_judge_fingerprint,
    models: run.proof.models,
    framework: run.proof.framework_revisions,
    cases: [...run.scenarios].sort(),
    trials: run.trials_per_scenario,
    kinds: run.evaluation_kinds,
    objective: run.comparison_objective,
  });
}

export function buildPlanReport(
  planPath: string,
  root: string,
  runsDirectory: string,
  repoRoot = resolve(root, "../.."),
): PlanReport {
  const plan = loadPlan(planPath, root, repoRoot),
    history: HistoryEntry[] = [],
    issues: string[] = [];
  if (!existsSync(runsDirectory))
    issues.push(`Retained run directory unavailable: ${runsDirectory}`);
  else
    for (const dir of readdirSync(runsDirectory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (
        !dir.isDirectory() ||
        !existsSync(join(runsDirectory, dir.name, "manifest.json"))
      )
        continue;
      const directory = join(runsDirectory, dir.name);
      try {
        const run = readRun(directory);
        if (run.agent !== plan.agent) continue;
        if (run.run_id !== dir.name)
          throw new Error("Manifest/run directory identity mismatch");
        let limit: string;
        try {
          limit = currentEvidence(directory, run, plan, root);
        } catch (error) {
          limit = error instanceof Error ? error.message : String(error);
        }
        history.push({
          run,
          directory,
          current: !limit,
          harness_matches_current: !limit &&
            run.proof.harness_fingerprint === currentHarnessFingerprint(),
          limit,
          series: limit ? null : series(run),
          counts: {
            pass: run.trials.filter((t) => t.machine_verdict === "pass").length,
            fail: run.trials.filter((t) => t.machine_verdict === "fail").length,
            invalid: run.trials.filter((t) => t.machine_verdict === "invalid")
              .length,
          },
          duration_ms: sum(run, "duration_ms"),
          total_tokens: sum(run, "total_tokens"),
          ops: sum(run, "ops"),
          gate: "unavailable",
        });
      } catch (error) {
        issues.push(
          `${dir.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  history.sort(
    (a, b) =>
      (a.run.started_at ?? "").localeCompare(b.run.started_at ?? "") ||
      a.run.run_id.localeCompare(b.run.run_id),
  );
  for (const item of history.filter(
    (h) => h.current && h.run.phase === "verify",
  )) {
    try {
      const baseline = history.find(
        (h) => h.run.run_id === item.run.baseline_run_id,
      );
      if (!baseline?.current || baseline.series !== item.series)
        throw new Error("No current comparable baseline");
      const labels: GroundTruthCatalog = JSON.parse(
        readFileSync(
          retainedPath(
            baseline.directory,
            baseline.run.source.labels_snapshot!,
          ),
          "utf8",
        ),
      );
      item.gate = compareRuns(baseline.run, item.run, labels).gate;
    } catch (error) {
      item.gate = `unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  for (const assignment of plan.benchmarks)
    if (assignment.baseline_run_id) {
      const baseline = history.find(
        (h) => h.run.run_id === assignment.baseline_run_id,
      );
      if (
        !baseline?.current ||
        baseline.run.benchmark !== assignment.id ||
        baseline.run.phase !== "test" ||
        baseline.run.baseline_run_id !== null ||
        baseline.counts.invalid ||
        baseline.run.trials.some((t) => t.label_status !== "approved")
      )
        issues.push(
          `${assignment.id}: selected baseline is missing, incompatible, invalid or unapproved`,
        );
    }
  const decisions: OwnerDecision[] = [];
  for (const ref of plan.decisions) {
    try {
      const d = JSON.parse(
        readFileSync(evidencePath(repoRoot, ref), "utf8"),
      ) as OwnerDecision;
      const h = history.find((h) => h.run.run_id === d.run_id);
      if (
        d.schema_version !== 1 ||
        d.agent !== plan.agent ||
        d.owner !== plan.owner ||
        !h ||
        d.benchmark !== h.run.benchmark ||
        d.benchmark_version !== h.run.benchmark_version ||
        !d.candidate_fingerprint ||
        d.candidate_fingerprint !== h.run.proof.candidate_fingerprint ||
        d.input_fingerprint !== h.run.proof.input_fingerprint ||
        !d.input_fingerprint ||
        !["adopt", "reject", "defer", "no-change"].includes(d.disposition) ||
        !["verified", "unverified"].includes(d.source_readiness) ||
        !["applied", "not-applied", "unknown"].includes(d.integration) ||
        !["active", "inactive", "unknown"].includes(d.activation) ||
        !Number.isFinite(Date.parse(d.created_at))
      )
        throw new Error("Owner decision identity or disposition mismatch");
      evidencePath(repoRoot, d.evidence);
      assertRetained(h.directory, h.run);
      decisions.push(d);
    } catch (error) {
      issues.push(
        `${ref}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return {
    generated_at: new Date().toISOString(),
    plan,
    plan_fingerprint: fingerprintValue(plan),
    history,
    decisions,
    issues,
  };
}

const cell = (value: unknown) =>
  String(value === "" || value == null ? "unknown" : value)
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
const link = (label: string, path: string) => `[${cell(label)}](<${path}>)`;

export function renderPlanReport(
  report: PlanReport,
  root: string,
  repoRoot = resolve(root, "../.."),
): string {
  const { plan, history, decisions } = report;
  const lines = [
    `# ${plan.agent}: evaluation plan and evidence`,
    "",
    `Plan revision ${plan.revision}; owner: ${plan.owner}; fingerprint: \`${report.plan_fingerprint}\`.`,
    `Generated ${report.generated_at}; ${history.length} retained runs for this agent.`,
    "",
    "North star: correct useful delivery, fewer operator corrections, acceptable total time/cost.",
    "",
    ...plan.outcomes.map((goal) => `- ${goal}`),
    "",
    "## Whole-benchmark coverage",
    "",
    "Current evidence matches the benchmark and planned evaluation setup under its recorded harness. New verification still requires a matching execution harness. Subject fingerprints identify what was tested; they do not establish which candidate is installed or active.",
    "",
    "| Benchmark / goal | Kind | Latest current evidence | Selected baseline |",
    "| --- | --- | --- | --- |",
  ];
  for (const assignment of plan.benchmarks) {
    const { suite } = readBenchmark(root, assignment.id),
      latest = history
        .filter((h) => h.current && h.run.benchmark === assignment.id)
        .at(-1);
    lines.push(
      `| ${assignment.id} v${assignment.version} (${suite.scenarios.length} ${suite.scenarios.length === 1 ? "case" : "cases"}): ${cell(assignment.goal)} | ${suite.evaluation_kind} | ${latest ? `${link(latest.run.run_id, join(latest.directory, "manifest.json"))}: ${latest.counts.pass} pass / ${latest.counts.fail} fail / ${latest.counts.invalid} invalid; ${latest.run.trials.some((t) => t.label_status !== "approved") ? "draft/missing truth; diagnostic only" : "approved truth"}` : "unmeasured"} | ${assignment.baseline_run_id ?? "unmeasured"} |`,
    );
  }
  lines.push(
    "",
    "## Current improvement",
    "",
    plan.improvement.problem,
    "",
    `Hypothesis: ${plan.improvement.hypothesis}`,
    "",
    `Expected benefit: ${plan.improvement.expected_benefit}`,
    "",
    `Unchanged alternative: ${plan.improvement.unchanged_alternative}`,
    "",
    `Stop when: ${plan.improvement.stop_when}`,
    "",
    ...plan.improvement.evidence.map(
      (ref) => `- Evidence: ${link(ref, resolve(repoRoot, ref))}`,
    ),
    "",
    `**Next action:** ${plan.improvement.next_action}`,
    "",
    "## Coverage gaps",
    "",
    ...plan.coverage_gaps.map((gap) => `- ${gap}`),
    "",
    "## Evaluation allowance",
    "",
    `Target ${plan.evaluation.target}; configured model ${plan.evaluation.model}; ${plan.evaluation.trials} trial(s) per case; ${plan.evaluation.timeout_minutes} minutes per trial; at most ${plan.evaluation.max_runs_per_cycle} benchmark runs per manual cycle.`,
    "",
    "Commissioned runs enforce whole membership, trial count and per-trial subject timeout. Alex accounts for the cumulative cycle allowance manually. Total cycle and grader cost are unknown unless separately evidenced.",
    "",
    "## Retained history",
    "",
    "Historical counts below are retained machine verdicts, not current benchmark scores. Old runs are not relabeled after a split. Unknown usage stays unknown. No historical run is rewritten.",
    "",
    "| Run / date | Benchmark / candidate | Kind | P / F / invalid; truth | Target ms / tokens / ops | Current evidence limit |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const h of history) {
    const r = h.run,
      truth =
        [...new Set(r.trials.map((t) => t.label_status))].join(", ") ||
        "missing";
    const kinds =
      [...new Set(Object.values(r.evaluation_kinds ?? {}))]
        .map((k) => k ?? "unclassified")
        .join(", ") || "unclassified";
    lines.push(
      `| ${link(r.run_id, join(h.directory, "manifest.json"))} / ${cell(r.started_at)} | ${cell(r.benchmark)} v${r.benchmark_version} / ${cell(r.candidate)} | ${cell(kinds)} | ${h.counts.pass} / ${h.counts.fail} / ${h.counts.invalid}; ${cell(truth)} | ${cell(h.duration_ms)} / ${cell(h.total_tokens)} / ${cell(h.ops)} | ${cell(h.limit || (h.harness_matches_current ? "complete current evidence" : "complete measurement; use recorded harness for comparison"))} |`,
    );
  }
  if (!history.length)
    lines.push(
      "| No retained runs for this agent | — | unclassified | unmeasured | unknown | unmeasured |",
    );
  lines.push("", "## Execution identity and failures", "");
  for (const h of history) {
    const r = h.run;
    lines.push(
      `- ${r.run_id}: model ${cell(r.proof.models?.join(", "))}; framework ${cell(r.proof.framework_revisions?.join(", "))}; candidate fingerprint ${cell(r.proof.candidate_fingerprint)}; inputs ${cell(r.proof.input_fingerprint)}; prompts ${cell(r.proof.agent_prompt_fingerprints?.join(", "))}; plan revision ${cell(r.evaluation_plan?.revision)}; comparison series ${h.series ?? "unestablished"}; gate ${cell(h.gate)}.`,
    );
    for (const t of r.trials.filter((t) => t.machine_verdict !== "pass"))
      lines.push(
        `  - ${link(`${t.scenario} trial ${t.trial}: ${t.machine_verdict}`, resolve(h.directory, t.result_path))}${t.invalid_reason ? `: ${cell(t.invalid_reason.length > 240 ? t.invalid_reason.slice(0, 237) + "… (see linked evidence)" : t.invalid_reason)}` : ""}`,
      );
  }
  lines.push("", "## Owner decisions and delivery", "");
  if (!decisions.length)
    lines.push(
      "No validated explicit owner decisions linked. Adoption, source readiness, integration and activation are unknown. A passing gate establishes none of them.",
    );
  for (const d of decisions)
    lines.push(
      `- ${d.run_id}: ${d.owner} chose ${d.disposition} (${d.created_at}); source ${d.source_readiness}; integration ${d.integration}; activation ${d.activation}. ${link("Decision evidence", resolve(repoRoot, d.evidence))}`,
    );
  if (report.issues.length)
    lines.push(
      "",
      "## Evidence issues",
      "",
      ...report.issues.map((issue) => `- ${cell(issue)}`),
    );
  return lines.join("\n") + "\n";
}
