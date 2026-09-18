import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fingerprintValue, readAdjudications } from "./store";
import type {
  GroundTruthCatalog,
  LoopRunManifest,
  RunComparison,
  ScenarioComparison,
  StoredTrial,
} from "./types";

interface TrialEvidence {
  expected?: { human_answer?: string };
  decision?: { response_to_hao?: string };
  checks: Array<{ name: string; passed: boolean; detail?: string; category?: string; gate?: boolean }>;
}

function counts(trials: StoredTrial[]): { pass: number; fail: number; invalid: number } {
  return {
    pass: trials.filter((trial) => trial.machine_verdict === "pass").length,
    fail: trials.filter((trial) => trial.machine_verdict === "fail").length,
    invalid: trials.filter((trial) => trial.machine_verdict === "invalid").length,
  };
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertComparableRun(run: LoopRunManifest, role: "baseline" | "candidate"): void {
  const startedAt = Date.parse(run.started_at);
  const completedAt = run.completed_at ? Date.parse(run.completed_at) : Number.NaN;
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    throw new Error(`Cannot compare incomplete or invalid ${role} run`);
  }
  if (!run.proof.harness_fingerprint || !run.source.harness_snapshot) {
    throw new Error(`Cannot compare ${role} without frozen Gym harness evidence`);
  }
  if (!run.proof.label_set_fingerprint || !run.source.labels_snapshot) {
    throw new Error(`Cannot compare ${role} without frozen label snapshot evidence`);
  }
  const hasJudgeFingerprint = Object.prototype.hasOwnProperty.call(run.proof, "semantic_judge_fingerprint");
  const hasJudgeSnapshot = Object.prototype.hasOwnProperty.call(run.source, "semantic_judges_snapshot");
  if (!hasJudgeFingerprint || !hasJudgeSnapshot) {
    throw new Error(`Cannot compare ${role} without explicit semantic judge evidence or nonsemantic absence`);
  }
  if ((run.proof.semantic_judge_fingerprint === null) !== (run.source.semantic_judges_snapshot === null)) {
    throw new Error(`Cannot compare ${role} with inconsistent semantic judge evidence`);
  }
  if (run.proof.semantic_judging === true && (!run.proof.semantic_judge_fingerprint || !run.source.semantic_judges_snapshot)) {
    throw new Error(`Cannot compare ${role} semantic run without frozen judge definitions`);
  }
  if (!run.trials.every((trial) => ["pass", "fail", "invalid"].includes(trial.machine_verdict))) {
    throw new Error(`Cannot compare ${role} with an unknown machine verdict`);
  }
  if (!run.trials.every((trial) => trial.label_status === "approved")) {
    throw new Error(`Cannot compare ${role} whose truth was not approved at execution`);
  }
  if (!Number.isInteger(run.trials_per_scenario) || run.trials_per_scenario < 1) {
    throw new Error(`Cannot compare ${role} with invalid trial count`);
  }
  if (new Set(run.scenarios).size !== run.scenarios.length || run.scenarios.length === 0) {
    throw new Error(`Cannot compare ${role} with duplicate or empty scenarios`);
  }
  const expected = new Set(
    run.scenarios.flatMap((scenario) =>
      Array.from({ length: run.trials_per_scenario }, (_, index) => `${scenario}\0${index + 1}`),
    ),
  );
  const actual = run.trials.map((trial) => `${trial.scenario}\0${trial.trial}`);
  if (actual.length !== expected.size || new Set(actual).size !== actual.length || actual.some((key) => !expected.has(key))) {
    throw new Error(`Cannot compare ${role} with an incomplete or duplicate trial grid`);
  }
  if (run.trials.some((trial) => trial.machine_verdict === "invalid")) {
    throw new Error(`Cannot compare ${role} containing invalid trials`);
  }
  if (
    run.proof.framework_revisions.length !== 1 ||
    run.proof.models.length !== 1 ||
    run.proof.agent_prompt_fingerprints.length < 1
  ) {
    throw new Error(`Cannot compare ${role} without observed model, framework, and prompt identities`);
  }
  for (const trial of run.trials) {
    if (
      trial.provenance.framework_revision !== run.proof.framework_revisions[0] ||
      trial.provenance.model !== run.proof.models[0] ||
      !trial.provenance.prompt_fingerprint ||
      !run.proof.agent_prompt_fingerprints.includes(trial.provenance.prompt_fingerprint)
    ) throw new Error(`Cannot compare ${role} with inconsistent trial provenance`);
  }
}

