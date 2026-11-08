import { afterEach, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { spawnFixtureProcess } from "../../../test/fixtures/owned-process.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { isProcessInstanceAlive, type ProcessInstance } from "../../lib/process-identity.js";
import { sessionDir, writeSessionMeta } from "../../lib/persistence.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "../core/state/task-budget-admission.js";
import { TaskExecutionStore } from "../core/state/task-execution-store.js";
import { admitTaskInput } from "../core/state/inbox.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  observeAppTaskIntent,
} from "../core/tasks/app-task-reconciler.js";
import { installRetainedWorkloadState, type RetainedWorkloadInstallation } from "./install-retained-workload-state.js";

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
const recipient = { kind: "programmatic" as const, id: "fixture/owner" };

function fixture() {
  const state = mkdtempSync(join(tmpdir(), "may-retained-workload-"));
  const db = getDb(state);
  cleanups.push(() => {
    closeDb(state);
    rmSync(state, { recursive: true, force: true });
  });
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.bootstrapSnapshot({ project: "sample", groups: { root: { id: "root", parent_id: null } } }, "seed");
  const config = appTaskContext({
    appDir: join(state, "sample.app"),
    projectDir: state,
    agent: "owner",
    resourceStore: store,
  });
  const add = (id: string, creator?: { appId: string; taskId: string }) =>
    observeAppTaskIntent(config, {
      appAgent: "owner",
      creator,
      intent: { id, parentId: "root", outcome: "Collect facts", acceptance: ["Facts retained"] },
    });
  const claim = (id: string) =>
    claimObservedAppTask(config, {
      taskId: id,
      appAgent: "owner",
      handler: "agent",
      execution: { recipient: () => recipient, lane: "background" },
    });
  add("work");
  const historical = claim("work");
  if (historical.kind !== "claimed") throw new Error("Historical claim missing");
  completeAppTask(config, historical, { summary: "Historical accepted evidence" });
  add("contribution", { appId: "sample", taskId: "work" });
  add("unattributed");
  admitTaskInput(config, {
    appId: "sample",
    attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: "retained-caller",
    inputContext: {
      id: "retained-caller",
      source: { kind: "human", id: "person" },
      input: { kind: "inspect", data: {} },
    },
  });
  const root = {
    root: { appId: "sample", taskId: "work" },
    sponsor: { appId: "sample", agent: "owner" },
    purpose: "ordinary" as const,
    credits: 5,
    renewal: "lifetime" as const,
  };
  const plan = (): RetainedWorkloadInstallation => ({
    version: 1,
    policy: {
      version: 1,
      host: { slots: 4, backgroundSlots: 2 },
      apps: [{ appId: "sample", sponsor: root.sponsor, dailyCredits: 10, rootCredits: 5, rootExecutionSlots: 2 }],
      limits: [
        { scope: { kind: "agent", recipient }, slots: 2 },
        { scope: { kind: "root", root: root.root }, slots: 1 },
      ],
    },
    adoptions: ["work", "contribution"].map((taskId) => ({
      task: { appId: "sample", taskId },
      root,
      generation: store.readTask(taskId)!.metadata.generation,
      resourceVersion: store.readTask(taskId)!.metadata.resourceVersion,
      adoptionId: `installation:${taskId}`,
      reason: "Explicit future attribution of retained work",
    })),
  });
  const install = (input: unknown = plan(), dryRun = false) =>
    installRetainedWorkloadState(db, state, input, { quiesced: true, dryRun });
  const accounting = new TaskBudgetAdmissionStore(db);
  return { state, db, store, config, add, claim, plan, install, root, historical, accounting };
}

