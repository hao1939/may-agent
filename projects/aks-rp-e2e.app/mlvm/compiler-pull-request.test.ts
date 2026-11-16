import { expect, test } from "bun:test";
import {
  compilerMergeCondition,
  compilerPullRequestObserver,
} from "./compiler-pull-request.js";

const sourceCommit = "a".repeat(40);
const resource = `pull-request:77@${sourceCommit}`;
const signal = new AbortController().signal;
const response = {
  pullRequestId: 77,
  status: "completed",
  isDraft: false,
  targetRefName: "refs/heads/main",
  lastMergeSourceCommit: { commitId: sourceCommit },
  lastMergeCommit: { commitId: "b".repeat(40) },
};

test("reads one exact PR using the supplied reader and retains provider meaning", async () => {
  const requests: string[] = [];
  const observer = compilerPullRequestObserver(async (path) => {
    requests.push(path);
    return { ...response, status: "active" };
  });
  expect(await observer.inspect(resource, { signal })).toMatchObject({
    pullRequestId: "77",
    status: "active",
    sourceCommit,
    mergeCommitRecorded: true,
  }); // ADO can report a speculative merge commit while the PR is still active.
  expect(requests).toEqual([
    "git/repositories/aks-e2e-spec-runner/pullrequests/77",
  ]);
});

test("rejects malformed/unrelated responses and unavailable reads", async () => {
  for (const value of [
    null,
    {},
    [],
    { ...response, pullRequestId: 78 },
    { ...response, targetRefName: "refs/heads/dev" },
    { ...response, status: "unknown" },
    { ...response, isDraft: undefined },
    { ...response, lastMergeSourceCommit: { commitId: "bad" } },
  ]) {
    await expect(
      compilerPullRequestObserver(async () => value).inspect(resource, {
        signal,
      }),
    ).rejects.toThrow();
  }
});

test("missing merge commit is explicitly unproven; a changed source is not re-pinned", async () => {
  expect(
    await compilerPullRequestObserver(async () => ({
      ...response,
      lastMergeSourceCommit: { commitId: "c".repeat(40) },
      lastMergeCommit: undefined,
    })).inspect(resource, { signal }),
  ).toMatchObject({
    sourceCommit: "c".repeat(40),
    mergeCommit: null,
    mergeCommitRecorded: false,
  });
});

test("bounds resource identity and obeys cancellation without issuing new reads", async () => {
  let reads = 0;
  const observer = compilerPullRequestObserver(async () => {
    reads++;
    return response;
  });
  for (const bad of [
    "",
    `pull-request:0@${sourceCommit}`,
    `pull-request:../77@${sourceCommit}`,
    `pull-request:9007199254740992@${sourceCommit}`,
    "pull-request:77@short",
  ]) {
    await expect(observer.inspect(bad, { signal })).rejects.toThrow();
  }
  await expect(
    observer.inspect(resource, { signal: AbortSignal.abort() }),
  ).rejects.toThrow();
  expect(reads).toBe(0);
});

test("the wait uses the installed capability and an exact, fresh completed merge", () => {
  const observer = compilerPullRequestObserver(async () => response);
  const before = Date.now();
  const condition = compilerMergeCondition(
    { ...observer, appId: "aks-rp-e2e" },
    {
      id: "compiler-merge-g2",
      pullRequestId: 77,
      sourceCommit,
    },
  );
  expect(condition).toMatchObject({
    type: observer.type,
    subject: `resource:${resource}`,
    owner: "app:aks-rp-e2e",
    expected: {
      source: "app:aks-rp-e2e:observer:compiler-pull-request",
      sourceCommit,
      status: "completed",
      isDraft: false,
      mergeCommitRecorded: true,
    },
  });
  expect(
    (condition.expected as { timestamp: { gte: number } }).timestamp.gte,
  ).toBeGreaterThanOrEqual(before);
  expect(() =>
    compilerMergeCondition(
      { ...observer, appId: "aks-rp-e2e", id: "other" },
      {
        id: "bad",
        pullRequestId: 77,
        sourceCommit,
      },
    ),
  ).toThrow();
});