export function compareRuns(
  baseline: LoopRunManifest,
  candidate: LoopRunManifest,
  labels: GroundTruthCatalog | null,
): RunComparison {
  assertComparableRun(baseline, "baseline");
  assertComparableRun(candidate, "candidate");
  if (
    baseline.phase !== "test" || baseline.baseline_run_id !== null ||
    candidate.phase !== "verify" || candidate.baseline_run_id !== baseline.run_id
  ) throw new Error("Cannot compare runs with an invalid baseline relationship");
  if (baseline.benchmark !== candidate.benchmark || baseline.benchmark_version !== candidate.benchmark_version) {
    throw new Error("Cannot compare different benchmarks");
  }
  if (baseline.agent !== candidate.agent) throw new Error("Cannot compare different agents");
  if (!labels || labels.benchmark !== baseline.benchmark) {
    throw new Error("Cannot compare without the matching benchmark truth catalog");
  }
  const suppliedTruthFingerprint = fingerprintValue(labels);
  const currentTruthApproved = baseline.scenarios.every(
    (scenario) => labels.labels[scenario]?.status === "approved",
  );
  if (currentTruthApproved && (
    !baseline.proof.label_catalog_fingerprint ||
    baseline.proof.label_catalog_fingerprint !== suppliedTruthFingerprint ||
    candidate.proof.label_catalog_fingerprint !== suppliedTruthFingerprint
  )) throw new Error("Cannot compare without the exact frozen truth catalog");
  if (!sameStrings(baseline.scenarios, candidate.scenarios)) throw new Error("Cannot compare different scenario sets");
  if (baseline.trials_per_scenario !== candidate.trials_per_scenario) throw new Error("Cannot compare different trial counts");
  if (
    !baseline.proof.input_fingerprint || baseline.proof.input_fingerprint !== candidate.proof.input_fingerprint ||
    baseline.proof.label_set_fingerprint !== candidate.proof.label_set_fingerprint ||
    baseline.proof.semantic_judge_fingerprint !== candidate.proof.semantic_judge_fingerprint ||
    baseline.proof.harness_fingerprint !== candidate.proof.harness_fingerprint ||
    !sameStrings(baseline.proof.models, candidate.proof.models) ||
    !sameStrings(baseline.proof.framework_revisions, candidate.proof.framework_revisions)
  ) throw new Error("Cannot compare runs with different frozen inputs or execution identities");
  const scenarios = baseline.scenarios.map((scenario): ScenarioComparison => {
    const baselineCounts = counts(baseline.trials.filter((trial) => trial.scenario === scenario));
    const candidateCounts = counts(candidate.trials.filter((trial) => trial.scenario === scenario));
    return {
      scenario,
      baseline: baselineCounts,
      candidate: candidateCounts,
      delta_passes: candidateCounts.pass - baselineCounts.pass,
      regression: candidateCounts.pass < baselineCounts.pass,
    };
  });
  const labelsApproved = baseline.scenarios.every((scenario) => labels?.labels[scenario]?.status === "approved");
  const sameFrameworkRevision =
    baseline.proof.framework_revisions.length === 1 &&
    candidate.proof.framework_revisions.length === 1 &&
    baseline.proof.framework_revisions[0] ===
      candidate.proof.framework_revisions[0];
  const noInvalidRuns = [...baseline.trials, ...candidate.trials].every((trial) => trial.machine_verdict !== "invalid");
  const noRegressions = scenarios.every((scenario) => !scenario.regression);
  const improved = scenarios.some((scenario) => scenario.delta_passes > 0);
  const machineGatePassed =
    sameFrameworkRevision && noInvalidRuns && noRegressions && improved;
  return {
    baseline_run_id: baseline.run_id,
    candidate_run_id: candidate.run_id,
    labels_approved: labelsApproved,
    same_framework_revision: sameFrameworkRevision,
    no_invalid_runs: noInvalidRuns,
    no_regressions: noRegressions,
    improved,
    // Draft truth cannot produce a definitive regression or release verdict.
    // Review/approve it first, then create a fresh frozen baseline.
    gate: !labelsApproved ? "needs-human-review" : machineGatePassed ? "pass" : "fail",
    scenarios,
  };
}

function readJson<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function trialEvidence(runDir: string, trial: StoredTrial): TrialEvidence {
  const caseDir = join(runDir, dirname(trial.result_path));
  return {
    expected: readJson(join(caseDir, "expected.json")),
    decision: readJson(join(caseDir, "alignment-decision.json")),
    checks: readJson<TrialEvidence["checks"]>(join(caseDir, "checks.json")) ?? [],
  };
}

