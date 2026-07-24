#!/usr/bin/env bun

import { buildLearningReview } from "./registry";

const review = buildLearningReview();
console.log(JSON.stringify(review, null, 2));
if (review.errors.length) process.exitCode = 1;
