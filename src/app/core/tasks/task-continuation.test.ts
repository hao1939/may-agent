import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskInput } from "../state/inbox.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import { trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import {
  appTaskContext,
  claimObservedAppTask,
  deferAppTask,
  completeAppTask,
  closeAppTask,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
} from "./app-task-reconciler.js";

test.each(["finish", "close"])("continuation survives reopen and retains the original input through %s", (end) => {
  const root = mkdtempSync(join(tmpdir(), "task-continuation-"));
  const databasePath = join(root, "state.db");
  let config = appTaskTestContext({
    appDir: root,
    databasePath,
    agent: "owner",
    maxConcurrent: 1,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  try {
    observeAppTaskIntent(config, {
      appAgent: "owner",
      intent: {
        id: "parent",
        parentId: "root",
        outcome: "Review and prepare",
        acceptance: ["result reviewed"],
        agent: "owner",
      },
    });
    admitTaskInput(config, {
      appId: "sample",
      attachment: { kind: "existing", taskId: "parent" },
      idempotencyKey: "original",
      inputContext: { id: "original", source: { kind: "human", id: "operator" }, input: { kind: "work", data: {} } },
    });
    const claim = () => claimObservedAppTask(config, { taskId: "parent", appAgent: "owner", handler: "agent" });
    const first = claim();
    if (first.kind !== "claimed") throw new Error(first.kind);
    const wait = {
      id: "result",
      type: "pipeline.state",
      subject: "id:42",
      expected: "complete",
      owner: "app:ci",
      reviewAfterMs: 60_000,
    };
    expect(
      deferAppTask(config, first, {
        disposition: "waiting",
        continue: true,
        summary: "Prepare independent notes next",
        facts: ["review:requested"],
        conditions: [wait],
      }).reconcileTaskIds,
    ).toEqual(["parent"]);
    expect(readAppTaskAdmissionOutcome(config, "parent", "original")).toBeNull();
    expect(readAppTaskAdmissionOutcome(config, "parent", "original", "report")).toBeNull();
    const firstResult = config.resourceStore.readAttempt(first.attemptId)?.acceptedResult;
    expect(firstResult).toMatchObject({ state: "waiting", continue: true });
    config.resourceStore.close();
    config = appTaskContext({
      appDir: root,
      projectDir: root,
      agent: "owner",
      maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.openStandalone(databasePath, "sample"),
    });
    const current = config.resourceStore.readTask("parent")!;
    expect(current.status.executionFailures).toBeUndefined();
    expect(current.status.conditionIds).toEqual(["result"]);
    if (end === "close") {
      closeAppTask(config, {
        appId: "sample",
        taskId: "parent",
        reason: "owner withdrew",
        expectedGeneration: current.metadata.generation,
        expectedResourceVersion: current.metadata.resourceVersion,
      });
      expect(claim().kind).not.toBe("claimed");
      return;
    }
    const next = claim();
    if (next.kind !== "claimed") throw new Error(next.kind);
    expect(next.continuedInputKeys).toContain("original");
    expect(next.attemptId).not.toBe(first.attemptId);
    expect(claim().kind).not.toBe("claimed");
    // Useful preparation still owes the result. Yielding again parks normally.
    deferAppTask(config, next, {
      disposition: "waiting",
      summary: "Notes prepared; now only the review remains",
      facts: ["notes:prepared"],
    });
    expect(claim().kind).toBe("waiting");
    expect(config.resourceStore.readTask("parent")?.status.inputWaits?.original).toBeDefined();
    expect(config.resourceStore.readAttempt(next.attemptId)?.acceptedResult?.continue).toBeUndefined();
    expect(completeAppTask(config, first, { summary: "late", facts: [] }).status).toBe("stale");
    admitTaskInput(config, {
      appId: "sample",
      attachment: { kind: "existing", taskId: "parent" },
      idempotencyKey: "new-question",
      inputContext: {
        id: "new-question",
        source: { kind: "human", id: "operator" },
        input: { kind: "status", data: {} },
      },
    });
    const question = claim();
    if (question.kind !== "claimed") throw new Error(question.kind);
    expect(question.continuedInputKeys ?? []).not.toContain("original");
    completeAppTask(config, question, {
      summary: "Still waiting",
      response: "Notes ready, review pending",
      facts: ["notes:prepared"],
    });
    expect(readAppTaskAdmissionOutcome(config, "parent", "new-question")?.response).toBe("Notes ready, review pending");
    expect(readAppTaskAdmissionOutcome(config, "parent", "original")).toBeNull();
    trackAppTaskConditionEventForTasks(config, { type: "pipeline.state", data: { id: "42", state: "complete" } }, [
      "parent",
    ]);
    const final = claim();
    if (final.kind !== "claimed") throw new Error(final.kind);
    expect(final.continuedInputKeys).toContain("original");
    completeAppTask(config, final, {
      summary: "Reviewed",
      response: "Review and notes complete",
      facts: ["review:complete"],
    });
    expect(readAppTaskAdmissionOutcome(config, "parent", "original")?.response).toBe("Review and notes complete");
  } finally {
    config.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  }
});
