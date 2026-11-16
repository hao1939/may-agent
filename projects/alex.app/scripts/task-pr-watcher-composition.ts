// Production Alex detector + production Host Task/observation/admission components.
// Provider, publication and agent decisions are fixtures. No live writes or model.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createAlexGitHubPullRequestWatchers } from "../watchers/github-pull-request.js";
import { githubPullRequestFixture } from "../../../shared/tests/fixtures/github-pull-request.js";

if (!process.env.HOST_CANDIDATE || !process.argv[2])
  throw new Error(
    "usage: HOST_CANDIDATE=/path/to/host bun task-pr-watcher-composition.ts output.json",
  );
const host = resolve(process.env.HOST_CANDIDATE);
const { fixture, until } = await import(
  `${host}/test/fixtures/resource-observer.ts`
);
const { observeAppTaskIntent, deferAppTask } = await import(
  `${host}/src/app/core/tasks/app-task-reconciler.ts`
);
const provider = githubPullRequestFixture();
provider.checks = [provider.check(1, null)];
const [, detector] = createAlexGitHubPullRequestWatchers(provider.fetch);
const f = await fixture(detector);
const resource = "github:hao1939/may-agent#215";
const taskId = "delivery/change";
const outcome = "Deliver the agreed change through an acceptable PR";
const acceptance = [
  "Verify current-head CI, account for review feedback and retain independent approval",
];
const human = {
  id: "approval",
  type: "human.decision",
  subject: "approval:independent",
  expected: { field: "decision", equals: "approve" },
  owner: "human",
};
const checks: string[] = [];
const inspect = () =>
  detector.inspect(resource, { signal: new AbortController().signal });
const wait = (fingerprint: unknown) =>
  f.capability.waitFor("pr-feedback", resource, {
    field: "fingerprint",
    notEquals: fingerprint,
  });
const retain = (held: unknown, fingerprint: unknown, headSha: string) =>
  deferAppTask(f.config(), held, {
    disposition: "waiting",
    summary: "PR published; waiting for needed external evidence",
    conditions: [wait(fingerprint), human],
    result: {
      publication: { resource, number: 215, headSha },
      remaining: acceptance,
    },
    report: true,
  });
