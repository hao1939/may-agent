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
} from "./app-task-reconciler.js";

const roots: string[] = [];
const stores = new Set<AppTaskResourceStore>();
afterEach(() => {
  for (const store of stores) store.close();
  stores.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(mode: "achieve" | "maintain" = "maintain") {
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
    mode,
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

  it("returns each accepted result through a durable parent wake, even when summaries repeat", () => {
    const { config, intent, claim, reopen } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent, id: "parent", outcome: "Review measurements" },
      appAgent: "owner",
    });
    observeAppTaskIntent(config, { intent: { ...intent, parentId: "parent" }, appAgent: "owner" });
    const first = claim();
    completeAppTask(config, first, measured);
    recordAppTaskTrigger(config, "work", { type: "sample.measure", eventId: 2, data: {} });
    const second = claim();
    completeAppTask(config, second, { ...measured, result: { sample: "second", value: 23 } });

    const restored = reopen();
    const events = restored.resourceStore.readTrigger("parent")?.events ?? [];
    const references = events.map(({ event }) => event.resultAttemptId);
    expect(references).toEqual([first.attemptId, second.attemptId]);
    // Caller context reads the saved return link, never "latest result" or a model-copied ID.
    expect(references.map((id) => restored.resourceStore.readAttempt(String(id))?.acceptedResult?.result)).toEqual([
      measured.result,
      { sample: "second", value: 23 },
    ]);
    expect(restored.resourceStore.readTask("work")).not.toBeNull();
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
        mode: "maintain",
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
    const { config, claim, reopen } = fixture("achieve");
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
    const { config, claim } = fixture("achieve");
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
