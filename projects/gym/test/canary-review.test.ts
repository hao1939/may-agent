import { describe, expect, test } from "bun:test";

import { buildCanaryReview } from "../src/loop/canary-review";

describe("May alignment canary approval", () => {
  test("fingerprints exactly four bounded approved expectations", () => {
    const review = buildCanaryReview();
    expect(review.approval_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.automatic_schedule_enabled).toBe(true);
    expect(review.development_trials).toBe(3);
    expect(review.release_trials).toBe(5);
    expect(review.scenarios).toHaveLength(4);
    expect(review.scenarios.map((scenario) => scenario.id)).toEqual([
      "may-align-proof-before-adopt",
      "may-align-local-guidance-wins",
      "may-align-infer-safe-cleanup",
      "may-align-remove-specified-cleanup",
    ]);
    expect(new Set(review.scenarios.map((scenario) => scenario.id)).size).toBe(
      4,
    );
    expect(
      review.scenarios.every(
        (scenario) =>
          scenario.status === "approved" &&
          scenario.approved_by === "hao" &&
          typeof scenario.approved_at === "string",
      ),
    ).toBe(true);
    expect(
      review.scenarios.every((scenario) => scenario.human_answer.length > 20),
    ).toBe(true);
  });
});
