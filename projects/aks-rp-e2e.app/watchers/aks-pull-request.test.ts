import { describe, expect, test } from "bun:test";
import {
  observePullRequest,
  pullRequestObservationEvent,
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
});
