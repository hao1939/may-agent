import type { TaskAgentInput, TaskConversationRunner } from "./execution.js";
import { expect, test, setSystemTime } from "bun:test";
import { appTaskContext, observeAppTaskIntent } from "./app-task-reconciler.js";
import { readConversationTaskInputs } from "../state/conversation-task-turns.js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  Type,
  defineApp,
  type TaskExecutor,
  type TaskCommunication,
  type TaskAttempt,
} from "@may-agent/sdk";
import { createAssistantMessageEventStream, type ToolCall } from "@earendil-works/pi-ai";
import { DbWriter } from "../../../lib/db-writer.js";
import { createAgentRun } from "../../../lib/agent-runner.js";
import { SubagentManager } from "../../../lib/manager.js";
import { getDb, closeDb } from "../../../lib/requests.js";
import { createTaskAgentRunner } from "../../adapters/executors/managed-agent.js";
import { fakeModel } from "../../../../test/fixtures/model.js";
import { usageReply } from "../../../../test/fixtures/execution-usage.js";
import { EventBus } from "../events/bus.js";
import { AppRegistry } from "../apps/registry.js";
import { startAppInboxRuntime } from "../../composition/app-inbox-runtime.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "./app-task-runtime.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { readConversationRequest } from "../state/conversation-requests.js";
import { listAppConversationMessages, readConversationMessageTopicId } from "../state/conversations.js";
import { listAppInboxItems } from "../state/app-inbox-store.js";

