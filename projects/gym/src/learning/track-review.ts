import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  buildLearningReleaseReview,
  type LearningReleaseReview,
} from "./release-review";

type TrackManifest = {
  schema_version: 1;
  id: string;
  unit: string;
  development_benchmark: string;
  release_benchmark: string;
};

export type LearningTrackReview = {
  schema_version: 1;
  track: string;
  unit: string;
  approval_fingerprint: string;
  partitions: Array<{
    partition: "development" | "release";
    benchmark: string;
    benchmark_fingerprint: string;
    scenarios: LearningReleaseReview["scenarios"];
  }>;
};

export function buildLearningTrackReview(
  gymRoot = resolve(import.meta.dirname, "../.."),
  track = "system-deputy-operations",
): LearningTrackReview {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(track)) {
    throw new Error(`Invalid learning track id: ${track}`);
  }
  const manifestPath = join(
    gymRoot,
    "benchmarks",
    "may-learning",
    "tracks",
    `${track}.json`,
  );
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as TrackManifest;
  if (manifest.schema_version !== 1 || manifest.id !== track) {
    throw new Error(`Learning track manifest is invalid: ${track}`);
  }

  const development = buildLearningReleaseReview(
    gymRoot,
    manifest.development_benchmark,
  );
  const release = buildLearningReleaseReview(
    gymRoot,
    manifest.release_benchmark,
  );
  const approvalInput = {
    schema_version: 1,
    track: manifest.id,
    unit: manifest.unit,
    development: development.approval_fingerprint,
    release: release.approval_fingerprint,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(approvalInput))
    .digest("hex");

  return {
    schema_version: 1,
    track: manifest.id,
    unit: manifest.unit,
    approval_fingerprint: `sha256:${fingerprint}`,
    partitions: [
      {
        partition: "development",
        benchmark: development.benchmark,
        benchmark_fingerprint: development.approval_fingerprint,
        scenarios: development.scenarios,
      },
      {
        partition: "release",
        benchmark: release.benchmark,
        benchmark_fingerprint: release.approval_fingerprint,
        scenarios: release.scenarios,
      },
    ],
  };
}
