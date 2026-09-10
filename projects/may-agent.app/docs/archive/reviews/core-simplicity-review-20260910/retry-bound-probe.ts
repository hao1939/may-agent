// Component integration probe; no installed App, executor or external provider.
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const hostRoot = resolve(process.argv[2]);
const databasePath = resolve(process.argv[3]);
const mode = process.argv[4] ?? "initial";
assert.ok(mode === "initial" || mode === "restart");
const load = (path: string) => import(pathToFileURL(join(hostRoot, path)).href);
const { AppTaskController } = await load("src/app/app-task-controller.ts");
const { AppTaskRecoveryScheduler } = await load("src/app/app-task-recovery.ts");
const { AppTaskResourceStore } = await load("src/app/app-task-resource-store.ts");
const { appTaskContext, claimObservedAppTask, releaseStaleAppTaskResult } = await load("src/app/app-task-reconciler.ts");
const store = AppTaskResourceStore.openStandalone(databasePath, "probe");
if (mode === "initial") {
  store.bootstrapSnapshot({
    version: 1, project: "probe", project_lifecycle: "active", root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } }, tasks: {},
    resources: {
      "always-fails": {
        metadata: { id: "always-fails", generation: 1, resourceVersion: 1 },
        spec: { parentId: "root", outcome: "Synthetic result", acceptance: ["Synthetic acceptance"], mode: "achieve" },
        status: { phase: "pending", observedGeneration: 0, updatedAt: "2026-09-10T00:00:00.000Z" },
      },
    },
  }, "retry-bound-probe");
}
const config = appTaskContext({
  appDir: join(dirname(databasePath), "probe.app"), projectDir: dirname(databasePath),
  agent: "probe-agent", maxConcurrent: 1, resourceStore: store,
});
const reports: Array<{ attemptId: string; willRetry: boolean; error: string }> = [];
let latestAttemptId = "";
const controller = new AppTaskController({
  maxConcurrent: 1,
  maxRetries: 3,
  retryDelayMs: () => 1,
  async reconcile(taskId: string) {
    const claim = claimObservedAppTask(config, { taskId, appAgent: "probe-agent", handler: "auto", reason: "task-controller" });
    assert.equal(claim.kind, "claimed");
    latestAttemptId = claim.attemptId;
    // Runtime uses this same transition before throwing a retryable execution error.
    const released = releaseStaleAppTaskResult(config, claim, "Synthetic repeatable execution failure");
    assert.equal(released.status, "released");
    throw new Error("Synthetic repeatable execution failure");
  },
  onError(_taskId: string, error: unknown, willRetry: boolean) {
    reports.push({ attemptId: latestAttemptId, willRetry, error: error instanceof Error ? error.message : String(error) });
  },
});
const scheduler = new AppTaskRecoveryScheduler({
  source: store,
  enqueue: (taskId: string) => controller.enqueue(taskId),
});
async function waitForReports(count: number) {
  const deadline = Date.now() + 3_000;
  while (reports.length < count || controller.snapshot().running.length > 0) {
    if (Date.now() >= deadline) throw new Error("Probe timed out");
    await new Promise((done) => setTimeout(done, 1));
  }
  assert.equal(reports.length, count);
  assert.equal(new Set(reports.map((r) => r.attemptId)).size, count);
  assert.ok(reports.every((r) => r.attemptId && r.error === "Synthetic repeatable execution failure"));
}
try {
  assert.equal(scheduler.recover(), 1);
  await waitForReports(4);
  const exhausted = {
    reports: [...reports],
    task: store.readTask("always-fails"),
    candidates: store.listRecoveryCandidates().items,
  };
  assert.deepEqual(reports.map((r) => r.willRetry), [true, true, true, false]);
  if (mode === "initial") {
    assert.equal(scheduler.recover(), 1);
    await waitForReports(5);
    assert.equal(reports[4].willRetry, false);
  }
  const task = store.readTask("always-fails");
  assert.equal(task.metadata.generation, 1);
  assert.equal(task.status.phase, "pending");
  console.log(JSON.stringify({
    mode, maxRetries: 3, retryDelayMs: 1, exhausted,
    afterRecovery: { reports, task, candidates: store.listRecoveryCandidates().items },
  }));
} finally {
  scheduler.close();
  controller.close();
  await controller.whenDrained();
  store.close();
}