async function fixture(
  execute: TaskExecutor,
  conversationMode?: "task" | "agent",
  beforeAgent?: (input: TaskAgentInput) => Promise<void>,
  conversations?: TaskConversationRunner,
  managedAgents?: ReturnType<typeof createTaskAgentRunner>,
) {
  const root = mkdtempSync(join(tmpdir(), "task-communication-"));
  const appDir = join(root, "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks/seed.json"),
    JSON.stringify({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }),
  );
  const app = defineApp({
    ...(conversationMode
      ? { conversation: { mode: conversationMode, inputKinds: ["message"], conversationId: "discussion" } }
      : {}),
    id: "sample",
    agent: "owner",
    version: 1,
    inputSchema: Type.Object({ kind: Type.String(), data: Type.Unknown() }),
    task: ({ input }) => ({
      kind: "desired",
      intent: {
        id: input.kind === "review" ? "reviewer" : "work",
        parentId: "root",
        agent: input.kind === "review" ? "reviewer" : "owner",
        executor: "fixture",
        outcome: input.kind === "review" ? "Review the contribution" : "Handle the ask",
        acceptance: ["Address accepted requirements"],
      },
    }),
    tasks: { maxConcurrent: 2 },
  });
  let db = getDb(root);
  let bus = new EventBus();
  let inbox: Awaited<ReturnType<typeof startAppInboxRuntime>>;
  let store: AppTaskResourceStore;
  const registry = new AppRegistry(async () => [{ appDir, definition: app }]);
  await registry.reload();
  const open = async () => {
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    await installAppTaskRuntimes(
      {
        projectRoot: root,
        projectsRoot: root,
        persistDir: root,
        bus,
        appRegistrySnapshot: registry.snapshot(),
        executors: { fixture: execute },
        conversations,
        agents: {
          available: (agent) => managedAgents?.available(agent) ?? true,
          prepare: async (input) => managedAgents?.prepare(input) ?? true,
          role: (agent) => managedAgents?.role(agent) ?? { agent: "owner", instructions: "Handle input" },
          snapshot() {
            return this;
          },
          async execute(input) {
            const { attempt } = input;
            await beforeAgent?.(input);
            return managedAgents
              ? managedAgents.execute(input)
              : { runId: attempt.attemptId, handlerResult: { ...(await execute(attempt)), actions: [] } };
          },
        },
      },
      { deferRecovery: true },
    );
    store = AppTaskResourceStore.activeFromDb(db, app.id)!;
    const capability = createAppTaskCapability({ bus });
    inbox = await startAppInboxRuntime({
      db,
      bus,
      registry,
      persistDir: root,
      schedulesEnabled: false,
      attachTask: capability.attach,
      readDependency: capability.readDependency,
      admitConversation: capability.admitConversation,
      admitTaskEvent: capability.admitEvent,
      hasTaskTarget: capability.has,
      previewTaskEvent: capability.previewEvent,
      previewTaskEventRoutes: capability.previewEventRoutes,
    });
  };
  await open();
  return {
    get db() {
      return db;
    },
    get bus() {
      return bus;
    },
    get store() {
      return store;
    },
    get inbox() {
      return inbox;
    },
    admit(id: string, kind = "message", conversationId: string | undefined = "discussion") {
      return inbox.host.admit({
        id,
        appId: "sample",
        source: { kind: "human", id },
        input: { kind, data: { message: id } },
        conversationId,
        ...(conversationId ? { conversationSequence: 1 } : {}),
        channel: "telegram",
        channelTargetId: "synthetic-chat",
        channelMessageId: 7,
      });
    },
    run(taskId = "work") {
      return reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId,
        dispatch: { lane: "human", enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 },
      });
    },
    async useTaskMode() {
      app.conversation = { mode: "task", inputKinds: ["message"], conversationId: "discussion" };
      await registry.reload();
      await this.reopen();
    },
    async reopen() {
      inbox.close();
      await closeInstalledAppTaskRuntimes(bus);
      closeDb(root);
      bus = new EventBus();
      db = getDb(root);
      await open();
    },
    async close() {
      inbox.close();
      await closeInstalledAppTaskRuntimes(bus);
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const progress: TaskCommunication = {
  id: "progress",
  inputId: "ask",
  message: "The tests passed; review is still pending.",
};

test("a malformed Conversation handoff falls back to its agent, retains failure across restart, and answers the original input", async () => {
  let agentCalls = 0;
  let conversationCalls = 0;
  const f = await fixture(async (attempt) => {
    agentCalls++;
    expect(attempt.events.inputs?.map(({ key }) => key).sort()).toEqual([
      "conversation-follow-up:sample:ask", "conversation-input:ask",
    ]);
    expect(attempt.events.inputs?.find(({ key }) => key.startsWith("conversation-follow-up:"))?.communication)
      .toBeUndefined();
    if (agentCalls === 1) {
      expect(attempt.previousAttempt?.summary).toContain("Conversation input does not belong to this Task attempt");
      throw new Error("Temporary diagnostic failure");
    }
    expect(attempt.previousAttempt?.summary).toContain("Temporary diagnostic failure");
    return {
      state: "converged", summary: "Answered through ordinary Task communication",
      facts: ["Recovered the original ask; the retained legacy routing defect needs later investigation."],
      communication: [{ id: "recovered-answer", inputId: "ask", message: "Here is the requested answer." }],
    };
  }, "agent", async (input) => {
    expect(input.fallbackReason).toBeTruthy();
  }, {
    async execute({ config, claim }) {
      conversationCalls++;
      readConversationTaskInputs(config, claim);
      throw new Error("The malformed fixture should fail input validation first");
    },
  });
  try {
    const human = f.admit("ask").item;
    const taskId = human.executionTaskId!;
    const config = appTaskContext({ appDir: "fixture", projectDir: "fixture", agent: "owner", resourceStore: f.store });
    // Retained old-format follow-up: distinct work reused a Conversation input ID.
    // Current normal admission prevents this, but deployed history can contain it.
    const admissionKey = "conversation-follow-up:sample:ask";
    observeAppTaskIntent(config, {
      appAgent: "owner", intent: { ...f.store.readTask(taskId)!.spec, id: taskId }, admissionKey,
      trigger: {
        type: "app.task.requested", source: "fixture", owner: "agent:owner",
        target: { appId: "sample", taskId }, idempotencyKey: admissionKey,
        data: { appId: "sample", taskId, idempotencyKey: admissionKey,
          request: { id: "ask", source: { kind: "system", id: "retained-follow-up" },
            input: { kind: "goal", data: { outcome: "Check the accompanying evidence" } } } },
      },
    });
    const generation = f.store.readTask(taskId)!.metadata.generation;
    await f.run(taskId);
    expect(agentCalls).toBe(0);
    const failedId = Object.values(f.store.readTaskContext({ taskIds: [taskId] }).attempts!)[0]!.metadata.id;
    const failure = f.store.readAttempt(failedId);
    expect(failure?.state).toBe("failed");
    for (let pass = 0; pass < 2; pass++) {
      setSystemTime(f.store.readTask(taskId)!.status.executionRetryAt! + 1);
      await f.reopen();
      await f.run(taskId);
    }
    await f.inbox.host.refreshTaskResults("sample", taskId);
    expect(agentCalls).toBe(2);
    expect(conversationCalls).toBe(1);
    expect(f.store.readAttempt(failedId)).toEqual(failure);
    expect(f.store.readTask(taskId)).toMatchObject({ metadata: { generation }, status: { phase: "converged" } });
    const admissions = f.store.readTaskContext({ taskIds: [], admissionIds: [
      "conversation-input:ask", "conversation-follow-up:sample:ask",
    ] }).appTaskAdmissions!;
    expect(admissions["conversation-input:ask"]?.resultAttemptId).toBeTruthy();
    expect(admissions["conversation-follow-up:sample:ask"]?.resultAttemptId)
      .toBe(admissions["conversation-input:ask"]?.resultAttemptId);
    expect(listAppInboxItems(f.db, { appId: "sample" }).find(({ id }) => id === "ask")?.status).toBe("done");
    expect(listAppConversationMessages(f.db, "sample", "discussion").filter(({ author }) => author.kind === "agent")
      .map(({ text }) => text)).toEqual(["Here is the requested answer."]);
  } finally {
    setSystemTime();
    await f.close();
  }
});

test("ordinary Task publishes before failure, reuses the publication after restart, and retains the ask", async () => {
  let calls = 0;
  const f = await fixture(async (attempt) => {
    calls++;
    expect(attempt.events.inputs?.[0]).toMatchObject({
      id: "ask",
      key: "task:ask",
      communication: { conversationId: "discussion", replyTo: "ask" },
    });
    expect(attempt.events.inputs?.[0]).not.toHaveProperty("input");
    expect(JSON.stringify(attempt.events.communication)).not.toContain("synthetic-chat");
    if (calls === 1) {
      await attempt.apply({
        communication: [
          {
            id: "accept-ask",
            inputId: "ask",
            requestUpdates: [
              { id: "requested-work", expectedRevision: 0, scope: "Test and review the change", disposition: "open" },
            ],
          },
        ],
      });
      const published = await attempt.apply({ communication: [progress] });
      expect(published.communication?.[0]?.messageId).toMatch(/^task-message:/);
      throw new Error("Execution failed after publication");
    }
    expect(attempt.events.communication?.[0]?.requests?.[0]).toMatchObject({
      id: "requested-work",
      status: "open",
      revision: 1,
    });
    // Retained publications remain visible on retry even though the original
    // input body is already supplied by Task events. The operation can be cited.
    expect(attempt.events.communication?.[0]?.messages).toMatchObject([
      { text: progress.message, metadata: { communicationId: "progress" } },
    ]);
    const replay = await attempt.apply({ communication: [progress] });
    expect(replay.communication?.[0]?.messageId).toMatch(/^task-message:/);
    await expect(attempt.apply({ communication: [{ ...progress, message: "Different text" }] })).rejects.toThrow(
      "different content",
    );
    return {
      state: "waiting",
      summary: "Tests complete, waiting for review",
      facts: ["tests:passed"],
      communication: [
        {
          id: "explain-wait",
          inputId: "ask",
          replyId: "progress",
          requestUpdates: [
            { id: "requested-work", expectedRevision: 1, disposition: "open", reason: "Review is pending" },
          ],
        },
      ],
      conditions: [
        {
          id: "review",
          type: "review.completed",
          subject: "review:change",
          expected: { approved: true },
          owner: "agent:reviewer",
        },
      ],
    };
  });
  try {
    f.admit("ask");
    await f.run();
    expect(f.store.readTask("work")?.status.executionFailures).toBe(1);
    expect(readConversationRequest(f.db, "sample", "discussion", "requested-work")?.status).toBe("open");
    expect(
      listAppConversationMessages(f.db, "sample", "discussion")
        .filter(({ author }) => author.kind === "agent")
        .map(({ text }) => text),
    ).toEqual([progress.message!]);
    await f.reopen();
    // The existing recovery timer retries the failed assignment after reopening.
    const deadline = Date.now() + 4000;
    while (calls < 2 || f.store.readTask("work")?.status.phase === "running") {
      if (Date.now() > deadline) throw new Error("Recovery did not settle");
      await Bun.sleep(5);
    }
    expect(calls).toBe(2);
    expect(f.store.readTask("work")?.status.phase).toBe("waiting");
    expect(readConversationRequest(f.db, "sample", "discussion", "requested-work")?.status).toBe("open");
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM app_task_admissions WHERE app_id = 'sample'").get()?.n).toBe(1);
    expect(
      f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'conversation.message.created'").get()?.n,
    ).toBe(1);
    expect(
      listAppConversationMessages(f.db, "sample", "discussion").filter(({ author }) => author.kind === "agent"),
    ).toHaveLength(1);
    expect(listAppInboxItems(f.db, { appId: "sample" })[0]?.status).not.toBe("done");
  } finally {
    await f.close();
  }
});

async function until(check: () => boolean) {
  const deadline = Date.now() + 4000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Expected Task transition");
    await Bun.sleep(5);
  }
}