test("offline adoption preserves history and caller obligations, shares future charges and enforces the explicit historical root limit", () => {
  const f = fixture();
  const before = f.store.readTaskContext({ taskIds: ["work", "contribution", "unattributed"] });
  expect(f.install()).toEqual({ kind: "installed", appCount: 1, adoptionCount: 2 });
  expect(f.store.readTaskContext({ taskIds: ["work", "contribution", "unattributed"] })).toEqual(before);
  expect(f.accounting.budget.view(f.root.root, Date.now())).toMatchObject({ rootCharged: 0, grant: null });
  const operations = f.db.prepare("SELECT kind, credits FROM task_budget_operations ORDER BY task_id").all();
  expect(operations).toEqual([
    { kind: "adoption", credits: 0 },
    { kind: "adoption", credits: 0 },
  ]);
  const claim = f.claim("work");
  expect(claim.kind).toBe("claimed");
  const executions = new TaskExecutionStore(f.db);
  expect(executions.usage({ kind: "root", root: f.root.root })).toEqual({ limit: 1, occupied: 1 });
  expect(f.claim("contribution")).toMatchObject({
    kind: "deferred",
    execution: { scope: { kind: "root", root: f.root.root } },
  });
  expect(f.accounting.budget.view(f.root.root, Date.now())).toMatchObject({ rootCharged: 1, grant: { charged: 1 } });
  expect(f.claim("unattributed")).toMatchObject({ kind: "deferred", funding: { reason: "adoption-required" } });
  expect(f.store.readAttempt(f.historical.attemptId)?.acceptedResult?.summary).toBe("Historical accepted evidence");
});

test("dry run validates the complete installation and leaves no policy, binding, receipt or Task mutation", () => {
  const f = fixture();
  const before = f.store.readTaskContext({ taskIds: ["work", "contribution"] });
  expect(f.install(f.plan(), true)).toEqual({ kind: "dry-run", appCount: 1, adoptionCount: 2 });
  expect(f.accounting.policy("sample")).toBeNull();
  expect(new TaskExecutionStore(f.db).configured()).toBe(false);
  expect(f.accounting.budget.binding(f.root.root)).toBeNull();
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()?.n).toBe(0);
  expect(f.store.readTaskContext({ taskIds: ["work", "contribution"] })).toEqual(before);
  expect(f.install().kind).toBe("installed");
});

test.each([
  "stale-fence",
  "missing-root-limit",
  "missing-root-adoption",
  "conflicting-root",
  "wrong-sponsor",
  "duplicate",
  "invalid-host",
  "unknown-field",
])("%s refuses or rolls back the complete installation", (kind) => {
  const f = fixture();
  const plan = f.plan();
  if (kind === "stale-fence") plan.adoptions[1]!.resourceVersion++;
  if (kind === "missing-root-limit")
    plan.policy.limits = plan.policy.limits.filter((limit) => limit.scope.kind !== "root");
  if (kind === "missing-root-adoption") plan.adoptions = plan.adoptions.slice(1);
  if (kind === "conflicting-root") plan.adoptions[1]!.root = { ...f.root, credits: 99 };
  if (kind === "wrong-sponsor") plan.adoptions[1]!.root = { ...f.root, sponsor: { appId: "sample", agent: "other" } };
  if (kind === "duplicate") plan.adoptions = [...plan.adoptions, plan.adoptions[0]!];
  if (kind === "invalid-host") plan.policy.host.slots = 0;
  if (kind === "unknown-field") Object.assign(plan.adoptions[0]!, { resourceVerison: 3 });
  expect(() => f.install(plan)).toThrow();
  expect(f.accounting.policy("sample")).toBeNull();
  expect(f.accounting.budget.binding(f.root.root)).toBeNull();
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()?.n).toBe(0);
  expect(f.db.prepare("SELECT count(*) AS n FROM task_execution_limits").get()?.n).toBe(0);
});

test("explicit adoption wakes the retained funding hold through canonical recovery without discarding caller admission", () => {
  const f = fixture();
  f.accounting.install(f.plan().policy.apps[0]!);
  expect(f.claim("work")).toMatchObject({ kind: "deferred", funding: { reason: "adoption-required" } });
  const before = f.store.readTaskContext({ taskIds: ["work"] }).appTaskAdmissions;
  expect(f.install().kind).toBe("installed");
  expect(f.store.readTask("work")?.status.funding).toBeUndefined();
  expect(f.store.listRecoveryCandidates().items.map((item) => item.taskId)).toContain("work");
  expect(f.store.readTaskContext({ taskIds: ["work"] }).appTaskAdmissions).toEqual(before);
  expect(f.claim("work").kind).toBe("claimed");
});

