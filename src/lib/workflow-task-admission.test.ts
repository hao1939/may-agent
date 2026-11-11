import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../app/core/events/bus.js";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "../app/core/state/task-budget-admission.js";
import { releaseJoinedTaskAttemptExecution } from "../app/core/state/task-execution-cleanup.js";
import { TaskExecutionStore } from "../app/core/state/task-execution-store.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  observeAppTaskIntent,
} from "../app/core/tasks/app-task-reconciler.js";
import { closeDb, getDb } from "./db/connection.js";
import type { TaskBinding } from "./persistence.js";
import { buildRuntimeCtx } from "./runtime-ctx.js";
import { createWorkflowRunner, createWorkflowTool, runWorkflowDirect } from "./workflow-tool.js";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
});

function textResult(response: Awaited<ReturnType<ReturnType<typeof createWorkflowTool>["execute"]>>) {
  const part = response.content[0];
  if (part.type !== "text") throw new Error("Expected structured workflow result");
  return JSON.parse(part.text);
}

function fixture(throws = false) {
  const root = mkdtempSync(join(tmpdir(), "may-workflow-admission-"));
  cleanups.push(() => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
  const db = getDb(root);
  const workflowDir = join(root, "workflows");
  mkdirSync(workflowDir);
  const marker = join(root, "execution.txt");
  writeFileSync(
    join(workflowDir, "inspect.ts"),
    `
import { appendFileSync } from "node:fs";
export const name = "inspect";
export const description = "Run code without a managed agent";
export function execute(ctx) {
  appendFileSync(${JSON.stringify(marker)}, "executed\\n");
  ${throws ? 'throw new Error("Unfinished execution");' : 'return ctx.done("Executed code");'}
}
`,
  );
  const runtimeCtx = buildRuntimeCtx({
    bus: new EventBus(),
    persistDir: root,
    projectRoot: root,
    agentsRoot: root,
    sharedRoot: root,
    projectsRoot: root,
    agentName: "owner",
  });
  const options = { manager: {} as never, persistDir: root, workflowDir, runtimeCtx, agentName: "owner" };
  const configure = () => new TaskExecutionStore(db).installLimit({ kind: "host" }, 4, { backgroundSlots: 2 });
  return { root, db, marker, options, configure };
}

test.each(["typed", "model", "direct", "typed-context-only"])(
  "installed limits reject an unbound %s workflow before authored execution",
  async (route) => {
    const f = fixture();
    f.configure();
    const events: string[] = [];
    const options = {
      ...f.options,
      onEvent: (event: { type: string }) => {
        events.push(event.type);
      },
      ...(route === "typed-context-only" ? { persistDir: undefined } : {}),
    };
    if (route === "direct") {
      await expect(
        runWorkflowDirect({ ...options, persistDir: f.root, workflowName: "inspect", task: "Inspect" }),
      ).rejects.toThrow("Task");
    } else {
      const result =
        route === "model"
          ? textResult(await createWorkflowTool(options).execute("run", { action: "run", name: "inspect", input: {} }))
          : await createWorkflowRunner(options).run("inspect", "Inspect");
      expect(result).toMatchObject({ type: "error", error: expect.stringContaining("Task") });
    }
    expect(existsSync(f.marker)).toBe(false);
    expect(events).toEqual([]);
    expect(f.db.prepare("SELECT count(*) AS n FROM workflow_runs").get()?.n).toBe(0);
  },
);

test("retired replay cannot execute a failed historical workflow again", async () => {
  const f = fixture(true);
  const first = await createWorkflowRunner(f.options).run("inspect", "Inspect");
  if (first.type !== "error" || !first.workflowRunId) throw new Error("Expected retained unfinished workflow");
  expect(readFileSync(f.marker, "utf8")).toBe("executed\n");
  f.configure();
  const response = await createWorkflowTool(f.options).execute("resume", {
    action: "resume",
    workflowRunId: first.workflowRunId,
  });
  const result = textResult(response);
  expect(result).toMatchObject({ error: "Unknown action: resume" });
  expect(readFileSync(f.marker, "utf8")).toBe("executed\n");
  expect(f.db.prepare("SELECT count(*) AS n FROM workflow_runs").get()?.n).toBe(1);
});

test("unconfigured execution remains available and history remains readable without replay", async () => {
  const f = fixture();
  const first = await createWorkflowRunner(f.options).run("inspect", "Inspect");
  if (first.type !== "done") throw new Error("Expected initial completion");
  f.configure();
  const response = await createWorkflowTool(f.options).execute("resume", {
    action: "resume",
    workflowRunId: first.workflowRunId,
  });
  expect(textResult(response)).toMatchObject({ error: "Unknown action: resume" });
  expect(f.db.prepare("SELECT status FROM workflow_runs").get()?.status).toBe("done");
  expect(readFileSync(f.marker, "utf8")).toBe("executed\n");
  expect(f.db.prepare("SELECT count(*) AS n FROM workflow_runs").get()?.n).toBe(1);
});

function fundedTask(f: ReturnType<typeof fixture>, bounded: boolean) {
  const admission = new TaskBudgetAdmissionStore(f.db);
  admission.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "owner" },
    dailyCredits: 10,
    rootCredits: 10,
  });
  const store = AppTaskResourceStore.fromDb(f.db, "sample");
  store.bootstrapSnapshot({ project: "sample", groups: { root: { id: "root", parent_id: null } } }, "seed");
  const config = appTaskContext({
    appDir: join(f.root, "sample.app"),
    projectDir: f.root,
    agent: "owner",
    resourceStore: store,
  });
  observeAppTaskIntent(config, {
    appAgent: "owner",
    intent: { id: "work", parentId: "root", outcome: "Collect facts", acceptance: ["Facts retained"] },
  });
  const recipient = { kind: "programmatic" as const, id: "fixture/owner" };
  if (bounded) {
    f.configure();
    const execution = new TaskExecutionStore(f.db);
    execution.installLimit({ kind: "agent", recipient }, 2);
    execution.installLimit({ kind: "root", root: { appId: "sample", taskId: "work" } }, 1);
  }
  const claim = claimObservedAppTask(config, {
    taskId: "work",
    appAgent: "owner",
    handler: "workflow:inspect",
    ...(bounded ? { execution: { recipient: () => recipient, lane: "background" as const } } : {}),
  });
  if (claim.kind !== "claimed") throw new Error("Expected paid Task claim");
  const binding: TaskBinding = {
    appId: "sample",
    taskId: "work",
    generation: claim.generation,
    attemptId: claim.attemptId,
  };
  return { admission, store, config, claim, binding };
}

