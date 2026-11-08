import { afterEach, expect, spyOn, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { defineApp, Type } from "@may-agent/sdk";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { markSessionActive, writeSessionMeta } from "../../lib/persistence.js";
import { createWorkflowRunner } from "../../lib/workflow-tool.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "../core/state/task-budget-admission.js";
import { changeTaskBudgetDailyCredits, changeTaskBudgetRootCredits } from "../core/state/task-budget-funding.js";
import { admitManagedTaskStart, assertManagedTaskContinuation, assertTaskWorkflowStart } from "../core/state/task-budget-managed-start.js";
import { releaseJoinedTaskAttemptExecution } from "../core/state/task-execution-cleanup.js";
import { TaskExecutionStore } from "../core/state/task-execution-store.js";
import { readWorkloadWithdrawal, workloadEnforcementEnabled } from "../core/state/task-workload-enforcement.js";
import { appTaskContext, observeAppTaskIntent, claimObservedAppTask, completeAppTask, cancelAppTask, failAppTaskAttempt, refreshTaskWorkspaceConstraint } from "../core/tasks/app-task-reconciler.js";
import { AppInboxHost } from "../core/inbox/app-inbox-host.js";
import { readTaskWorkload } from "../core/reads/task-workload.js";
import { admitTaskInput } from "../core/state/inbox.js";
import { inspectWorkloadConfiguration, withdrawWorkloadEnforcement } from "./withdraw-workload-enforcement.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const close of cleanups.splice(0)) close(); });

function fixture(active = false) {
  const state = mkdtempSync(join(tmpdir(), "may-withdraw-workload-"));
  const db = getDb(state);
  cleanups.push(() => { closeDb(state); rmSync(state, { recursive: true, force: true }); });
  const budgets = new TaskBudgetAdmissionStore(db);
  const policy = { appId: "sample", sponsor: { appId: "sample", agent: "owner" }, dailyCredits: 2, rootCredits: 2, rootExecutionSlots: 2 };
  budgets.install(policy);
  const executions = new TaskExecutionStore(db);
  const recipient = { kind: "programmatic" as const, id: "fixture/owner" };
  executions.installLimit({ kind: "host" }, 2, { backgroundSlots: 1 });
  executions.installLimit({ kind: "agent", recipient }, 2);
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.bootstrapSnapshot({ project: "sample", groups: { root: { id: "root", parent_id: null } } }, "seed");
  const config = appTaskContext({ appDir: join(state, "sample.app"), projectDir: state, agent: "owner", resourceStore: store });
  const add = (id: string, creator?: { appId: string; taskId: string }) => observeAppTaskIntent(config, {
    appAgent: "owner", creator, intent: { id, parentId: "root", outcome: "Collect facts", acceptance: ["Facts retained"] },
  });
  const claim = () => claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent",
    execution: { recipient: () => recipient, lane: "background" } });
  add("work");
  const historical = claim();
  if (historical.kind !== "claimed") throw new Error("Expected funded claim");
  const task = { appId: "sample", taskId: "work" };
  if (!active) {
    completeAppTask(config, historical, { summary: "Historical accepted evidence" });
    if (!releaseJoinedTaskAttemptExecution(db, task, historical.attemptId)) throw new Error("Expected confirmed local join");
    admitTaskInput(config, { appId: "sample", attachment: { kind: "existing", taskId: "work" }, idempotencyKey: "retained-caller",
      inputContext: { id: "retained-caller", source: { kind: "human", id: "person" }, input: { kind: "inspect", data: {} } } });
    if (claim().kind !== "deferred") throw new Error("Expected exhausted allowance");
  }
  const command = () => ({ version: 1 as const, operationId: "withdraw-pilot", reason: "End the reviewed workload pilot",
    expectedConfigurationDigest: inspectWorkloadConfiguration(db).configurationDigest });
  const withdraw = (input: unknown = command(), dryRun = false) => withdrawWorkloadEnforcement(db, state, input, { quiesced: true, dryRun });
  const accountingSnapshot = () => ["task_budget_policies", "task_credit_grants", "task_budget_roots", "task_budget_root_balances",
    "task_budget_bindings", "task_budget_operations", "task_budget_funding_receipts", "task_execution_limits", "task_execution_reservations",
    "task_budget_managed_starts"].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]);
  return { state, db, budgets, policy, executions, recipient, store, config, add, claim, task, historical, command, withdraw, accountingSnapshot };
}