test("one ordinary Task asks for review, continues testing, and answers through its original context", async () => {
  let parentCalls = 0;
  let reviewed = false;
  let testsPassed = false;
  let releaseReview!: () => void;
  const reviewPermission = new Promise<void>((resolve) => {
    releaseReview = resolve;
  });
  const f = await fixture(async (attempt) => {
    if (attempt.task.id === "reviewer") {
      expect(attempt.events.inputs?.[0]?.communication).toBeUndefined();
      await expect(attempt.read.communication!("ask")).rejects.toThrow("accepted by this Task");
      await expect(
        attempt.apply({ communication: [{ id: "steal-reply", inputId: "ask", message: "I own the ask now" }] }),
      ).rejects.toThrow("accepted by this Task");
      await reviewPermission;
      reviewed = true;
      return { state: "converged", summary: "Review approved", facts: ["review:approved"], result: { approved: true } };
    }
    parentCalls++;
    if (parentCalls === 1) {
      await attempt.apply({
        communication: [
          {
            id: "accept",
            inputId: "ask",
            requestUpdates: [
              { id: "change", expectedRevision: 0, scope: "Review and test the change", disposition: "open" },
            ],
          },
        ],
      });
      const receipt = await attempt.apply({
        requests: [
          { id: "review", appId: "sample", input: { kind: "review", data: { outcome: "Review the change" } } },
        ],
        conditions: [{ requestId: "review" }],
      });
      expect(receipt.requests).toHaveLength(1);
      return {
        state: "waiting",
        continue: true,
        summary: "Review requested; test next",
        facts: ["review:requested"],
        communication: [{ id: "started", inputId: "ask", message: "Review requested; I am running the tests." }],
      };
    }
    if (!reviewed) {
      testsPassed = true;
      return { state: "waiting", summary: "Tests passed; review is pending", facts: ["tests:passed"] };
    }
    expect(testsPassed).toBe(true);
    expect(attempt.events.continuedInputs?.length).toBeGreaterThan(0);
    return {
      state: "converged",
      summary: "Tested and reviewed",
      facts: ["tests:passed", "review:approved"],
      communication: [
        {
          id: "answer",
          inputId: "ask",
          message: "The change passed tests and review.",
          requestUpdates: [
            { id: "change", expectedRevision: 1, disposition: "fulfilled", reason: "Tests and review are complete" },
          ],
        },
      ],
    };
  });
  try {
    f.admit("ask");
    await f.run();
    await f.run();
    expect(testsPassed).toBe(true);
    expect(f.store.readTask("work")?.status.phase).toBe("waiting");
    expect(parentCalls).toBe(2);
    expect(readConversationRequest(f.db, "sample", "discussion", "change")?.status).toBe("open");
    await until(() => Boolean(f.store.readTask("reviewer")));
    await f.run();
    expect(parentCalls).toBe(2); // An open Request alone cannot schedule execution.
    const reviewRun = f.run("reviewer");
    releaseReview();
    await reviewRun;
    await f.inbox.host.refreshTaskResults("sample", "reviewer");
    await f.run();
    await until(() => readConversationRequest(f.db, "sample", "discussion", "change")?.status === "closed");
    await f.inbox.host.refreshTaskResults("sample", "work");
    const messages = listAppConversationMessages(f.db, "sample", "discussion").filter(
      ({ author }) => author.kind === "agent",
    );
    expect(messages.map(({ text }) => text).sort()).toEqual(
      ["Review requested; I am running the tests.", "The change passed tests and review."].sort(),
    );
    expect(messages.every(({ metadata }) => metadata?.channelTargetId === "synthetic-chat")).toBe(true);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM conversation_requests").get()?.n).toBe(1);
    expect(listAppInboxItems(f.db, { appId: "sample" }).find(({ id }) => id === "ask")?.status).toBe("done");
    expect(f.store.readTrigger("work")).toBeNull();
    expect(parentCalls).toBe(3);
  } finally {
    releaseReview();
    await f.close();
  }
});

