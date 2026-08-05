#!/usr/bin/env bun

import { collectPendingReviews, formatPendingReviews } from "./pending-review";

console.log(formatPendingReviews(collectPendingReviews(process.cwd())));