test("offline withdrawal preserves all accounting history and caller obligations, wakes held work and stops new enforcement", () => {
  const f = fixture();
  const before = f.accountingSnapshot();
  const caller = f.store.readTaskContext({ taskIds: ["work"] }).appTaskAdmissions;
  expect(f.withdraw()).toMatchObject({ kind: "withdrawn", replay: false, receipt: { command: f.command() } });
  expect(f.accountingSnapshot()).toEqual(before);
  expect(f.store.readTask("work")?.status.funding).toBeUndefined();
  expect(f.store.listRecoveryCandidates().items.map(item => item.taskId)).toContain("work");
  expect(f.store.readTaskContext({ taskIds: ["work"] }).appTaskAdmissions).toEqual(caller);
  expect(f.executions.configured()).toBe(false);
  expect(f.claim().kind).toBe("claimed");
  expect(f.accountingSnapshot()).toEqual(before);
  f.add("new-root");
  f.add("new-child", f.task);
  expect(f.budgets.budget.binding({ appId: "sample", taskId: "new-root" })).toBeNull();
  expect(f.budgets.budget.binding({ appId: "sample", taskId: "new-child" })).toBeNull();
  expect(f.accountingSnapshot()).toEqual(before);
  const workload = readTaskWorkload({ taskStateConfig: f.config, workloadSource: { currentTaskId: "work", executionRecipient: () => f.recipient } });
  expect(workload.funding).toEqual({ ordinary: { available: false }, currentRoot: { available: false } });
  expect(workload.limits.sharedHost).toEqual({ available: false });
  expect(workload.limits.root).toEqual({ available: false });
});

test("dry run and a failed recovery wake roll back the withdrawal marker and every Task change", () => {
  const f = fixture();
  const resource = f.store.readTask("work");
  const before = f.accountingSnapshot();
  expect(f.withdraw(f.command(), true).kind).toBe("dry-run");
  expect(readWorkloadWithdrawal(f.db)).toBeNull();
  expect(f.store.readTask("work")).toEqual(resource);
  const commit = spyOn(AppTaskResourceStore.prototype, "commit").mockReturnValue(false);
  try { expect(() => f.withdraw()).toThrow("resource fence"); } finally { commit.mockRestore(); }
  expect(readWorkloadWithdrawal(f.db)).toBeNull();
  expect(f.accountingSnapshot()).toEqual(before);
  expect(f.store.readTask("work")).toEqual(resource);
  expect(f.executions.configured()).toBe(true);
});

test("withdrawal wakes the saved unfunded Inbox input through ordinary admission without fulfilling it", async () => {
  const f = fixture();
  const definition = defineApp({
    id: "sample", version: 1, agent: "owner", tasks: {},
    inputSchema: Type.Object({ kind: Type.Literal("work"), data: Type.Object({}) }),
    task: input => ({ kind: "desired", intent: { id: input.id, parentId: "root",
      outcome: "Collect facts", acceptance: ["Facts retained"] } }),
  });
  const host = new AppInboxHost({ db: f.db, apps: [definition], attachTask: input => admitTaskInput(f.config, input) });
  try {
    const request = { id: "retained-input", appId: "sample", source: { kind: "app" as const, id: "caller" },
      input: { kind: "work", data: {} } };
    const held = host.admit(request).item;
    expect(held.handling).toMatchObject({ phase: "deferred", funding: { reason: "sponsor-credit" } });
    expect(f.store.readTask(request.id)).toBeNull();
    const before = f.accountingSnapshot();
    f.withdraw();
    expect(host.get(request.id)).toMatchObject({ source: held.source, input: held.input, status: "pending" });
    expect(host.get(request.id)?.handling).toBeUndefined();
    await host.recoverAdmissions();
    expect(host.get(request.id)).toMatchObject({ status: "handling", waitingOn: { kind: "task", id: request.id } });
    expect(host.get(request.id)?.result).toBeUndefined();
    expect(f.store.readTask(request.id)?.status.phase).toBe("pending");
    expect(f.accountingSnapshot()).toEqual(before);
  } finally { host.close(); }
});

