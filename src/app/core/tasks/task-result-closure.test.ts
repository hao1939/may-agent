import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppTaskPolicy, ResourceCreator } from "@may-agent/sdk";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { createRuntimeTaskRead } from "../reads/app-read.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
} from "./app-task-reconciler.js";

const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);

const policy: AppTaskPolicy["closeOnResult"] = ({ acceptedResult }) =>
  acceptedResult.result?.endAssignment === true
    ? { reason: "The scoped review is fulfilled; no follow-through remains" }
    : null;

function fixture(
  creator: ResourceCreator | null = { appId: "sample" },
  closeOnResult = policy,
  agent?: string,
) {
  const root = mkdtempSync(join(tmpdir(), "task-result-closure-"));
  roots.push(root);
  const store = AppTaskResourceStore.fromDb(getDb(root), "sample");
  store.bootstrapSnapshot({ groups: { root: { id: "root", parent_id: null } }, root_task_id: "root" }, "fixture");
  const config = appTaskContext({
    appDir: root,
    projectDir: root,
    agent: "owner",
    maxConcurrent: 3,
    resourceStore: store,
    closeOnResult,
  });
  observeAppTaskIntent(config, {
    appAgent: "owner",
    ...(creator ? { creator } : {}),
    intent: {
      id: "review",
      parentId: "root",
      outcome: "Assess the exact report",
      acceptance: ["Return a supported disposition"],
      ...(agent ? { agent } : {}),
    },
  });
  if (creator === null) {
    // Imported history can lack provenance; ordinary admission always records it.
    const resource = store.readTask("review")!;
    delete resource.metadata.creator;
    store.db
      .prepare("UPDATE app_tasks SET resource_json=? WHERE app_id='sample' AND task_id='review'")
      .run(JSON.stringify(resource));
  }
  const claim = () => {
    const attempt = claimObservedAppTask(config, { taskId: "review", appAgent: "owner", handler: "auto" });
    if (attempt.kind !== "claimed") throw new Error(`Unexpected ${attempt.kind}`);
    return attempt;
  };
  const read = createRuntimeTaskRead({ taskStateConfig: config });
  return { root, config, store, claim, read };
}

const ending = {
  summary: "Supported no change",
  response: "Report assessed; no corrective work",
  facts: ["Exact report and subject verified"],
  result: { endAssignment: true },
};

test("App policy ends its own finite assignment in the accepted-result transaction and survives reopen", () => {
  const f = fixture();
  const claim = f.claim();
  const applied = completeAppTask(f.config, claim, ending);
  expect(applied.cancelledTasks?.[0]?.cancellation).toMatchObject({
    kind: "closed",
    acceptedResultAttemptId: claim.attemptId,
    decidedBy: { kind: "app-policy" },
  });
  expect(f.read.get("review")).toMatchObject({
    status: "closed",
    response: ending.response,
    facts: ending.facts,
    result: ending.result,
    acceptedAttempt: { id: claim.attemptId },
  });
  const accepted = f.store.readAttempt(claim.attemptId)?.acceptedResult;
  expect(accepted).toMatchObject({ state: "converged", ...ending });
  expect(completeAppTask(f.config, claim, ending)).toMatchObject({ status: "stale" });
  closeDb(f.root);
  const reopened = AppTaskResourceStore.fromDb(getDb(f.root), "sample");
  expect(reopened.readCancellation("review")).toMatchObject({
    kind: "closed",
    acceptedResultAttemptId: claim.attemptId,
  });
  expect(reopened.readAttempt(claim.attemptId)?.acceptedResult).toEqual(accepted);
  expect(reopened.listRecoveryCandidates().items).toEqual([]);
});

test("an assigned agent reaches the App policy and can authorize the finite ending", () => {
  let callbackAgent: string | undefined;
  const f = fixture(
    undefined,
    (context) => {
      callbackAgent = context.task.agent;
      return context.task.agent === "reviewer" ? policy(context) : null;
    },
    "reviewer",
  );
  expect(f.read.get("review")?.agent).toBe("reviewer");
  const claim = f.claim();
  expect(claim.agent).toBe("reviewer");
  completeAppTask(f.config, claim, ending);
  expect(callbackAgent).toBe("reviewer");
  expect(f.read.get("review")).toMatchObject({
    status: "closed",
    agent: "reviewer",
    acceptedAttempt: { id: claim.attemptId },
  });
});

test.each([{ appId: "sample", taskId: "creator" }, { appId: "another-app" }, null])(
  "App policy cannot acquire creator authority over delegated/foreign/unattributed work: %j",
  (creator) => {
    let called = false;
    const f = fixture(creator, () => {
      called = true;
      return { reason: "Must not run" };
    });
    completeAppTask(f.config, f.claim(), ending);
    expect(f.read.get("review")?.status).toBe("idle");
    expect(called).toBe(false);
    expect(f.store.readCancellation("review")).toBeNull();
  },
);

test("convergence and an owner recommendation without App authorization both remain idle", () => {
  const f = fixture();
  completeAppTask(f.config, f.claim(), { summary: "A standing cycle completed", facts: ["Standing purpose remains"] });
  expect(f.read.get("review")?.status).toBe("idle");
  const g = fixture();
  g.config.closeOnResult = undefined;
  completeAppTask(g.config, g.claim(), ending);
  expect(g.read.get("review")?.status).toBe("idle");
});

test("new input racing the accepted result is retained rather than closed", () => {
  const f = fixture();
  const first = f.claim();
  recordAppTaskTrigger(f.config, "review", { type: "report.corrected", data: { revision: 2 } });
  completeAppTask(f.config, first, ending);
  expect(f.read.get("review")?.status).toBe("pending");
  expect(f.store.readCancellation("review")).toBeNull();
  completeAppTask(f.config, f.claim(), ending);
  expect(f.read.get("review")?.status).toBe("closed");
});

test("a remaining exact Condition prevents App-policy closure after a narrower result", () => {
  const f = fixture();
  deferAppTask(f.config, f.claim(), {
    disposition: "waiting",
    summary: "Await approval",
    conditions: [
      { id: "approval", type: "review.approved", subject: "change:one", owner: "human:owner", expected: true },
    ],
  });
  recordAppTaskTrigger(f.config, "review", { type: "report.corrected", data: {} });
  completeAppTask(f.config, f.claim(), ending);
  expect(f.read.get("review")?.status).toBe("waiting");
  expect(f.store.readTask("review")?.status.conditionIds).toEqual(["approval"]);
  expect(f.store.readCancellation("review")).toBeNull();
});

test("invalid policy decision cannot partially persist the accepted result", () => {
  const f = fixture(undefined, () => ({ reason: " " }));
  const claim = f.claim();
  expect(() => completeAppTask(f.config, claim, ending)).toThrow("nonblank closure reason");
  expect(f.store.readTask("review")?.status.phase).toBe("running");
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(f.store.readCancellation("review")).toBeNull();
});
