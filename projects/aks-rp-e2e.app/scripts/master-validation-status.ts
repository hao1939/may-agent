#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MasterValidationProgress } from "../watchers/aks-pipeline.js";

const path = resolve(".state/watchers/aks-pipeline-progress.json");
if (!existsSync(path)) {
  console.error("Master-validation progress is not available yet.");
  process.exit(1);
}

const progress = JSON.parse(
  readFileSync(path, "utf8"),
) as MasterValidationProgress;
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(progress, null, 2));
  process.exit(0);
}

const { counts } = progress;
console.log(
  `Master validation ${progress.runId}: ${progress.state}${progress.result && progress.result !== progress.state ? `/${progress.result}` : ""}`,
);
console.log(
  `source: ${progress.sourceBranch ?? "unknown"}@${progress.sourceCommit ?? "unknown"}`,
);
console.log(
  `verdicts: ${counts.observed}/${counts.selected} observed; pass=${counts.pass} fail=${counts.fail} error=${counts.error} skipped=${counts.skipped} excluded=${counts.excluded ?? 0} pending=${counts.pending}`,
);
console.log(
  `slices: ${progress.slices
    .map(
      (slice) =>
        `${slice.sliceId}:${slice.status}(${slice.observed}/${slice.selected})`,
    )
    .join(" ")}`,
);
const nonpassing = progress.specs.filter((spec) =>
  ["fail", "error", "excluded"].includes(spec.status),
);
if (nonpassing.length) {
  console.log("nonpassing:");
  for (const spec of nonpassing) {
    console.log(`- ${spec.specId}: ${spec.status} — ${spec.reason}`);
  }
}
console.log(`checked: ${progress.checkedAt}`);
