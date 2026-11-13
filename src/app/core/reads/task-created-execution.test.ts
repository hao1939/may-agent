import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentConfig } from "../../loader/agent-config.js";
import { buildTools, type ToolsetLoaderOptions } from "../../loader/toolset-loader.js";
import { EventBus } from "../events/bus.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { readOnlyTaskTool } from "../../../lib/tools/task-read-policy.js";
import { readCreatedTasks } from "./task-created.js";

test("the production model tool resolves the live creator reader for each session and fails visibly when unavailable", async () => {
  const root = mkdtempSync(join(tmpdir(), "creator-discovery-tool-"));
  const store = AppTaskResourceStore.openStandalone(":memory:", "source");
  try {
    const session = (taskId: string) => ({
      taskBinding: { appId: "source", taskId, generation: 1, attemptId: `attempt-${taskId}` },
      taskContext: {
        taskRead: {
          created: async (options?: Parameters<typeof readCreatedTasks>[2]) =>
            readCreatedTasks(store.db, { appId: "source", taskId }, options),
        },
      },
    });
    const first = session("first");
    const sessions = new Map<string, { taskBinding: typeof first.taskBinding; taskContext?: typeof first.taskContext }>(
      [
        ["first", first],
        ["second", session("second")],
      ],
    );
    let active = "first";
    const tools = await buildTools(
      { name: "worker", tools: [] } as unknown as AgentConfig,
      {
        agentsRoot: root,
        sharedRoot: root,
        projectsRoot: root,
        projectRoot: root,
        persistDir: root,
        bus: new EventBus(),
        getAgentSessionId: () => active,
        manager: { activeSessions: sessions },
      } as unknown as ToolsetLoaderOptions,
    );
    const tool = readOnlyTaskTool(tools.find((tool) => tool.name === "tasks")!);
    const read = async (query = {}) => {
      const result = await tool.execute("created", { action: "created", ...query });
      return JSON.parse((result.content[0] as { text: string }).text);
    };
    expect(await read()).toMatchObject({ creator: { appId: "source", taskId: "first" }, items: [] });
    active = "second";
    expect(await read()).toMatchObject({ creator: { appId: "source", taskId: "second" }, items: [] });
    expect(await read({ taskId: "first" })).toMatchObject({ error: expect.stringContaining("current creator") });
    expect(await read({ target: { appId: "other" } })).toMatchObject({
      error: expect.stringContaining("current creator"),
    });
    delete sessions.get("second")!.taskContext;
    expect(await read()).toEqual({ error: "Current Task creator discovery is unavailable" });
    active = "absent";
    expect(await read()).toEqual({ error: "No current App Task scope" });
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
