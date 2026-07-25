#!/usr/bin/env bun

import { buildLearningReleaseReview } from "./release-review";

console.log(
  JSON.stringify(
    buildLearningReleaseReview(
      process.cwd(),
      process.argv[2] ?? "may-learning-transfer",
    ),
    null,
    2,
  ),
);