function cleanLine(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function latestReview(
  reviews: ReturnType<typeof readAdjudications>,
  scenario: string,
  trial: number,
) {
  return reviews.filter((review) => review.scenario === scenario && review.trial === trial).at(-1);
}

export function renderReport(
  runDir: string,
  manifest: LoopRunManifest,
  comparison?: RunComparison,
): string {
  const reviews = readAdjudications(runDir);
  const result = counts(manifest.trials);
  const approvedScenarios = manifest.scenarios.filter((scenario) =>
    manifest.trials.some((trial) => trial.scenario === scenario && trial.label_status === "approved"),
  );
  const pendingTrials = manifest.trials.filter(
    (trial) =>
      (trial.machine_verdict !== "pass" || trial.label_status !== "approved") &&
      !latestReview(reviews, trial.scenario, trial.trial),
  );
  const lines = [
    `# Gym ${manifest.phase === "test" ? "Test" : "Verification"} Report`,
    "",
    `- Run: \`${manifest.run_id}\``,
    `- Benchmark: \`${manifest.benchmark}\` v${manifest.benchmark_version}`,
    `- Candidate: \`${manifest.candidate}\``,
    `- Agent: \`${manifest.agent}\``,
    `- Trials: ${manifest.trials.length}`,
    `- Human adjudications: ${reviews.length}`,
    "",
    "## Review status",
    "",
    `- Machine: ${result.pass} pass, ${result.fail} fail, ${result.invalid} invalid`,
    `- Approved ground truth: ${approvedScenarios.length}/${manifest.scenarios.length} scenarios`,
    `- Review queue: ${pendingTrials.length} trial${pendingTrials.length === 1 ? "" : "s"}`,
    approvedScenarios.length === manifest.scenarios.length
      ? "- Result status: machine verdicts use human-approved truth"
      : "- Result status: **provisional — draft or missing truth cannot establish a May regression**",
    "",
    "## Machine evaluation",
    "",
  ];

  for (const scenario of manifest.scenarios) {
    const scenarioTrials = manifest.trials.filter((trial) => trial.scenario === scenario);
    const result = counts(scenarioTrials);
    const labelStatus = scenarioTrials[0]?.label_status ?? "missing";
    const icon = result.invalid > 0 ? "!" : labelStatus !== "approved" ? "?" : result.fail > 0 ? "✗" : "✓";
    lines.push(
      `### ${icon} ${scenario}`,
      "",
      `Machine: ${result.pass}/${scenarioTrials.length} pass, ${result.fail} fail, ${result.invalid} invalid · Ground truth: **${labelStatus}**`,
    );
    const firstEvidence = scenarioTrials[0] ? trialEvidence(runDir, scenarioTrials[0]) : undefined;
    if (firstEvidence?.expected?.human_answer) {
      lines.push("", `Expected intent: ${cleanLine(firstEvidence.expected.human_answer)}`);
    }
    for (const trial of scenarioTrials) {
      const review = latestReview(reviews, scenario, trial.trial);
      if (trial.machine_verdict === "pass" && trial.label_status === "approved" && !review) continue;
      const evidence = trialEvidence(runDir, trial);
      const failedChecks = evidence.checks.filter((check) => !check.passed);
      lines.push(
        "",
        `- Trial ${trial.trial}: machine **${trial.machine_verdict}**${review ? ` · human **${review.verdict}** (${review.classification ?? "unclassified"})` : " · human **pending**"}`,
      );
      if (evidence.decision?.response_to_hao) {
        lines.push(`  - May replied: “${cleanLine(evidence.decision.response_to_hao)}”`);
      }
      if (trial.invalid_reason) lines.push(`  - Invalid because: ${trial.invalid_reason}`);
      for (const check of failedChecks) {
        const kind = check.gate === false ? "advisory" : check.category ?? "check";
        lines.push(`  - ${kind} · ${check.name}: ${cleanLine(check.detail ?? "failed")}`);
      }
      lines.push(`  - Evidence: \`${trial.result_path}\``);
    }
    lines.push("");
  }

  lines.push("", "## Human review", "");
  if (reviews.length === 0) {
    lines.push("No trials have been adjudicated. Machine results are evidence, not final ground truth.");
  } else {
    for (const review of reviews) {
      const classification = review.classification ? ` · ${review.classification}` : "";
      const reasonCodes = review.reason_codes?.length ? ` · ${review.reason_codes.join(", ")}` : "";
      lines.push(`- ${review.scenario} trial ${review.trial}: **${review.verdict}**${classification}${reasonCodes} — ${review.reason} (${review.reviewer})`);
    }
  }

  if (comparison) {
    lines.push("", "## Baseline comparison", "");
    for (const item of comparison.scenarios) {
      const sign = item.delta_passes > 0 ? `+${item.delta_passes}` : String(item.delta_passes);
      lines.push(
        `${item.regression ? "✗" : "✓"} ${item.scenario}: ${item.baseline.pass} → ${item.candidate.pass} passes (${sign})`,
      );
    }
    lines.push(
      "",
      `Gate: **${comparison.gate}**`,
      `- Ground truth approved: ${comparison.labels_approved}`,
      `- One matching framework revision: ${comparison.same_framework_revision}`,
      `- No invalid runs: ${comparison.no_invalid_runs}`,
      `- No regressions: ${comparison.no_regressions}`,
      `- At least one improvement: ${comparison.improved}`,
    );
  }

  lines.push("");
  const report = lines.join("\n");
  writeFileSync(join(runDir, "report.md"), report);
  return report;
}
