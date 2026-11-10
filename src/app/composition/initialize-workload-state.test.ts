import { afterEach, expect, spyOn, test } from "bun:test";
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { TaskBudgetAdmissionStore } from "../core/state/task-budget-admission.js";
import { TaskExecutionStore } from "../core/state/task-execution-store.js";
import { initializeWorkloadState, type WorkloadStateInitialization } from "./initialize-workload-state.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(join(root, "state"));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = fs.mkdtempSync(join(tmpdir(), "may-fresh-workload-"));
  roots.push(root);
  const state = join(root, "state");
  const recipient = { kind: "programmatic" as const, id: "fixture/owner" };
  const plan: WorkloadStateInitialization = {
    version: 1,
    host: { slots: 4, backgroundSlots: 2 },
    apps: [
      {
        appId: "sample",
        sponsor: { appId: "sample", agent: "owner" },
        dailyCredits: 10,
        rootCredits: 5,
        rootExecutionSlots: 1,
      },
    ],
    limits: [{ scope: { kind: "agent", recipient }, slots: 2 }],
  };
  return { root, state, recipient, plan };
}

test("the first ordinary database opener receives complete installed policy without a sidecar dependency", () => {
  const f = fixture();
  expect(initializeWorkloadState(f.state, f.plan)).toEqual({
    kind: "initialized",
    appCount: 1,
    executionLimitCount: 3,
  });
  expect(fs.readdirSync(f.state)).toEqual(["may.db"]);
  expect(fs.readdirSync(f.root)).toEqual(["state"]);
  const db = getDb(f.state);
  expect(new TaskBudgetAdmissionStore(db).policy("sample")).toEqual(f.plan.apps[0]!);
  const executions = new TaskExecutionStore(db);
  expect(executions.hostPolicy()).toEqual({ maxConcurrent: 4, backgroundMaxConcurrent: 2 });
  expect(executions.usage({ kind: "agent", recipient: f.recipient })).toEqual({ limit: 2, occupied: 0 });
  expect(db.prepare("SELECT COUNT(*) AS n FROM app_tasks").get()?.n).toBe(0);
  expect(db.prepare("SELECT COUNT(*) AS n FROM task_budget_managed_starts").get()?.n).toBe(0);
});

test.each(["empty", "database", "backup", "recovery", "sessions"])(
  "existing %s state is never reinterpreted as a fresh installation",
  (kind) => {
    const f = fixture();
    fs.mkdirSync(f.state);
    if (kind !== "empty")
      fs.writeFileSync(
        join(
          f.state,
          kind === "database"
            ? "may.db"
            : kind === "backup"
              ? "may.db.backup"
              : kind === "recovery"
                ? "may.db-wal"
                : "sessions",
        ),
        "retained bytes",
      );
    const before = fs.readdirSync(f.state).map((name) => [name, fs.readFileSync(join(f.state, name), "utf8")]);
    expect(() => initializeWorkloadState(f.state, f.plan)).toThrow("absent state directory");
    expect(fs.readdirSync(f.state).map((name) => [name, fs.readFileSync(join(f.state, name), "utf8")])).toEqual(before);
  },
);

test.each([
  "bad-cap",
  "duplicate-app",
  "duplicate-scope",
  "missing-root-default",
  "missing-background",
  "unknown-field",
])("%s cannot publish partially installed policy", (kind) => {
  const f = fixture();
  const plan = structuredClone(f.plan);
  if (kind === "bad-cap") plan.apps[0]!.rootCredits = -1;
  if (kind === "duplicate-app") plan.apps = [...plan.apps, plan.apps[0]!];
  if (kind === "duplicate-scope") plan.limits = [...plan.limits, plan.limits[0]!];
  if (kind === "missing-root-default")
    delete (plan.apps[0] as Partial<WorkloadStateInitialization["apps"][number]>).rootExecutionSlots;
  if (kind === "missing-background") delete (plan.host as Partial<typeof plan.host>).backgroundSlots;
  if (kind === "unknown-field") Object.assign(plan.host, { backgoundSlots: 2 });
  expect(() => initializeWorkloadState(f.state, plan)).toThrow();
  expect(fs.readdirSync(f.root)).toEqual([]);
});

test("an ordinary opener that wins publication keeps its own database and receives no partial limits", () => {
  const f = fixture();
  const link = fs.linkSync;
  const publish = spyOn(fs, "linkSync").mockImplementation((source, target) => {
    const db = getDb(f.state);
    db.exec("CREATE TABLE competing_opener (id INTEGER)");
    link(source, target);
  });
  try {
    expect(() => initializeWorkloadState(f.state, f.plan)).toThrow();
  } finally {
    publish.mockRestore();
  }
  const db = getDb(f.state);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'competing_opener'").get()?.name).toBe(
    "competing_opener",
  );
  expect(new TaskBudgetAdmissionStore(db).policy("sample")).toBeNull();
  expect(new TaskExecutionStore(db).configured()).toBe(false);
  expect(fs.readdirSync(f.root)).toEqual(["state"]);
});

test("concurrent operator processes publish one complete database and never overwrite it on replay", async () => {
  const f = fixture();
  const file = join(f.root, "plan.json");
  fs.writeFileSync(file, JSON.stringify(f.plan));
  const script = new URL("../../../scripts/operations/initialize-workload-state.ts", import.meta.url).pathname;
  const execute = promisify(execFile);
  const results = await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      execute(process.execPath, [script, "--new-state-dir", f.state, "--plan", file], {
        timeout: 10_000,
        encoding: "utf8",
      }),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(2);
  const db = getDb(f.state);
  expect(new TaskBudgetAdmissionStore(db).policy("sample")).toEqual(f.plan.apps[0]!);
  expect(new TaskExecutionStore(db).hostPolicy()?.backgroundMaxConcurrent).toBe(2);
  expect(fs.readdirSync(f.root).sort()).toEqual(["plan.json", "state"]);
  expect(() => initializeWorkloadState(f.state, f.plan)).toThrow("absent state directory");
}, 15_000);
