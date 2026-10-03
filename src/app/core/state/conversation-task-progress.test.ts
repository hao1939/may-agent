import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { getDb, closeDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  readAppTaskAdmissionOutcome,
} from "../tasks/app-task-reconciler.js";
import {
  admitConversationTaskInput,
  completeConversationTaskTurn,
  readConversationTaskInputs,
  stopConversationTaskTurn,
  validateConversationTaskProposal,
  updateConversationTaskRequest,
} from "./conversation-task-turns.js";
import { getAppInboxItem } from "./app-inbox-store.js";
import { applyConversationRequestUpdates, readConversationRequest } from "./conversation-requests.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
const app = defineApp({
  id: "sample",
  version: 1,
  agent: "sample",
  conversation: { mode: "agent" },
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ text: Type.String() }) }),
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-scoped-progress-"));
  roots.push(root);
  let db = getDb(root);
  let store = AppTaskResourceStore.fromDb(db, app.id);
  store.bootstrapSnapshot(
    {
      project: app.id,
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
    "scoped-progress",
  );
  const context = () =>
    appTaskContext({ appDir: root, projectDir: root, agent: app.id, maxConcurrent: 1, resourceStore: store });
  const admit = (id: string, sequence: number, text = `Answer ${id}`, source: "human" | "system" = "human") =>
    admitConversationTaskInput(context(), {
      id,
      appId: app.id,
      conversationId: "chat",
      conversationSequence: sequence,
      source: { kind: source, id },
      input: { kind: "message", data: { text } },
      intent: {
        parentId: "root",
        executor: "conversation",
        outcome: "Answer considered questions",
        acceptance: ["Retain later input"],
      },
    });
  const claim = (taskId: string) => {
    const c = claimObservedAppTask(context(), { taskId, appAgent: app.id, handler: "executor:conversation" });
    if (c.kind !== "claimed") throw new Error(`Expected claim: ${c.kind}`);
    return c;
  };
  return {
    root,
    context,
    admit,
    claim,
    get db() {
      return db;
    },
    get store() {
      return store;
    },
    reopen() {
      closeDb(root);
      db = getDb(root);
      store = AppTaskResourceStore.fromDb(db, app.id);
    },
  };
}

