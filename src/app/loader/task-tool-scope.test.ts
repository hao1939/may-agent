import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../core/events/bus.js";
import type { AgentConfig } from "@may-agent/sdk/runtime";
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
    manager: {
      activeSessions: new Map(),
      createAgentsTool: () => ({
        name: "agents",
        label: "Agents",
        description: "test callable boundary",
        parameters: {} as any,
        execute: async () => ({ content: [{ type: "text" as const, text: "[]" }] }),
      }),
    },
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

test("does not inject a built-in tasks tool and allows agent-local tools", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-tool-local-"));
  roots.push(root);
  expect((await buildTools({ name: "worker", tools: [] } as unknown as AgentConfig, fixtureOptions(root))).map((tool) => tool.name)).toEqual(["agents"]);

  const toolsDir = join(root, "worker", "tools");
  mkdirSync(toolsDir, { recursive: true });
  writeFileSync(join(toolsDir, "tasks.ts"), 'export default () => ({ name: "tasks" });');

  const tools = await buildTools({ name: "worker", tools: [] } as unknown as AgentConfig, fixtureOptions(root));
  expect(tools.map((tool) => tool.name)).toEqual(["agents", "tasks"]);
});
