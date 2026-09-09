import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTools, type ToolsetLoaderOptions } from "./toolset-loader.js";
import type { AgentConfig } from "./agent-config.js";
import { EventBus } from "../event-bus.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("Task-bound workflow tools use their exact binding; unbound workflows get no Task scope", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-tool-scope-"));
  roots.push(root);
  const binding = { appId: "sample", taskId: "work/one", generation: 3, attemptId: "attempt-one" };
  const session: { source: string; projectId?: string; taskBinding?: typeof binding } = {
    source: "workflow:reconcile",
    projectId: "wrong-display-project",
    taskBinding: binding,
  };
  const tools = await buildTools(
    { name: "worker", tools: [] } as unknown as AgentConfig,
    {
      agentsRoot: root,
      sharedRoot: root,
      projectsRoot: root,
      projectRoot: root,
      persistDir: root,
      manager: { activeSessions: new Map([["session-test", session]]) },
      bus: new EventBus(),
      cronEnabled: false,
      getAgentSessionId: () => "session-test",
    } as unknown as ToolsetLoaderOptions,
  );
  const tool = tools.find((row) => row.name === "tasks")!;
  const get = async () => {
    const result = await tool.execute("read-one", { action: "get", taskId: "work/two" });
    return JSON.parse((result.content[0] as { text: string }).text);
  };
  // There is intentionally no loaded App in this portable fixture. Reaching
  // its reader with the exact binding proves scope, without publishing facts.
  expect(await get()).toEqual({ error: "App sample has no loaded Task runtime" });
  delete session.taskBinding;
  expect(await get()).toEqual({ error: "No current App Task scope" });
  session.source = "app-task-agent";
  session.projectId = "legacy";
  expect(await get()).toEqual({ error: "App legacy has no loaded Task runtime" });
});
