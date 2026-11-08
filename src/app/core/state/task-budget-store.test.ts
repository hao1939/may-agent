import { afterEach, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { TaskBudgetStore, utcBudgetPeriod } from "./task-budget-store.js";

const databases: SqliteDb[] = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));
const now = Date.parse("2026-11-09T23:59:59Z");
function fixture(credits = 3, renewal: "lifetime" | "utc-day" = "lifetime") {
  const db = openDatabase(":memory:");
  databases.push(db);
  applyDbSchema(db);
  const store = new TaskBudgetStore(db);
  const root = { appId: "sample", taskId: "root" };
  const sponsor = { appId: "sample", agent: "owner" };
  store.grant({ sponsor, purpose: "ordinary", period: utcBudgetPeriod(now), credits });
  store.registerRoot({ root, sponsor, purpose: "ordinary", renewal, credits: 2 });
  return { db, store, root, sponsor };
}

test("one immutable account follows contributions across Apps; exact operation replay spends once", () => {
  const f = fixture();
  const child = { appId: "other", taskId: "contribution" };
  f.store.bind(child, f.root);
  expect(f.store.charge({ task: child, kind: "task" }, now)).toMatchObject({ kind: "admitted", replay: false });
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  expect(f.store.charge({ task: child, kind: "task" }, now + 86_400_000)).toMatchObject({
    kind: "admitted",
    replay: true,
    receipt: { period: "2026-11-09", credits: 1 },
  });
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  expect(f.store.view(child, now)).toMatchObject({ rootCharged: 1, grant: { credits: 3, charged: 1 } });
  expect(() => f.store.bind(child, child)).toThrow("not configured");
  const other = { appId: "other", taskId: "root" };
  f.store.registerRoot({ root: other, sponsor: f.sponsor, purpose: "ordinary", credits: 3, renewal: "lifetime" });
  expect(() => f.store.bind(child, other)).toThrow("immutable");
});

test.each(["lifetime", "utc-day"] as const)(
  "UTC renewal preserves the declared %s root allowance and original receipts",
  (renewal) => {
    const f = fixture(5, renewal);
    f.store.charge({ task: f.root, kind: "task" }, now);
    f.store.charge({ task: f.root, kind: "attempt", attemptId: "attempt-one" }, now);
    expect(f.store.charge({ task: f.root, kind: "helper", invocationId: "helper-one" }, now)).toMatchObject({
      kind: "deferred",
      reason: "root-credit",
    });
    const tomorrow = now + 86_400_000;
    f.store.grant({ sponsor: f.sponsor, purpose: "ordinary", period: utcBudgetPeriod(tomorrow), credits: 5 });
    const result = f.store.charge({ task: f.root, kind: "helper", invocationId: "helper-one" }, tomorrow);
    expect(result.kind).toBe(renewal === "lifetime" ? "deferred" : "admitted");
    expect(f.store.charge({ task: f.root, kind: "attempt", attemptId: "attempt-one" }, tomorrow)).toMatchObject({
      kind: "admitted",
      replay: true,
      receipt: { period: "2026-11-09" },
    });
  },
);

test("a denied debit writes nothing, and accounting joins the caller's rollback", () => {
  const f = fixture(0);
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  expect(f.store.charge({ task: f.root, kind: "task" }, now)).toMatchObject({
    kind: "deferred",
    reason: "sponsor-credit",
  });
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
  const funded = fixture();
  expect(() =>
    stateTransaction(funded.db, () => {
      expect(funded.store.charge({ task: funded.root, kind: "task" }, now).kind).toBe("admitted");
      throw new Error("Resource link commit failed");
    }),
  ).toThrow("Resource link commit failed");
  expect(funded.store.view(funded.root, now)).toMatchObject({ rootCharged: 0, grant: { charged: 0 } });
  expect(funded.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()?.n).toBe(0);
});

test("protected and ordinary sponsorship are separate; historical work needs explicit adoption", () => {
  const f = fixture(0);
  const coordination = { appId: "sample", taskId: "coordination" };
  f.store.grant({ sponsor: f.sponsor, purpose: "coordination", period: utcBudgetPeriod(now), credits: 1 });
  f.store.registerRoot({
    root: coordination,
    sponsor: f.sponsor,
    purpose: "coordination",
    renewal: "utc-day",
    credits: 1,
  });
  expect(f.store.charge({ task: coordination, kind: "attempt", attemptId: "review-one" }, now).kind).toBe("admitted");
  expect(f.store.charge({ task: f.root, kind: "task" }, now).kind).toBe("deferred");
  const old = { appId: "sample", taskId: "retained" };
  expect(f.store.view(old, now)).toBeNull();
  expect(() => f.store.charge({ task: old, kind: "attempt", attemptId: "unfunded" }, now)).toThrow(
    "explicit budget adoption",
  );
  f.store.bind(old, f.root);
  expect(
    f.store.charge(
      {
        task: old,
        kind: "adoption",
        adoptionId: "install-one",
        reason: "Attribute future work; historical spending is unknown",
      },
      now,
    ),
  ).toMatchObject({ kind: "admitted", receipt: { credits: 0 } });
  expect(f.store.view(old, now)).toMatchObject({ rootCharged: 0, grant: { charged: 0 } });
});

