import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gitTaskWorkspaces } from "../may-agent/src/app/adapters/workspaces/git.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import app from "./app.ts";
import { getDb, closeDb } from "../may-agent/src/lib/requests.js";
import { DbWriter } from "../may-agent/src/lib/db-writer.js";
import { AppRegistry } from "../may-agent/src/app/core/apps/registry.js";
import {
  EventBus,
  EVENT_ROW_ID,
} from "../may-agent/src/app/core/events/bus.js";
import { startAppInboxRuntime } from "../may-agent/src/app/composition/app-inbox-runtime.js";
import { createAppTaskCapability } from "../may-agent/src/app/core/tasks/app-task-capability.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../may-agent/src/app/core/tasks/app-task-runtime.js";
import { AppTaskResourceStore } from "../may-agent/src/app/core/state/app-task-resource-store.js";
import { listAppInboxItems } from "../may-agent/src/app/core/state/app-inbox-store.js";
import { readAppConversationResource } from "../may-agent/src/app/core/state/conversations.js";
import type { TaskAgentRunner } from "../may-agent/src/app/core/tasks/execution.js";

async function until(check: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() >= deadline)
      throw new Error("Expected durable report admission");
    await Bun.sleep(5);
  }
}

test("real Evaluation route executes ordinary May work while Conversation remains broken", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-evaluation-route-"));
  const appDir = join(root, "may.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks/seed.json"),
    JSON.stringify({
      project: "may",
      root_task_id: "may",
      project_lifecycle: "active",
      groups: { may: { id: "may", parent_id: null } },
    }),
  );
  execFileSync("git", ["init", "-b", "main", appDir], { stdio: "pipe" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
    ],
    { cwd: appDir, stdio: "pipe" },
  );
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  let calls = 0;
  let conversationCalls = 0;
  const agents: TaskAgentRunner = {
    available: () => true,
    prepare: async () => true,
    role: () => ({ agent: "may", instructions: "Review the finding" }),
    snapshot: () => agents,
    async execute({ attempt }) {
      if (attempt.task.id !== "evaluation-intake") {
        conversationCalls++;
        throw new Error("Conversation handling is broken");
      }
      calls++;
      expect(attempt.task.id).toBe("evaluation-intake");
      const reports = attempt.events.items.filter(
        ({ event }) => event.type === "app.task.requested",
      );
      expect(reports).toHaveLength(1);
      expect(reports[0]!.event.data).toMatchObject({
        request: {
          input: {
            kind: "goal",
            data: {
              context: { publication: { executionId: `review-${calls}` } },
            },
          },
        },
      });
      return {
        runId: attempt.attemptId,
        handlerResult: {
          state: "converged",
          summary:
            "Verified the failure; retained the evidence and repair recommendation",
          facts: [`review-${calls}`],
          actions: [],
        },
      };
    },
  };
  const registry = new AppRegistry(async () => [
    { appDir, definition: { ...app, observers: [] } },
    {
      appDir: root,
      definition: {
        id: "evaluation",
        version: 1,
        agent: "reviewer",
        inputSchema: app.inputSchema,
      },
    },
  ]);
  await registry.reload();
  let inbox: Awaited<ReturnType<typeof startAppInboxRuntime>> | undefined;
  try {
    await installAppTaskRuntimes(
      {
        projectRoot: root,
        projectsRoot: root,
        persistDir: root,
        bus,
        appRegistrySnapshot: registry.snapshot(),
        agents,
        workspaces: gitTaskWorkspaces,
        conversations: {
          execute: async () => {
            conversationCalls++;
            throw new Error("Legacy Conversation handling is broken");
          },
        },
      },
      { deferRecovery: true },
    );
    const capability = createAppTaskCapability({ bus });
    inbox = await startAppInboxRuntime({
      db,
      bus,
      registry,
      persistDir: root,
      schedulesEnabled: false,
      attachTask: (input) => capability.attach(input),
      admitConversation: (input) => capability.admitConversation(input),
    });
    const human = capability.admitConversation({
      appId: "may",
      id: "human-ask",
      conversationId: "may:primary",
      source: { kind: "human", id: "human-ask" },
      input: { kind: "message", data: { message: "Help with the incident" } },
    });
    await reconcileLoadedAppTaskOnce({
      bus,
      appId: "may",
      dispatch: {
        lane: "human",
        enqueuedAt: Date.now(),
        startedAt: Date.now(),
        readyWaitMs: 0,
      },
      taskId: human.taskId,
    });
    expect(conversationCalls).toBe(1);
    const store = AppTaskResourceStore.activeFromDb(db, "may")!;
    expect(store.readTask(human.taskId)?.status.executionFailures).toBe(1);
    for (const ordinal of [1, 2]) {
      const emitted = bus.emit({
        type: "evaluation.task_report_published",
        source: "workflow:review",
        owner: "app:evaluation",
        target: { appId: "evaluation" },
        data: {
          appId: "may",
          taskId: human.taskId,
          evidenceHash: "a".repeat(64),
          executionId: `review-${ordinal}`,
          report: `reports/${ordinal}.md`,
          facts: `reports/${ordinal}.json`,
          jsonHash: "b".repeat(64),
          markdownHash: "c".repeat(64),
        },
      });
      await until(
        () =>
          listAppInboxItems(db, { appId: "may" }).filter(
            ({ input }) => input.kind === "goal",
          ).length === ordinal &&
          Boolean(store.readTrigger("evaluation-intake")),
      );
      const generation =
        store.readTask("evaluation-intake")!.metadata.generation;
      await reconcileLoadedAppTaskOnce({
        bus,
        appId: "may",
        dispatch: {
          lane: "human",
          enqueuedAt: Date.now(),
          startedAt: Date.now(),
          readyWaitMs: 0,
        },
        taskId: "evaluation-intake",
      });
      expect(calls).toBe(ordinal);
      expect(generation).toBe(1);
      bus.redeliverPersisted(emitted, emitted[EVENT_ROW_ID]!);
      inbox.scanNow();
    }
    expect(
      store.readTask(human.taskId)?.status.executionFailures,
    ).toBeGreaterThanOrEqual(1);
    expect(conversationCalls).toBeGreaterThanOrEqual(1);
    expect(store.readTrigger("evaluation-intake")).toBeNull();
    const inputs = listAppInboxItems(db, { appId: "may" });
    expect(inputs.filter(({ input }) => input.kind === "goal")).toHaveLength(2);
    expect(inputs.find(({ id }) => id === "human-ask")?.status).not.toBe(
      "done",
    );
    expect(
      readAppConversationResource(db, "may", "may:primary").messages.filter(
        ({ author }) => author.kind === "agent",
      ),
    ).toHaveLength(0);
  } finally {
    inbox?.close();
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