test.each(["valid", "changed-method", "ordinary-attribution"])(
  "retained protected coordination uses the same eligibility policy: %s",
  (kind) => {
    const f = fixture();
    const taskId = "runtime/review";
    const policy = {
      taskId,
      workflow: "workload-review",
      agent: "owner",
      maxAttemptMs: 60_000,
      dailyCredits: 3,
      credits: 3,
    };
    observeAppTaskIntent(f.config, {
      appAgent: "owner",
      intent: {
        id: taskId,
        parentId: "root",
        workflow: kind === "changed-method" ? "other" : policy.workflow,
        outcome: "Review commitments",
        acceptance: ["Commitments preserved"],
      },
    });
    const resource = f.store.readTask(taskId)!;
    const plan = f.plan();
    plan.policy.apps[0]!.coordination = policy;
    const root = {
      ...f.root,
      root: { appId: "sample", taskId },
      credits: 3,
      purpose: kind === "ordinary-attribution" ? ("ordinary" as const) : ("coordination" as const),
      renewal: kind === "ordinary-attribution" ? ("lifetime" as const) : ("utc-day" as const),
    };
    plan.policy.limits = [...plan.policy.limits, { scope: { kind: "root", root: root.root }, slots: 2 }];
    plan.adoptions = [
      ...plan.adoptions,
      {
        task: root.root,
        root,
        generation: resource.metadata.generation,
        resourceVersion: resource.metadata.resourceVersion,
        adoptionId: "installation:coordination",
        reason: "Retain coordination",
      },
    ];
    if (kind !== "valid") {
      expect(() => f.install(plan)).toThrow();
      expect(f.accounting.policy("sample")).toBeNull();
      expect(f.accounting.budget.binding(f.root.root)).toBeNull();
      return;
    }
    expect(f.install(plan).adoptionCount).toBe(3);
    expect(f.accounting.budget.view(root.root, Date.now())).toMatchObject({
      purpose: "coordination",
      rootCharged: 0,
      grant: null,
    });
    expect(
      claimObservedAppTask(f.config, {
        taskId,
        appAgent: "owner",
        handler: `workflow:${policy.workflow}`,
        execution: { recipient: () => recipient, lane: "coordination" },
      }).kind,
    ).toBe("claimed");
    expect(f.accounting.budget.view(root.root, Date.now())).toMatchObject({
      rootCharged: 1,
      grant: { credits: 3, charged: 1 },
    });
  },
);

test.each(["running", "missing-meta", "corrupt-meta", "active", "started", "descendant", "corrupt-descendant"])(
  "retained %s session evidence requires explicit recovery even with no running Task rows",
  (kind) => {
    const f = fixture();
    const meta = { agent: "owner", task: "Historical session", status: "done" as const, startedAt: Date.now() };
    writeSessionMeta(f.state, "retained", kind === "running" ? { ...meta, status: "running" } : meta);
    const directory = sessionDir(f.state, "retained");
    if (kind === "missing-meta") rmSync(join(directory, "meta.json"));
    if (kind === "corrupt-meta") writeFileSync(join(directory, "meta.json"), "{");
    if (kind === "active") writeFileSync(join(directory, "[ACTIVE]"), "legacy marker");
    if (kind === "started") writeFileSync(join(directory, "[STARTED]"), "legacy marker");
    if (kind === "descendant") writeFileSync(join(directory, "bash-process-groups.json"), '{"pgids":[1]}');
    if (kind === "corrupt-descendant") writeFileSync(join(directory, "bash-process-groups.json"), "{");
    const snapshot = () =>
      readdirSync(directory)
        .sort()
        .map((name) => [name, readFileSync(join(directory, name), "utf8")]);
    const before = snapshot();
    expect(() => f.install()).toThrow(/cleanup/);
    expect(f.accounting.policy("sample")).toBeNull();
    expect(snapshot()).toEqual(before);
  },
);

test("ended Tasks with unjoined execution remain blockers; offline installation does not release reservations", () => {
  const f = fixture();
  f.add("live");
  const claim = f.claim("live");
  if (claim.kind !== "claimed") throw new Error("Expected claim");
  expect(() => f.install()).toThrow("running attempts");
  expect(f.accounting.policy("sample")).toBeNull();
  expect(f.store.readAttempt(claim.attemptId)?.state).toBe("running");
  const executions = new TaskExecutionStore(f.db);
  executions.installLimit({ kind: "host" }, 4, { backgroundSlots: 2 });
  executions.installLimit({ kind: "agent", recipient }, 2);
  const reserved = executions.reserve({
    operation: { kind: "attempt", task: { appId: "sample", taskId: "live" }, attemptId: claim.attemptId },
    recipient,
    lane: "background",
    ownerId: "retained-owner",
  });
  expect(reserved.kind).toBe("admitted");
  const resource = f.store.readTask("live")!;
  cancelAppTask(f.config, {
    appId: "sample",
    taskId: "live",
    expectedGeneration: resource.metadata.generation,
    expectedResourceVersion: resource.metadata.resourceVersion,
    reason: "Withdrawn",
  });
  expect(f.store.isCancelled("live")).toBe(true);
  expect(() => f.install()).toThrow("reservations");
  expect(executions.usage({ kind: "host" }).occupied).toBe(1);
  expect(f.accounting.policy("sample")).toBeNull();
});

