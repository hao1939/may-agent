import { describe, expect, test } from "bun:test";
import {
  observePullRequest,
  pullRequestObservationEvent,
  selectPullRequestObservations,
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

  test("repeats actionable levels and emits terminal PRs only on transition", () => {
    const observed = [
      observePullRequest({
        pullRequestId: 77,
        status: "active",
        mergeStatus: "succeeded",
      }),
      observePullRequest({
        pullRequestId: 78,
        status: "completed",
        mergeStatus: "succeeded",
      }),
      observePullRequest({
        pullRequestId: 79,
        status: "completed",
        mergeStatus: "succeeded",
      }),
      observePullRequest({
        pullRequestId: 80,
        status: "active",
        mergeStatus: "conflicts",
      }),
    ].filter((value) => value !== null);

    const selection = selectPullRequestObservations(observed, ["78"]);

    expect(selection.activeIds).toEqual(["77", "80"]);
    expect(selection.emitted.map((value) => value.pullRequestId)).toEqual([
      "77",
      "78",
      "80",
    ]);
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
              author: { displayName: "PR Assistant" },
              content: "<span>bot preamble</span>",
            },
            {
              id: 2,
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

  test("keeps actionable AI review text after stripping a long HTML preamble", () => {
    const longPreamble = `${"<span>PR Assistant</span>".repeat(180)}<p>Use the shared direct-node helper instead of duplicating cleanup logic.</p>`;
    const review = summarizePullRequestReview({
      value: [
        {
          id: 21,
          status: "active",
          threadContext: { filePath: "/feature.test.ts" },
          comments: [
            {
              id: 1,
              commentType: "text",
              author: { displayName: "GitOps (Git LowPriv)" },
              content: longPreamble,
            },
          ],
        },
      ],
    });

    expect(review.threads).toEqual([
      {
        threadId: "21",
        path: "/feature.test.ts",
        author: "GitOps (Git LowPriv)",
        content: expect.stringContaining(
          "Use the shared direct-node helper instead of duplicating cleanup logic.",
        ),
      },
    ]);
    expect(review.threads[0]?.content).not.toContain("<span>");
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
