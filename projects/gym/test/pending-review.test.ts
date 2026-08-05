import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  collectPendingReviews,
  formatPendingReviews,
} from "../src/learning/pending-review";
import { withTempDir } from "./support/temp-dir";

describe("pending benchmark truth review", () => {
  test("separates reviewable drafts from withheld release controls", () => {
    withTempDir((root) => {
      const gymRoot = join(root, "gym");
      const benchmark = join(gymRoot, "benchmarks", "example");
      mkdirSync(benchmark, { recursive: true });
      writeFileSync(
        join(benchmark, "labels.json"),
        JSON.stringify({
          benchmark: "example",
          labels: {
            approved: { status: "approved", source: "human" },
            ready: { status: "draft", source: "incident" },
            explicit_ready: {
              status: "draft",
              source: "incident",
              review_status: "ready",
            },
            withheld: {
              status: "draft",
              source: "transfer",
              review_status: "withheld",
            },
          },
        }),
      );

      const groups = collectPendingReviews(gymRoot);

      expect(groups).toEqual([
        {
          benchmark: "example",
          source: "incident",
          reviewStatus: "ready",
          scenarios: ["explicit_ready", "ready"],
        },
        {
          benchmark: "example",
          source: "transfer",
          reviewStatus: "withheld",
          scenarios: ["withheld"],
        },
      ]);
      expect(formatPendingReviews(groups)).toContain(
        "Ready for human truth review: 2 draft labels",
      );
      expect(formatPendingReviews(groups)).toContain(
        "Withheld release controls: 1 draft label",
      );
    });
  });
});
