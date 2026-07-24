#!/usr/bin/env bun

import { buildLearningReleaseReview } from "./release-review";

console.log(JSON.stringify(buildLearningReleaseReview(), null, 2));
