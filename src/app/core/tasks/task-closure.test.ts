import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { createRuntimeTaskRead } from "../reads/app-read.js";
import { closeCreatedAppTask } from "./task-closure.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  failAppTaskAttempt,
} from "./app-task-reconciler.js";

const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);

// Portable counterparts of the reviewed finite report, stale recovery wait and
// merged change with an outstanding approval. No installation records are loaded.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "task-closure-"));
  roots.push(root);
  const db = getDb(root);
  const context = (appId: string) =>
    appTaskContext({
      appDir: root,
      projectDir: root,
      agent: appId,
      maxConcurrent: 4,
      resourceStore: AppTaskResourceStore.fromDb(db, appId),
    });
  const source = context("owner");
  const target = context("worker");
  for (const ctx of [source, target])
    ctx.resourceStore.bootstrapSnapshot(
      {
        groups: { root: { id: "root", parent_id: null } },
        root_task_id: "root",
      },
      "fixture",
    );
  const create = (ctx: typeof source, id: string, creator = { appId: "owner", taskId: "parent" }) =>
    observeAppTaskIntent(ctx, {
      appAgent: ctx.agent,
      creator,
      intent: {
        id,
        parentId: "root",
        outcome: "Review the exact evidence",
        acceptance: ["Return a scoped disposition"],
      },
    });
  create(source, "parent");
  create(source, "sibling");
  create(target, "child");
  const claim = (ctx = target, taskId = "child") => {
    const result = claimObservedAppTask(ctx, { taskId, appAgent: ctx.agent, handler: "auto" });
    if (result.kind !== "claimed") throw new Error(`Expected claim, got ${result.kind}`);
    return result;
  };
  const parent = claim(source, "parent");
  const actor = { appId: "owner", taskId: "parent", generation: parent.generation, attemptId: parent.attemptId };
  const change = () => {
    const resource = target.resourceStore.readTask("child")!;
    return {
      appId: "worker",
      taskId: "child",
      expectedGeneration: resource.metadata.generation,
      expectedResourceVersion: resource.metadata.resourceVersion,
      afterResult: resource.status.observedAttemptId!,
      reason: "Reviewed the supported no-change decision; no follow-through remains",
    };
  };
  const close = (request = change(), caller = actor) =>
    closeCreatedAppTask({ source, target, actor: caller, change: request });
  const read = createRuntimeTaskRead({ taskStateConfig: target });
  return { source, target, parent, actor, change, close, claim, read };
}

test("finite no-change review is idle until explicit creator closure; exact evidence and terminal filters agree", () => {
  const f = fixture();
  const attempt = f.claim();
  completeAppTask(f.target, attempt, {
    summary: "Supported no change",
    result: { decision: "no-change" },
    facts: ["report:checked"],
  });
  expect(f.read.get("child")).toMatchObject({ status: "idle", acceptedAttempt: { id: attempt.attemptId } });
  expect(f.read.list({ status: ["idle"] }).items).toHaveLength(1);
  expect(f.read.list({ status: ["done", "closed", "cancelled"] }).items).toEqual([]);
  const request = f.change();
  const accepted = f.target.resourceStore.readAttempt(attempt.attemptId)?.acceptedResult;
  expect(f.close(request)).toMatchObject({
    applied: true,
    closure: {
      kind: "closed",
      acceptedResultAttemptId: attempt.attemptId,
      decidedBy: { kind: "creator", creator: { appId: "owner", taskId: "parent" } },
    },
  });
  expect(f.close(request).applied).toBe(false);
  expect(f.read.get("child")).toMatchObject({ status: "closed", closed: true, result: { decision: "no-change" } });
  expect(f.read.list({ status: ["closed"] }).items).toHaveLength(1);
  expect(f.read.list({ status: ["idle", "done", "cancelled"] }).items).toEqual([]);
  expect(f.target.resourceStore.readAttempt(attempt.attemptId)?.acceptedResult).toEqual(accepted);
  expect(f.target.resourceStore.listRecoveryCandidates().items).toEqual([]);
});

