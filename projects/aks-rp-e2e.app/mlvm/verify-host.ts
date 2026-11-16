// Explicit integration check against a selected Host source. No provider/model I/O.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compilerMergeCondition,
  compilerPullRequestObserver,
} from "./compiler-pull-request.js";

assert(
  process.env.MAY_HOST_SOURCE,
  "Set MAY_HOST_SOURCE to the matching Host checkout",
);
const load = (name: string) =>
  import(pathToFileURL(resolve(process.env.MAY_HOST_SOURCE!, name)).href);
const [
  { appTaskTestContext },
  task,
  tracker,
  { observationDemandReader },
  { bindResourceObserver },
] = await Promise.all([
  load("src/app/core/tasks/app-task-test-support.ts"),
  load("src/app/core/tasks/app-task-reconciler.ts"),
  load("src/app/core/tasks/app-task-condition-tracker.ts"),
  load("src/app/core/state/observation-demand.ts"),
  load("src/app/adapters/producers/resource-observer.ts"),
]);
const root = mkdtempSync(join(tmpdir(), "compiler-wake-host-"));
const config = appTaskTestContext({
  appDir: root,
  appId: "aks-rp-e2e",
  agent: "owner",
  maxConcurrent: 2,
  tree: {
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null, owner: "owner" } },
  },
});
const sourceCommit = "a".repeat(40);
let reads = 0;
let pr: Record<string, unknown> = {
  pullRequestId: 77,
  status: "active",
  isDraft: false,
  targetRefName: "refs/heads/main",
  lastMergeSourceCommit: { commitId: sourceCommit },
  lastMergeCommit: { commitId: "b".repeat(40) },
};
const definition = compilerPullRequestObserver(async () => {
  reads++;
  return pr;
});
const capability = { ...definition, appId: "aks-rp-e2e" };
const condition = compilerMergeCondition(capability, {
  id: "compiler-merge-g1",
  pullRequestId: 77,
  sourceCommit,
});
const intent = {
  id: "workstream/compiler",
  parentId: "root",
  outcome: "Full compiler assignment",
  acceptance: ["All original gates"],
  agent: "owner",
  executor: "codex-goal",
};
const claim = () => {
  const c = task.claimObservedAppTask(config, {
    taskId: intent.id,
    appAgent: "owner",
    handler: "executor:codex-goal",
  });
  assert.equal(c.kind, "claimed");
  return c;
};
const demands = observationDemandReader(config.resourceStore.db);
const route = (event: Record<string, unknown>) => {
  const ids = tracker.matchingAppTaskConditionTaskIds(config, event);
  return tracker.trackAppTaskConditionEventForTasks(config, event, ids);
};
const context = {
  read: {},
  log: {},
  workspace: { appRoot: root, projectRoot: root },
};
const bind = () =>
  bindResourceObserver({
    appId: capability.appId,
    definition,
    readDemand: demands,
    needsFact: (event: Record<string, unknown>) =>
      tracker.matchingAppTaskConditionTaskIds(config, event).length > 0,
    signal: new AbortController().signal,
    occupied: new Set(),
    now: Date.now,
  });
let sequence = 0;
const publish = (event: Record<string, unknown>) =>
  route({ ...event, eventId: ++sequence, timestamp: Date.now() });