test.each(["human", "system"] as const)(
  "scoped progress: progress while %s input arrives before every finish",
  (source) => {
    const f = fixture();
    const first = f.admit("first", 1);
    const accepted: number[] = [];
    for (let i = 0; i < 8; i++) {
      const claim = f.claim(first.taskId);
      const considered = readConversationTaskInputs(f.context(), claim).map((item) => item.id);
      f.admit(`later-${i}`, i + 2, `Independent update ${i}`, source);
      completeConversationTaskTurn(f.context(), claim, {
        summary: `Handled ${considered.join(",")}`,
        response: `Answer for ${considered.join(",")}`,
      });
      expect(getAppInboxItem(f.db, `later-${i}`)?.status).not.toBe("done");
      accepted.push(Number(f.db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items WHERE status='done'").get().n));
      f.reopen();
    }
    expect(accepted).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const last = f.claim(first.taskId);
    completeConversationTaskTurn(f.context(), last, { summary: "Handled remaining inputs", response: "Final answer" });
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items WHERE status='done'").get().n).toBe(9);
  },
);

test("scoped progress: finite backlog larger than one claim makes bounded progress", () => {
  const f = fixture();
  let taskId = "";
  for (let i = 0; i < 70; i++) taskId = f.admit(`input-${i}`, i + 1).taskId;
  const sizes: number[] = [];
  const done: number[] = [];
  for (let i = 0; i < 3; i++) {
    const claim = f.claim(taskId);
    sizes.push(readConversationTaskInputs(f.context(), claim).length);
    completeConversationTaskTurn(f.context(), claim, { summary: "Answered considered inputs", response: "Answers" });
    done.push(Number(f.db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items WHERE status='done'").get().n));
    f.reopen();
  }
  expect(done).toEqual([32, 64, 70]);
  expect(sizes).toEqual([32, 32, 6]);
});

function handoff() {
  const f = fixture();
  const first = f.admit("first", 1, "Compare A and B");
  const claim = f.claim(first.taskId);
  let mappings = 0;
  const getTaskApp = () => ({
    config: f.context(),
    app: defineApp({
      ...app,
      tasks: {},
      task: () => {
        mappings++;
        return {
          kind: "desired",
          intent: { id: "worker", parentId: "root", outcome: "Collect requested facts", acceptance: ["Return facts"] },
        };
      },
    }),
  });
  const decision = {
    summary: "Requested facts",
    response: "I requested the comparison facts.",
    requestUpdates: [
      {
        id: "comparison",
        expectedRevision: 0,
        scope: "Compare A and B",
        disposition: "open" as const,
        reason: "Collect facts",
      },
    ],
    followUp: { appId: app.id, requestId: "comparison", input: { kind: "message", data: { text: "Get facts" } } },
  };
  const proposal = validateConversationTaskProposal(f.context(), claim, decision, getTaskApp);
  return { f, first, claim, proposal, getTaskApp, mappings: () => mappings };
}

test("scoped progress: unrelated update does not need to block a useful handoff", () => {
  const h = handoff();
  h.f.admit("background", 2, "Another worker returned its report", "system");
  completeConversationTaskTurn(h.f.context(), h.claim, h.proposal.decision, {
    ...h.proposal,
    getTaskApp: h.getTaskApp,
  });
  expect(h.mappings()).toBe(1);
  expect(Boolean(h.f.store.readTask("worker"))).toBe(true);
  expect(getAppInboxItem(h.f.db, "background")?.status).not.toBe("done");
});

test("scoped progress: actual Request revision still rejects stale handoff atomically", () => {
  const h = handoff();
  applyConversationRequestUpdates(h.f.db, {
    appId: app.id,
    conversationId: "chat",
    updateKey: "correction",
    now: 1,
    updates: [{ id: "comparison", scope: "Compare A and C instead", expectedRevision: 0, disposition: "open" }],
  });
  expect(() =>
    completeConversationTaskTurn(h.f.context(), h.claim, h.proposal.decision, {
      ...h.proposal,
      getTaskApp: h.getTaskApp,
    }),
  ).toThrow("revision changed");
  expect(h.mappings()).toBe(0);
  expect(h.f.store.readAttempt(h.claim.attemptId)?.acceptedResult).toBeUndefined();
  expect(readConversationRequest(h.f.db, app.id, "chat", "comparison")?.scope).toBe("Compare A and C instead");
});

test("scoped progress: explicit Stop still fences the running attempt", () => {
  const f = fixture();
  const first = f.admit("first", 1);
  const claim = f.claim(first.taskId);
  stopConversationTaskTurn(f.context(), {
    appId: app.id,
    conversationId: "chat",
    turnId: claim.attemptId,
    expectedRevision: claim.generation,
  });
  expect(completeAppTask(f.context(), claim, { summary: "Late completion" }).status).toBe("stale");
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
});

test("scoped progress: unread free-text correction is not an applied revision", () => {
  const h = handoff();
  h.f.admit("correction", 2, "Wait, do not request that comparison; compare A and C instead");
  completeConversationTaskTurn(h.f.context(), h.claim, h.proposal.decision, {
    ...h.proposal,
    getTaskApp: h.getTaskApp,
  });
  // Ordinary input is considered at the next decision boundary; explicit Stop is separate.
  expect(h.mappings()).toBe(1);
  expect(getAppInboxItem(h.f.db, "correction")?.status).not.toBe("done");
  const firstResult = h.f.store.readAttempt(h.claim.attemptId)?.acceptedResult;
  h.f.reopen();
  const next = h.f.claim(h.first.taskId);
  h.f.admit("later", 3, "Also explain what facts were reused");
  const updated = updateConversationTaskRequest(
    h.f.context(),
    next,
    {
      id: "comparison",
      expectedRevision: 1,
      scope: "Compare A and C instead",
      inputIds: ["correction"],
    },
    "correct-scope",
  );
  expect(updated.revision).toBe(2);
  completeConversationTaskTurn(h.f.context(), next, {
    summary: "Updated the comparison; retained previous facts",
    response: "The comparison now covers A and C.",
    requestUpdates: [
      {
        id: "comparison",
        expectedRevision: 2,
        disposition: "open",
        reason: "The revised comparison still needs work",
        inputIds: ["correction"],
      },
    ],
  });
  expect(readConversationRequest(h.f.db, app.id, "chat", "comparison")).toMatchObject({
    scope: "Compare A and C instead",
    status: "open",
    revision: 3,
  });
  expect(h.f.store.readAttempt(h.claim.attemptId)?.acceptedResult).toEqual(firstResult);
  expect(getAppInboxItem(h.f.db, "correction")?.status).toBe("done");
  expect(getAppInboxItem(h.f.db, "later")?.status).not.toBe("done");
  expect(h.mappings()).toBe(1); // The saved handoff was not replayed to repair its caller's result.
});

test("scoped progress: an accepted partial contribution retains requirements across restart", () => {
  const f = fixture();
  const first = f.admit("first", 1, "Implement and verify the change");
  const claim = f.claim(first.taskId);
  const later = f.admit("later", 2, "Also explain the tradeoffs");
  deferAppTask(f.context(), claim, {
    disposition: "waiting",
    continue: true,
    summary: "Patch prepared; verification remains",
    result: { artifact: "patch-1" },
    facts: ["patch:saved"],
    inputKeys: [first.item.taskAdmissionKey!],
  });
  f.reopen();
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult).toMatchObject({
    state: "waiting",
    continue: true,
    result: { artifact: "patch-1" },
    inputKeys: [first.item.taskAdmissionKey!],
  });
  expect(readAppTaskAdmissionOutcome(f.context(), first.taskId, first.item.taskAdmissionKey!)).toBeNull();
  expect(readAppTaskAdmissionOutcome(f.context(), first.taskId, later.item.taskAdmissionKey!)).toBeNull();
  const next = f.claim(first.taskId);
  expect(readConversationTaskInputs(f.context(), next).map(({ id }) => id)).toEqual(["first", "later"]);
  completeConversationTaskTurn(f.context(), next, {
    summary: "Verified existing patch and explained the tradeoffs",
    response: "Verification and explanation complete",
    facts: ["patch-1:verified"],
  });
  expect(getAppInboxItem(f.db, "first")?.status).toBe("done");
  expect(getAppInboxItem(f.db, "later")?.status).toBe("done");
});