test("the source command requires operator isolation, preserves the existing database and survives an ordinary reopen", async () => {
  const f = fixture();
  const plan = join(f.state, "installation.json");
  writeFileSync(plan, JSON.stringify(f.plan()));
  const before = f.store.readTaskContext({ taskIds: ["work", "contribution"] });
  closeDb(f.state);
  const command = new URL("../../../scripts/operations/install-retained-workload-state.ts", import.meta.url).pathname;
  const run = promisify(execFile);
  const args = [command, "--state-dir", f.state, "--plan", plan];
  await expect(run(process.execPath, args, { timeout: 10_000 })).rejects.toThrow("Usage");
  const dryRun = await run(process.execPath, [...args, "--confirm-quiesced", "--dry-run"], { timeout: 10_000 });
  expect(JSON.parse(dryRun.stdout).kind).toBe("dry-run");
  const actual = await run(process.execPath, [...args, "--confirm-quiesced"], { timeout: 10_000 });
  expect(JSON.parse(actual.stdout).kind).toBe("installed");
  const db = getDb(f.state);
  expect(new TaskExecutionStore(db).hostPolicy()).toEqual({ maxConcurrent: 4, backgroundMaxConcurrent: 2 });
  const store = AppTaskResourceStore.fromDb(db, "sample");
  expect(store.readAttempt(f.historical.attemptId)?.acceptedResult?.summary).toBe("Historical accepted evidence");
  expect(store.readTaskContext({ taskIds: ["work", "contribution"] })).toEqual(before);
});

test("a terminal historical session with a live external owner is refused until the real process exits", async () => {
  const f = fixture();
  const persistence = JSON.stringify(new URL("../../lib/persistence.ts", import.meta.url).href);
  const processIdentity = JSON.stringify(new URL("../../lib/process-identity.ts", import.meta.url).href);
  const child = spawnFixtureProcess([
    "--eval",
    `
    import { writeSessionMeta } from ${persistence};
    import { currentProcessInstance } from ${processIdentity};
    writeSessionMeta(${JSON.stringify(f.state)}, "retained", { agent: "owner", task: "Retained",
      status: "done", startedAt: Date.now(), detached: true, pid: process.pid });
    process.stdout.write(JSON.stringify(currentProcessInstance()) + "\\n");
  `,
  ]);
  const closed = once(child, "close");
  cleanups.push(async () => {
    child.stdin.end();
    await closed;
  });
  const ready = Promise.withResolvers<ProcessInstance>();
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    if (stdout.includes("\n")) ready.resolve(JSON.parse(stdout.trim()));
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  child.on("error", ready.reject);
  child.on("close", () => {
    if (!stdout.includes("\n")) ready.reject(new Error(stderr || "Worker exited before readiness"));
  });
  const owner = await ready.promise;
  expect(isProcessInstanceAlive(owner)).toBe(true);
  expect(f.db.prepare("SELECT 1 FROM app_task_attempts WHERE state = 'running'").get()).toBeNull();
  expect(() => f.install()).toThrow("confirmed cleanup");
  expect(f.accounting.policy("sample")).toBeNull();
  child.stdin.end();
  await closed;
  expect(isProcessInstanceAlive(owner)).toBe(false);
  expect(f.install().kind).toBe("installed");
}, 15_000);

test("a different database cannot borrow clean session evidence from another state directory", () => {
  const f = fixture();
  const other = fixture();
  expect(() => installRetainedWorkloadState(f.db, other.state, f.plan(), { quiesced: true })).toThrow("exact database");
  expect(f.accounting.policy("sample")).toBeNull();
});
