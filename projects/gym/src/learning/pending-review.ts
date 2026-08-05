import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface Label {
  status?: string;
  source?: string;
  review_status?: "ready" | "withheld";
}

interface LabelFile {
  benchmark?: string;
  labels?: Record<string, Label>;
}

export interface PendingReviewGroup {
  benchmark: string;
  source: string;
  reviewStatus: "ready" | "withheld";
  scenarios: string[];
}

export function collectPendingReviews(gymRoot: string): PendingReviewGroup[] {
  const benchmarksRoot = join(gymRoot, "benchmarks");
  const groups = new Map<string, PendingReviewGroup>();

  for (const directory of readdirSync(benchmarksRoot).sort()) {
    const labelsPath = join(benchmarksRoot, directory, "labels.json");
    if (!existsSync(labelsPath)) continue;

    const file = JSON.parse(readFileSync(labelsPath, "utf8")) as LabelFile;
    const benchmark = file.benchmark ?? directory;
    for (const [scenario, label] of Object.entries(file.labels ?? {}).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      if (label.status !== "draft") continue;
      const source = label.source ?? "unspecified";
      const reviewStatus = label.review_status ?? "ready";
      const key = `${reviewStatus}\0${benchmark}\0${source}`;
      const group = groups.get(key) ?? {
        benchmark,
        source,
        reviewStatus,
        scenarios: [],
      };
      group.scenarios.push(scenario);
      groups.set(key, group);
    }
  }

  return [...groups.values()].sort(
    (left, right) =>
      left.reviewStatus.localeCompare(right.reviewStatus) ||
      left.benchmark.localeCompare(right.benchmark) ||
      left.source.localeCompare(right.source),
  );
}

export function formatPendingReviews(groups: PendingReviewGroup[]): string {
  const count = (status: PendingReviewGroup["reviewStatus"]) =>
    groups
      .filter((group) => group.reviewStatus === status)
      .reduce((total, group) => total + group.scenarios.length, 0);
  const ready = count("ready");
  const withheld = count("withheld");
  const lines = [
    `Ready for human truth review: ${ready} draft label${ready === 1 ? "" : "s"}`,
  ];

  const append = (status: PendingReviewGroup["reviewStatus"]) => {
    let benchmark = "";
    for (const group of groups.filter(
      (candidate) => candidate.reviewStatus === status,
    )) {
      if (group.benchmark !== benchmark) {
        benchmark = group.benchmark;
        lines.push("", benchmark);
      }
      lines.push(`  ${group.source}`);
      for (const scenario of group.scenarios)
        lines.push(`    - ${scenario}`);
    }
  };

  append("ready");

  lines.push(
    "",
    `Withheld release controls: ${withheld} draft label${withheld === 1 ? "" : "s"}`,
  );
  append("withheld");

  if (!ready) lines.push("", "No human truth decisions are ready for review.");
  if (!withheld) lines.push("", "No release controls are withheld.");
  return lines.join("\n");
}
