import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import {
  buildLearningReview,
  resolveLearningContexts,
} from "../src/learning/registry";
import { buildLearningReleaseReview } from "../src/learning/release-review";
import { buildLearningTrackReview } from "../src/learning/track-review";

const gymRoot = resolve(import.meta.dirname, "..");

describe("May learning registry", () => {
  test("loads the approved learning units", () => {
    const review = buildLearningReview(gymRoot);

    expect(review.errors).toEqual([]);
    expect(review.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "initiative-and-approval",
          version: 3,
          status: "pilot",
          ready_for_development: true,
          ready_for_release: true,
          evidence: { positive: 2, negative: 3, contrast: 1 },
        }),
        expect.objectContaining({
          id: "system-deputy-operations",
          version: 2,
          status: "pilot",
          ready_for_development: true,
          ready_for_release: true,
          evidence: { positive: 1, negative: 2, contrast: 1 },
        }),
        expect.objectContaining({
          id: "cli-worker-opinions",
          version: 2,
          status: "pilot",
          ready_for_development: true,
          ready_for_release: true,
          evidence: { positive: 1, negative: 0, contrast: 0 },
        }),
        expect.objectContaining({
          id: "human-inbox-deputy",
          version: 2,
          status: "pilot",
          ready_for_development: true,
          ready_for_release: false,
          release_benchmark: "may-human-inbox-deputy-transfer",
        }),
        expect.objectContaining({
          id: "conversation-follow-through",
          version: 2,
          status: "active",
          ready_for_development: true,
          ready_for_release: false,
          evidence: { positive: 2, negative: 1, contrast: 1 },
        }),
        expect.objectContaining({
          id: "admission-review-closure",
          version: 1,
          status: "active",
          ready_for_development: true,
          ready_for_release: true,
          evidence: { positive: 0, negative: 1, contrast: 0 },
          development_scenarios: [
            "may-learn-admission-review-disposition-before-runtime-repair",
            "may-learn-admission-review-complete-gate-before-debugging",
          ],
          release_scenarios: [
            "may-learn-admission-review-material-human-authority-deliver",
          ],
        }),
      ]),
    );
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        "human-inbox-deputy release truth is not approved: may-learn-inbox-transfer-handle-recovered-urgent",
        "conversation-follow-through release truth is not approved: may-conversation-admit-long-running-reply",
      ]),
    );
  });

  test("loads real guided practice separately from withheld truth", () => {
    const contexts = resolveLearningContexts(gymRoot, "may-cli-worker-learning", [
      "may-learn-handle-cli-timeout-and-retry",
    ]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      id: "cli-worker-opinions",
      guidedPracticeCases: [
        expect.objectContaining({ id: "fresh-dual-review", type: "live" }),
        expect.objectContaining({ id: "timeout-then-recover", type: "live" }),
      ],
      releaseBenchmark: "may-cli-worker-learning-transfer",
      releaseScenarios: [
        "may-learn-resume-cli-continuation-not-independent",
        "may-learn-own-decision-after-cli-opinions",
      ],
    });
  });

  test("keeps human-inbox transfer truth held back from learning context", () => {
    const contexts = resolveLearningContexts(
      gymRoot,
      "may-human-inbox-deputy",
      ["may-learn-inbox-route-product-failure"],
    );

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      id: "human-inbox-deputy",
      releaseBenchmark: "may-human-inbox-deputy-transfer",
      releaseScenarios: [
        "may-learn-inbox-transfer-handle-recovered-urgent",
        "may-learn-inbox-handle-self-suppressing-recovery",
        "may-learn-inbox-transfer-deliver-human-authority",
        "may-learn-inbox-transfer-deliver-material-change",
        "may-learn-inbox-transfer-sanitize-digest",
        "may-learn-inbox-transfer-handle-bounded-cleanup",
        "may-learn-inbox-transfer-deliver-balanced-decision",
      ],
    });
    expect(contexts[0]).not.toHaveProperty("human_answer");
    expect(contexts[0]).not.toHaveProperty("approval_case");
  });

  test("selects approved system-deputy learning without exposing release truth", () => {
    const contexts = resolveLearningContexts(gymRoot, "may-deputy-learning", [
      "may-learn-select-skill-or-workflow",
    ]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      id: "system-deputy-operations",
      releaseBenchmark: "may-deputy-learning-transfer",
      releaseScenarios: [
        "may-learn-route-project-app-request",
        "may-learn-diagnose-unconsumed-event",
        "may-learn-replan-stalled-human-task",
      ],
    });
  });

  test("selects candidate-visible learning without exposing release truth", () => {
    const contexts = resolveLearningContexts(gymRoot, "may-alignment", [
      "may-align-infer-safe-cleanup",
    ]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      id: "initiative-and-approval",
      version: 3,
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
        status: "approved",
        human_answer: expect.stringContaining(
          "Let the app interpret the request and choose its task",
        ),
      }),
      expect.objectContaining({
        id: "may-learn-diagnose-unconsumed-event",
        status: "approved",
        human_answer: expect.stringContaining(
          "Give the reporting app owner the outcome",
        ),
      }),
      expect.objectContaining({
        id: "may-learn-replan-stalled-human-task",
        status: "approved",
        human_answer: expect.stringContaining(
          "Ask the owner to change execution",
        ),
      }),
    ]);
  });

  test("builds a plain-language packet for human-inbox release truth", () => {
    const review = buildLearningReleaseReview(
      gymRoot,
      "may-human-inbox-deputy-transfer",
    );

    expect(review.approval_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.scenarios).toHaveLength(7);
    expect(
      review.scenarios.find(
        (item) =>
          item.id === "may-learn-inbox-handle-self-suppressing-recovery",
      )?.status,
    ).toBe("approved");
    expect(
      review.scenarios
        .filter(
          (item) =>
            item.id !== "may-learn-inbox-handle-self-suppressing-recovery",
        )
        .every((item) => item.status === "draft"),
    ).toBe(
      true,
    );
    expect(review.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "may-learn-inbox-transfer-deliver-human-authority",
          human_answer: expect.stringContaining("one-time $180 vendor run"),
        }),
        expect.objectContaining({
          id: "may-learn-inbox-transfer-deliver-balanced-decision",
          human_answer: expect.stringContaining("May has no recommendation"),
        }),
      ]),
    );
  });

  test("combines approved system-deputy cases into one review fingerprint", () => {
    const review = buildLearningTrackReview(
      gymRoot,
      "system-deputy-operations",
    );

    expect(review.approval_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.partitions.map((item) => item.partition)).toEqual([
      "development",
      "release",
    ]);
    expect(
      review.partitions.flatMap((item) =>
        item.scenarios.map((case_) => case_.id),
      ),
    ).toEqual([
      "may-learn-reject-stale-app-approval",
      "may-learn-select-skill-or-workflow",
      "may-learn-understand-telegram-reply-intent",
      "may-learn-require-terminal-proof-before-completion",
      "may-learn-repair-ownerless-wait",
      "may-learn-keep-completion-judgment-with-owner",
      "may-learn-keep-domain-work-with-project-owner",
      "may-learn-keep-repair-in-owner-task",
      "may-learn-choose-durable-execution-owner",
      "may-learn-separate-agent-capability-from-app-autonomy",
      "may-learn-reconcile-stable-task-resource",
      "may-learn-retire-exact-legacy-conversation-task",
      "may-learn-route-project-app-request",
      "may-learn-diagnose-unconsumed-event",
      "may-learn-replan-stalled-human-task",
    ]);
  });

  test("stages real learning-intake cases as plain-language approved cases", () => {
    const review = buildLearningTrackReview(
      gymRoot,
      "system-deputy-learning-intake",
    );

    expect(review.approval_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(review.partitions).toEqual([
      expect.objectContaining({
        partition: "development",
        scenarios: [
          expect.objectContaining({
            id: "may-learn-recover-codex-intake-timeout",
            status: "approved",
            human_answer: expect.stringContaining("Give Gym ownership"),
          }),
        ],
      }),
      expect.objectContaining({
        partition: "release",
        scenarios: [
          expect.objectContaining({
            id: "may-learn-resolve-session-design-conflict",
            status: "approved",
            human_answer: expect.stringContaining("Give Gym the next move"),
          }),
          expect.objectContaining({
            id: "may-learn-treat-repetition-as-automation-evidence",
            status: "approved",
            human_answer: expect.stringContaining(
              "reject the rule that a request repeated twice",
            ),
          }),
        ],
      }),
    ]);
  });
});
