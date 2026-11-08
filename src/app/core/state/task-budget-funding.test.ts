import { afterEach, expect, setSystemTime, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { defineApp, Type } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { createAppInboxItem } from "./app-inbox-store.js";
import { admitTaskInput } from "./inbox.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "./task-budget-admission.js";
import { adoptTaskBudget, changeTaskBudgetRootCredits } from "./task-budget-funding.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  observeAppTaskIntent,
} from "../tasks/app-task-reconciler.js";

const databases: SqliteDb[] = [];
const roots: string[] = [];
afterEach(() => {
  setSystemTime();
  databases.splice(0).forEach((db) => db.close());
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function fixture(path = ":memory:") {
  const db = openDatabase(path);
  databases.push(db);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode=WAL");
  applyDbSchema(db);
  const accounting = new TaskBudgetAdmissionStore(db);
  accounting.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "owner" },
    dailyCredits: 20,
    rootCredits: 2,
  });
  function app(appId: string) {
    const store = AppTaskResourceStore.fromDb(db, appId);
    store.bootstrapSnapshot(
      { project: appId, root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
      "seed",
    );
    const config = appTaskContext({
      appDir: `/fixture/${appId}.app`,
      projectDir: `/fixture/${appId}.app`,
      agent: "worker",
      resourceStore: store,
    });
    const add = (taskId: string, creator?: { appId: string; taskId: string }) =>
      observeAppTaskIntent(config, {
        appAgent: "worker",
        creator,
        intent: { id: taskId, parentId: "root", outcome: "Collect facts", acceptance: ["Facts accepted"] },
      });
    const claim = (taskId: string) => claimObservedAppTask(config, { taskId, appAgent: "worker", handler: "agent" });
    return { store, config, add, claim };
  }
  const sample = app("sample");
  sample.add("work");
  const target = { appId: "sample", taskId: "work" };
  const change = () => ({
    changeId: "fund-work",
    expected: accounting.budget.root(target)!,
    credits: 5,
    reason: "Authorized extra investigation",
  });
  return { db, accounting, app, ...sample, target, change };
}

test("an explicit cap change retains charges and attribution; exact replay cannot undo a later change", () => {
  const f = fixture();
  expect(f.claim("work").kind).toBe("claimed");
  const input = f.change();
  const result = changeTaskBudgetRootCredits(f.db, input);
  expect(result).toMatchObject({ replay: false, receipt: { change: input, rootPeriod: "lifetime" } });
  expect(f.accounting.budget.view(f.target, Date.now())).toMatchObject({
    credits: 5,
    rootCharged: 2,
    grant: { charged: 2 },
  });
  const later = { ...f.change(), changeId: "fund-work-again", credits: 7 };
  changeTaskBudgetRootCredits(f.db, later);
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  expect(changeTaskBudgetRootCredits(f.db, input)).toEqual({ receipt: result.receipt, replay: true });
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  expect(f.accounting.budget.root(f.target)).toEqual({ ...input.expected, credits: 7 });
  expect(() => changeTaskBudgetRootCredits(f.db, { ...input, credits: 20 })).toThrow("identity");
  expect(() => changeTaskBudgetRootCredits(f.db, { ...input, changeId: "stale" })).toThrow("exact current");
  expect(() =>
    changeTaskBudgetRootCredits(f.db, {
      ...f.change(),
      changeId: "wrong-sponsor",
      expected: { ...f.change().expected, sponsor: { appId: "sample", agent: "other" } },
    }),
  ).toThrow("exact current");
});

test("a cap cannot erase spending, and a failed caller commit rolls back its receipt and cap", () => {
  const f = fixture();
  f.app("other").add("contribution", f.target);
  expect(f.claim("work").kind).toBe("deferred");
  expect(() => changeTaskBudgetRootCredits(f.db, { ...f.change(), credits: 0 })).toThrow("charged credits");
  const before = f.accounting.budget.view(f.target, Date.now());
  const task = f.store.readTaskContext({ taskIds: ["work"] });
  expect(() =>
    stateTransaction(f.db, () => {
      changeTaskBudgetRootCredits(f.db, f.change());
      throw new Error("Installation failed");
    }),
  ).toThrow("Installation failed");
  expect(f.accounting.budget.view(f.target, Date.now())).toEqual(before);
  expect(f.store.readTaskContext({ taskIds: ["work"] })).toEqual(task);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_funding_receipts").get()?.n).toBe(0);
});