test("common Conversation execution retains old admissions and can read ordinary addressed input in the same Task", async () => {
  let calls = 0;
  const f = await fixture(async (attempt) => {
    calls++;
    const inputs = attempt.events.inputs!;
    expect(inputs.map(({ id }) => id).sort()).toEqual(["ask", "evidence"]);
    expect(inputs.find(({ id }) => id === "ask")?.communication?.replyTo).toBe("ask");
    expect(inputs.find(({ id }) => id === "evidence")?.communication).toBeUndefined();
    expect(attempt.events.communication).toHaveLength(1);
    if (calls === 1)
      return {
        state: "waiting",
        continue: true,
        summary: "Keep testing here",
        facts: ["test:started"],
        communication: [
          {
            id: "progress",
            inputId: "ask",
            message: "Testing the updated requirement.",
            requestUpdates: [
              { id: "work", expectedRevision: 0, scope: "Test the updated requirement", disposition: "open" },
            ],
          },
        ],
      };
    return {
      state: "converged",
      summary: "Test complete",
      facts: ["test:passed"],
      communication: [
        {
          id: "answer",
          inputId: "ask",
          message: "The updated requirement passed.",
          requestUpdates: [
            { id: "work", expectedRevision: 1, disposition: "fulfilled", reason: "Verified the complete requirement" },
          ],
        },
      ],
    };
  }, "agent");
  try {
    const admitted = f.admit("ask").item;
    const taskId = admitted.executionTaskId!;
    const generation = f.store.readTask(taskId)!.metadata.generation;
    const oldKey = admitted.taskAdmissionKey;
    await f.useTaskMode();
    const extra = f.inbox.host.admit({
      appId: "sample",
      id: "evidence",
      source: { kind: "app", id: "reviewer" },
      targetTaskId: taskId,
      input: { kind: "evidence", data: { finding: "Use the updated requirement" } },
    });
    expect(extra.item.taskAdmissionKey).toBe("task:evidence");
    await f.run(taskId);
    expect(f.store.readTask(taskId)?.status.phase).toBe("pending");
    await f.run(taskId);
    await f.inbox.host.refreshTaskResults("sample", taskId);
    const rows = listAppInboxItems(f.db, { appId: "sample" });
    expect(rows.find(({ id }) => id === "ask")).toMatchObject({
      status: "done",
      executionTaskId: taskId,
      taskAdmissionKey: oldKey,
    });
    expect(rows.find(({ id }) => id === "evidence")?.status).toBe("done");
    expect(f.store.readTask(taskId)?.metadata.generation).toBe(generation);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM app_task_admissions WHERE app_id = 'sample'").get()?.n).toBe(2);
    expect(
      listAppConversationMessages(f.db, "sample", "discussion").filter(({ author }) => author.kind === "agent"),
    ).toHaveLength(2);
    expect(f.store.readTrigger(taskId)).toBeNull();
    expect(calls).toBe(2);
  } finally {
    await f.close();
  }
});