test("withdrawal clears funding holds while preserving App pause and exhausted retry authority", () => {
  const paused = fixture();
  paused.store.setProjectLifecycle("paused");
  paused.withdraw();
  expect(paused.store.projectLifecycle()).toBe("paused");
  expect(paused.claim().kind).toBe("waiting");
  expect(paused.store.readTask("work")?.status.funding).toBeUndefined();

  const exhausted = fixture(true);
  exhausted.config.maxConsecutiveFailures = 1;
  failAppTaskAttempt(exhausted.config, exhausted.historical, "Requires owner repair");
  releaseJoinedTaskAttemptExecution(exhausted.db, exhausted.task, exhausted.historical.attemptId);
  const before = exhausted.store.readTask("work");
  expect(before?.status.retryExhausted).toMatchObject({ failures: 1, limit: 1 });
  exhausted.withdraw();
  expect(exhausted.store.readTask("work")).toEqual(before);
  expect(exhausted.claim().kind).toBe("attention");
});

test("withdrawal clears an execution admission hold while preserving the operation's workspace prerequisite", () => {
  const f = fixture();
  changeTaskBudgetDailyCredits(f.db, { changeId: "fund-recheck", expected: f.policy, dailyCredits: 3, reason: "Fund one future check" });
  changeTaskBudgetRootCredits(f.db, { changeId: "fund-root-recheck", expected: f.budgets.budget.root(f.task)!, credits: 3,
    reason: "Fund one future check" });
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" })).toMatchObject({
    kind: "deferred", execution: { reason: "execution-recipient" },
  });
  const current = f.store.readTask("work")!;
  const workspace = { resource: "workspace" as const, reason: "workspace-capacity" as const,
    generation: current.metadata.generation, repoDir: join(f.state, "repo"), destinationPath: join(f.state, "checkout"),
    commit: "a".repeat(40), availableBytes: 0, requiredBytes: 4096, observedAt: Date.now(), retryAt: Date.now() + 60_000 };
  expect(refreshTaskWorkspaceConstraint(f.config, { ...f.task, generation: current.metadata.generation,
    resourceVersion: current.metadata.resourceVersion }, workspace)).toBe(true);
  const before = f.accountingSnapshot();
  f.withdraw();
  expect(f.store.readTask("work")?.status.executionConstraint).toBeUndefined();
  expect(f.store.readTask("work")?.status.workspaceConstraint).toEqual(workspace);
  expect(f.claim()).toMatchObject({ kind: "deferred", workspace });
  expect(f.accountingSnapshot()).toEqual(before);
});

test("exact receipt replay is read-only and cannot reactivate policy or change the withdrawal", () => {
  const f = fixture();
  const command = f.command();
  const first = f.withdraw(command);
  const changes = f.db.prepare("SELECT total_changes() AS n").get();
  expect(f.withdraw(command)).toEqual({ ...first, replay: true });
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(changes);
  expect(() => f.withdraw({ ...command, reason: "Another reason" })).toThrow("different withdrawal");
  expect(() => f.budgets.install(f.policy)).toThrow("reactivation");
  expect(() => f.executions.installLimit({ kind: "host" }, 2, { backgroundSlots: 1 })).toThrow("reactivation");
  expect(readWorkloadWithdrawal(f.db)).toEqual(first.receipt);
});

test("a changed root cap invalidates a reviewed withdrawal plan without losing the authorized funding change", () => {
  const f = fixture();
  const command = f.command();
  changeTaskBudgetRootCredits(f.db, { changeId: "authorized-funding", expected: f.budgets.budget.root(f.task)!, credits: 3,
    reason: "Authorized extra work" });
  expect(() => f.withdraw(command)).toThrow("configuration fence");
  expect(f.budgets.budget.root(f.task)?.credits).toBe(3);
  expect(readWorkloadWithdrawal(f.db)).toBeNull();
});

test("unclean execution cannot disappear from capacity through withdrawal", () => {
  const f = fixture(true);
  const before = f.accountingSnapshot();
  expect(() => f.withdraw()).toThrow("reservations");
  expect(f.executions.configured()).toBe(true);
  expect(f.executions.usage({ kind: "host" }).occupied).toBe(1);
  expect(readWorkloadWithdrawal(f.db)).toBeNull();
  expect(f.accountingSnapshot()).toEqual(before);
});

test("session cleanup remains a prerequisite after the Task execution was joined", () => {
  const f = fixture();
  writeSessionMeta(f.state, "retained", { agent: "owner", task: "Historical", status: "done", startedAt: Date.now() });
  markSessionActive(f.state, "retained");
  expect(() => f.withdraw()).toThrow("confirmed cleanup");
  expect(readWorkloadWithdrawal(f.db)).toBeNull();
});

