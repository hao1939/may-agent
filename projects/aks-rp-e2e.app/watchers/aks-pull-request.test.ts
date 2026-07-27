import { describe, expect, test } from "bun:test";
import {
  observePullRequest,
  pullRequestObservationEvent,
  summarizePullRequestReview,
} from "./aks-pull-request.js";

describe("AKS pull request watcher", () => {
  test("normalizes completed PR state as a level observation", () => {
    const observed = observePullRequest({
      pullRequestId: 77,
      status: "completed",
      mergeStatus: "succeeded",
      sourceRefName: "refs/heads/task/spec-example-a1b2c3",
      targetRefName: "refs/heads/dev",
      lastMergeSourceCommit: { commitId: "abc" },
      lastMergeCommit: { commitId: "def" },
    });

    expect(observed).toMatchObject({
      pullRequestId: "77",
      state: "completed",
      sourceBranch: "task/spec-example-a1b2c3",
      targetBranch: "dev",
      sourceCommit: "abc",
      mergeCommit: "def",
    });
    expect(pullRequestObservationEvent(observed!)).toMatchObject({
      type: "pull-request.state",
      pullRequestId: "77",
      state: "completed",
      target: { project: "aks-rp-e2e" },
    });
  });

  test("repeats active PR source state so Conditions can detect a changed commit", () => {
    expect(
      observePullRequest({
        pullRequestId: 77,
        status: "active",
        mergeStatus: "succeeded",
        lastMergeSourceCommit: { commitId: "new" },
      }),
    ).toMatchObject({ state: "active", sourceCommit: "new" });
  });

  test("exposes conflict and abandonment as actionable states", () => {
    expect(
      observePullRequest({
        pullRequestId: 77,
        status: "active",
        mergeStatus: "conflicts",
      }),
    ).toMatchObject({ state: "conflicted" });
    expect(
      observePullRequest({
        pullRequestId: 78,
        status: "abandoned",
        mergeStatus: "succeeded",
      }),
    ).toMatchObject({ state: "abandoned" });
  });

  test("includes unresolved review facts in the repeated PR observation", () => {
    const review = summarizePullRequestReview({
      value: [
        {
          id: 12,
          status: "active",
          threadContext: { filePath: "/feature.test.ts" },
          comments: [
            {
              id: 1,
              commentType: "text",
              author: { displayName: "Reviewer" },
              content: "Please preserve terminal cleanup evidence.",
            },
          ],
        },
        {
          id: 13,
          status: "fixed",
          comments: [{ id: 1, commentType: "text", content: "Done" }],
        },
      ],
    });
    const observed = observePullRequest(
      { pullRequestId: 77, status: "active", mergeStatus: "succeeded" },
      review,
    );

    expect(review).toMatchObject({
      available: true,
      unresolvedCount: 1,
      threads: [
        {
          threadId: "12",
          path: "/feature.test.ts",
          author: "Reviewer",
          content: "Please preserve terminal cleanup evidence.",
        },
      ],
    });
    expect(review.fingerprint).toHaveLength(16);
    expect(pullRequestObservationEvent(observed!)).toMatchObject({
      unresolvedReviewCount: 1,
      reviewFingerprint: review.fingerprint,
      unresolvedReviewThreads: review.threads,
    });
  });

  test("does not report review success when thread discovery is unavailable", () => {
    expect(summarizePullRequestReview(null)).toEqual({
      available: false,
      unresolvedCount: 0,
      fingerprint: "",
      threads: [],
    });
  });
});