test("Request revisions and ownership are checked before publication, independently of waiting", async () => {
  const f = await fixture(async (attempt) => {
    if (attempt.task.id === "reviewer") {
      await expect(
        attempt.apply({
          communication: [
            {
              id: "take-over",
              inputId: "review-input",
              message: "Closed by reviewer",
              requestUpdates: [{ id: "ask-scope", expectedRevision: 3, disposition: "fulfilled", reason: "reviewed" }],
            },
          ],
        }),
      ).rejects.toThrow("accepted by this Task");
      return { state: "converged", summary: "Contribution only", facts: [] };
    }
    const accept = await attempt.apply({
      communication: [
        {
          id: "accept",
          inputId: "ask",
          requestUpdates: [{ id: "ask-scope", expectedRevision: 0, scope: "Test A", disposition: "open" }],
        },
      ],
    });
    expect(accept.communication?.[0]?.requests?.[0]?.revision).toBe(1);
    await attempt.apply({
      communication: [
        {
          id: "refine",
          inputId: "ask",
          requestUpdates: [{ id: "ask-scope", expectedRevision: 1, scope: "Test A and B", disposition: "open" }],
        },
      ],
    });
    expect(await attempt.read.communication!("ask", { action: "request", id: "ask-scope" })).toMatchObject({
      revision: 2,
      scope: "Test A and B",
    });
    await expect(
      attempt.apply({
        communication: [
          {
            id: "stale-answer",
            inputId: "ask",
            message: "Only A passed",
            requestUpdates: [
              { id: "ask-scope", expectedRevision: 1, disposition: "fulfilled", reason: "Test A passed" },
            ],
          },
        ],
      }),
    ).rejects.toThrow("revision changed");
    await expect(
      attempt.publish("unscoped", { type: "conversation.message.created", data: { text: "Bypass context" } }),
    ).rejects.toThrow("Use Task communication");
    return {
      state: "waiting",
      summary: "Original ask fulfilled; independent review still pending",
      facts: ["tests:A-and-B:passed"],
      communication: [
        {
          id: "answer",
          inputId: "ask",
          message: "A and B passed.",
          requestUpdates: [
            { id: "ask-scope", expectedRevision: 2, disposition: "fulfilled", reason: "Verified both requirements" },
          ],
        },
      ],
      conditions: [
        {
          id: "extra-review",
          type: "review.completed",
          subject: "review:extra",
          owner: "agent:reviewer",
          expected: true,
        },
      ],
    };
  });
  try {
    f.admit("ask");
    await f.run();
    expect(f.store.readTask("work")?.status.phase).toBe("waiting");
    expect(readConversationRequest(f.db, "sample", "discussion", "ask-scope")).toMatchObject({
      revision: 3,
      status: "closed",
      scope: "Test A and B",
    });
    f.inbox.host.admit({
      appId: "sample",
      id: "review-input",
      conversationId: "discussion",
      source: { kind: "app", id: "reviewer" },
      input: { kind: "review", data: {} },
    });
    await f.run("reviewer");
    const messages = listAppConversationMessages(f.db, "sample", "discussion").filter(
      ({ author }) => author.kind === "agent",
    );
    expect(messages.map(({ text }) => text)).toEqual(["A and B passed."]);
    expect(
      f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'conversation.message.created'").get()?.n,
    ).toBe(1);
  } finally {
    await f.close();
  }
});

test("a final response uses the common saved context without a duplicate result projection", async () => {
  const f = await fixture(
    async () => ({ state: "converged", summary: "Answered", response: "Here is the answer.", facts: [] }),
    "task",
  );
  try {
    const item = f.admit("ask").item;
    await f.run(item.executionTaskId!);
    expect(
      listAppConversationMessages(f.db, "sample", "discussion")
        .filter(({ author }) => author.kind === "agent")
        .map(({ text }) => text),
    ).toEqual(["Here is the answer."]);
    expect(listAppInboxItems(f.db, { appId: "sample" })[0]?.status).toBe("done");
  } finally {
    await f.close();
  }
});

test("managed finish preflight checks a combined decision without keeping state or publishing", async () => {
  const proposal = {
    state: "converged" as const,
    summary: "Answered",
    facts: [],
    communication: [
      {
        id: "accept",
        inputId: "ask",
        requestUpdates: [
          { id: "scope", expectedRevision: 0, scope: "Answer the question", disposition: "open" as const },
        ],
      },
      {
        id: "answer",
        inputId: "ask",
        message: "Here is the answer.",
        topic: { kind: "new" as const, title: "Question" },
        requestUpdates: [
          { id: "scope", expectedRevision: 1, disposition: "fulfilled" as const, reason: "Answered completely" },
        ],
      },
    ],
  };
  const f = await fixture(
    async () => proposal,
    "task",
    async ({ validateResult }) => {
      expect(validateResult!(proposal)).toBeNull();
      expect(readConversationRequest(f.db, "sample", "discussion", "scope")).toBeNull();
      expect(f.db.prepare("SELECT COUNT(*) AS n FROM conversation_topics").get()?.n).toBe(0);
      expect(
        f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'conversation.message.created'").get()?.n,
      ).toBe(0);
      expect(validateResult!({ ...proposal, communication: [proposal.communication[1]!] })).toContain(
        "requires a scope",
      );
      expect(validateResult!(proposal)).toBeNull();
    },
  );
  try {
    const input = f.admit("ask").item;
    await f.run(input.executionTaskId!);
    expect(readConversationRequest(f.db, "sample", "discussion", "scope")?.status).toBe("closed");
    expect(
      listAppConversationMessages(f.db, "sample", "discussion").filter(({ author }) => author.kind === "agent"),
    ).toHaveLength(1);
  } finally {
    await f.close();
  }
});