test("new input racing owner disposition rejects closure even when the stored phase remains converged", () => {
  const f = fixture();
  completeAppTask(f.target, f.claim(), { summary: "First review" });
  const request = f.change();
  recordAppTaskTrigger(f.target, "child", { type: "report.corrected", data: { revision: 2 } });
  expect(f.read.get("child")?.status).toBe("pending");
  expect(() => f.close(request)).toThrow("resource version changed");
  expect(() => f.close(f.change())).toThrow("newer or unresolved work");
  const next = f.claim();
  completeAppTask(f.target, next, { summary: "Correction reviewed" });
  expect(() => f.close(request)).toThrow("resource version changed");
  expect(() => f.close({ ...f.change(), afterResult: request.afterResult })).toThrow("newer or unresolved work");
  expect(f.close().applied).toBe(true);
});

test("creator closure rejects sibling, stale caller and self authority, including receipt replay", () => {
  const f = fixture();
  completeAppTask(f.target, f.claim(), { summary: "Evidence checked" });
  const sibling = f.claim(f.source, "sibling");
  expect(() => f.close(f.change(), { ...f.actor, taskId: "sibling", attemptId: sibling.attemptId })).toThrow(
    "recorded creator",
  );
  expect(() =>
    closeCreatedAppTask({
      source: f.source,
      target: f.source,
      actor: f.actor,
      change: { ...f.change(), appId: "owner", taskId: "parent" },
    }),
  ).toThrow("own assignment");
  const request = f.change();
  f.close(request);
  failAppTaskAttempt(f.source, f.parent, "Caller ended");
  expect(() => f.close(request)).toThrow("caller is no longer current");
});

test.each([
  {
    id: "retry-signal",
    type: "human.retried",
    subject: "recovery:capacity",
    owner: "human",
    evidence: "Actual provider recovery completed; retry acknowledgment is obsolete",
  },
  {
    id: "independent-review",
    type: "review.approved",
    subject: "change:merged",
    owner: "app:reviewer",
    evidence: "Change merged with green checks; required approval remains unproved",
  },
])("a result does not silently settle the independent $id Condition", ({ evidence, ...condition }) => {
  const f = fixture();
  deferAppTask(f.target, f.claim(), {
    disposition: "waiting",
    summary: "Await exact evidence",
    conditions: [{ ...condition, expected: true }],
  });
  recordAppTaskTrigger(f.target, "child", { type: "provider.completed", data: { status: "done" } });
  const next = f.claim();
  expect(f.read.get("child")).toMatchObject({ status: "running", conditions: [{ id: condition.id }] });
  completeAppTask(f.target, next, { summary: evidence });
  expect(f.read.get("child")).toMatchObject({ status: "waiting", conditions: [{ id: condition.id }] });
  expect(() => f.close()).toThrow("newer or unresolved work");
  if (condition.id === "retry-signal") {
    recordAppTaskTrigger(f.target, "child", { type: "owner.reconcile", data: {} });
    completeAppTask(f.target, f.claim(), {
      summary: evidence,
      facts: [evidence],
      actions: [
        { kind: "retire-condition", conditionId: condition.id, expectedConditionGeneration: 1, reason: evidence },
      ],
    });
    expect(f.read.get("child")).toMatchObject({ status: "idle", conditions: [] });
    expect(f.close().applied).toBe(true);
  }
});

test("accepted containment evidence does not close or certify the broader content outcome", () => {
  const f = fixture();
  completeAppTask(f.target, f.claim(), {
    summary: "Retry loop contained; browser content remains unverified",
    result: { containment: true, contentVerified: false },
  });
  expect(f.read.get("child")).toMatchObject({ status: "idle", result: { containment: true, contentVerified: false } });
  expect(f.target.resourceStore.readCancellation("child")).toBeNull();
});
