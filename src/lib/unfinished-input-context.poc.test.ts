import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { admitTaskInput } from "../app/core/state/inbox.js";
import { readRuntimeTaskView } from "../app/core/reads/app-read.js";
import { appTaskTestContext } from "../app/core/tasks/app-task-test-support.js";
import { readAppTaskReconciliationEvents } from "../app/core/tasks/app-task-context.js";
import { appTaskContext, claimObservedAppTask, completeAppTask, deferAppTask,
  observeAppTaskIntent, readAppTaskAdmissionOutcome } from "../app/core/tasks/app-task-reconciler.js";
import { createTaskDecisionContext } from "./task-decision-context.js";
import { prepareTaskWorkspaceContext } from "./task-workspace-context.js";
import type { TaskExecutionContext } from "./task-execution-context.js";

// Characterization switch changes assertions, never the production behavior.
const candidate = process.env.POC_WORK_CONTEXT === "1";
const cleanup: Array<() => void> = [];
afterEach(() => { for (const close of cleanup.splice(0)) close(); });

function fixture(count = 6) {
  const root = mkdtempSync(join(tmpdir(), "unfinished-input-poc-"));
  const databasePath = join(root, "state.db");
  let config = appTaskTestContext({ appDir: root, databasePath, agent: "owner", maxConcurrent: 1,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } } });
  cleanup.push(() => { config.resourceStore.close(); rmSync(root, { recursive: true, force: true }); });
  observeAppTaskIntent(config, { appAgent: "owner", intent: { id: "work", parentId: "root",
    outcome: "Repair and review the report", acceptance: ["Address the actual requirements"], agent: "owner" } });
  const keys = Array.from({ length: count }, (_, i) => `input-${String(i).padStart(3, "0")}`);
  for (const key of keys) admitTaskInput(config, { appId: "sample", attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: key, inputContext: { id: key, source: { kind: "human", id: "requester" },
      input: { kind: "message", data: { message: `Requirement ${key}: ${"retained detail ".repeat(80)}` } } } });
  const claim = () => {
    const value = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
    if (value.kind !== "claimed") throw new Error(`Expected claim, got ${value.kind}`);
    return value;
  };
  const read = () => readRuntimeTaskView({ taskStateConfig: config }, "work")!;
  const brief = async (c: ReturnType<typeof claim>) => {
    const task = read();
    const context = {
      taskBinding: { appId: "sample", taskId: "work", generation: c.generation, attemptId: c.attemptId },
      recoveryOwner: "app-task", executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
      reconciliation: { task, appId: "sample", taskId: "work", generation: c.generation,
        resourceVersion: task.resourceVersion, agent: "owner", outcome: task.outcome, acceptance: task.acceptance,
        input: task.input, previousAttempt: c.previousAttempt, events: readAppTaskReconciliationEvents(config.resourceStore, c),
        waits: { open: [], note: "snapshot" }, children: { live: [], completed: [] } },
      taskRead: { get: async () => read() }, details: { task, declaredOutputs: [] },
    } as unknown as TaskExecutionContext;
    const entry = prepareTaskWorkspaceContext(context, root, []);
    const message = await createTaskDecisionContext(context)();
    const content = message.content;
    if (!Array.isArray(content)) throw new Error("Expected text blocks");
    const text = content.find(b => b.type === "text");
    if (!text || text.type !== "text") throw new Error("Expected brief");
    const packet = JSON.parse(text.text.slice(text.text.indexOf("\n{")));
    return { packet, bytes: Buffer.byteLength(text.text), detail: readFileSync(packet.coverage.detail, "utf8"),
      entry: "taskFile" in entry ? readFileSync(entry.taskFile, "utf8") : entry.error };
  };
  return { get config() { return config; }, keys, claim, brief, read,
    reopen() { config.resourceStore.close(); config = appTaskContext({ appDir: root, projectDir: root,
      agent: "owner", maxConcurrent: 1, resourceStore: AppTaskResourceStore.openStandalone(databasePath, "sample") }); } };
}

