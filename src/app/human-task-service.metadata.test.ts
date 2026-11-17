import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { AppTaskResourceStore } from "./core/state/app-task-resource-store.js";
import { readRuntimeTaskView } from "./core/reads/app-read.js";
import {
  cancelAppTask, claimObservedAppTask, deferAppTask, observeAppTaskIntent,
} from "./core/tasks/app-task-reconciler.js";
import { appTaskTestContext } from "./core/tasks/app-task-test-support.js";
import { HumanTaskService } from "./human-task-service.js";

const databases: SqliteDb[] = [];
const directories: string[] = [];
afterEach(() => {
  while (databases.length) databases.pop()!.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

function fixture(worker = "worker", fileBacked = false, assignment: "explicit" | "inherited" | "app-default" = "explicit") {
  const appAgent = assignment === "inherited" ? "app-lead" : worker;
  const directory = fileBacked ? mkdtempSync(join(tmpdir(), "public-task-metadata-")) : undefined;
  if (directory) directories.push(directory);
  const path = directory ? join(directory, "fixture.sqlite") : ":memory:";
  const db = openDatabase(path);
  databases.push(db);
  if (fileBacked) db.exec("PRAGMA journal_mode = WAL");
  applyDbSchema(db);
  const appId = "sample", taskId = "review/metadata";
  const store = AppTaskResourceStore.fromDb(db, appId);
  const config = appTaskTestContext({
    appDir: "/unused", appId, agent: appAgent, maxConcurrent: 1, resourceStore: store,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  const service = new HumanTaskService(db, {
    snapshot: () => ({ id: "fixture:1", generation: 1, entries: [{
      appDir: "/unused/sample.app",
      definition: { id: appId, version: 1 as const, agent: appAgent, inputSchema: {} as never },
    }] }),
  });
  if (assignment === "inherited") observeAppTaskIntent(config, {
    appAgent, intent: { id: "parent", parentId: "root", agent: worker,
      outcome: "Own child review", acceptance: ["Preserve worker assignment"] },
  });
  observeAppTaskIntent(config, {
    appAgent, creator: { appId: "requester", taskId: "commission" },
    intent: {
      id: taskId, parentId: assignment === "inherited" ? "parent" : "root", outcome: "Retain exact review evidence",
      acceptance: ["Preserve independent waits and provenance"], ...(assignment === "explicit" ? { agent: worker } : {}),
      input: { kind: "goal", data: { context: { version: "original" } } },
    },
  });
  const claim = claimObservedAppTask(config, { taskId, appAgent, handler: "agent" });
  if (claim.kind !== "claimed") throw Error(`Expected claim, got ${claim.kind}`);
  const read = () => service.getTask({ appId, taskId })!;
  const wait = () => {
    const first = Date.now() + 60_000, later = first + 120_000;
    deferAppTask(config, claim, {
      disposition: "waiting", summary: "Waiting for independent input",
      facts: ["evidence:retained"], result: { checked: true }, reviewAt: first,
    });
    const resource = store.readTask(taskId)!;
    const expectedResourceVersion = resource.metadata.resourceVersion;
    resource.status.inputWaits = { "later-input": {
      taskGeneration: resource.metadata.generation, conditions: [], reviewAt: later,
    } };
    resource.metadata.resourceVersion++;
    expect(store.replaceTask({ expectedResourceVersion, resource, ready: false })).toBe(true);
    return { first, later };
  };
  return { db, path, appId, taskId, store, config, claim, service, read, wait };
}

test("public detail retains canonical assignment, claimed input, independent waits and accepted history", () => {
  const f = fixture();
  const running = f.read();
  expect(running.activeAttempt).toMatchObject({
    id: f.claim.attemptId, generation: 1,
    assignedInput: { newEvents: 0, continuingInputs: 0, truncated: false },
  });
  expect(running.pendingEvents).toMatchObject({ items: [], truncated: false });
  const { first, later } = f.wait();
  const detail = f.read();
  const canonical = readRuntimeTaskView({ taskStateConfig: f.config }, f.taskId)!;
  expect(detail.input).toEqual(canonical.input);
  expect(detail.creator).toEqual({ appId: "requester", taskId: "commission" });
  expect(detail.currentObligations).toEqual(canonical.currentObligations);
  expect(detail.currentObligations).toMatchObject({
    available: true, reviewAt: first,
    inputWaits: { truncated: false, items: [{ key: "later-input", reviewAt: later }] },
  });
  expect(detail.result).toEqual({ checked: true });
  expect(detail.facts).toEqual(["evidence:retained"]);
  expect(detail.acceptedEvidence?.page).toBeUndefined();
  const history = f.service.getTask({ appId: f.appId, taskId: f.taskId, acceptedEvidence: { limit: 1 } })!;
  expect(history.acceptedEvidence?.page?.items).toHaveLength(1);
  expect(history.acceptedEvidence?.page?.items[0]?.attemptId).toBe(f.claim.attemptId);
  const card = f.service.listTasks({ appId: f.appId, includeDone: true }).items.find((item) => item.taskId === f.taskId)!;
  for (const field of ["input", "creator", "agent", "currentObligations", "activeAttempt", "pendingEvents", "inputEvents"])
    expect(card).not.toHaveProperty(field);
});

test("public metadata reads succeed with SQLite writes disabled", () => {
  const f = fixture();
  f.wait();
  f.db.exec("PRAGMA query_only = ON");
  expect(f.read()).toMatchObject({
    input: { data: { context: { version: "original" } } },
    currentObligations: { available: true },
  });
});

test("a concurrent writer cannot mix new saved input with an old public revision", () => {
  const f = fixture("worker", true);
  f.wait();
  const before = f.store.readTask(f.taskId)!;
  const peer = openDatabase(f.path);
  databases.push(peer);
  const peerStore = AppTaskResourceStore.inspectFromDb(peer, f.appId);
  const inspect = AppTaskResourceStore.inspectFromDb.bind(AppTaskResourceStore);
  let injected = false;
  const hook = spyOn(AppTaskResourceStore, "inspectFromDb").mockImplementation((db, appId) => {
    if (db === f.db && !injected) {
      injected = true;
      const next = peerStore.readTask(f.taskId)!;
      const expectedResourceVersion = next.metadata.resourceVersion;
      next.metadata.resourceVersion++;
      next.metadata.generation++;
      next.spec.input = { kind: "goal", data: { context: { version: "revised" } } };
      expect(peerStore.replaceTask({ expectedResourceVersion, resource: next, ready: false })).toBe(true);
    }
    return inspect(db, appId);
  });
  let result;
  try { result = f.read(); } finally { hook.mockRestore(); }
  expect(injected).toBe(true);
  expect(peerStore.readTask(f.taskId)!.metadata.generation).toBe(before.metadata.generation + 1);
  expect(result).toMatchObject({
    generation: before.metadata.generation, resourceVersion: before.metadata.resourceVersion,
    input: { data: { context: { version: "original" } } },
  });
});

test.each(["reviewer", "builder"])("closed and open detail retain recorded %s worker identity", (worker) => {
  const f = fixture(worker);
  expect(f.read().agent).toBe(worker);
  f.wait();
  const current = f.store.readTask(f.taskId)!;
  expect(cancelAppTask(f.config, {
    appId: f.appId, taskId: f.taskId,
    expectedGeneration: current.metadata.generation, expectedResourceVersion: current.metadata.resourceVersion,
    reason: "Fixture responsibility ended",
  }).applied).toBe(true);
  expect(f.read()).toMatchObject({ terminal: true, agent: worker });
});


test.each(["inherited", "app-default"] as const)("public detail resolves %s worker identity before and after closure", (assignment) => {
  const f = fixture("specialist", false, assignment);
  expect(f.store.readTask(f.taskId)?.spec.owner).toBeUndefined();
  expect(readRuntimeTaskView({ taskStateConfig: f.config }, f.taskId)?.agent).toBe("specialist");
  expect(f.read().agent).toBe("specialist");
  f.wait();
  const current = f.store.readTask(f.taskId)!;
  expect(cancelAppTask(f.config, {
    appId: f.appId, taskId: f.taskId,
    expectedGeneration: current.metadata.generation, expectedResourceVersion: current.metadata.resourceVersion,
    reason: "Fixture responsibility ended",
  }).applied).toBe(true);
  f.db.exec("PRAGMA query_only = ON");
  expect(readRuntimeTaskView({ taskStateConfig: f.config }, f.taskId)?.agent).toBe("specialist");
  expect(f.read()).toMatchObject({ terminal: true, agent: "specialist" });
});
