import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import app from "./app.ts";
import may from "../may.app/app.ts";
import { gitTaskWorkspaces } from "../may-agent/src/app/adapters/workspaces/git.js";
import { getDb, closeDb } from "../may-agent/src/lib/requests.js";
import { DbWriter } from "../may-agent/src/lib/db-writer.js";
import { AppRegistry } from "../may-agent/src/app/core/apps/registry.js";
import { EventBus, EVENT_ROW_ID } from "../may-agent/src/app/core/events/bus.js";
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
    if (Date.now() >= deadline) throw new Error("Expected durable report admission");
    await Bun.sleep(5);
  }
}

function dispatch() {
  const now = Date.now();
  return { lane: "human" as const, enqueuedAt: now, startedAt: now, readyWaitMs: 0 };
}

function fixtureApp(root: string, appId: string, group: string): string {
  const dir = join(root, appId + ".app");
  mkdirSync(join(dir, "tasks"), { recursive: true });
  writeFileSync(join(dir, "tasks/seed.json"), JSON.stringify({
    project: appId,
    root_task_id: group,
    project_lifecycle: "active",
    groups: { [group]: { id: group, parent_id: null } },
  }));
  execFileSync("git", ["init", "-b", "main", dir], { stdio: "pipe" });
  execFileSync("git", ["add", "tasks"], { cwd: dir, stdio: "pipe" });
  execFileSync("git", [
    "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
    "commit", "-m", "fixture",
  ], { cwd: dir, stdio: "pipe" });
  return dir;
}

test("published diagnoses execute in Alex while May Conversation remains broken", async () => {
  const root = mkdtempSync(join(tmpdir(), "alex-evaluation-route-"));
  const alexDir = fixtureApp(root, "alex", "root");
  const mayDir = fixtureApp(root, "may", "may");
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
    role: (agent) => ({ agent, instructions: "Review the finding" }),
    snapshot: () => agents,
    async execute({ descriptor, attempt }) {
      expect(descriptor.id).toBe("alex");
      expect(attempt.role.agent).toBe("alex");
      const reports = attempt.events.items.filter(
        ({ event }) => event.type === "app.task.requested",
      );
      expect(reports).toHaveLength(1);
      calls++;
      expect(reports[0]!.event.data).toMatchObject({
        request: {
          input: {
            kind: "message",
            data: { context: { publication: { executionId: "review-" + calls } } },
          },
        },
      });
      return {
        runId: attempt.attemptId,
        handlerResult: {
          state: "converged",
          summary: "Verified the failure; retained the evidence and repair recommendation",
          facts: ["review-" + calls],
          actions: [],
        },
      };
    },
  };
  const registry = new AppRegistry(async () => [
    { appDir: alexDir, definition: app },
    { appDir: mayDir, definition: { ...may, observers: [] } },
  ]);
  await registry.reload();
  let inbox: Awaited<ReturnType<typeof startAppInboxRuntime>> | undefined;
  try {
    await installAppTaskRuntimes({
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
    }, { deferRecovery: true });
    const capability = createAppTaskCapability({ bus });
    inbox = await startAppInboxRuntime({
      db, bus, registry, persistDir: root, schedulesEnabled: false,
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
    await reconcileLoadedAppTaskOnce({ bus, appId: "may", taskId: human.taskId, dispatch: dispatch() });
    expect(conversationCalls).toBe(1);
    const mayStore = AppTaskResourceStore.activeFromDb(db, "may")!;
    const alexStore = AppTaskResourceStore.activeFromDb(db, "alex")!;
    expect(mayStore.readTask(human.taskId)?.status.executionFailures).toBe(1);
    const reportInputs = () => listAppInboxItems(db, { appId: "alex" })
      .filter((item) => typeof (item.input.data as any).context?.publication?.executionId === "string");
    const handled: string[] = [];
    for (const [index, type] of [
      "evaluation.task_report_published",
      "evaluation.metric_report_published",
    ].entries()) {
      const ordinal = index + 1;
      const emitted = bus.emit({
        type,
        source: "workflow:review",
        owner: "app:alex",
        target: { appId: "alex" },
        data: {
          appId: "may",
          ...(index === 0 ? { taskId: human.taskId } : { metricId: "may.fixture-failure", alertId: 7 }),
          evidenceHash: "a".repeat(64),
          executionId: "review-" + ordinal,
          report: "reports/" + ordinal + ".md",
          facts: "reports/" + ordinal + ".json",
          jsonHash: "b".repeat(64),
          markdownHash: "c".repeat(64),
        },
      });
      await until(() => {
        const inputs = reportInputs();
        const taskId = inputs.find((item) =>
          (item.input.data as any).context?.publication?.executionId === "review-" + ordinal,
        )?.waitingOn?.id;
        return inputs.length === ordinal && !!taskId && !!alexStore.readTrigger(taskId);
      });
      const input = reportInputs()
        .find((item) => (item.input.data as any).context?.publication?.executionId === "review-" + ordinal)!;
      const taskId = input.waitingOn!.id;
      expect(alexStore.readTask(taskId)?.metadata.generation).toBe(1);
      await reconcileLoadedAppTaskOnce({ bus, appId: "alex", taskId, dispatch: dispatch() });
      expect(calls).toBe(ordinal);
      expect(alexStore.readTrigger(taskId)).toBeNull();
      handled.push(taskId);
      bus.redeliverPersisted(emitted, emitted[EVENT_ROW_ID]!);
      inbox.scanNow();
      await Bun.sleep(10);
      expect(reportInputs()).toHaveLength(ordinal);
      expect(alexStore.readTrigger(taskId)).toBeNull();
    }
    expect(new Set(handled).size).toBe(2);
    expect(calls).toBe(2);
    const mayInputs = listAppInboxItems(db, { appId: "may" });
    expect(mayInputs.filter(({ input }) => input.kind === "goal")).toHaveLength(0);
    expect(mayInputs.find(({ id }) => id === "human-ask")?.status).not.toBe("done");
    expect(mayStore.readTask(human.taskId)?.status.executionFailures).toBeGreaterThanOrEqual(1);
    expect(readAppConversationResource(db, "may", "may:primary").messages.filter(
      ({ author }) => author.kind === "agent",
    )).toHaveLength(0);
  } finally {
    inbox?.close();
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
