import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWithAgentSessionContext } from "../../lib/agent-session-context.js";
import { readCheckpoints } from "../../lib/tools/checkpoint.js";
import { EventBus } from "../core/events/bus.js";
import type { AgentConfig } from "./agent-config.js";
import { buildTools, type ToolsetLoaderOptions } from "./toolset-loader.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixtureOptions(root: string): ToolsetLoaderOptions {
  return {
    agentsRoot: root,
    sharedRoot: root,
    projectsRoot: root,
    projectRoot: root,
    persistDir: root,
    manager: { activeSessions: new Map() },
    bus: new EventBus(),
    getAgentSessionId: () => undefined,
  } as unknown as ToolsetLoaderOptions;
}

test("rejects duplicate concrete names from overlapping presets with both sources", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-tool-overlap-"));
  roots.push(root);
  await expect(
    buildTools(
      { name: "worker", tools: ["coding", "read-only"] } as unknown as AgentConfig,
      fixtureOptions(root),
    ),
  ).rejects.toThrow(
    'Agent worker has duplicate model-visible tool name "read" from preset "coding" and preset "read-only"',
  );
});

test("rejects an agent-local tool that collides with the built-in Task tool", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-tool-local-"));
  roots.push(root);
  const toolsDir = join(root, "worker", "tools");
  mkdirSync(toolsDir, { recursive: true });
  writeFileSync(join(toolsDir, "tasks.ts"), 'export default () => ({ name: "tasks" });');

  await expect(
    buildTools({ name: "worker", tools: [] } as unknown as AgentConfig, fixtureOptions(root)),
  ).rejects.toThrow(
    'Agent worker has duplicate model-visible tool name "tasks" from agent-local tools for "worker" and built-in "tasks"',
  );
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

test("checkpoint preset isolates same-name agent session contexts and falls back when no context is active", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-tool-checkpoint-"));
  roots.push(root);
  let fallbackSessionId: string | undefined = "s-fallback";
  const tools = await buildTools(
    { name: "worker", tools: ["checkpoint"] } as unknown as AgentConfig,
    {
      ...fixtureOptions(root),
      getAgentSessionId: (agentName) => (agentName === "worker" ? fallbackSessionId : undefined),
    },
  );
  const checkpoint = tools.find((row) => row.name === "checkpoint")!;

  await runWithAgentSessionContext("worker", "s-ctx-1", () =>
    checkpoint.execute("cp-1", { summary: "Context one progress", data: { step: "one" } }),
  );
  await runWithAgentSessionContext("worker", "s-ctx-2", () =>
    checkpoint.execute("cp-2", { summary: "Context two progress", data: { step: "two" } }),
  );
  await checkpoint.execute("cp-fallback", { summary: "Fallback session progress" });
  fallbackSessionId = undefined;
  await checkpoint.execute("cp-unknown", { summary: "No context progress" });

  expect(readCheckpoints(root, "s-ctx-1")).toMatchObject([
    { sessionId: "s-ctx-1", agentName: "worker", step: 1, summary: "Context one progress", data: { step: "one" } },
  ]);
  expect(readCheckpoints(root, "s-ctx-2")).toMatchObject([
    { sessionId: "s-ctx-2", agentName: "worker", step: 1, summary: "Context two progress", data: { step: "two" } },
  ]);
  expect(readCheckpoints(root, "s-fallback")).toMatchObject([
    { sessionId: "s-fallback", agentName: "worker", step: 1, summary: "Fallback session progress", data: {} },
  ]);
  expect(readCheckpoints(root, "unknown")).toMatchObject([
    { sessionId: "unknown", agentName: "worker", step: 1, summary: "No context progress", data: {} },
  ]);
});
