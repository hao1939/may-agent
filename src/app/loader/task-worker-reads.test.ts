import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTools, type ToolsetLoaderOptions } from "./toolset-loader.js";
import type { AgentConfig } from "./agent-config.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus } from "../core/events/bus.js";
import { HostCapacity } from "../core/scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { appTaskTestContext } from "../core/tasks/app-task-test-support.js";
import { observeAppTaskIntent } from "../core/tasks/app-task-reconciler.js";
import { closeInstalledAppTaskRuntimes, installAppTaskRuntimes } from "../core/tasks/app-task-runtime.js";
import { closeDb, getDb } from "../../lib/requests.js";
import type { TaskAgentRunner } from "../core/tasks/execution.js";

test("one-App worker tools read exact registered peer Tasks without installing their execution runtimes", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-worker-reads-"));
  const bus = new EventBus();
  const db = getDb(root);
  const registry = new AppRegistry(async () =>
    ["current", "peer", "unstarted"].map((id) => ({
      appDir: join(root, `${id}.app`),
      definition: { id, version: 1, agent: id, inputSchema: { type: "object" }, tasks: { maxConcurrent: 1 } },
    })),
  );
  try {
    await registry.reload();
    const contexts = Object.fromEntries(
      ["current", "peer", "disabled"].map((appId) => {
        const context = appTaskTestContext({
          appDir: join(root, `${appId}.app`),
          appId,
          agent: appId,
          maxConcurrent: 1,
          resourceStore: AppTaskResourceStore.fromDb(db, appId),
          tree: { root_task_id: "root", groups: { root: { id: "root" } } },
        });
        observeAppTaskIntent(context, {
          appAgent: appId,
          intent: {
            id: "same-id",
            parentId: "root",
            mode: "achieve",
            outcome: `${appId} outcome`,
            acceptance: ["Verified"],
            outputs: [],
            priority: "P1",
            input: {},
          },
        });
        return [appId, context];
      }),
    );
    const peerBefore = contexts.peer!.resourceStore.readTaskContext({ taskIds: ["same-id"] });
    const prepared: string[] = [];
    const agents: TaskAgentRunner = {
      prepare: async ({ agent }) => {
        prepared.push(agent);
        return true;
      },
      available: () => true,
      role: (agent) => ({ agent, instructions: "Fixture" }),
      execute: async () => {
        throw new Error("read must not execute work");
      },
      snapshot: () => agents,
    };
    const { installed } = await installAppTaskRuntimes(
      {
        bus,
        projectRoot: root,
        projectsRoot: root,
        persistDir: root,
        appRegistry: registry,
        hostCapacity: new HostCapacity(1),
        taskAppIds: ["current"],
        installControllers: false,
        syncReadModels: false,
        agents,
      },
      { deferRecovery: true },
    );
    expect(installed.map((app) => app.id)).toEqual(["current"]);
    expect(prepared).toEqual(["current"]);
    const tools = await buildTools(
      { name: "current", tools: [] } as unknown as AgentConfig,
      {
        agentsRoot: root,
        sharedRoot: root,
        projectsRoot: root,
        projectRoot: root,
        persistDir: root,
        bus,
        cronEnabled: false,
        getAgentSessionId: () => "session",
        manager: {
          activeSessions: new Map([
            [
              "session",
              {
                taskBinding: { appId: "current", taskId: "same-id", generation: 1, attemptId: "attempt" },
              },
            ],
          ]),
        },
      } as unknown as ToolsetLoaderOptions,
    );
    const tool = tools.find((tool) => tool.name === "tasks")!;
    const get = async (appId: string, taskId = "same-id") => {
      const result = await tool.execute("read", { action: "get", taskId, target: { appId } });
      return JSON.parse((result.content[0] as { text: string }).text);
    };
    expect(await get("current")).toMatchObject({ outcome: "current outcome" });
    expect(await get("peer.app")).toMatchObject({ outcome: "peer outcome" });
    expect(await get("peer", "missing")).toBeNull();
    for (const appId of ["disabled", "unknown", "unstarted"]) {
      expect(await get(appId)).toEqual({ error: `App ${appId} has no loaded Task runtime` });
    }
    expect(AppTaskResourceStore.activeFromDb(db, "unstarted")).toBeNull();
    expect(contexts.peer!.resourceStore.readTaskContext({ taskIds: ["same-id"] })).toEqual(peerBefore);
    expect(prepared).toEqual(["current"]);

    // The registry is source identity, not a cached copy of peer progress.
    observeAppTaskIntent(contexts.peer!, {
      appAgent: "peer",
      intent: {
        id: "same-id",
        parentId: "root",
        mode: "achieve",
        outcome: "Updated peer outcome",
        acceptance: ["Verified"],
        outputs: [],
        priority: "P1",
        input: {},
      },
    });
    expect(await get("peer")).toMatchObject({ outcome: "Updated peer outcome", generation: 2 });
  } finally {
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
