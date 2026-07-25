import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import {
  buildLearningReview,
  resolveLearningContexts,
} from "../src/learning/registry";
import { buildLearningReleaseReview } from "../src/learning/release-review";

const gymRoot = resolve(import.meta.dirname, "..");

describe("May learning registry", () => {
  test("loads the active pilot and staged system-deputy unit", () => {
    const review = buildLearningReview(gymRoot);

    expect(review.errors).toEqual([]);
    expect(review.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.units).toEqual([
      expect.objectContaining({
        id: "initiative-and-approval",
        version: 2,
        status: "pilot",
        ready_for_development: true,
        ready_for_release: true,
        evidence: { positive: 1, negative: 2, contrast: 1 },
      }),
      expect.objectContaining({
        id: "system-deputy-operations",
        version: 1,
        status: "draft",
        ready_for_development: false,
        ready_for_release: false,
        evidence: { positive: 0, negative: 0, contrast: 0 },
      }),
    ]);
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "system-deputy-operations development truth is not approved",
        ),
        expect.stringContaining(
          "system-deputy-operations release truth is not approved",
        ),
        "system-deputy-operations has no positive evidence",
        "system-deputy-operations has no negative evidence",
        "system-deputy-operations has no contrast evidence",
      ]),
    );
  });

  test("keeps draft learning out of candidate-visible contexts", () => {
    expect(
      resolveLearningContexts(gymRoot, "may-deputy-learning", [
        "may-learn-select-skill-or-workflow",
      ]),
    ).toEqual([]);
  });

  test("selects candidate-visible learning without exposing release truth", () => {
    const contexts = resolveLearningContexts(gymRoot, "may-alignment", [
      "may-align-infer-safe-cleanup",
    ]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      id: "initiative-and-approval",
      version: 2,
      competencies: expect.arrayContaining([
        "authority.act-vs-approve",
        "judgment.infer-bounded-intent",
      ]),
      releaseBenchmark: "may-learning-transfer",
      releaseScenarios: [
        "may-learn-proof-before-config-rollout",
        "may-learn-infer-bounded-maintenance",
      ],
    });
    expect(contexts[0]?.lessonPath).toEndWith("lesson.md");
    expect(contexts[0]?.practicePath).toEndWith("practice.md");
    expect(contexts[0]?.evidencePath).toEndWith("evidence.jsonl");

    expect(
      resolveLearningContexts(gymRoot, "may-alignment", [
        "may-align-concise-status",
      ]),
    ).toEqual([]);
  });

  test("builds an exact stable approval packet for withheld transfer truth", () => {
    const review = buildLearningReleaseReview(gymRoot);

    expect(review.approval_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.scenarios).toEqual([
      expect.objectContaining({
        id: "may-learn-proof-before-config-rollout",
        status: "approved",
        approval_case: expect.objectContaining({
          title: "Test a retry change before using it everywhere",
        }),
        human_answer: expect.stringContaining("small, representative sample"),
      }),
      expect.objectContaining({
        id: "may-learn-infer-bounded-maintenance",
        status: "approved",
        human_answer: expect.stringContaining("Remove digest-v1"),
      }),
    ]);
  });

  test("builds a plain-language packet for system-deputy release truth", () => {
    const review = buildLearningReleaseReview(
      gymRoot,
      "may-deputy-learning-transfer",
    );

    expect(review.approval_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.scenarios).toEqual([
      expect.objectContaining({
        id: "may-learn-route-project-app-request",
        status: "draft",
        human_answer: expect.stringContaining(
          "existing reconcile/invoices task",
        ),
      }),
      expect.objectContaining({
        id: "may-learn-diagnose-unconsumed-event",
        status: "draft",
        human_answer: expect.stringContaining("missing consumer"),
      }),
    ]);
  });
});