test("raising a root wakes its exact cross-App holds and preserves unrelated accounts and inputs", () => {
  const f = fixture();
  const other = f.app("other");
  other.add("contribution", f.target);
  f.add("unrelated");
  other.add("unrelated-contribution", { appId: "sample", taskId: "unrelated" });
  for (const [owner, taskId] of [
    [f, "work"],
    [other, "contribution"],
    [f, "unrelated"],
    [other, "unrelated-contribution"],
  ] as const) {
    admitTaskInput(owner.config, {
      appId: owner.store.appId,
      attachment: { kind: "existing", taskId },
      idempotencyKey: `input:${taskId}`,
      inputContext: { id: `ask:${taskId}`, source: { kind: "human", id: "person" }, input: { kind: "work", data: {} } },
    });
    expect(owner.claim(taskId)).toMatchObject({ kind: "deferred", funding: { reason: "root-credit" } });
  }
  const unrelated = f.store.readTaskContext({ taskIds: ["unrelated"] });
  const before = other.store.readTask("contribution")!;
  changeTaskBudgetRootCredits(f.db, f.change());
  expect(f.store.listRecoveryCandidates().items.map((item) => item.taskId)).toEqual(["work"]);
  expect(other.store.listRecoveryCandidates().items.map((item) => item.taskId)).toEqual(["contribution"]);
  expect(f.store.readTaskContext({ taskIds: ["unrelated"] })).toEqual(unrelated);
  expect(other.store.readTask("contribution")!.metadata.generation).toBe(before.metadata.generation);
  expect(other.store.readTask("contribution")!.status.executionFailures).toBeUndefined();
  expect(other.claim("contribution").kind).toBe("claimed");
  expect(f.accounting.budget.view(f.target, Date.now())).toMatchObject({ rootCharged: 3, grant: { charged: 5 } });
});

test("a root increase after debit denial but before saving the hold is not lost", () => {
  const f = fixture();
  f.app("other").add("contribution", f.target);
  const original = f.store.commit.bind(f.store);
  let changed = false;
  f.store.commit = (mutation) => {
    try {
      return original(mutation);
    } catch (error) {
      if (error instanceof TaskBudgetDeferredError && !changed) {
        changed = true;
        changeTaskBudgetRootCredits(f.db, f.change());
      }
      throw error;
    }
  };
  expect(f.claim("work").kind).toBe("deferred");
  expect(f.store.readTask("work")!.status.funding).toBeUndefined();
  expect(f.store.listRecoveryCandidates().items.map((item) => item.taskId)).toContain("work");
  expect(f.claim("work").kind).toBe("claimed");
});

test("funding wakes denied child creation in the existing Inbox without losing its caller", async () => {
  const f = fixture();
  f.app("other").add("contribution", f.target);
  f.add("unrelated");
  f.app("third").add("contribution", { appId: "sample", taskId: "unrelated" });
  const definition = defineApp({
    id: "sample",
    version: 1,
    agent: "worker",
    tasks: {},
    inputSchema: Type.Object({ kind: Type.Literal("work"), data: Type.Object({}) }),
    task: (input) => ({
      kind: "desired",
      intent: { id: input.id, parentId: "root", outcome: "Collect facts", acceptance: ["Facts accepted"] },
    }),
  });
  const host = new AppInboxHost({
    db: f.db,
    apps: [definition],
    attachTask: (input) => admitTaskInput(f.config, input),
  });
  try {
    for (const [id, creator] of [
      ["needed-child", f.target],
      ["other-child", { appId: "sample", taskId: "unrelated" }],
    ] as const)
      createAppInboxItem(f.db, {
        id,
        appId: "sample",
        creator,
        source: { kind: "app", id: "caller" },
        input: { kind: "work", data: {} },
      });
    await host.recoverAdmissions();
    expect(host.get("needed-child")?.handling).toMatchObject({ phase: "deferred", funding: { reason: "root-credit" } });
    expect(f.store.readTask("needed-child")).toBeNull();
    changeTaskBudgetRootCredits(f.db, f.change());
    await host.recoverAdmissions();
    expect(host.get("needed-child")).toMatchObject({
      source: { kind: "app", id: "caller" },
      waitingOn: { kind: "task", id: "needed-child" },
    });
    expect(f.accounting.budget.binding({ appId: "sample", taskId: "needed-child" })).toEqual(f.target);
    expect(host.get("other-child")?.handling).toMatchObject({ phase: "deferred", funding: { reason: "root-credit" } });
    expect(f.store.readTask("other-child")).toBeNull();
  } finally {
    host.close();
  }
});

