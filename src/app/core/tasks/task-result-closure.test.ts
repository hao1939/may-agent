import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppTaskPolicy, ResourceCreator } from "@may-agent/sdk/app";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { createRuntimeTaskRead } from "../reads/app-read.js";
import { admitTaskInput } from "../state/inbox.js";
import { readLoadedAppTaskView, reconcileLoadedAppTaskOnce } from "./app-task-runtime.js";
import { appTaskRuntimeTestSuite } from "../../../../test/fixtures/app-task-runtime.js";
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

const runtime = appTaskRuntimeTestSuite();

test.each(["keep-open", "close", "no-policy"] as const)(
  "plain workflow done honors App closure policy before Host fallback: %s",
  async (mode) => {
    const f = runtime.fixture();
    const bus = runtime.eventBus();
    const workflowDir = join(f.root, "agents", "sample-owner", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "cycle.ts"), `
export const name = "cycle";
export const description = "Complete one review cycle";
export async function execute(ctx) {
  return ctx.done("Cycle reviewed", { answer: 42 }, { facts: { source: "fixture" } });
}
`);
    const app = runtime.definition();
    const reason = "The finite assignment is fulfilled";
    let policyCalls = 0;
    app.tasks = mode === "no-policy" ? {} : {
      closeOnResult(context) {
        policyCalls++;
        expect(context.creator).toEqual({ appId: "sample" });
        expect(context.acceptedResult).toMatchObject({ state: "converged", result: { answer: 42 } });
        return mode === "close" ? { reason } : null;
      },
    };
    await runtime.installAppTaskRuntimes({
      ...runtime.options(f, bus), installControllers: false,
      agentsRoot: join(f.root, "agents"), sharedRoot: join(f.root, "shared"),
      appRegistrySnapshot: { id: "workflow-closure", generation: 1,
        entries: [{ appDir: f.appDir, definition: app }] },
    });
    const config = runtime.loadedTaskConfig(f);
    const taskId = "work/review";
    observeAppTaskIntent(config, {
      appAgent: "sample-owner", creator: { appId: "sample" },
      intent: { id: taskId, parentId: "operations", outcome: "Review each new report",
        acceptance: ["Report assessed"], workflow: "cycle" },
    });
    const generation = config.resourceStore.readTask(taskId)!.metadata.generation;
    await reconcileLoadedAppTaskOnce({ bus, appId: "sample", taskId,
      dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" } });
    const accepted = runtime.readAcceptedRuntimeAttempt(config, taskId)!;
    expect(accepted.acceptedResult).toMatchObject({
      state: "converged", summary: "Cycle reviewed", result: { answer: 42 },
      facts: ['execution-facts:{"source":"fixture"}'],
    });
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })).toMatchObject({
      id: taskId, generation, status: mode === "keep-open" ? "idle" : "closed",
      result: { answer: 42 }, facts: ['execution-facts:{"source":"fixture"}'],
      acceptedAttempt: { id: accepted.metadata.id },
    });
    expect(policyCalls).toBe(mode === "no-policy" ? 0 : 1);
    if (mode === "keep-open") {
      expect(config.resourceStore.readCancellation(taskId)).toBeNull();
      expect(admitTaskInput(config, {
        appId: "sample", attachment: { kind: "existing", taskId }, idempotencyKey: "next-report",
        inputContext: { id: "next-report", source: { kind: "human", id: "requester" },
          input: { kind: "message", data: { text: "Review the next report" } } },
      })).toMatchObject({ taskId });
      expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })).toMatchObject({
        id: taskId, generation, status: "pending",
        pendingEvents: { items: [{ event: { data: {
          idempotencyKey: "next-report", taskId,
          request: { input: { data: { text: "Review the next report" } } },
        } } }] },
      });
    } else {
      expect(config.resourceStore.readCancellation(taskId)).toMatchObject({
        kind: "closed", acceptedResultAttemptId: accepted.metadata.id,
        reason: mode === "close" ? reason : "Public execution returned done for the finite assignment",
        decidedBy: { kind: mode === "close" ? "app-policy" : "host-execution" },
      });
    }
  },
);

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

test.each([{ appId: "sample", taskId: "creator" }, { appId: "another-app", taskId: "caller" }, { appId: "another-app" }])(
  "App closeOnResult closes finite delegated and cross-App assignments while preserving creator provenance: %j",
  (creator) => {
    let observedCreator: ResourceCreator | undefined;
    const f = fixture(creator, (ctx) => {
      observedCreator = ctx.creator;
      return policy(ctx);
    });
    const claim = f.claim();
    const applied = completeAppTask(f.config, claim, ending);
    expect(observedCreator).toEqual(creator);
    expect(applied.cancelledTasks?.[0]?.cancellation).toMatchObject({
      kind: "closed",
      acceptedResultAttemptId: claim.attemptId,
      decidedBy: { kind: "app-policy" },
    });
    expect(f.read.get("review")).toMatchObject({
      status: "closed",
      response: ending.response,
      result: ending.result,
      acceptedAttempt: { id: claim.attemptId },
    });
  },
);

test("App policy does not close historical unattributed records lacking creator provenance", () => {
  let called = false;
  const f = fixture(null, () => {
    called = true;
    return { reason: "Must not run" };
  });
  completeAppTask(f.config, f.claim(), ending);
  expect(f.read.get("review")?.status).toBe("idle");
  expect(called).toBe(false);
  expect(f.store.readCancellation("review")).toBeNull();
});

test("convergence and an owner recommendation without App authorization both remain idle", () => {
  const f = fixture();
  completeAppTask(f.config, f.claim(), { summary: "A standing cycle completed", facts: ["Standing purpose remains"] });
  expect(f.read.get("review")?.status).toBe("idle");
  const g = fixture();
  g.config.closeOnResult = undefined;
  completeAppTask(g.config, g.claim(), ending);
  expect(g.read.get("review")?.status).toBe("idle");
});

test("Host finite-done provenance closes an ordinary App-created assignment without global legacy closure", () => {
  const f = fixture();
  f.config.closeOnResult = undefined;
  const claim = f.claim();
  const applied = completeAppTask(f.config, claim, {
    summary: "Finite execution completed",
    result: { answer: 42 },
    hostCompletion: "finite-done",
    conversation: false,
  });
  expect(applied.cancelledTasks?.[0]?.cancellation).toMatchObject({
    kind: "closed",
    acceptedResultAttemptId: claim.attemptId,
    decidedBy: { kind: "host-execution" },
  });
  expect(f.read.get("review")).toMatchObject({ status: "closed", result: { answer: 42 } });
});

test("Host finite-done provenance never auto-closes Conversation responsibility", () => {
  const f = fixture();
  f.config.closeOnResult = undefined;
  completeAppTask(f.config, f.claim(), {
    summary: "Conversation turn answered",
    hostCompletion: "finite-done",
    conversation: true,
  });
  expect(f.read.get("review")?.status).toBe("idle");
  expect(f.store.readCancellation("review")).toBeNull();
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