test("grant publication is idempotent and cannot reset spending or silently increase a root cap", () => {
  const f = fixture();
  f.store.charge({ task: f.root, kind: "task" }, now);
  f.store.grant({ sponsor: f.sponsor, purpose: "ordinary", period: utcBudgetPeriod(now), credits: 3 });
  expect(f.store.view(f.root, now)?.grant?.charged).toBe(1);
  expect(() =>
    f.store.grant({ sponsor: f.sponsor, purpose: "ordinary", period: utcBudgetPeriod(now), credits: 20 }),
  ).toThrow("funding operation");
  expect(() =>
    f.store.registerRoot({ root: f.root, sponsor: f.sponsor, purpose: "ordinary", credits: 20, renewal: "lifetime" }),
  ).toThrow("funding operation");
});

test.each(["sponsor", "root"] as const)(
  "independent workers share one durable %s limit and uncertain helper starts stay charged after reopen",
  async (limit) => {
    const rootDir = mkdtempSync(join(tmpdir(), "may-budget-workers-"));
    const path = join(rootDir, "host.sqlite");
    const root = { appId: "sample", taskId: "root" };
    const sponsor = { appId: "sample", agent: "owner" };
    let db = openDatabase(path);
    try {
      db.exec("PRAGMA journal_mode=WAL");
      applyDbSchema(db);
      const budget = new TaskBudgetStore(db);
      budget.grant({
        sponsor,
        purpose: "ordinary",
        period: utcBudgetPeriod(now),
        credits: limit === "sponsor" ? 3 : 4,
      });
      budget.registerRoot({
        root,
        sponsor,
        purpose: "ordinary",
        renewal: "lifetime",
        credits: limit === "root" ? 3 : 4,
      });
      const exec = promisify(execFile);
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, index) =>
          exec(
            process.execPath,
            [
              "-e",
              `
      const { openDatabase } = await import(${JSON.stringify(new URL("../../../lib/db.ts", import.meta.url).href)});
      const { TaskBudgetStore } = await import(${JSON.stringify(new URL("./task-budget-store.ts", import.meta.url).href)});
      const db = openDatabase(${JSON.stringify(path)});
      db.exec("PRAGMA busy_timeout=5000");
      try {
        const result = new TaskBudgetStore(db).charge({ kind: "helper", task: ${JSON.stringify(root)}, invocationId: "helper-" + ${index} }, ${now});
        console.log(result.kind);
      } finally { db.close(); }
    `,
            ],
            { encoding: "utf8", timeout: 10_000 },
          ),
        ),
      );
      for (const result of results) if (result.status === "rejected") throw result.reason;
      const admissions = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value.stdout.trim()] : [],
      );
      expect(admissions.filter((kind) => kind === "admitted")).toHaveLength(3);
      expect(admissions.filter((kind) => kind === "deferred")).toHaveLength(5);
      expect(budget.view(root, now)).toMatchObject({ rootCharged: 3, grant: { charged: 3 } });
      db.close();
      db = openDatabase(path);
      const reopened = new TaskBudgetStore(db);
      const receipt = db.prepare("SELECT receipt_json FROM task_budget_operations LIMIT 1").get()!;
      const paid = JSON.parse(receipt.receipt_json as string);
      expect(reopened.charge(paid.operation, now)).toMatchObject({ kind: "admitted", replay: true });
      expect(reopened.charge({ task: root, kind: "helper", invocationId: "after-restart" }, now)).toMatchObject({
        kind: "deferred",
        reason: limit === "sponsor" ? "sponsor-credit" : "root-credit",
      });
      expect(reopened.view(root, now)).toMatchObject({ rootCharged: 3, grant: { charged: 3 } });
    } finally {
      db.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  },
  20_000,
);

test("a budget observation uses one SQLite snapshot while another runtime commits a debit", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "may-budget-observation-"));
  const path = join(rootDir, "host.sqlite");
  const root = { appId: "sample", taskId: "root" };
  const sponsor = { appId: "sample", agent: "owner" };
  const reader = openDatabase(path);
  const writer = openDatabase(path);
  try {
    reader.exec("PRAGMA journal_mode=WAL");
    applyDbSchema(reader);
    const budget = new TaskBudgetStore(writer);
    budget.grant({ sponsor, purpose: "ordinary", period: utcBudgetPeriod(now), credits: 3 });
    budget.registerRoot({ root, sponsor, purpose: "ordinary", renewal: "lifetime", credits: 3 });
    let committed = false;
    const interleaved: SqliteDb = {
      ...reader,
      prepare(sql) {
        const statement = reader.prepare(sql);
        if (!sql.includes("SELECT charged FROM task_budget_root_balances")) return statement;
        return {
          ...statement,
          get(...params) {
            const result = statement.get(...params);
            if (!committed) {
              committed = true;
              expect(budget.charge({ task: root, kind: "attempt", attemptId: "other-runtime" }, now).kind).toBe(
                "admitted",
              );
            }
            return result;
          },
        };
      },
    };
    expect(new TaskBudgetStore(interleaved).view(root, now)).toMatchObject({ rootCharged: 0, grant: { charged: 0 } });
    expect(committed).toBe(true);
    expect(budget.view(root, now)).toMatchObject({ rootCharged: 1, grant: { charged: 1 } });
  } finally {
    reader.close();
    writer.close();
    rmSync(rootDir, { recursive: true, force: true });
  }
});
