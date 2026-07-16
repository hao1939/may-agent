import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { readAdjudications } from "./store";
import type {
  GroundTruthCatalog,
  LoopRunManifest,
  RunComparison,
  ScenarioComparison,
  StoredTrial,
} from "./types";

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
    gate: !machineGatePassed ? "fail" : labelsApproved ? "pass" : "needs-human-review",
    scenarios,
  };
}

export function renderReport(
  runDir: string,
  manifest: LoopRunManifest,
  comparison?: RunComparison,
): string {
  const reviews = readAdjudications(runDir);
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
    "## Machine evaluation",
    "",
  ];

  for (const scenario of manifest.scenarios) {
    const scenarioTrials = manifest.trials.filter((trial) => trial.scenario === scenario);
    const result = counts(scenarioTrials);
    const icon = result.invalid > 0 ? "!" : result.fail > 0 ? "✗" : "✓";
    lines.push(
      `${icon} ${scenario} — ${result.pass}/${scenarioTrials.length} pass, ${result.fail} fail, ${result.invalid} invalid`,
    );
    for (const trial of scenarioTrials.filter((item) => item.machine_verdict !== "pass")) {
      lines.push(
        `  - trial ${trial.trial}: ${trial.machine_verdict}${trial.invalid_reason ? ` — ${trial.invalid_reason}` : ""} (${trial.result_path})`,
      );
    }
  }

  lines.push("", "## Human review", "");
  if (reviews.length === 0) {
    lines.push("No trials have been adjudicated. Machine results are evidence, not final ground truth.");
  } else {
    for (const review of reviews) {
      lines.push(`- ${review.scenario} trial ${review.trial}: **${review.verdict}** — ${review.reason} (${review.reviewer})`);
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