test("managed finish corrects invalid input scope in one model execution and preserves independent work", async () => {
  const managerRoot = mkdtempSync(join(tmpdir(), "task-managed-finish-"));
  let originalKey = "";
  let liveKey = "";
  let laterKey = "";
  let wrongTaskKey = "";
  let addLaterInput = () => {};
  let modelRequests = 0;
  let usefulFeedback = "";
  const proposal = {
    state: "waiting" as const,
    summary: "Recorded the reviewed work; independent review remains",
    facts: ["review:complete"],
    report: true as const,
    result: { artifact: "candidate" },
    inputKeys: [] as string[],
    conditions: [
      {
        id: "independent-review",
        type: "review.completed",
        subject: "change:candidate",
        expected: true,
        owner: "app:sample",
      },
    ],
  };
  const finishCall = (id: string, result: typeof proposal): ToolCall => ({
    type: "toolCall",
    id,
    name: "finish",
    arguments: {
      status: "success",
      summary: result.summary,
      verification_facts: ["Synthetic managed execution completed"],
      result,
    },
  });
  const manager = new SubagentManager({
    persistDir: managerRoot,
    agentRunFactory: (config) =>
      createAgentRun({
        ...config,
        streamFn: (_model, context) => {
          modelRequests++;
          if (modelRequests === 2) {
            usefulFeedback = JSON.stringify(context.messages);
            addLaterInput();
          }
          const result = modelRequests === 1
            ? { ...proposal, inputKeys: [wrongTaskKey] }
            : { ...proposal, inputKeys: [originalKey, liveKey] };
          const stream = createAssistantMessageEventStream();
          const message = usageReply({
            stopReason: "toolUse",
            content: [finishCall(`finish-${modelRequests}`, result)],
          });
          stream.push({ type: "done", reason: "toolUse", message });
          return stream;
        },
      }),
  });
  const definition = {
    name: "owner",
    description: "Synthetic Task owner",
    domain: "tests",
    systemPrompt: "Finish the synthetic Task once its explicit input scope is valid.",
    projectRoot: managerRoot,
    tools: [],
    model: fakeModel(),
  };
  manager.register(definition);
  const agents = createTaskAgentRunner({ manager }, new Map([[definition.name, definition]]));
  const f = await fixture(
    async () => proposal,
    "task",
    async ({ attempt }) => {
      const accepted = Promise.withResolvers<void>();
      const unsubscribe = attempt.onEvent((event, accept) => {
        if (event.type !== "app.task.requested") return;
        accept();
        unsubscribe();
        accepted.resolve();
      });
      const config = appTaskContext({
        appDir: "fixture",
        projectDir: "fixture",
        agent: "owner",
        resourceStore: f.store,
      });
      liveKey = "task:synthetic-live-input";
      const liveEvent = {
        type: "app.task.requested",
        source: "fixture",
        owner: "agent:owner",
        target: { appId: "sample", taskId: attempt.task.id },
        idempotencyKey: liveKey,
        data: {
          appId: "sample",
          taskId: attempt.task.id,
          idempotencyKey: liveKey,
          request: {
            id: "synthetic-live-input",
            source: { kind: "system", id: "fixture" },
            input: { kind: "message", data: {} },
          },
        },
      };
      observeAppTaskIntent(config, {
        appAgent: "owner",
        intent: { ...f.store.readTask(attempt.task.id)!.spec, id: attempt.task.id },
        admissionKey: liveKey,
        trigger: liveEvent,
      });
      f.bus.emit(liveEvent);
      await accepted.promise;
      proposal.inputKeys = [originalKey, liveKey];

      addLaterInput = () => {
        laterKey = "task:synthetic-later-input";
        observeAppTaskIntent(config, {
          appAgent: "owner",
          intent: { ...f.store.readTask(attempt.task.id)!.spec, id: attempt.task.id },
          admissionKey: laterKey,
          trigger: {
            ...liveEvent,
            idempotencyKey: laterKey,
            data: {
              ...liveEvent.data,
              idempotencyKey: laterKey,
              request: {
                id: "synthetic-later-input",
                source: { kind: "system", id: "fixture" },
                input: { kind: "message", data: {} },
              },
            },
          },
        });
      };
    },
    undefined,
    agents,
  );
  try {
    const original = f.admit("ask").item;
    originalKey = original.taskAdmissionKey!;
    wrongTaskKey = "task:synthetic-wrong-task-input";
    const config = appTaskContext({
      appDir: "fixture",
      projectDir: "fixture",
      agent: "owner",
      resourceStore: f.store,
    });
    observeAppTaskIntent(config, {
      appAgent: "owner",
      intent: {
        ...f.store.readTask(original.executionTaskId!)!.spec,
        id: "synthetic-wrong-task",
        agent: "reviewer",
      },
      admissionKey: wrongTaskKey,
      trigger: {
        type: "app.task.requested",
        source: "fixture",
        owner: "agent:reviewer",
        target: { appId: "sample", taskId: "synthetic-wrong-task" },
        idempotencyKey: wrongTaskKey,
        data: {
          appId: "sample",
          taskId: "synthetic-wrong-task",
          idempotencyKey: wrongTaskKey,
          request: {
            id: "synthetic-wrong-task-input",
            source: { kind: "system", id: "fixture" },
            input: { kind: "review", data: {} },
          },
        },
      },
    });
    await f.run(original.executionTaskId!);

    expect(modelRequests).toBe(2);
    expect(usefulFeedback).toContain(
      `finish() error: inputKeys contains input not outstanding on this Task: ${wrongTaskKey}`,
    );
    const taskTree = f.store.readTaskContext({
      taskIds: [original.executionTaskId!],
      admissionIds: [originalKey, liveKey, laterKey],
    });
    expect(taskTree.appTaskAdmissions?.[originalKey]?.reportAttemptId).toBeTruthy();
    expect(taskTree.appTaskAdmissions?.[liveKey]?.reportAttemptId).toBeTruthy();
    expect(taskTree.appTaskAdmissions?.[laterKey]?.reportAttemptId).toBeUndefined();
    expect(f.store.readTask(original.executionTaskId!)?.status.conditionIds).toEqual(["independent-review"]);
    const attempts = Object.values(taskTree.attempts ?? {});
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.acceptedResult).toMatchObject({
      inputKeys: [originalKey, liveKey],
      result: { artifact: "candidate" },
      acceptedLiveEventIds: [expect.any(Number)],
    });
    expect(laterKey).not.toBe("");
  } finally {
    await f.close();
    closeDb(managerRoot);
    rmSync(managerRoot, { recursive: true, force: true });
  }
});