test("PoC: repeated empty convergence stays accountable, even if the worker ignores the improved context", async () => {
  const f = fixture();
  const remaining: number[] = [];
  for (let i = 0; i < 3; i++) {
    completeAppTask(f.config, f.claim(), { summary: "Already done", inputKeys: [], facts: ["Previous report retained"] });
    f.reopen();
    remaining.push(Object.keys(f.config.resourceStore.readTask("work")!.status.inputWaits!).length);
  }
  const next = f.claim();
  expect(next.previousAttempt?.acceptedResult).toMatchObject({ state: "converged", summary: "Already done" });
  expect(next.previousAttempt?.acceptedResult).toHaveProperty("facts");
  const p = await f.brief(next);
  expect(p.packet.work?.previousResult.coveredInputs).toBe(candidate ? 0 : undefined);
  if (candidate) {
    expect(p.packet.work.assignedAtStart).toMatchObject({ newEvents: 0, continuingInputs: 6 });
    expect(p.packet.work.retainedInputs).toMatchObject({ observed: 6, pendingWork: 6, truncated: false });
    expect(next.previousAttempt?.acceptedResult).toHaveProperty("inputKeys", []);
    expect(p.entry).toContain("6 earlier unanswered inputs");
  }
  expect(remaining).toEqual([6, 6, 6]);
  console.log(JSON.stringify({ case: "worker-repeats", candidate, remaining, work: p.packet.work ?? null }));
});

test("PoC: reconcile existing evidence for a subset; unfinished work and accepted partial progress survive restart", async () => {
  const f = fixture();
  completeAppTask(f.config, f.claim(), { summary: "Draft saved; requirements not yet answered", inputKeys: [],
    facts: ["draft:prepared"], result: { draft: "draft-v1" } });
  const next = f.claim();
  const before = await f.brief(next);
  expect(before.packet.current.result).toEqual({ draft: "draft-v1" });
  const originals = readRuntimeTaskView({ taskStateConfig: f.config }, "work", { inputKeys: f.keys })!.inputEvents!;
  expect(originals.map(x => x.key)).toEqual(f.keys);
  completeAppTask(f.config, next, { summary: "First three requirements covered by reviewed draft", inputKeys: f.keys.slice(0, 3),
    facts: ["draft:reviewed", "Remaining requirements need additional tests"] });
  f.reopen();
  const remainder = f.claim();
  expect(remainder.continuedInputKeys).toEqual(f.keys.slice(3));
  for (const key of f.keys.slice(0, 3)) expect(readAppTaskAdmissionOutcome(f.config, "work", key)?.attemptId).toBe(next.attemptId);
  for (const key of f.keys.slice(3)) expect(readAppTaskAdmissionOutcome(f.config, "work", key)).toBeNull();
  const after = await f.brief(remainder);
  expect(after.packet.work?.previousResult.coveredInputs).toBe(candidate ? 3 : undefined);
  console.log(JSON.stringify({ case: "scripted-subset-judgment", candidate, settled: 3, remaining: remainder.continuedInputKeys?.length }));
});

test("PoC: a waiting result's scope is not completion; genuine waits do not keep the owner runnable", async () => {
  const f = fixture(2);
  deferAppTask(f.config, f.claim(), { disposition: "waiting", summary: "Prepare independent work while review runs", continue: true,
    conditions: [{ id: "review", type: "review.ready", subject: "draft:v1", expected: true, owner: "app:reviewer", reviewAfterMs: 60_000 }] });
  f.reopen();
  const c = f.claim();
  const p = await f.brief(c);
  expect(p.packet.work?.previousResult.state).toBe(candidate ? "waiting" : undefined);
  if (candidate) expect(p.packet.work.previousResult).toMatchObject({ coveredInputs: 2, continue: true });
  for (const key of f.keys) expect(readAppTaskAdmissionOutcome(f.config, "work", key)).toBeNull();
  deferAppTask(f.config, c, { disposition: "waiting", summary: "Independent work ready; only review remains" });
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" }).kind).toBe("waiting");
});

test("PoC: a large carried-over assignment remains discoverable through ordinary reads", async () => {
  const f = fixture(90);
  // Drain the bounded event batches, preserving every input. This does not judge fulfillment.
  for (let i = 0; i < 3; i++) completeAppTask(f.config, f.claim(), { summary: "Prior result", inputKeys: [] });
  f.reopen();
  const c = f.claim();
  expect(c.continuedInputKeys).toHaveLength(90);
  const p = await f.brief(c);
  const longest = Math.max(...p.detail.split("\n").map(line => Buffer.byteLength(line)));
  expect(longest < 50 * 1024).toBe(candidate);
  expect(p.bytes).toBeLessThan(18 * 1024);
  if (candidate) expect(p.packet.work.assignedAtStart.continuingInputs).toBe(90);
  const originals = readRuntimeTaskView({ taskStateConfig: f.config }, "work", { inputKeys: f.keys.slice(-8) })!.inputEvents!;
  expect(originals.map(x => x.key)).toEqual(f.keys.slice(-8));
  console.log(JSON.stringify({ case: "large-backlog", candidate, assigned: 90, promptBytes: p.bytes, longestDetailLineBytes: longest }));
});
