import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  closeAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  reportAppTaskFailure,
} from "./app-task-reconciler.js";

const roots: string[] = [];
const stores = new Set<AppTaskResourceStore>();
afterEach(() => {
  for (const store of stores) store.close();
  stores.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-accepted-result-"));
  roots.push(root);
  const databasePath = join(root, "host.sqlite");
  const config = appTaskTestContext({
    appDir: root,
    agent: "owner",
    maxConcurrent: 1,
    databasePath,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "owner" } } },
  });
  stores.add(config.resourceStore);
  const intent = {
    id: "work",
    parentId: "root",
    outcome: "Return the requested measurement",
    acceptance: ["Measurement is verified"],
  };
  observeAppTaskIntent(config, {
    intent,
    appAgent: "owner",
    trigger: { type: "sample.measure", eventId: 1, data: { sample: "first" } },
  });
  const claim = () => {
    const claimed = claimObservedAppTask(config, { taskId: intent.id, appAgent: "owner", handler: "agent" });
    if (claimed.kind !== "claimed") throw new Error(`Expected attempt, got ${claimed.kind}`);
    return claimed;
  };
  const reopen = () => {
    config.resourceStore.close();
    stores.delete(config.resourceStore);
    const store = AppTaskResourceStore.openStandalone(databasePath, "sample");
    stores.add(store);
    return appTaskContext({ appDir: root, agent: "owner", maxConcurrent: 1, resourceStore: store });
  };
  return { config, intent, claim, reopen };
}

const measured = {
  summary: "Verified first measurement",
  response: "The measurement is 17.",
  result: { sample: "first", value: 17 },
  evidence: ["fixture:measurement:first"],
  acceptanceBasis: { method: "deterministic" as const, evidence: ["fixture:check:first"] },
};

