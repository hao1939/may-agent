// Isolated feasibility trial: current GitHub parser + current Host resource observer.
// Provider HTTP and agent judgments are fixtures. No live publication or Task writes.
import assert from "node:assert/strict";
import { resolve } from "node:path";
const app = resolve(
  process.env.APP_CANDIDATE || new URL("../../..", import.meta.url).pathname,
);
if (!process.env.HOST_CANDIDATE || !process.argv[2])
  throw new Error(
    "usage: HOST_CANDIDATE=/path/to/host [APP_CANDIDATE=/path/to/apps] bun github-pull-request-recovery-composition.ts output.json",
  );
const host = resolve(process.env.HOST_CANDIDATE);
const { fixture } = await import(`${host}/test/fixtures/resource-observer.ts`);
const { createGitHubPullRequestObservers, GITHUB_PULL_REQUEST_EVENT } =
  await import(`${app}/projects/may.app/watchers/github-pull-request.ts`);
const calls: string[] = [];
let merged = false;
const fetcher = async (input: unknown) => {
  const url = String(input);
  calls.push(url);
  assert.ok(!url.includes("?state="), "must not list GitHub PRs");
  return Response.json(
    url.includes("/reviews")
      ? []
      : {
          number: 215,
          body: "External resource; Task interest supplies the return route",
          user: { login: "hao1939" },
          state: merged ? "closed" : "open",
          draft: false,
          merged,
          merged_at: merged ? "2026-10-15T15:00:00Z" : null,
          merge_commit_sha: merged ? "b".repeat(40) : null,
          head: { sha: "a".repeat(40) },
          updated_at: merged ? "2026-10-15T15:00:00Z" : "2026-10-15T14:00:00Z",
          base: { repo: { full_name: "hao1939/may-agent" } },
        },
  );
};
const [, detector] = createGitHubPullRequestObservers(
  {
    repository: "hao1939/may-agent",
    author: "hao1939",
    appId: "may",
    project: "may",
  },
  fetcher as typeof fetch,
);
const checks: string[] = [];
const f = await fixture(detector);
const wait = (id: string) =>
  f.capability.waitFor(id, "github:hao1939/may-agent#215", {
    field: "state",
    equals: "closed",
  });
const human = {
  id: "approval",
  type: "human.decision",
  subject: "approval:independent",
  expected: { field: "decision", equals: "approve" },
  owner: "human",
};
try {
  await f.scan();
  assert.equal(calls.length, 0);
  checks.push("No Task interest: zero GitHub reads");
  f.add("legacy", [
    {
      id: "old-pr",
      type: GITHUB_PULL_REQUEST_EVENT,
      subject: "pull-request:github:hao1939/may-agent#215",
      expected: {
        provider: "github",
        repository: "hao1939/may-agent",
        field: "fingerprint",
        notEquals: null,
      },
      owner: "app:may",
    },
  ]);
  await f.scan();
  assert.equal(calls.length, 0);
  checks.push(
    "Legacy Condition does not drive generic observer: migration required",
  );
  f.cancel("legacy");
  f.add("owner", [wait("pr"), human]);
  f.add("peer", [wait("pr")], "peer");
  await f.scan();
  assert.equal(calls.length, 2);
  assert.deepEqual(f.runnable(), []);
  assert.deepEqual(f.runnable("peer"), []);
  checks.push(
    "Two Tasks share one exact PR/reviews read; open PR does not wake a completion wait",
  );
  await f.scan();
  assert.equal(calls.length, 4);
  assert.equal(f.events().length, 1);
  checks.push("Unchanged read produces no extra fact or agent attempt");
  f.stopObserver();
  merged = true;
  await f.restart();
  f.publicationFails = true;
  await f.scan();
  assert.deepEqual(f.runnable(), []);
  f.publicationFails = false;
  await f.scan();
  assert.deepEqual(f.runnable(), ["owner"]);
  assert.deepEqual(f.runnable("peer"), ["peer"]);
  assert.equal(calls.length, 8);
  assert.equal(
    f.view("owner").conditions.find((c: { id: string }) => c.id === "approval")
      ?.observation?.state,
    "unknown",
  );
  const claim = f.claim("owner");
  assert.equal(claim.events.at(-1)?.event.data?.merged, true);
  f.defer(claim, [human]);
  f.complete("peer", "peer");
  checks.push(
    "Merge during downtime survives restart and failed publication, reaches both saved Tasks; independent human wait survives",
  );
  const before = calls.length;
  await f.scan();
  assert.equal(calls.length, before);
  checks.push("Satisfied/removed PR interests stop all provider reads");
  f.add("late", [wait("pr")]);
  await f.scan();
  assert.deepEqual(f.runnable(), ["late"]);
  f.complete("late");
  checks.push(
    "New interest sees an already merged PR without closed-history discovery",
  );
  f.add("cancelled", [wait("pr")]);
  f.cancel("cancelled");
  const beforeCancel = calls.length;
  await f.scan();
  assert.equal(calls.length, beforeCancel);
  checks.push("Cancelled Task creates no further provider reads");
  const report = {
    passed: checks.length,
    checks,
    httpReads: calls.length,
    githubListReads: calls.filter((u) => u.includes("?state=")).length,
    limits: [
      "Fixtures use existing Host test Apps sample/peer/builds; not installed May composition",
      "Production App detector/reader and Host observation/admission are used; no live GitHub mutation, deployment or native-agent judgment",
      "Existing legacy Conditions need a mechanical format upgrade; absent waits require owner judgment",
    ],
  };
  await Bun.write(process.argv[2], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  f.close();
}
