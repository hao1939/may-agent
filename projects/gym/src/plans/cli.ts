import { resolve, join } from "node:path";
import { gymRoot, stateRoot } from "../loop/store";
import { buildPlanReport, renderPlanReport } from "./report";

export function executePlanCli(argv: string[]): void {
  const [command, path, ...options] = argv;
  if (!path || !["validate", "report"].includes(command ?? ""))
    throw new Error(
      "Usage: gym plan <validate|report> PATH [--runs RETAINED_BENCHMARKS_DIR] [--json]",
    );
  let runs = join(stateRoot(), "benchmarks"),
    json = false;
  for (let i = 0; i < options.length; i++) {
    if (options[i] === "--json") json = true;
    else if (
      options[i] === "--runs" &&
      options[i + 1] &&
      !options[i + 1]!.startsWith("--")
    )
      runs = resolve(options[++i]!);
    else throw new Error(`Unknown plan argument: ${options[i]}`);
  }
  const report = buildPlanReport(path, gymRoot, runs);
  if (command === "validate") {
    console.log(
      JSON.stringify(
        {
          passed: !report.issues.length,
          agent: report.plan.agent,
          revision: report.plan.revision,
          benchmarks: report.plan.benchmarks.length,
          retained_runs: report.history.length,
          issues: report.issues,
        },
        null,
        2,
      ),
    );
    if (report.issues.length) process.exitCode = 1;
  } else
    console.log(
      json
        ? JSON.stringify(report, null, 2)
        : renderPlanReport(report, gymRoot),
    );
}
