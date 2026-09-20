import { afterEach, expect, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskInput } from "../state/inbox.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import { trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import { readAppTaskReconciliationEvents } from "./app-task-context.js";
import {
  appTaskContext,
  claimObservedAppTask,
  deferAppTask,
  completeAppTask,
  closeAppTask,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
} from "./app-task-reconciler.js";

afterEach(() => setSystemTime());

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

test("continuation can outlive a wait while sleeping still requires a return route", () => {
  const root = mkdtempSync(join(tmpdir(), "task-continuation-admission-"));
  const config = appTaskTestContext({ appDir: root, databasePath: join(root, "state.db"), agent: "owner", maxConcurrent: 1,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } } });
  const claim = (taskId: string) => {
    const result = claimObservedAppTask(config, { taskId, appAgent: "owner", handler: "agent" });
    if (result.kind !== "claimed") throw new Error(result.kind);
    return result;
  };
  const admit = (taskId: string, key: string) => admitTaskInput(config, {
    appId: "sample", attachment: { kind: "existing", taskId }, idempotencyKey: key,
    inputContext: { id: key, source: { kind: "human", id: "operator" },
      input: { kind: "message", data: { text: key } } },
  });
  try {
    observeAppTaskIntent(config, { appAgent: "owner", intent: {
      id: "with-wait", parentId: "root", outcome: "Review and prepare", acceptance: ["Reviewed"],
    } });
    admit("with-wait", "original");
    deferAppTask(config, claim("with-wait"), {
      disposition: "waiting", summary: "Review requested",
      conditions: [{ id: "review", type: "review.completed", subject: "review:candidate",
        expected: true, owner: "human", reviewAfterMs: 60_000 }],
    });
    admit("with-wait", "progress");
    const progress = claim("with-wait");
    deferAppTask(config, progress, {
      disposition: "waiting", report: true, continue: true,
      summary: "Review is blocked; independent checks started", facts: ["checks:started"],
    });
    expect(config.resourceStore.readAttempt(progress.attemptId)?.acceptedResult)
      .toMatchObject({ state: "waiting", report: true, continue: true });
    expect(readAppTaskAdmissionOutcome(config, "with-wait", "progress", "report"))
      .toMatchObject({ state: "waiting", summary: "Review is blocked; independent checks started" });
    expect(config.resourceStore.readTask("with-wait")?.status)
      .toMatchObject({ phase: "pending", conditionIds: ["review"] });
    trackAppTaskConditionEventForTasks(config, {
      type: "review.completed", data: { review: "candidate", state: true },
    }, ["with-wait"]);
    const continued = claim("with-wait");
    deferAppTask(config, continued, { disposition: "waiting", continue: true,
      summary: "Review arrived; finish independent checks next", facts: ["review:complete"] });
    expect(config.resourceStore.readTask("with-wait")?.status).toMatchObject({ phase: "pending" });
    expect(config.resourceStore.readTask("with-wait")?.status.conditionIds).toEqual([]);
    completeAppTask(config, claim("with-wait"), {
      summary: "Review and independent checks complete", response: "Complete", facts: ["checks:complete"],
    });

    observeAppTaskIntent(config, { appAgent: "owner", intent: {
      id: "without-wait", parentId: "root", outcome: "Do bounded work", acceptance: ["Done"],
    } });
    admit("without-wait", "start");
    const noWait = claim("without-wait");
    deferAppTask(config, noWait, { disposition: "waiting", continue: true,
      summary: "Continue useful work without inventing a wait", facts: ["step:complete"] });
    expect(config.resourceStore.readAttempt(noWait.attemptId)?.acceptedResult)
      .toMatchObject({ state: "waiting", continue: true });
    expect(config.resourceStore.readTask("without-wait")?.status.phase).toBe("pending");
    const finalPass = claim("without-wait");
    expect(() => deferAppTask(config, finalPass, { disposition: "waiting",
      summary: "No work or return route remains", facts: ["step:complete"] }))
      .toThrow("requires at least one exact Condition");
    expect(config.resourceStore.readAttempt(finalPass.attemptId)?.acceptedResult).toBeUndefined();
  } finally {
    config.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("omitted declarations preserve deadlines without attaching unrelated Conditions or spinning a consumed deadline", () => {
  const root = mkdtempSync(join(tmpdir(), "task-input-wait-correlation-"));
  const config = appTaskTestContext({
    appDir: root,
    databasePath: join(root, "state.db"),
    agent: "owner",
    maxConcurrent: 1,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  const admit = (key: string) =>
    admitTaskInput(config, {
      appId: "sample",
      attachment: { kind: "existing", taskId: "work" },
      idempotencyKey: key,
      inputContext: {
        id: key,
        source: { kind: "human", id: "operator" },
        input: { kind: "message", data: { text: key } },
      },
    });
  const claim = () => {
    const result = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
    if (result.kind !== "claimed") throw new Error(result.kind);
    return result;
  };
  const now = 1_800_000_000_000;
  const due = now + 60_000;
  const independent = {
    id: "independent-review",
    type: "review.completed",
    subject: "id:independent",
    expected: "accepted",
    owner: "app:reviewer",
    reviewAfterMs: 600_000,
  };
  try {
    setSystemTime(now);
    observeAppTaskIntent(config, {
      appAgent: "owner",
      intent: { id: "work", parentId: "root", outcome: "Answer correlated requests", acceptance: ["Answered"] },
    });
    admit("original");
    deferAppTask(config, claim(), {
      disposition: "waiting",
      summary: "Original input awaits its review",
      conditions: [independent],
      reviewAt: due,
    });

    admit("unrelated-feedback");
    deferAppTask(config, claim(), {
      disposition: "waiting",
      summary: "Feedback does not alter obligations",
    });
    let task = config.resourceStore.readTask("work")!;
    expect(task.status.reviewAt).toBe(due);
    expect(task.status.inputWaits?.original).toEqual({
      taskGeneration: 1,
      conditions: [{ id: independent.id, generation: 1 }],
      reviewAt: due,
    });
    expect(task.status.inputWaits?.["unrelated-feedback"]).toEqual({
      taskGeneration: 1,
      conditions: [],
      reviewAt: due,
    });

    setSystemTime(due);
    const dueClaim = claim();
    expect(dueClaim.continuedInputKeys?.sort()).toEqual(["original", "unrelated-feedback"]);
    deferAppTask(config, dueClaim, {
      disposition: "waiting",
      summary: "Deadline consumed; independent review remains",
    });
    task = config.resourceStore.readTask("work")!;
    expect(task.status.reviewAt).toBeUndefined();
    expect(task.status.inputWaits?.original?.reviewAt).toBeUndefined();
    expect(task.status.inputWaits?.["unrelated-feedback"]?.reviewAt).toBeUndefined();
    expect(task.status.inputWaits?.["unrelated-feedback"]?.conditions).toEqual([]);
    expect(claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" }).kind).toBe("waiting");
    expect(config.resourceStore.nextDueAt()).toBeGreaterThan(due);
  } finally {
    config.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("converged review renews only overdue retained Condition checkpoints", () => {
  const root = mkdtempSync(join(tmpdir(), "task-converged-condition-review-"));
  const databasePath = join(root, "state.db");
  let config = appTaskTestContext({
    appDir: root,
    databasePath,
    agent: "owner",
    maxConcurrent: 1,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  const claim = () => claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
  const startedAt = Date.parse("2026-09-20T00:00:00.000Z");
  const overdue = {
    id: "publication",
    type: "app.dependency.updated",
    subject: "id:publication",
    expected: { field: "status", equals: "done" },
    owner: "app:library",
    reviewAfterMs: 60_000,
  };
  const future = {
    id: "independent",
    type: "review.completed",
    subject: "id:independent",
    expected: "done",
    owner: "human",
    reviewAfterMs: 3_600_000,
  };
  const satisfied = {
    id: "already-reviewed",
    type: "review.completed",
    subject: "id:accepted",
    expected: "done",
    owner: "human",
    reviewAfterMs: 3_600_000,
  };
  try {
    setSystemTime(startedAt);
    observeAppTaskIntent(config, {
      appAgent: "owner",
      intent: { id: "work", parentId: "root", outcome: "Review source", acceptance: ["Source reviewed"] },
    });
    const initial = claim();
    if (initial.kind !== "claimed") throw new Error(initial.kind);
    deferAppTask(config, initial, {
      disposition: "waiting",
      summary: "Publication and independent review remain",
      conditions: [overdue, future, satisfied],
    });
    trackAppTaskConditionEventForTasks(config, {
      type: "review.completed",
      data: { id: "accepted", state: "done" },
    }, ["work"]);
    const review = claim();
    if (review.kind !== "claimed") throw new Error(review.kind);
    const before = config.resourceStore.readTaskContext({
      taskIds: ["work"],
      conditionIds: [overdue.id, future.id, satisfied.id],
    });
    const futureBefore = structuredClone(before.conditions?.[future.id]);
    const overdueBefore = structuredClone(before.conditions?.[overdue.id]);

    setSystemTime(startedAt + overdue.reviewAfterMs + 1);
    completeAppTask(config, review, {
      summary: "Current source review is complete; publication remains pending",
      facts: ["source:unchanged", "publication:pending"],
    });

    const after = config.resourceStore.readTaskContext({
      taskIds: ["work"],
      conditionIds: [overdue.id, future.id, satisfied.id],
    });
    expect(after.resources?.work?.status).toMatchObject({
      phase: "waiting",
      conditionIds: [overdue.id, future.id],
    });
    expect(after.conditions?.[overdue.id]).toMatchObject({
      metadata: {
        id: overdue.id,
        generation: overdueBefore?.metadata.generation,
        resourceVersion: (overdueBefore?.metadata.resourceVersion ?? 0) + 1,
      },
      spec: overdueBefore?.spec,
      status: { state: "unknown", observedAt: new Date(Date.now()).toISOString() },
    });
    expect(after.conditions?.[future.id]).toEqual(futureBefore);
    expect(after.conditions?.[satisfied.id]).toBeUndefined();
    const renewedDue = Date.now() + overdue.reviewAfterMs;
    expect(config.resourceStore.nextDueAt()).toBe(renewedDue);
    expect(claim().kind).toBe("waiting");

    config.resourceStore.close();
    config = appTaskContext({
      appDir: root,
      projectDir: root,
      agent: "owner",
      maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.openStandalone(databasePath, "sample"),
    });
    expect(config.resourceStore.nextDueAt()).toBe(renewedDue);
    expect(claim().kind).toBe("waiting");
  } finally {
    config.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test.each(["changed-spec", "replaced-id"])("reconsiders inputs with %s waits after reopen, without answering unrelated input", (change) => {
  const root = mkdtempSync(join(tmpdir(), "task-wait-replacement-"));
  const databasePath = join(root, "state.db");
  let config = appTaskTestContext({
    appDir: root, databasePath, agent: "owner", maxConcurrent: 1,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  const claim = () => {
    const result = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
    if (result.kind !== "claimed") throw new Error(result.kind);
    return result;
  };
  const admit = (key: string) => admitTaskInput(config, {
    appId: "sample", attachment: { kind: "existing", taskId: "work" }, idempotencyKey: key,
    inputContext: { id: key, source: { kind: "human", id: "operator" }, input: { kind: "message", data: { text: key } } },
  });
  const wait = (id: string, expected = "complete") => ({
    id, type: "review.completed", subject: `id:${id}`, expected, owner: "human", reviewAfterMs: 60_000,
  });
  try {
    observeAppTaskIntent(config, { appAgent: "owner", intent: {
      id: "work", parentId: "root", outcome: "Review requested artifacts", acceptance: ["Reviews returned"], agent: "owner",
    } });
    const independent = wait("independent");
    admit("independent-request");
    deferAppTask(config, claim(), { disposition: "waiting", summary: "Independent review pending", conditions: [independent] });
    const original = wait("review");
    admit("original");
    deferAppTask(config, claim(), { disposition: "waiting", summary: "Review requested", conditions: [independent, original] });
    admit("correction");
    const correction = claim();
    expect(correction.continuedInputKeys ?? []).not.toContain("original");
    const replacement = change === "changed-spec" ? wait("review", "accepted") : wait("replacement", "accepted");
    deferAppTask(config, correction, { disposition: "waiting", summary: "Use corrected review contract", conditions: [independent, replacement] });
    expect(readAppTaskAdmissionOutcome(config, "work", "original")).toBeNull();
    config.resourceStore.close();
    config = appTaskContext({ appDir: root, projectDir: root, agent: "owner", maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.openStandalone(databasePath, "sample") });
    expect(claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" }).kind).toBe("waiting");
    trackAppTaskConditionEventForTasks(config, { type: "review.completed", data: { id: replacement.id, state: "accepted" } }, ["work"]);
    const final = claim();
    const expectedContinued = change === "changed-spec" ? ["correction", "original"] : ["correction"];
    expect(final.continuedInputKeys?.sort()).toEqual(expectedContinued);
    const context = readAppTaskReconciliationEvents(config.resourceStore, final);
    expect(context.continuedInputs?.map(({ event }) => event.data.idempotencyKey).sort()).toEqual(expectedContinued);
    // A later independent ask was not in this execution's context.
    admit("late-question");
    expect(completeAppTask(config, final, { summary: "Reviews accepted", response: "Corrected review complete" }).taskContinues).toBe(true);
    expect(readAppTaskAdmissionOutcome(config, "work", "original")).toBeNull();
    const next = claim();
    if (change === "changed-spec") expect(next.continuedInputKeys).toContain("original");
    else expect(next.continuedInputKeys ?? []).not.toContain("original");
    completeAppTask(config, next, { summary: "Reviewed new question too", response: "Corrected review complete; independent review pending" });
    for (const key of ["correction", "late-question"]) {
      expect(readAppTaskAdmissionOutcome(config, "work", key)?.attemptId).toBe(next.attemptId);
    }
    expect(readAppTaskAdmissionOutcome(config, "work", "independent-request")).toBeNull();
    if (change === "changed-spec") {
      expect(readAppTaskAdmissionOutcome(config, "work", "original")?.attemptId).toBe(next.attemptId);
      expect(config.resourceStore.readTask("work")?.status.conditionIds).toEqual(["independent"]);
    } else {
      expect(readAppTaskAdmissionOutcome(config, "work", "original")).toBeNull();
      expect(config.resourceStore.readTask("work")?.status.conditionIds).toEqual(["independent", "review"]);
    }
  } finally {
    config.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  }
});
