import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readAdjudications } from "./store";
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

export function compareRuns(
  baseline: LoopRunManifest,
  candidate: LoopRunManifest,
  labels: GroundTruthCatalog | null,
): RunComparison {
  if (baseline.benchmark !== candidate.benchmark) throw new Error("Cannot compare different benchmarks");
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
  const noInvalidRuns = [...baseline.trials, ...candidate.trials].every((trial) => trial.machine_verdict !== "invalid");
  const noRegressions = scenarios.every((scenario) => !scenario.regression);
  const improved = scenarios.some((scenario) => scenario.delta_passes > 0);
  const machineGatePassed = noInvalidRuns && noRegressions && improved;
  return {
    baseline_run_id: baseline.run_id,
    candidate_run_id: candidate.run_id,
    labels_approved: labelsApproved,
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