describe("accepted Task outcome evidence", () => {
  it("retains an exact accepted result after later cycles and SQLite reopen", () => {
    const { config, claim, reopen } = fixture();
    const first = claim();
    expect(completeAppTask(config, first, measured).status).toBe("applied");
    // Exceed the bounded context window: exact evidence must not mean latest state.
    for (let cycle = 2; cycle <= 19; cycle++) {
      recordAppTaskTrigger(config, "work", { type: "sample.measure", eventId: cycle, data: { sample: cycle } });
      completeAppTask(config, claim(), {
        summary: `Verified measurement ${cycle}`,
        result: { sample: cycle, value: cycle },
        evidence: [`fixture:${cycle}`],
      });
    }
    expect(config.resourceStore.readTask("work")?.status.result).toEqual({ sample: 19, value: 19 });
    const restored = reopen();
    expect(restored.resourceStore.readAttempt(first.attemptId)).toMatchObject({
      taskId: "work",
      taskGeneration: first.generation,
      state: "completed",
      events: [{ event: { eventId: 1 } }],
      acceptedResult: { state: "converged", ...measured },
    });
    expect(restored.resourceStore.readReceipt("work")).toBeNull();
    expect(restored.resourceStore.listRecoveryCandidates().items).toEqual([]);
  });

  it("commits accepted evidence atomically with the Task result", () => {
    const { config, claim } = fixture();
    const current = claim();
    const before = config.resourceStore.readTask("work");
    config.resourceStore.db.exec(`CREATE TRIGGER reject_outcome BEFORE INSERT ON app_task_attempts
      WHEN NEW.state = 'completed' BEGIN SELECT RAISE(ABORT, 'fixture outcome write rejected'); END;`);
    expect(() => completeAppTask(config, current, measured)).toThrow("fixture outcome write rejected");
    expect(config.resourceStore.readTask("work")).toEqual(before);
    expect(config.resourceStore.readAttempt(current.attemptId)).not.toHaveProperty("acceptedResult");
    config.resourceStore.db.exec("DROP TRIGGER reject_outcome");
    expect(completeAppTask(config, current, measured).status).toBe("applied");
    expect(config.resourceStore.readAttempt(current.attemptId)).toHaveProperty("acceptedResult", {
      state: "converged",
      ...measured,
    });
  });

  it("does not label output awaiting a correction as accepted completion", () => {
    const { config, claim } = fixture();
    const old = claim();
    recordAppTaskTrigger(config, "work", { type: "sample.correction", eventId: 2, data: { sample: "corrected" } });
    expect(completeAppTask(config, old, measured)).toMatchObject({ status: "applied", taskContinues: true });
    expect(config.resourceStore.readAttempt(old.attemptId)).not.toHaveProperty("acceptedResult");
    const corrected = claim();
    completeAppTask(config, corrected, {
      summary: "Corrected measurement",
      result: { value: 23 },
      evidence: ["fixture:corrected"],
    });
    expect(config.resourceStore.readAttempt(corrected.attemptId)).toMatchObject({
      acceptedResult: { state: "converged", result: { value: 23 } },
    });
  });

  it("retains a waiting judgment without turning it into completion", () => {
    const { config, claim, reopen } = fixture();
    const waiting = claim();
    deferAppTask(config, waiting, {
      disposition: "waiting",
      summary: "The external sample is unavailable",
      result: { missing: "sample" },
      evidence: ["fixture:sample:pending"],
      conditions: [
        {
          id: "sample-ready",
          type: "sample.ready",
          subject: "sample:first",
          expected: true,
          owner: "app:sampler",
          reviewAfterMs: 60_000,
        },
      ],
    });
    const restored = reopen();
    expect(restored.resourceStore.readAttempt(waiting.attemptId)).toMatchObject({
      acceptedResult: { state: "waiting", result: { missing: "sample" }, evidence: ["fixture:sample:pending"] },
    });
    expect(restored.resourceStore.readTask("work")?.status.phase).toBe("waiting");
    expect(restored.resourceStore.readReceipt("work")).toBeNull();
  });

  it("keeps an accepted parent outcome separate from its child's continuing responsibility", () => {
    const { config, claim } = fixture();
    const current = claim();
    observeAppTaskIntent(config, {
      intent: {
        id: "measurement",
        parentId: "work",
        outcome: "Measure the sample",
        acceptance: ["Measurement is verified"],
      },
      appAgent: "owner",
    });
    expect(completeAppTask(config, current, measured)).toMatchObject({ status: "applied" });
    expect(config.resourceStore.readTask("work")?.status.phase).toBe("converged");
    expect(config.resourceStore.readAttempt(current.attemptId)).toMatchObject({
      acceptedResult: { state: "converged", ...measured },
    });
    expect(config.resourceStore.readTask("measurement")?.status.phase).toBe("pending");
    expect(config.resourceStore.isCancelled("measurement")).toBe(false);
    expect(config.resourceStore.listRecoveryCandidates().items.map(({ taskId }) => taskId)).toEqual(["measurement"]);
  });

  it("cannot overwrite an accepted outcome with a duplicate or superseded result", () => {
    const { config, claim, intent } = fixture();
    const first = claim();
    completeAppTask(config, first, measured);
    expect(completeAppTask(config, first, { summary: "Duplicate changed result", evidence: [] }).status).toBe("stale");
    recordAppTaskTrigger(config, "work", { type: "sample.measure", eventId: 2, data: {} });
    const second = claim();
    observeAppTaskIntent(config, { intent: { ...intent, input: { revised: true } }, appAgent: "owner" });
    expect(completeAppTask(config, second, measured).status).toBe("stale");
    expect(config.resourceStore.readAttempt(second.attemptId)).not.toHaveProperty("acceptedResult");
    expect(config.resourceStore.readAttempt(first.attemptId)).toHaveProperty("acceptedResult", {
      state: "converged",
      ...measured,
    });
  });

  it("records only live input actually incorporated by the accepted attempt", () => {
    const { config, claim } = fixture();
    const current = claim();
    recordAppTaskTrigger(config, "work", { type: "sample.correction", eventId: 2, data: { sample: "second" } });
    completeAppTask(config, current, { ...measured, acceptedLiveEventIds: [2, 2, 999] });
    expect(config.resourceStore.readAttempt(current.attemptId)).toMatchObject({
      events: [{ event: { eventId: 1 } }],
      acceptedResult: { ...measured, acceptedLiveEventIds: [2] },
    });
    expect(config.resourceStore.readTrigger("work")).toBeNull();
  });

  it("retains finite work's accepted evidence while open and after explicit owner closure", () => {
    const { config, claim, reopen } = fixture();
    const current = claim();
    completeAppTask(config, current, measured);
    const restored = reopen();
    const resource = restored.resourceStore.readTask("work")!;
    expect(resource.status).toMatchObject({
      phase: "converged",
      summary: measured.summary,
      response: measured.response,
      result: measured.result,
      evidence: measured.evidence,
    });
    expect(restored.resourceStore.readReceipt("work")).toBeNull();
    expect(restored.resourceStore.isCancelled("work")).toBe(false);
    expect(restored.resourceStore.listRecoveryCandidates().items).toEqual([]);
    const accepted = restored.resourceStore.readAttempt(current.attemptId)?.acceptedResult;
    expect(
      closeAppTask(restored, {
        appId: "sample",
        taskId: "work",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
        afterResult: current.attemptId,
        reason: "Owner accepted the completed work",
      }),
    ).toMatchObject({
      applied: true,
      closure: { kind: "closed", acceptedResultAttemptId: current.attemptId },
    });
    expect(restored.resourceStore.readAttempt(current.attemptId)?.acceptedResult).toEqual(accepted);
    expect(restored.resourceStore.readAttempt(current.attemptId)).toHaveProperty("acceptedResult", {
      state: "converged",
      ...measured,
    });
  });

  it("does not record cancelled execution as an accepted result", () => {
    const { config, claim } = fixture();
    const current = claim();
    const resource = config.resourceStore.readTask("work")!;
    cancelAppTask(config, {
      appId: "sample",
      taskId: "work",
      expectedGeneration: resource.metadata.generation,
      expectedResourceVersion: resource.metadata.resourceVersion,
      reason: "Sample no longer needed",
    });
    expect(completeAppTask(config, current, measured).status).toBe("stale");
    expect(config.resourceStore.readAttempt(current.attemptId)).not.toHaveProperty("acceptedResult");
  });
});