test("a legacy paid attempt cannot start code after limits are installed without its execution reservation", async () => {
  const f = fixture();
  const task = fundedTask(f, false);
  f.configure();
  const result = await createWorkflowRunner({ ...f.options, taskBinding: task.binding }).run("inspect", "Inspect");
  expect(result).toMatchObject({ type: "error", error: expect.stringContaining("active local claim") });
  expect(existsSync(f.marker)).toBe(false);
  expect(task.admission.budget.view(task.binding, Date.now())?.rootCharged).toBe(2);
});

test.each(["cancelled", "released"])(
  "a %s Task attempt cannot lend its old authority to workflow code",
  async (mode) => {
    const f = fixture();
    const task = fundedTask(f, true);
    if (mode === "cancelled") {
      const resource = task.store.readTask("work")!;
      cancelAppTask(task.config, {
        appId: "sample",
        taskId: "work",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
        reason: "Withdrawn",
      });
    } else {
      expect(releaseJoinedTaskAttemptExecution(f.db, task.binding, task.binding.attemptId)).toBe(true);
    }
    const result = await createWorkflowRunner({ ...f.options, taskBinding: task.binding }).run("inspect", "Inspect");
    expect(result.type).toBe("error");
    expect(existsSync(f.marker)).toBe(false);
    expect(f.db.prepare("SELECT count(*) AS n FROM workflow_runs").get()?.n).toBe(0);
    expect(task.admission.budget.view(task.binding, Date.now())?.rootCharged).toBe(2);
  },
);

test("current parent and nested workflows reuse their paid Task attempt without another credit or execution reservation", async () => {
  const f = fixture();
  const task = fundedTask(f, true);
  writeFileSync(
    join(f.options.workflowDir, "parent.ts"),
    `
export const name = "parent";
export const description = "Run a nested method in the same attempt";
export async function execute(ctx) { const result = await ctx.workflows.run("inspect", {}); return ctx.done(result.summary); }
`,
  );
  const result = await createWorkflowRunner({ ...f.options, taskBinding: task.binding }).run("parent", "Inspect");
  expect(result).toMatchObject({ type: "done", summary: "Executed code" });
  expect(readFileSync(f.marker, "utf8")).toBe("executed\n");
  expect(f.db.prepare("SELECT count(*) AS n FROM workflow_runs").get()?.n).toBe(2);
  expect(task.admission.budget.view(task.binding, Date.now())?.rootCharged).toBe(2);
  expect(new TaskExecutionStore(f.db).usage({ kind: "root", root: task.binding })).toEqual({ limit: 1, occupied: 1 });
});

test("nested workflow code rechecks current authority if its parent is cancelled during execution", async () => {
  const f = fixture();
  const task = fundedTask(f, true);
  f.options.runtimeCtx.log = () => {
    const resource = task.store.readTask("work")!;
    cancelAppTask(task.config, {
      appId: "sample",
      taskId: "work",
      expectedGeneration: resource.metadata.generation,
      expectedResourceVersion: resource.metadata.resourceVersion,
      reason: "Withdrawn before nested execution",
    });
  };
  writeFileSync(
    join(f.options.workflowDir, "parent.ts"),
    `
export const name = "parent";
export const description = "Start a nested method after parent cancellation";
export async function execute(ctx) { ctx.log.info("Cancel now"); await ctx.workflows.run("inspect", {}); return ctx.done("Unexpected execution"); }
`,
  );
  const result = await createWorkflowRunner({ ...f.options, taskBinding: task.binding }).run("parent", "Inspect");
  expect(result).toMatchObject({ type: "error", error: expect.stringContaining("no longer current") });
  expect(existsSync(f.marker)).toBe(false);
  expect(f.db.prepare("SELECT count(*) AS n FROM workflow_runs").get()?.n).toBe(1);
  expect(task.store.isCancelled("work")).toBe(true);
  expect(task.admission.budget.view(task.binding, Date.now())?.rootCharged).toBe(2);
  expect(new TaskExecutionStore(f.db).usage({ kind: "host" }).occupied).toBe(1);
});
