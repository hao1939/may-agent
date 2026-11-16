import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  collectPendingReviews,
  formatPendingReviews,
  type PendingReviewGroup,
} from "../src/loop/pending-review";
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

  test("includes embedded and cases.json drafts while preserving catalog precedence", () => {
    withTempDir((root) => {
      const benchmark = join(root, "benchmarks", "inline");
      mkdirSync(benchmark, { recursive: true });
      writeFileSync(join(benchmark, "suite.json"), JSON.stringify({
        name: "inline", version: 1,
        cases: [{ id: "embedded", task: "Diagnostic case" }],
      }));
      writeFileSync(join(benchmark, "cases.json"), JSON.stringify([
        { id: "external", task: "Diagnostic case" },
        {
          id: "withheld", task: "Release control",
          label: { status: "draft", source: "adversarial", review_status: "withheld" },
        },
        {
          id: "approved", task: "Approved fixture",
          label: {
            status: "approved", approved_by: "fixture-reviewer", approved_at: "2026-01-01T00:00:00Z",
          },
        },
      ]));
      const expected: PendingReviewGroup[] = [
        { benchmark: "inline", source: "synthetic", reviewStatus: "ready", scenarios: ["embedded", "external"] },
        { benchmark: "inline", source: "adversarial", reviewStatus: "withheld", scenarios: ["withheld"] },
      ];
      expect(collectPendingReviews(root)).toEqual(expected);

      // A separate catalog's draft takes precedence over claimed inline approval.
      writeFileSync(join(benchmark, "labels.json"), JSON.stringify({
        version: 1, benchmark: "inline",
        labels: { approved: { status: "draft", source: "synthetic" } },
      }));
      expected[0]!.scenarios = ["approved", "embedded", "external"];
      expect(collectPendingReviews(root)).toEqual(expected);
    });
  });

  test("uses the suite's custom label file and includes missing scenario labels", () => {
    withTempDir((root) => {
      const benchmark = join(root, "benchmarks", "custom");
      mkdirSync(benchmark, { recursive: true });
      writeFileSync(join(benchmark, "suite.json"), JSON.stringify({
        name: "custom", version: 1, scenarios: ["recorded", "unreviewed"], labels_file: "truth.json",
      }));
      writeFileSync(join(benchmark, "truth.json"), JSON.stringify({
        version: 1, benchmark: "custom", labels: { recorded: { status: "draft", source: "synthetic" } },
      }));
      expect(collectPendingReviews(root)).toEqual([
        { benchmark: "custom", source: "synthetic", reviewStatus: "ready", scenarios: ["recorded", "unreviewed"] },
      ]);
    });
  });
});