test("withdrawal retains current Task authority for workflow and managed starts and cannot revive an ended execution", async () => {
  const f = fixture();
  f.withdraw();
  const claim = f.claim();
  if (claim.kind !== "claimed") throw new Error("Expected resumed work");
  const binding = { ...f.task, generation: claim.generation, attemptId: claim.attemptId };
  expect(admitManagedTaskStart(f.db, { sessionId: "not-started", binding })).toBeNull();
  expect(() => assertManagedTaskContinuation(f.db, { binding, running: false })).toThrow("running managed execution");
  writeFileSync(join(f.state, "inspect.ts"), 'export const name="inspect"; export const description="Inspect"; export function execute(ctx) { return ctx.done("Executed under current authority"); }');
  const runner = createWorkflowRunner({ manager: {} as never, workflowDir: f.state, persistDir: f.state, taskBinding: binding });
  expect(await runner.run("inspect", "Inspect")).toMatchObject({ type: "done", summary: "Executed under current authority" });
  const resource = f.store.readTask("work")!;
  cancelAppTask(f.config, { ...f.task, expectedGeneration: resource.metadata.generation,
    expectedResourceVersion: resource.metadata.resourceVersion, reason: "Withdrawn business request" });
  expect(() => assertTaskWorkflowStart(f.db, binding)).toThrow("no longer current");
  expect(() => admitManagedTaskStart(f.db, { sessionId: "not-started", binding })).toThrow("no longer current");
  expect(f.budgets.budget.view(f.task, Date.now())?.rootCharged).toBe(2);
});

test("a damaged withdrawal record cannot silently disable or reactivate enforcement", () => {
  const f = fixture();
  f.db.prepare("INSERT INTO task_workload_withdrawal(singleton, receipt_json) VALUES (1, 'null')").run();
  expect(() => workloadEnforcementEnabled(f.db)).toThrow("explicit recovery");
  expect(f.claim().kind).toBe("deferred");
  expect(() => f.add("new-work")).toThrow("explicit recovery");
});

test("invalid withdrawal commands and an absent offline confirmation make no changes", () => {
  const f = fixture();
  const before = f.accountingSnapshot();
  const resource = f.store.readTask("work");
  const valid = f.command();
  for (const command of [null, { ...valid, version: 2 }, { ...valid, operationId: " " },
    { ...valid, reason: "r".repeat(1025) }, { ...valid, expectedConfigurationDigest: "wrong" },
    { ...valid, extraAuthority: true }]) {
    expect(() => f.withdraw(command)).toThrow();
    expect(readWorkloadWithdrawal(f.db)).toBeNull();
  }
  expect(() => withdrawWorkloadEnforcement(f.db, f.state, valid, { quiesced: false } as never)).toThrow("quiesced");
  expect(f.accountingSnapshot()).toEqual(before);
  expect(f.store.readTask("work")).toEqual(resource);
});

test("the actual operator command inspects, dry-runs and withdraws without replacing existing state", async () => {
  const f = fixture();
  const command = f.command();
  const plan = join(f.state, "withdrawal.json");
  writeFileSync(plan, JSON.stringify(command));
  closeDb(f.state);
  const script = new URL("../../../scripts/operations/withdraw-workload-enforcement.ts", import.meta.url).pathname;
  const run = promisify(execFile);
  const inspect = await run(process.execPath, [script, "--state-dir", f.state, "--confirm-quiesced", "--inspect"], { timeout: 10_000 });
  expect(JSON.parse(inspect.stdout).configurationDigest).toBe(command.expectedConfigurationDigest);
  const args = [script, "--state-dir", f.state, "--plan", plan, "--confirm-quiesced"];
  expect(JSON.parse((await run(process.execPath, [...args, "--dry-run"], { timeout: 10_000 })).stdout).kind).toBe("dry-run");
  expect(JSON.parse((await run(process.execPath, args, { timeout: 10_000 })).stdout).kind).toBe("withdrawn");
  const db = getDb(f.state);
  expect(new TaskExecutionStore(db).configured()).toBe(false);
  expect(readWorkloadWithdrawal(db)?.command).toEqual(command);
  expect(AppTaskResourceStore.fromDb(db, "sample").readAttempt(f.historical.attemptId)?.acceptedResult?.summary).toBe("Historical accepted evidence");
});