test("independent runtimes cannot apply competing caps; restart retains the winning receipt and spending", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-funding-"));
  roots.push(root);
  const path = join(root, "state.sqlite");
  const f = fixture(path);
  const inputs = Array.from({ length: 4 }, (_, index) => ({
    ...f.change(),
    changeId: `competing-${index}`,
    credits: 5 + index,
  }));
  const execute = promisify(execFile);
  const results = await Promise.allSettled(
    inputs.map((input) =>
      execute(
        process.execPath,
        [
          "-e",
          `
    const { openDatabase } = await import(${JSON.stringify(new URL("../../../lib/db.ts", import.meta.url).href)});
    const { changeTaskBudgetRootCredits } = await import(${JSON.stringify(new URL("./task-budget-funding.ts", import.meta.url).href)});
    const db = openDatabase(${JSON.stringify(path)});
    db.exec("PRAGMA busy_timeout=5000");
    try { changeTaskBudgetRootCredits(db, ${JSON.stringify(input)}); console.log("applied"); }
    catch (error) { if (!error.message.includes("exact current")) throw error; console.log("stale"); }
    finally { db.close(); }
  `,
        ],
        { encoding: "utf8", timeout: 10_000 },
      ),
    ),
  );
  for (const result of results) if (result.status === "rejected") throw result.reason;
  const outputs = results.map((result) => (result.status === "fulfilled" ? result.value.stdout.trim() : "unexpected"));
  expect(outputs.filter((output) => output === "applied")).toHaveLength(1);
  expect(outputs.filter((output) => output === "stale")).toHaveLength(3);
  const input = inputs[outputs.indexOf("applied")]!;
  f.db.close();
  databases.splice(databases.indexOf(f.db), 1);
  const reopened = openDatabase(path);
  databases.push(reopened);
  applyDbSchema(reopened);
  expect(changeTaskBudgetRootCredits(reopened, input).replay).toBe(true);
  expect(new TaskBudgetAdmissionStore(reopened).budget.view(f.target, Date.now())).toMatchObject({
    credits: input.credits,
    rootCharged: 1,
    grant: { charged: 1 },
  });
}, 15_000);

test("funding a cancelled assignment preserves its ending without scheduling it", () => {
  const f = fixture();
  f.app("other").add("contribution", f.target);
  expect(f.claim("work").kind).toBe("deferred");
  const current = f.store.readTask("work")!;
  cancelAppTask(f.config, {
    appId: "sample",
    taskId: "work",
    expectedGeneration: current.metadata.generation,
    expectedResourceVersion: current.metadata.resourceVersion,
    reason: "Outcome withdrawn",
  });
  const before = f.store.readTaskContext({ taskIds: ["work"] });
  changeTaskBudgetRootCredits(f.db, f.change());
  expect(f.store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(f.accounting.budget.view(f.target, Date.now())?.rootCharged).toBe(2);
});

test("historical adoption replay retains an amended allowance without applying funding or wakes again", () => {
  const f = fixture();
  const old = f.app("old");
  old.add("retained");
  const task = { appId: "old", taskId: "retained" };
  const input = {
    task,
    root: {
      root: task,
      sponsor: { appId: "sample", agent: "owner" },
      purpose: "ordinary" as const,
      credits: 2,
      renewal: "lifetime" as const,
    },
    adoptionId: "historical-installation",
    reason: "Future work only",
  };
  adoptTaskBudget(f.db, input);
  changeTaskBudgetRootCredits(f.db, {
    changeId: "historical-cap",
    expected: input.root,
    credits: 4,
    reason: "Authorized cap increase",
  });
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  expect(() => adoptTaskBudget(f.db, input)).not.toThrow();
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  expect(f.accounting.budget.view(task, Date.now())).toMatchObject({ credits: 4, rootCharged: 0 });
  expect(() =>
    adoptTaskBudget(f.db, { ...input, root: { ...input.root, sponsor: { appId: "sample", agent: "other" } } }),
  ).toThrow("attribution");
});

test("an amended standing cap survives daily renewal without resetting finite root spending", () => {
  setSystemTime(new Date("2026-11-09T12:00:00Z"));
  const f = fixture();
  f.accounting.install({
    appId: "standing",
    sponsor: { appId: "standing", agent: "owner" },
    dailyCredits: 10,
    rootCredits: 2,
    standing: [{ taskId: "scheduled", credits: 2 }],
  });
  const standing = f.app("standing");
  standing.add("scheduled");
  const claim = standing.claim("scheduled");
  if (claim.kind !== "claimed") throw new Error("Expected standing claim");
  completeAppTask(standing.config, claim, { summary: "Current cycle complete" });
  const task = { appId: "standing", taskId: "scheduled" };
  changeTaskBudgetRootCredits(f.db, {
    changeId: "standing-cap",
    expected: f.accounting.budget.root(task)!,
    credits: 3,
    reason: "Authorized recurring allowance",
  });
  changeTaskBudgetRootCredits(f.db, f.change());
  setSystemTime(new Date("2026-11-10T12:00:00Z"));
  admitTaskInput(standing.config, {
    appId: "standing",
    attachment: { kind: "existing", taskId: "scheduled" },
    idempotencyKey: "next-cycle",
    inputContext: { id: "next-cycle", source: { kind: "app", id: "schedule" }, input: { kind: "work", data: {} } },
  });
  expect(standing.claim("scheduled").kind).toBe("claimed");
  expect(f.accounting.budget.view(task, Date.now())).toMatchObject({ credits: 3, renewal: "utc-day", rootCharged: 1 });
  expect(f.accounting.budget.view(f.target, Date.now())).toMatchObject({
    credits: 5,
    renewal: "lifetime",
    rootCharged: 1,
  });
});
