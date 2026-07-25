#!/usr/bin/env bun

import { buildLearningTrackReview } from "./track-review";

console.log(
  JSON.stringify(
    buildLearningTrackReview(
      process.cwd(),
      process.argv[2] ?? "system-deputy-operations",
    ),
    null,
    2,
  ),
);