test("final Task acceptance can stay quiet and open without a reason; closure still requires an explanation", async () => {
  const accept = {
    id: "accept",
    inputId: "ask",
    requestUpdates: [{ id: "scope", expectedRevision: 0, scope: "Test the change", disposition: "open" as const }],
  };
  const proposal = {
    state: "waiting" as const,
    summary: "Accepted the ask; waiting for the test environment",
    facts: [],
    communication: [accept],
    conditions: [
      { id: "environment", type: "environment.ready", subject: "environment:test", expected: true, owner: "app:sample" },
    ],
  };
  let retainedRead: TaskAttempt["read"]["communication"];
  const f = await fixture(
    async (attempt) => {
      retainedRead = attempt.read.communication;
      await expect(retainedRead!("ask")).resolves.toMatchObject({ id: "discussion" });
      return proposal;
    },
    "task",
    async ({ validateResult }) => {
      expect(validateResult!(proposal)).toBeNull();
      // A closure must explain both its disposition and the outcome to the human.
      for (const explanation of [{ message: "Tested" }, { reason: "Tests passed" }]) {
        const { message, reason } = explanation;
        expect(
          validateResult!({
            ...proposal,
            communication: [
              accept,
              {
                id: "close",
                inputId: "ask",
                ...(message ? { message } : {}),
                requestUpdates: [
                  { id: "scope", expectedRevision: 1, disposition: "fulfilled", ...(reason ? { reason } : {}) },
                ],
              },
            ],
          }),
        ).toContain("Request closure requires a reason and Conversation explanation");
      }
      expect(readConversationRequest(f.db, "sample", "discussion", "scope")).toBeNull();
    },
  );
  try {
    const item = f.admit("ask").item;
    await f.run(item.executionTaskId!);
    expect(f.store.readTask(item.executionTaskId!)?.status).toMatchObject({ phase: "waiting" });
    expect(readConversationRequest(f.db, "sample", "discussion", "scope")).toMatchObject({
      status: "open",
      revision: 1,
      scope: "Test the change",
    });
    expect(f.store.readTrigger(item.executionTaskId!)).toBeNull();
    expect(
      listAppConversationMessages(f.db, "sample", "discussion").filter(({ author }) => author.kind === "agent"),
    ).toEqual([]);
    await expect(retainedRead!("ask")).rejects.toThrow("Task attempt is closed");
  } finally {
    await f.close();
  }
});

test("a reply to a common Task publication retains Topic and Task navigation without transport knowledge", async () => {
  let replyTo: string | undefined;
  let topicId: string | undefined;
  const f = await fixture(async (attempt) => {
    if (!replyTo)
      return {
        state: "converged",
        summary: "Explained the change",
        facts: [],
        communication: [
          { id: "explain", inputId: "ask", message: "Here is the change.", topic: { kind: "new", title: "Change" } },
        ],
      };
    expect(attempt.events.inputs?.[0]?.communication).toMatchObject({
      conversationId: "discussion",
      inReplyTo: replyTo,
      topicId,
    });
    expect(attempt.events.communication?.[0]?.current).toMatchObject({ replyTo, topicId });
    expect(attempt.events.communication?.[0]?.messages.some(({ id }) => id === replyTo)).toBe(true);
    return {
      state: "converged",
      summary: "Answered refinement",
      facts: [],
      communication: [{ id: "refinement", inputId: "followup", message: "Here is the detail." }],
    };
  }, "task");
  try {
    const original = f.admit("ask").item;
    await f.run(original.executionTaskId!);
    const message = listAppConversationMessages(f.db, "sample", "discussion").find(
      ({ author }) => author.kind === "agent",
    )!;
    replyTo = message.id;
    topicId = message.metadata?.topicId;
    expect(replyTo).toMatch(/^task-message:/);
    expect(topicId).toMatch(/^task-topic:/);
    expect(message.metadata?.taskRefs).toMatchObject([{ appId: "sample", taskId: original.executionTaskId! }]);
    expect(readConversationMessageTopicId(f.db, "sample", "discussion", replyTo)).toBe(topicId);
    expect(readConversationMessageTopicId(f.db, "sample", "other-discussion", replyTo)).toBeNull();
    const followup = f.inbox.host.admit({
      id: "followup",
      appId: "sample",
      conversationId: "discussion",
      conversationSequence: 2,
      source: { kind: "human", id: "followup" },
      replyToSourceId: replyTo,
      input: { kind: "message", data: { message: "Please explain that detail" } },
    }).item;
    expect(followup.executionTaskId).toBe(original.executionTaskId);
    await f.run(followup.executionTaskId!);
    const messages = listAppConversationMessages(f.db, "sample", "discussion").filter(
      ({ author }) => author.kind === "agent",
    );
    expect(messages.map(({ text }) => text)).toEqual(["Here is the change.", "Here is the detail."]);
    expect(messages[1]?.metadata?.topicId).toBe(topicId);
  } finally {
    await f.close();
  }
});

