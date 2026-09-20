/** Portable cross-repository composition trial for the May GitHub PR observer.
 * Uses production App observer/provider parsing and Host event/Condition handling
 * against a temporary database. External HTTP and owner judgment are fixtures.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const app = resolve(
  process.env.APP_CANDIDATE || new URL("../../..", import.meta.url).pathname,
);
const host = resolve(process.env.HOST_CANDIDATE || "");
const output = process.argv[2];
if (!process.env.HOST_CANDIDATE) {
  throw new Error(
    "HOST_CANDIDATE is required; this trial never guesses a Host checkout",
  );
}
if (!output) {
  throw new Error(
    "usage: HOST_CANDIDATE=/path/to/host [APP_CANDIDATE=/path/to/apps] bun github-pull-request-composition.ts output.json",
  );
}
const { default: definition } = await import(`${app}/projects/may.app/app.ts`);
const { observeGitHubPullRequests, GITHUB_PULL_REQUEST_EVENT } = await import(
  `${app}/projects/may.app/watchers/github-pull-request.ts`
);
const { openDatabase } = await import(`${host}/src/lib/db.ts`);
const { applyDbSchema } = await import(`${host}/src/lib/db/schema.ts`);
const { getDb, closeDb } = await import(`${host}/src/lib/requests.ts`);
const { DbWriter } = await import(`${host}/src/lib/db-writer.ts`);
const { EventBus, EVENT_ROW_ID } = await import(
  `${host}/src/app/core/events/bus.ts`
);
const { createAppObserverRuntime } = await import(
  `${host}/src/app/adapters/producers/app-observer-runtime.ts`
);
const { AppTaskResourceStore } = await import(
  `${host}/src/app/core/state/app-task-resource-store.ts`
);
const { appTaskTestContext } = await import(
  `${host}/src/app/core/tasks/app-task-test-support.ts`
);
const {
  observeAppTaskIntent,
  claimObservedAppTask,
  deferAppTask,
  completeAppTask,
} = await import(`${host}/src/app/core/tasks/app-task-reconciler.ts`);
const { matchingAppTaskConditionTaskIds } = await import(
  `${host}/src/app/core/tasks/app-task-condition-tracker.ts`
);
const { admitStandaloneCanonicalAppTaskEvent } = await import(
  `${host}/src/app/core/tasks/app-task-runtime.ts`
);
const { listRuntimeTaskViews, readRuntimeTaskView } = await import(
  `${host}/src/app/core/reads/app-read.ts`
);
const root = mkdtempSync(join(tmpdir(), "may-pr-observer-composition-"));
const init = openDatabase(join(root, "may.db"));
applyDbSchema(init);
init.close();
const db = getDb(root),
  store = AppTaskResourceStore.fromDb(db, "may");
const config = appTaskTestContext({
  appDir: root,
  appId: "may",
  agent: "may",
  maxConcurrent: 1,
  resourceStore: store,
  tree: {
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } },
  },
});
const descriptor = {
  id: "may",
  appDir: root,
  projectDir: root,
  agent: "may",
  app: definition,
  reconciliationPaused: false,
  resourceStore: store,
};
const taskId = "goal/linked-pr",
  type = GITHUB_PULL_REQUEST_EVENT;
const condition = (fingerprint: any) => ({
  id: "github-pr",
  type,
  subject: "pull-request:github:hao1939/may-agent#215",
  expected: {
    provider: "github",
    repository: "hao1939/may-agent",
    field: "fingerprint",
    notEquals: fingerprint,
  },
  owner: "service:github",
  reviewAfterMs: 21600000,
});
const human = {
  id: "human-review",
  type: "conversation.message.created",
  subject: "conversationId:fixture",
  expected: { field: "text", equals: "independent-decision" },
  owner: "human",
  requestedAction: "A separate fixture decision",
  reviewAfterMs: 21600000,
};
const claim = () => {
  const c = claimObservedAppTask(config, {
    taskId,
    appAgent: "may",
    handler: "agent",
  });
  assert.equal(c.kind, "claimed");
  return c;
};
observeAppTaskIntent(config, {
  appAgent: "may",
  intent: {
    id: taskId,
    parentId: "root",
    outcome: "Observe external PR facts",
    acceptance: ["Keep independent decision"],
    agent: "may",
  },
});
deferAppTask(config, claim(), {
  disposition: "waiting",
  summary: "Await real producer",
  facts: ["fixture"],
  conditions: [condition(null), human],
});
const bus = new EventBus(),
  writer = new DbWriter(root);
bus.setPersistenceSubscriber(writer.handler);
bus.setDeliveryRecorder(writer.recordDelivery);
const observations: any[] = [],
  admissions: any[] = [];
bus.subscribeDurableRoute((event: any) => {
  if (!event.type.startsWith("may.github.pull-request.")) return;
  observations.push(event);
  const canonical = {
    ...event,
    data: event.data,
    eventId: event[EVENT_ROW_ID],
  };
  const ids = matchingAppTaskConditionTaskIds(
    config,
    canonical,
    event.target?.taskId ? [event.target.taskId] : undefined,
  );
  const result = admitStandaloneCanonicalAppTaskEvent({
    descriptor,
    event,
    intent: null,
    targetedTaskId: event.target?.taskId,
    conditionTaskIds: ids,
  });
  admissions.push(result);
  return result.delivery;
});
let merged = false,
  failed = false,
  httpCalls = 0,
  currentTime = Date.now(),
  passes = 0;
const provider: any = async (u: any) => {
  httpCalls++;
  if (failed) return Response.json({ message: "unavailable" }, { status: 503 });
  return Response.json(
    String(u).includes("/reviews")
      ? []
      : {
          number: 215,
          state: merged ? "closed" : "open",
          draft: false,
          head: { sha: "a".repeat(40) },
          base: { repo: { full_name: "hao1939/may-agent" } },
          merged,
          merged_at: merged ? "2026-09-20T06:30:19Z" : null,
          merge_commit_sha: merged ? "b".repeat(40) : null,
        },
  );
};
const observer = {
  ...definition.observers.find((o: any) => o.id === "github-pull-request"),
  run: async (ctx: any) => {
    try {
      return await observeGitHubPullRequests(ctx, provider);
    } finally {
      passes++;
    }
  },
};
const runtime = createAppObserverRuntime({
  bus,
  now: () => currentTime,
  context: () => ({
    workspace: { appRoot: root, projectRoot: root },
    read: {
      tasks: {
        list: async (o: any) =>
          listRuntimeTaskViews({ taskStateConfig: config }, o),
        get: async (id: string) =>
          readRuntimeTaskView({ taskStateConfig: config }, id),
      },
    },
    log: { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} },
  }),
});
const entries = [
  { appDir: root, definition: { ...definition, observers: [observer] } },
];
const scan = async () => {
  let p = passes;
  runtime.scanNow();
  for (let n = 0; n < 300 && passes === p; n++) await Bun.sleep(10);
  assert.ok(passes > p);
  await Bun.sleep(5);
};
const report: any = {};
try {
  runtime.replace(entries);
  await scan();
  assert.equal(observations.filter((e) => e.type === type).length, 1);
  const initial = observations.find((e) => e.type === type);
  assert.equal(initial.data.merged, false);
  assert.equal(
    store
      .readTaskConditions(taskId)
      .find((c: any) => c.metadata.id === "github-pr").status.state,
    "true",
  );
  deferAppTask(config, claim(), {
    disposition: "waiting",
    summary: "Still awaiting merge and independent choice",
    facts: ["PR currently open"],
    conditions: [condition(initial.data.fingerprint)],
  });
  const before = observations.length;
  currentTime += observer.intervalMs;
  await scan();
  assert.equal(observations.length, before);
  merged = true;
  currentTime += observer.intervalMs;
  await scan();
  const fact = observations.at(-1);
  assert.equal(fact.data.merged, true);
  assert.ok(fact[EVENT_ROW_ID] > 0);
  const c = claim();
  completeAppTask(config, c, {
    summary: "Merge observed; independent choice stays",
    facts: ["Merged receipt verified"],
  });
  assert.deepEqual(
    store.readTaskConditions(taskId).map((c: any) => c.metadata.id),
    ["human-review"],
  );
  report.transitionWithoutHumanReply = {
    sameTaskId: taskId,
    prWaitRetired: true,
    independentHumanWaitPreserved: true,
    durableEventId: fact[EVENT_ROW_ID],
    status: readRuntimeTaskView({ taskStateConfig: config }, taskId).status,
  };
  // Rearm one PR interest to exercise real targeted failure admission.
  const resource = store.readTask(taskId);
  observeAppTaskIntent(config, {
    appAgent: "may",
    intent: {
      id: taskId,
      parentId: "root",
      outcome: "Observe external PR facts",
      acceptance: ["Keep independent decision"],
      agent: "may",
      input: { retryProbe: true },
    },
  });
  deferAppTask(config, claim(), {
    disposition: "waiting",
    summary: "Await next change",
    facts: ["Rearmed"],
    conditions: [condition(fact.data.fingerprint)],
  });
  failed = true;
  currentTime += observer.intervalMs;
  await scan();
  const failureEvent = observations.at(-1);
  const failureAdmission = admissions.at(-1);
  const failedClaim = claimObservedAppTask(config, {
    taskId,
    appAgent: "may",
    handler: "agent",
  });
  assert.equal(failureEvent?.type, "may.github.pull-request.read-failed");
  assert.deepEqual(failureAdmission?.taskIds, [taskId]);
  assert.equal(failedClaim.kind, "claimed");
  deferAppTask(config, failedClaim, {
    disposition: "waiting",
    summary: "Failure judged; preserve fallback",
    facts: ["Provider temporarily unavailable"],
  });
  assert.equal(
    readRuntimeTaskView({ taskStateConfig: config }, taskId).status,
    "waiting",
  );
  assert.deepEqual(
    store
      .readTaskConditions(taskId)
      .map((c: any) => c.metadata.id)
      .sort(),
    ["github-pr", "human-review"],
  );
  report.failure = {
    emitted: failureEvent.type,
    admittedTaskIds: failureAdmission.taskIds,
    ownerClaimKind: failedClaim.kind,
    settledStatus: "waiting",
    survivingConditionIds: ["github-pr", "human-review"],
  };
  currentTime += observer.intervalMs;
  await scan();
  const repeatedFailureOwnerClaimKind = claimObservedAppTask(config, {
    taskId,
    appAgent: "may",
    handler: "agent",
  }).kind;
  assert.equal(repeatedFailureOwnerClaimKind, "waiting");
  report.failure.repeatedFailureOwnerClaimKind = repeatedFailureOwnerClaimKind;
  report.httpCalls = httpCalls;
  report.fixtureOnly = true;
  report.limit =
    "Real observer runtime, event persistence and task admission/settlement; HTTP and owner decision are stubbed. No production DB writes.";
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  runtime.close();
  closeDb(root);
  rmSync(root, { recursive: true, force: true });
}
