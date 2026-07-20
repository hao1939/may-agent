import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAgentExecution } from "../lib/agent-execution.js";
import { prepareDirectAgentExecution, resolveDirectToolPolicy, runDirectAgent } from "./direct-agent.js";

describe("direct agent tool policy", () => {
  test("derives effective tools from configured tools and explicit denials in stable order", () => {
    expect(
      resolveDirectToolPolicy("may", ["coding", "message", "finish"], [
        { name: "message", reason: "isolated benchmark must not notify users" },
      ]),
    ).toEqual({
      agent: "may",
      configuredTools: ["coding", "message", "finish"],
      deniedTools: [{ name: "message", reason: "isolated benchmark must not notify users" }],
      effectiveTools: ["coding", "finish"],
    });
  });

  test("rejects unknown, duplicate, and unexplained denials", () => {
    expect(() =>
      resolveDirectToolPolicy("may", ["coding"], [{ name: "message", reason: "not configured" }]),
    ).toThrow("unconfigured tool");
    expect(() =>
      resolveDirectToolPolicy("may", ["coding"], [
        { name: "coding", reason: "first" },
        { name: "coding", reason: "second" },
      ]),
    ).toThrow("more than once");
    expect(() => resolveDirectToolPolicy("may", ["coding"], [{ name: "coding", reason: " " }])).toThrow(
      "requires a reason",
    );
  });

  test("fails before generation when an effective configured tool has no direct implementation", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-tools-"));
    const agentDir = join(root, "agents", "example");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, "agent.json"),
      JSON.stringify({
        name: "example",
        description: "example",
        domain: "test",
        model: "test",
        tools: ["message"],
      }),
    );
    try {
      await expect(
        runDirectAgent({
          agentName: "example",
          task: "test",
          projectRoot: root,
          workRoot: root,
          agentsRoot: join(root, "agents"),
          sharedRoot: join(root, "shared"),
          outputRoot: join(root, "output"),
          models: { test: {} as any },
        }),
      ).rejects.toThrow('cannot construct effective tool "message"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("prepares the same prompt, model, tools, skills, guards, and finish policy as a hosted turn", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-parity-"));
    const agentDir = join(root, "agents", "example");
    await mkdir(join(root, "shared"), { recursive: true });
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(root, "shared", "common-sense.md"), "Shared instruction.");
    await writeFile(join(agentDir, "AGENTS.md"), "Example agent instruction.");
    await writeFile(join(agentDir, "context.md"), "Stable context path.");
    await writeFile(
      join(agentDir, "agent.json"),
      JSON.stringify({
        name: "example",
        description: "example",
        domain: "test",
        model: "test",
        tools: ["read-only"],
        context_files: ["context.md"],
      }),
    );
    const timestamp = "2026-07-20T00:00:00.000Z";
    const sessionId = "parity-session";
    const task = "Review one bounded input";
    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      direct = await prepareDirectAgentExecution({
        agentName: "example",
        task,
        projectRoot: root,
        workRoot: root,
        agentsRoot: join(root, "agents"),
        globalAgentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        outputRoot: join(root, "output"),
        models: { test: { id: "test-model" } as any },
        promptTimestamp: timestamp,
        sessionId,
      });
      const hosted = prepareAgentExecution({
        definition: direct.prepared.definition,
        projectRoot: root,
        sessionId,
        task,
        promptTimestamp: timestamp,
      });
      const parityView = (prepared: typeof hosted) => ({
        prompt: prepared.prompt,
        systemPrompt: prepared.systemPrompt,
        tools: prepared.tools.map((tool) => tool.name),
        skills: [...(prepared.definition.skillCatalog?.skills.keys() ?? [])],
        model: prepared.runner.initialState.model,
        requireFinish: prepared.requireFinish,
        hasGuards: Boolean(prepared.runner.beforeToolCall),
        hasCompaction: Boolean(prepared.runner.transformContext),
        contextFiles: prepared.definition.contextFiles,
      });

      expect(parityView(direct.prepared)).toEqual(parityView(hosted));
      expect(direct.prepared.systemPrompt).toContain(`- Current time: ${timestamp}`);
      expect(direct.prepared.definition.contextFiles).toEqual([join(agentDir, "context.md")]);
    } finally {
      direct?.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  });
});