test("maximal Request scopes retain message history, reply links and exact receipts across restart", async () => {
  const communication: TaskCommunication = {
    id: "large-acceptance",
    inputId: "ask",
    message: "All eight asks have been accepted.",
    topic: { kind: "new", title: "Requested work" },
    requestUpdates: Array.from({ length: 8 }, (_, index) => ({
      id: `ask-${index}`,
      expectedRevision: 0,
      disposition: "open",
      scope: String(index).repeat(2000),
      reason: "r".repeat(2000),
    })),
  };
  let calls = 0;
  let messageId: string | undefined;
  let topicId: string | undefined;
  const f = await fixture(async (attempt) => {
    calls++;
    const receipt = await attempt.apply({
      // A different batch on retry exercises per-operation journal replay,
      // rather than returning the whole prior batch's saved receipt.
      communication: calls === 1 ? [communication] : [
        communication,
        {
          id: "additional-ask",
          inputId: "ask",
          requestUpdates: [{ id: "extra", expectedRevision: 0, scope: "Additional work", disposition: "open" }],
        },
      ],
    });
    const accepted = receipt.communication![0]!;
    expect(accepted.requests?.map(({ scope }) => scope)).toEqual(
      communication.requestUpdates!.map(({ scope }) => scope),
    );
    if (calls === 1) {
      messageId = accepted.messageId;
      topicId = readConversationMessageTopicId(f.db, "sample", "discussion", messageId!)!;
      throw new Error("Interrupted after large publication");
    }
    expect(accepted.messageId).toBe(messageId);
    expect(await attempt.read.communication!("ask")).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({ id: messageId, text: communication.message, metadata: expect.objectContaining({ topicId }) }),
      ]),
    });
    return {
      state: "waiting",
      summary: "Scope retained; waiting for environment",
      facts: [],
      conditions: [
        { id: "environment", type: "environment.ready", subject: "environment:test", expected: true, owner: "app:sample" },
      ],
    };
  });
  try {
    f.admit("ask");
    await f.run();
    expect(f.store.readTask("work")?.status.executionFailures).toBe(1);
    expect(f.store.readTask("work")?.status.summary).toContain("Interrupted after large publication");
    expect(topicId).toMatch(/^task-topic:/);
    await f.reopen();
    await until(() => f.store.readTask("work")?.status.phase === "waiting");
    expect(calls).toBe(2);
    const messages = listAppConversationMessages(f.db, "sample", "discussion").filter(
      ({ author }) => author.kind === "agent",
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: messageId,
      text: communication.message,
      replyTo: "ask",
      metadata: { topicId, communicationId: communication.id, taskRefs: [{ appId: "sample", taskId: "work" }] },
    });
    expect(readConversationMessageTopicId(f.db, "sample", "discussion", messageId!)).toBe(topicId);
  } finally {
    await f.close();
  }
});

test("finish preflight and settlement share the communication limit after adding an implicit response", async () => {
  const communication: TaskCommunication[] = Array.from({ length: 8 }, (_, index) => ({
    id: `accept-${index}`,
    inputId: "ask",
    requestUpdates: [{ id: `scope-${index}`, expectedRevision: 0, scope: `Ask ${index}`, disposition: "open" }],
  }));
  const proposal = { state: "converged" as const, summary: "Accepted", facts: [], communication, response: "Accepted." };
  const corrected = { ...proposal, communication: communication.slice(0, 7) };
  const f = await fixture(
    async () => corrected,
    "task",
    async ({ validateResult }) => {
      expect(validateResult!(proposal)).toContain("Task changes");
      expect(validateResult!(corrected)).toBeNull();
      expect(f.db.prepare("SELECT COUNT(*) AS n FROM conversation_requests").get()?.n).toBe(0);
      expect(
        f.db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'conversation.message.created'").get()?.n,
      ).toBe(0);
    },
  );
  try {
    const input = f.admit("ask").item;
    await f.run(input.executionTaskId!);
    expect(f.store.readTask(input.executionTaskId!)?.status.phase).toBe("converged");
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM conversation_requests").get()?.n).toBe(7);
    expect(
      listAppConversationMessages(f.db, "sample", "discussion")
        .filter(({ author }) => author.kind === "agent")
        .map(({ text }) => text),
    ).toEqual(["Accepted."]);
  } finally {
    await f.close();
  }
});
