import { afterEach, expect, setSystemTime, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { TaskBudgetStore, utcBudgetPeriod } from "./task-budget-store.js";
import {
  TaskExecutionStore,
  type ExecutionRecipient,
  type ExecutionRequest,
  type ExecutionReservation,
  type ExecutionRelease,
} from "./task-execution-store.js";

const databases: SqliteDb[] = [];
const roots: string[] = [];
afterEach(() => {
  setSystemTime();
  databases.splice(0).forEach((db) => db.close());
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
const recipient: ExecutionRecipient = { kind: "directory", id: "projects/sample.app/agents/owner" };
const root = { appId: "sample", taskId: "work" };
function fixture(hostSlots = 3, agentSlots = 3, rootSlots = 3, file?: string) {
  const db = openDatabase(file ?? ":memory:");
  databases.push(db);
  applyDbSchema(db);
  const budget = new TaskBudgetStore(db);
  budget.registerRoot({
    root,
    sponsor: { appId: "sample", agent: "owner" },
    purpose: "ordinary",
    credits: 10,
    renewal: "lifetime",
  });
  budget.grant({
    sponsor: { appId: "sample", agent: "owner" },
    purpose: "ordinary",
    period: utcBudgetPeriod(Date.now()),
    credits: 10,
  });
  const store = new TaskExecutionStore(db);
  store.installLimit({ kind: "host" }, hostSlots);
  store.installLimit({ kind: "agent", recipient }, agentSlots);
  store.installLimit({ kind: "root", root }, rootSlots);
  const request = (id: string, lane: ExecutionRequest["lane"] = "background"): ExecutionRequest => ({
    operation: { kind: "attempt", task: root, attemptId: id },
    recipient,
    lane,
    ownerId: "worker-instance",
  });
  const reserve = (id: string, lane?: ExecutionRequest["lane"]) => store.reserve(request(id, lane));
  return { db, budget, store, request, reserve };
}
function receipt(result: ReturnType<TaskExecutionStore["reserve"]>): ExecutionReservation {
  if (result.kind !== "admitted") throw new Error(`Not admitted: ${JSON.stringify(result)}`);
  return result.receipt;
}

test("Host reserve is shared by humans and coordination; size one invents no extra slot", () => {
  const f = fixture(3);
  f.reserve("background-one");
  f.reserve("background-two");
  expect(f.reserve("extra-background")).toMatchObject({
    kind: "deferred",
    reason: "execution-capacity",
    scope: { kind: "host" },
  });
  const review = receipt(f.reserve("review", "coordination"));
  expect(f.reserve("human", "human").kind).toBe("deferred");
  expect(
    f.store.confirmReleased(review.operationId, review.token, { kind: "joined", evidenceId: "review-drained" }),
  ).toBe(true);
  expect(f.reserve("human", "human").kind).toBe("admitted");
  const one = fixture(1);
  one.reserve("work");
  expect(one.reserve("management", "coordination").kind).toBe("deferred");
  expect(one.store.usage({ kind: "host" })).toEqual({ limit: 1, occupied: 1 });
});

test("root and resolved recipient constraints do not block unrelated work", () => {
  const f = fixture(6, 2, 1);
  f.reserve("one", "human");
  expect(f.reserve("same-root", "human")).toMatchObject({ kind: "deferred", scope: { kind: "root", root } });
  const other = { appId: "other", taskId: "work" };
  f.budget.registerRoot({
    root: other,
    sponsor: { appId: "other", agent: "owner" },
    purpose: "ordinary",
    credits: 10,
    renewal: "lifetime",
  });
  f.store.installLimit({ kind: "root", root: other }, 3);
  const request = {
    ...f.request("second", "human"),
    operation: { kind: "attempt" as const, task: other, attemptId: "second" },
  };
  expect(f.store.reserve(request).kind).toBe("admitted");
  expect(f.store.reserve({ ...request, operation: { ...request.operation, attemptId: "third" } })).toMatchObject({
    kind: "deferred",
    scope: { kind: "agent", recipient },
  });
  const different = { kind: "directory" as const, id: "projects/other.app/agents/owner" };
  f.store.installLimit({ kind: "agent", recipient: different }, 1);
  expect(
    f.store.reserve({
      ...request,
      recipient: different,
      operation: { ...request.operation, attemptId: "different-agent" },
    }).kind,
  ).toBe("admitted");
});

test("reservation and debit roll back together when any start requirement fails", () => {
  const f = fixture(3, 3, 1);
  f.reserve("occupant");
  expect(() =>
    stateTransaction(f.db, () => {
      expect(f.budget.charge({ task: root, kind: "attempt", attemptId: "denied" }, Date.now()).kind).toBe("admitted");
      const result = f.reserve("denied");
      if (result.kind !== "admitted") throw new Error("Execution deferred");
    }),
  ).toThrow("Execution deferred");
  expect(f.budget.view(root, Date.now())?.rootCharged).toBe(0);
  expect(f.store.usage({ kind: "root", root }).occupied).toBe(1);
  const g = fixture();
  expect(() =>
    stateTransaction(g.db, () => {
      g.reserve("rollback");
      throw new Error("claim fence lost");
    }),
  ).toThrow("claim fence lost");
  expect(g.store.usage({ kind: "host" }).occupied).toBe(0);
});

test("exact replay cannot move a live reservation or redispatch a released operation", () => {
  const f = fixture();
  const original = receipt(f.reserve("start"));
  expect(f.reserve("start")).toMatchObject({ kind: "admitted", replay: true, released: false, receipt: original });
  for (const change of [
    { ownerId: "new-instance" },
    { lane: "human" as const },
    { recipient: { kind: "directory" as const, id: "projects/different.app/agents/owner" } },
  ])
    expect(() => f.store.reserve({ ...f.request("start"), ...change })).toThrow("reused");
  expect(() =>
    f.store.confirmReleased(original.operationId, "wrong-token", { kind: "joined", evidenceId: "not-this-owner" }),
  ).toThrow("exact reservation");
  expect(
    f.store.confirmReleased(original.operationId, original.token, {
      kind: "confirmed-nonstart",
      evidenceId: "provider-not-invoked",
    }),
  ).toBe(true);
  expect(
    f.store.confirmReleased(original.operationId, original.token, { kind: "joined", evidenceId: "later-observation" }),
  ).toBe(false);
  expect(f.reserve("start")).toMatchObject({ kind: "admitted", replay: true, released: true, receipt: original });
  expect(f.store.usage({ kind: "host" }).occupied).toBe(0);
});

test("release accepts the full composite identity of valid bounded components", () => {
  const f = fixture();
  const task = { appId: "\u0000".repeat(1024), taskId: "\u0001".repeat(1024) };
  const admitted = receipt(
    f.store.reserve({
      ...f.request("long"),
      operation: { kind: "attempt", task, attemptId: "\u0002".repeat(1024) },
    }),
  );
  expect(Buffer.byteLength(admitted.operationId)).toBeGreaterThan(18_000);
  expect(
    f.store.confirmReleased(admitted.operationId, admitted.token, {
      kind: "joined",
      evidenceId: "exact-execution-drained",
    }),
  ).toBe(true);
  expect(f.store.usage({ kind: "host" }).occupied).toBe(0);
});

test("adopting live historical execution retains capacity without rewriting admission evidence", () => {
  const f = fixture(8, 8, 1);
  const historical = { appId: "retained", taskId: "old" };
  const primaryRequest: ExecutionRequest = {
    ...f.request("old-attempt", "human"),
    operation: { kind: "attempt", task: historical, attemptId: "old-attempt" },
  };
  const primary = receipt(f.store.reserve(primaryRequest));
  const helperRequest: ExecutionRequest = {
    ...primaryRequest,
    operation: {
      kind: "helper",
      task: historical,
      attemptId: "old-attempt",
      invocationId: "old-helper",
      sessionId: "helper",
    },
  };
  const helper = receipt(f.store.reserve(helperRequest));
  expect(primary.root).toBeNull();
  expect(f.store.usage({ kind: "root", root }).occupied).toBe(0);
  expect(() =>
    stateTransaction(f.db, () => {
      f.budget.bind(historical, root);
      expect(f.store.usage({ kind: "root", root }).occupied).toBe(2);
      throw new Error("adoption fence lost");
    }),
  ).toThrow("adoption fence lost");
  expect(f.budget.binding(historical)).toBeNull();
  expect(f.store.usage({ kind: "root", root }).occupied).toBe(0);
  f.budget.bind(historical, root);
  // Admission evidence stays immutable; occupancy follows the canonical binding.
  expect(f.store.reserve(primaryRequest)).toMatchObject({ receipt: primary, replay: true });
  expect(f.store.reserve(helperRequest)).toMatchObject({ receipt: helper, replay: true });
  expect(f.store.usage({ kind: "root", root })).toEqual({ limit: 1, occupied: 2 });
  expect(f.reserve("new", "human")).toMatchObject({ kind: "deferred", scope: { kind: "root", root } });
  f.store.confirmReleased(primary.operationId, primary.token, { kind: "joined", evidenceId: "primary-drained" });
  expect(f.reserve("new", "human").kind).toBe("deferred");
  f.store.confirmReleased(helper.operationId, helper.token, { kind: "joined", evidenceId: "helper-drained" });
  expect(f.reserve("new", "human").kind).toBe("admitted");
});

test("uncertain execution survives UTC, restart and unsupported release claims", () => {
  setSystemTime(new Date("2026-07-01T23:59:00Z"));
  const dir = mkdtempSync(join(tmpdir(), "may-execution-reopen-"));
  roots.push(dir);
  const path = join(dir, "state.db");
  const f = fixture(1, 1, 1, path);
  const original = receipt(f.reserve("retained"));
  setSystemTime(new Date("2026-07-02T00:01:00Z"));
  const reopened = openDatabase(path);
  databases.push(reopened);
  const store = new TaskExecutionStore(reopened);
  for (const kind of ["task-closed", "lease-expired", "transport-lost", "midnight"])
    expect(() =>
      store.confirmReleased(original.operationId, original.token, {
        kind,
        evidenceId: "unconfirmed",
      } as ExecutionRelease),
    ).toThrow("confirmed");
  expect(store.reserve(f.request("new", "human")).kind).toBe("deferred");
  expect(
    store.confirmReleased(original.operationId, original.token, {
      kind: "confirmed-recovery",
      evidenceId: "exact-owner-and-descendants-drained",
    }),
  ).toBe(true);
  expect(store.reserve(f.request("new", "human")).kind).toBe("admitted");
});

test("helpers and resumes share root capacity; an unconfigured execution policy reports unavailable", () => {
  const f = fixture(6, 6, 1);
  const primary = receipt(f.reserve("parent"));
  const helper: ExecutionRequest = {
    ...f.request("parent"),
    operation: { kind: "helper", invocationId: "call-one", sessionId: "helper", task: root, attemptId: "parent" },
  };
  expect(f.store.reserve(helper)).toMatchObject({ kind: "deferred", scope: { kind: "root" } });
  f.store.confirmReleased(primary.operationId, primary.token, { kind: "joined", evidenceId: "yield-drained" });
  const child = receipt(f.store.reserve(helper));
  expect(f.store.reserve({ ...helper, operation: { ...helper.operation, invocationId: "resume-one" } }).kind).toBe(
    "deferred",
  );
  f.store.confirmReleased(child.operationId, child.token, { kind: "joined", evidenceId: "helper-drained" });
  expect(f.store.reserve({ ...helper, operation: { ...helper.operation, invocationId: "resume-one" } }).kind).toBe(
    "admitted",
  );
  const db = openDatabase(":memory:");
  databases.push(db);
  applyDbSchema(db);
  const store = new TaskExecutionStore(db);
  expect(store.reserve(f.request("unconfigured"))).toEqual({ kind: "unavailable" });
  store.installLimit({ kind: "host" }, 2);
  expect(store.reserve(f.request("unconfigured"))).toMatchObject({
    kind: "deferred",
    reason: "execution-policy",
    scope: { kind: "agent" },
  });
});

test.each(["host", "agent", "root"] as const)(
  "independent OS workers cannot exceed the %s limit",
  async (constraint) => {
    const dir = mkdtempSync(join(tmpdir(), "may-execution-race-"));
    roots.push(dir);
    const path = join(dir, "state.db");
    const f = fixture(
      constraint === "host" ? 2 : 6,
      constraint === "agent" ? 2 : 6,
      constraint === "root" ? 2 : 6,
      path,
    );
    f.db.exec("PRAGMA journal_mode = WAL");
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        promisify(execFile)(
          process.execPath,
          [
            "-e",
            `
    const { openDatabase } = await import(${JSON.stringify(new URL("../../../lib/db.ts", import.meta.url).href)});
    const { TaskExecutionStore } = await import(${JSON.stringify(new URL("./task-execution-store.ts", import.meta.url).href)});
    const db = openDatabase(${JSON.stringify(path)}); db.exec("PRAGMA busy_timeout = 5000");
    try { console.log(new TaskExecutionStore(db).reserve(${JSON.stringify(f.request(`worker-${index}`, "human"))}).kind); } finally { db.close(); }
  `,
          ],
          { encoding: "utf8", timeout: 10_000 },
        ),
      ),
    );
    expect(results.filter((result) => result.stdout.trim() === "admitted")).toHaveLength(2);
    expect(results.filter((result) => result.stdout.trim() === "deferred")).toHaveLength(3);
    expect(f.store.usage({ kind: "host" }).occupied).toBe(2);
  },
  15_000,
);