try {
  await f.scan();
  assert.equal(provider.calls.length, 0);
  checks.push("No saved Task interest: no exact GitHub reads");

  const baseline = await inspect();
  observeAppTaskIntent(f.config(), {
    appAgent: "sample-owner",
    creator: { appId: "sample" },
    intent: {
      id: taskId,
      parentId: "root",
      outcome,
      acceptance,
      input: { repository: provider.repository, resource },
    },
  });
  retain(f.claim(taskId), baseline.fingerprint, provider.pull.head.sha);
  await f.scan();
  assert.deepEqual(f.runnable(), []);
  assert.equal(f.view(taskId).outcome, outcome);
  checks.push(
    "Publication progress and the original delivery outcome survive a bounded attempt; pending unchanged CI does not invoke an agent",
  );

  // Provider changes during downtime; publication failure must not consume demand.
  f.stopObserver();
  provider.checks = [provider.check(1, "failure")];
  provider.comments = [provider.comment()];
  await f.restart();
  f.publicationFails = true;
  await f.scan();
  assert.deepEqual(f.runnable(), []);
  f.publicationFails = false;
  await f.scan();
  assert.deepEqual(f.runnable(), [taskId]);
  const held = f.claim(taskId);
  const feedback = held.events.at(-1)?.event.data?.feedback;
  assert.equal(feedback.checks[0].conclusion, "failure");
  assert.equal(
    feedback.comments[0].bodyPreview,
    "Please cover the failure case",
  );
  assert.equal(
    f.view(taskId).conditions.find((c: { id: string }) => c.id === "approval")
      ?.observation?.state,
    "unknown",
  );
  checks.push(
    "CI failure/comment missed during downtime reaches the same retained Task after restart and failed-publication retry; independent approval survives",
  );

  // Bounded repair/publication is agent judgment, simulated here. PR identity stays.
  provider.pull.head.sha = "b".repeat(40);
  provider.checks = [provider.check(2, null)];
  const repaired = await inspect();
  // A new provider result arrives after readback but before result admission.
  provider.comments[0]!.body = "Please also cover the empty response";
  provider.comments[0]!.updated_at = "2026-11-16T12:00:00Z";
  retain(held, repaired.fingerprint, provider.pull.head.sha);
  await f.scan();
  assert.deepEqual(f.runnable(), [taskId]);
  const correction = f.claim(taskId);
  assert.equal(
    correction.events.at(-1)?.event.data?.feedback.comments[0].bodyPreview,
    "Please also cover the empty response",
  );
  const current = await inspect();
  retain(correction, current.fingerprint, provider.pull.head.sha);
  await f.scan();
  assert.deepEqual(f.runnable(), []);
  assert.equal(f.view(taskId).outcome, outcome);
  assert.deepEqual(f.view(taskId).acceptance, acceptance);
  checks.push(
    "A bounded repair reuses PR #215, saves its new head and rearms feedback on the original Task; a correction arriving during the attempt is not lost",
  );

  // A stale CI success must remain an evidence gap, not current-head success.
  provider.checks = [
    { ...provider.check(1, "success"), head_sha: "a".repeat(40) },
  ];
  await f.scan();
  const stale = f.claim(taskId);
  const staleFeedback = stale.events.at(-1)?.event.data?.feedback;
  assert.equal(staleFeedback.headSha, "b".repeat(40));
  assert.equal(staleFeedback.checksComplete, false);
  assert.deepEqual(staleFeedback.checks, []);
  const gap = await inspect();
  retain(stale, gap.fingerprint, provider.pull.head.sha);
  await f.scan();
  assert.deepEqual(f.runnable(), []);
  checks.push(
    "Old-head CI success cannot certify the repaired candidate; incomplete evidence stays explicit and unchanged gaps do not cause model polling",
  );

  provider.checks = [provider.check(2, "success")];
  provider.reviews = [
    {
      id: 3,
      state: "APPROVED",
      commit_id: provider.pull.head.sha,
      submitted_at: provider.at,
      user: { login: "reviewer" },
      body: "The requested cases are covered",
    },
  ];
  await f.scan();
  const ready = f.claim(taskId);
  assert.equal(
    ready.events.at(-1)?.event.data?.feedback.checks[0].headSha,
    provider.pull.head.sha,
  );
  assert.equal(
    ready.events.at(-1)?.event.data?.feedback.checks[0].conclusion,
    "success",
  );
  // Agent assesses CI and review as sufficient for its scope, not for merge/deploy.
  f.defer(ready, [human]);
  const before = provider.calls.length;
  await f.scan();
  assert.equal(provider.calls.length, before);
  assert.deepEqual(f.runnable(), []);
  checks.push(
    "Current-head CI and review return for judgment; removing the PR interest stops reads while the independent approval still keeps work waiting",
  );

  f.bus.emit({
    type: "human.decision",
    source: "fixture:authorized-decision",
    owner: "human:operator",
    data: { approval: "independent", decision: "approve" },
  });
  await until(
    () => f.runnable().includes(taskId),
    "independent approval return",
  );
  f.complete(taskId);
  assert.equal(f.view(taskId).outcome, outcome);
  assert.deepEqual(f.runnable(), []);
  const after = provider.calls.length;
  await f.scan();
  assert.equal(provider.calls.length, after);
  checks.push(
    "Only after the independent requirement returns does the fixture agent report completion against the original outcome; no automatic merge, deployment or Task closure",
  );

  const report = {
    passed: checks.length,
    checks,
    httpReads: provider.calls.length,
    source:
      "Alex production github-pull-request detector; Host production resource observation and Task admission/reconciliation",
    limits: [
      "Host fixture Apps sample/peer/builds rebind source identity; Alex declaration and live ownership are checked separately by App/unit tests",
      "GitHub HTTP, publication and agent judgments are fixtures; this is not live publication/retry evidence or a native-agent delivery trial",
      "No runtime activation, deployment, new Host phase, watch registry or PR lifecycle store",
    ],
  };
  await Bun.write(process.argv[2], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  f.close();
}
