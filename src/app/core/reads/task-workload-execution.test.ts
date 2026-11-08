import { afterEach, expect, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "../state/task-budget-admission.js";
import { installTaskExecutionLimit, releaseTaskExecutionReservation } from "../state/task-execution-admission.js";
import { TaskExecutionStore } from "../state/task-execution-store.js";
import { appTaskContext, claimObservedAppTask, observeAppTaskIntent } from "../tasks/app-task-reconciler.js";
import { createRuntimeTaskRead } from "./app-read.js";
import { runtimeWorkloadSource } from "./task-workload.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import type { AppTaskRuntimeOptions } from "../tasks/runtime-options.js";

const databases: SqliteDb[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
const recipient = { kind: "programmatic" as const, id: "fixture/worker" };
const other = { kind: "programmatic" as const, id: "fixture/other" };

function fixture() {
  const db = openDatabase(":memory:");
  databases.push(db);
  applyDbSchema(db);
  const config = (appId: string) => {
    const resourceStore = AppTaskResourceStore.fromDb(db, appId);
    resourceStore.bootstrapSnapshot({ project: appId, groups: { root: { id: "root", parent_id: null } } }, "seed");
    return appTaskContext({
      appDir: `/fixture/${appId}.app`,
      projectDir: "/fixture",
      agent: "worker",
      maxConcurrent: 4,
      resourceStore,
    });
  };
  const source = config("source");
  const target = config("target");
  const budgets = new TaskBudgetAdmissionStore(db);
  budgets.install({
    appId: "source",
    sponsor: { appId: "source", agent: "owner" },
    dailyCredits: 20,
    rootCredits: 20,
    rootExecutionSlots: 3,
  });
  const add = (cfg: typeof source, id: string, creator?: { appId: string; taskId: string }) =>
    observeAppTaskIntent(cfg, {
      appAgent: "worker",
      ...(creator ? { creator } : {}),
      intent: { id, parentId: "root", outcome: "Collect facts", acceptance: ["Facts retained"] },
    });
  const executions = new TaskExecutionStore(db);
  const root = { appId: "source", taskId: "work" };
  add(source, "work");
  add(target, "child", root);
  const runtime = {
    installControllers: false,
    hostCapacity: new HostCapacity(1),
    agents: { executionRecipient: (agent: string) => (agent === "worker" || agent === "alias" ? recipient : null) },
  } as AppTaskRuntimeOptions;
  const read = createRuntimeTaskRead({
    taskStateConfig: target,
    workloadSource: runtimeWorkloadSource(runtime, undefined, undefined, "child"),
  });
  return { db, source, target, root, add, executions, read };
}

test("worker feedback reads shared Host, resolved recipient and inherited root execution without writes", () => {
  const f = fixture();
  installTaskExecutionLimit(f.db, { kind: "host" }, 4);
  installTaskExecutionLimit(f.db, { kind: "agent", recipient }, 2);
  installTaskExecutionLimit(f.db, { kind: "agent", recipient: other }, 2);
  const parent = claimObservedAppTask(f.source, {
    taskId: "work",
    appAgent: "worker",
    handler: "agent",
    execution: { recipient: () => other, lane: "background" },
  });
  const child = claimObservedAppTask(f.target, {
    taskId: "child",
    appAgent: "worker",
    handler: "agent",
    execution: { recipient: () => recipient, lane: "background" },
  });
  if (parent.kind !== "claimed" || child.kind !== "claimed") throw new Error("Expected funded claims");
  const helper = f.executions.reserve({
    operation: {
      kind: "helper",
      invocationId: "helper",
      sessionId: "helper-session",
      task: { appId: "target", taskId: "child" },
      attemptId: child.attemptId,
    },
    recipient,
    lane: "background",
    ownerId: "fixture",
  });
  if (helper.kind !== "admitted") throw new Error("Expected helper reservation");
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  const observed = f.read.workload({ agent: "alias" });
  expect(observed.limits.host).toEqual({ available: false }); // No parent controller snapshot.
  expect(observed.limits).toMatchObject({
    sharedHost: {
      available: true,
      scope: "installation",
      maxConcurrent: 4,
      occupied: 3,
      remaining: 1,
      backgroundMaxConcurrent: 3,
      backgroundOccupied: 3,
      backgroundRemaining: 0,
    },
    agent: { available: true, scope: "installation-recipient", recipient, maxConcurrent: 2, occupied: 2, remaining: 0 },
    root: {
      available: true,
      scope: "current-task-root",
      task: { appId: "target", taskId: "child" },
      root: f.root,
      maxConcurrent: 3,
      occupied: 3,
      remaining: 0,
    },
  });
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  expect(f.read.workload({ agent: "unknown" }).limits).toMatchObject({
    agent: { available: false },
    root: observed.limits.root,
  });
  releaseTaskExecutionReservation(f.db, helper.receipt, { kind: "joined", evidenceId: "helper-drained" });
  expect(f.read.workload().limits).toMatchObject({
    sharedHost: { occupied: 2, backgroundRemaining: 1 },
    agent: { occupied: 1, remaining: 1 },
    root: { occupied: 2, remaining: 1 },
  });
  for (const [index, owner] of [recipient, other].entries())
    expect(
      f.executions.reserve({
        operation: { kind: "helper", invocationId: `human-${index}`, sessionId: `human-session-${index}` },
        recipient: owner,
        lane: "human",
        ownerId: "fixture",
      }).kind,
    ).toBe("admitted");
  // Foreground occupancy also bounds background starts, even below its own sublimit.
  expect(f.read.workload().limits.sharedHost).toMatchObject({
    occupied: 4,
    remaining: 0,
    backgroundOccupied: 2,
    backgroundMaxConcurrent: 3,
    backgroundRemaining: 0,
  });
  if (!observed.limits.agent.available) throw new Error("Expected recipient observation");
  observed.limits.agent.recipient.id = "changed-by-reader";
  expect(f.read.workload().limits.agent).toMatchObject({ recipient });
});

test("unconfigured execution and missing policies remain unavailable rather than inferred from Task counts", () => {
  const f = fixture();
  expect(f.read.workload().limits).toMatchObject({
    sharedHost: { available: false },
    agent: { available: false },
    root: { available: false },
  });
  installTaskExecutionLimit(f.db, { kind: "host" }, 1);
  expect(f.read.workload().limits).toMatchObject({
    sharedHost: { available: true, maxConcurrent: 1, backgroundMaxConcurrent: 1, occupied: 0, backgroundRemaining: 1 },
    agent: { available: false },
    root: { available: true, maxConcurrent: 3, occupied: 0 },
  });
  const appRead = createRuntimeTaskRead({ taskStateConfig: f.target });
  expect(appRead.workload().limits).toMatchObject({ agent: { available: false }, root: { available: false } });
});
