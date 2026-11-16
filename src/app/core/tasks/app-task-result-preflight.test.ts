import { expect, it } from "bun:test";
import type { TaskAttempt, TaskReconcileResult } from "@may-agent/sdk/app";
import { appTaskRuntimeTestSuite } from "../../../../test/fixtures/app-task-runtime.js";
import { observeAppTaskIntent } from "./app-task-reconciler.js";
import { installAppTaskRuntimes, reconcileLoadedAppTaskOnce, readLoadedAppTaskView } from "./app-task-runtime.js";
import { readTaskSnapshot } from "./app-task-store.js";

const { fixture, eventBus, options, definition, loadedTaskConfig, readAcceptedRuntimeAttempt } = appTaskRuntimeTestSuite();

it("preflights native executor results through real admission without committing waits or consuming input", async () => {
  const f = fixture(), bus = eventBus();
  const app = definition();
  app.tasks = { validateCondition: (condition) => condition.type === "sample.ready" ? null : "No such producer" };
  let saved: TaskAttempt | undefined;
  let calls = 0;
  const condition = { id: "approval", type: "sample.ready", subject: "draft:one", expected: true, owner: "human" };
  const result: TaskReconcileResult = { state: "waiting", summary: "Waiting for approval", facts: ["Draft saved"] };
  await installAppTaskRuntimes({
    ...options(f, bus), installControllers: false,
    executors: { native: async (attempt) => {
      calls++;
      saved = attempt;
      const config = loadedTaskConfig(f);
      const before = readTaskSnapshot(config);
      expect(attempt.validateResult!(result)).toContain("requires at least one exact Condition");
      expect(attempt.validateResult!({ ...result, conditions: [{ ...condition, type: "invented.ready" }] }))
        .toContain("No such producer");
      const corrected = { ...result, conditions: [condition] };
      expect(attempt.validateResult!(corrected)).toBeNull();
      expect(readTaskSnapshot(config)).toEqual(before);
      return corrected;
    } },
    appRegistrySnapshot: { id: "result-preflight", generation: 1, entries: [{ appDir: f.appDir, definition: app }] },
  });
  const config = loadedTaskConfig(f), taskId = "work/native";
  observeAppTaskIntent(config, { appAgent: "sample-owner", intent: {
    id: taskId, parentId: "operations", outcome: "Prepare draft", acceptance: ["Retain real approval wait"],
    agent: "sample-owner", executor: "native",
  } });
  await reconcileLoadedAppTaskOnce({ bus, appId: "sample", taskId,
    dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
  });
  expect(calls).toBe(1);
  expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })).toMatchObject({ status: "waiting" });
  expect(readAcceptedRuntimeAttempt(config, taskId)?.acceptedResult).toMatchObject({ state: "waiting", summary: result.summary });
  expect(config.resourceStore.readTask(taskId)?.status.conditionIds).toEqual([condition.id]);
  expect(saved!.validateResult!(result)).toBe("Task attempt is closed");
});

it("rechecks the wait route after a successful preflight when the final proposal changes", async () => {
  const f = fixture(), bus = eventBus();
  await installAppTaskRuntimes({
    ...options(f, bus), installControllers: false,
    executors: { native: async (attempt) => {
      const result: TaskReconcileResult = {
        state: "waiting", summary: "Work remains", facts: ["Independent work found"], continue: true,
      };
      expect(attempt.validateResult!(result)).toBeNull();
      const { continue: _continue, ...invalid } = result;
      return invalid;
    } },
    appRegistrySnapshot: { id: "result-recheck", generation: 1, entries: [{ appDir: f.appDir, definition: definition() }] },
  });
  const config = loadedTaskConfig(f), taskId = "work/native";
  observeAppTaskIntent(config, { appAgent: "sample-owner", intent: {
    id: taskId, parentId: "operations", outcome: "Prepare draft", acceptance: ["Retain real wait"],
    agent: "sample-owner", executor: "native",
  } });
  await reconcileLoadedAppTaskOnce({ bus, appId: "sample", taskId,
    dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
  });
  expect(readAcceptedRuntimeAttempt(config, taskId)?.acceptedResult).toBeUndefined();
  expect(config.resourceStore.readTask(taskId)?.status.summary).toContain("requires at least one exact Condition");
});