try {
  task.observeAppTaskIntent(config, { intent, appAgent: "owner" });
  task.deferAppTask(config, claim(), {
    disposition: "waiting",
    summary: "Old explicit wait",
    conditions: [
      {
        id: "old-human-merge",
        type: "app.input.requested",
        subject: "pull-request:77",
        expected: { status: "merged" },
        owner: "human",
      },
    ],
  });
  task.recordAppTaskTrigger(config, intent.id, {
    type: "task.feedback",
    eventId: 9000,
    data: { message: "Migrate this exact wait" },
  });
  const migration = claim();
  const originalSpec = structuredClone(
    config.resourceStore.readTask(intent.id).spec,
  );
  assert.throws(
    () =>
      task.deferAppTask(config, migration, {
        disposition: "waiting",
        summary: "Stale Condition generation",
        facts: ["Observed the exact old wait"],
        conditions: [condition],
        actions: [
          {
            kind: "retire-condition",
            conditionId: "old-human-merge",
            expectedConditionGeneration: 999,
            reason: "Observe human merge",
          },
        ],
      }),
    /generation|stale|changed/i,
  );
  assert.equal(
    config.resourceStore.readTaskContext({
      taskIds: [intent.id],
      conditionIds: [condition.id],
    }).conditions?.[condition.id],
    undefined,
  );
  assert.equal(
    task.deferAppTask(config, migration, {
      disposition: "waiting",
      summary: "Observe human merge",
      facts: ["Observed the exact old wait"],
      conditions: [condition],
      actions: [
        {
          kind: "retire-condition",
          conditionId: "old-human-merge",
          expectedConditionGeneration: 1,
          reason: "Replace manual receipt with actual provider observation",
        },
      ],
    }).status,
    "applied",
  );
  assert.deepEqual(config.resourceStore.readTask(intent.id).spec, originalSpec);
  assert.equal(
    config.resourceStore.readTask(intent.id).metadata.generation,
    migration.generation,
  );

  let bound = bind();
  const first = await bound.observer.run(context);
  assert.equal(first.events.length, 1);
  assert.deepEqual(publish(first.events[0]), []); // Active PR, even with synthetic merge SHA.
  const repeated = await bound.observer.run({
    ...context,
    previousObservation: first.nextObservation,
  });
  assert.deepEqual(repeated.events, []);
  for (const other of [
    { status: "abandoned", isDraft: false },
    { status: "completed", isDraft: true },
  ]) {
    pr = { ...pr, ...other };
    const observed = await bound.observer.run(context);
    assert.deepEqual(publish(observed.events[0]), []);
  }
  pr = {
    ...pr,
    status: "completed",
    isDraft: false,
    lastMergeSourceCommit: { commitId: "c".repeat(40) },
  };
  const wrongSource = await bound.observer.run(context);
  assert.deepEqual(publish(wrongSource.events[0]), []);
  pr = {
    ...pr,
    lastMergeSourceCommit: { commitId: sourceCommit },
    lastMergeCommit: undefined,
  };
  const missingMerge = await bound.observer.run(context);
  assert.deepEqual(publish(missingMerge.events[0]), []);
  pr = { ...pr, lastMergeCommit: { commitId: "b".repeat(40) } };
  bound = bind(); // Restart: no disposable snapshot needed to rediscover the wait.
  const merged = await bound.observer.run(context);
  const fact = { ...merged.events[0], timestamp: Date.now() };
  assert.deepEqual(route({ ...fact, source: "human" }), []);
  assert.deepEqual(
    route({
      ...fact,
      data: { ...fact.data, resource: "pull-request:78@" + sourceCommit },
    }),
    [],
  );
  assert.deepEqual(route({ ...fact, timestamp: 0 }), []);
  assert.deepEqual(
    publish(fact).map((w: { taskId: string }) => w.taskId),
    [intent.id],
  );
  assert.deepEqual(publish(fact), []);
  const before = reads;
  assert.deepEqual((await bind().observer.run(context)).events, []);
  assert.equal(reads, before); // No provider calls after satisfaction, including restart.

  const awake = claim();
  task.observeAppTaskIntent(config, {
    intent: { ...intent, input: { revision: 2 } },
    appAgent: "owner",
  });
  assert.equal(
    task.deferAppTask(config, awake, {
      disposition: "waiting",
      summary: "Stale worker",
      conditions: [condition],
    }).status,
    "stale",
  );
  console.log(
    "PASS: real Host demand, wait migration/fencing, exact merge matching, deduplication, restart and quiet settlement",
  );
} finally {
  config.resourceStore.close();
  rmSync(root, { recursive: true, force: true });
}