it.each([
  ["achieve", "9a59dba0d862f7b9914c126ba0caa52300e1e2bb59fd6c3564a72c06c0bc9da9"],
  ["maintain", "259f1b087aac89483676d589afad0b98f78fb46b605dadefd1d58292d1cf4dd5"],
])("reads retained %s work without restoring a public mode or losing its report", (mode, oldHash) => {
  const f = fixture();
  observeAppTaskIntent(f.config, { intent: f.intent, appAgent: "owner", admissionKey: "original" });
  const claim = f.claim();
  reportAppTaskFailure(f.config, claim, { summary: "Source unavailable", evidence: ["source:offline"] });
  const db = f.config.resourceStore.db;
  // Hashes come from the prior Host; the compatibility test does not copy hashing code.
  db.prepare("UPDATE app_tasks SET resource_json = json_set(resource_json, '$.spec.mode', ?) WHERE task_id = 'work'").run(mode);
  db.prepare("UPDATE app_task_admissions SET admission_json = json_set(admission_json, '$.specHash', ?) WHERE task_id = 'original'").run(oldHash);
  db.prepare("UPDATE app_task_attempts SET attempt_json = json_set(attempt_json, '$.acceptedResult.state', 'stopped') WHERE attempt_id = ?").run(claim.attemptId);
  const config = f.reopen();
  expect(config.resourceStore.readTask("work")?.spec).not.toHaveProperty("mode");
  expect(config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult).toMatchObject({
    state: "incomplete", summary: "Source unavailable", evidence: ["source:offline"],
  });
  expect(config.resourceStore.readSnapshot().attempts?.[claim.attemptId]?.acceptedResult?.state).toBe("incomplete");
  expect(observeAppTaskIntent(config, { intent: f.intent, appAgent: "owner", admissionKey: "original" }))
    .toMatchObject({ generation: 1, changed: false });
  expect(() => observeAppTaskIntent(config, { intent: { ...f.intent, outcome: "Different work" }, appAgent: "owner", admissionKey: "original" }))
    .toThrow("different desired work");
  expect(() => observeAppTaskIntent(config, { intent: { ...f.intent, mode } as typeof f.intent, appAgent: "owner" }))
    .toThrow("Task mode is retired");
});
