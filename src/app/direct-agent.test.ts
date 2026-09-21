import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { prepareAgentExecution } from "../lib/agent-execution.js";
import { prepareDirectAgentExecution, resolveDirectToolPolicy, runDirectAgent } from "./direct-agent.js";

describe("direct agent tool policy", () => {
  test("enforces a caller-owned structured result through finish", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-schema-"));
    const agentDir = join(root, "agents", "example");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, "agent.json"),
      JSON.stringify({
        name: "example",
        description: "example",
        domain: "test",
        model: "test",
        tools: ["read-only"],
      }),
    );
    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      direct = await prepareDirectAgentExecution({
        agentName: "example",
        task: "Return one decision",
        projectRoot: root,
        workRoot: root,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        outputRoot: join(root, "output"),
        models: { test: { id: "test-model" } as any },
        outputSchema: Type.Object({ decision: Type.String() }),
      });

      expect(direct.prepared.requireFinish).toBe(true);
      expect(direct.prepared.tools.map((tool) => tool.name)).toContain("finish");
      expect(direct.prepared.systemPrompt).toContain("schema-validated result payload");
    } finally {
      direct?.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("prepares local tools through the same manifest and denial policy", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-local-policy-"));
    const agentDir = join(root, "agents", "example");
    await mkdir(join(agentDir, "tools"), { recursive: true });
    await writeFile(
      join(agentDir, "agent.json"),
      JSON.stringify({
        name: "example",
        description: "example",
        domain: "test",
        model: "test",
        tools: ["read-only"],
      }),
    );
    await writeFile(
      join(agentDir, "tools", "local-probe.ts"),
      `export default () => ({
        name: "local_probe",
        label: "Local probe",
        description: "Portable local fixture",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
      });`,
    );
    const prepare = (
      toolDenials?: Array<{ name: string; reason: string }>,
      outputSchema?: ReturnType<typeof Type.Object>,
    ) =>
      prepareDirectAgentExecution({
        agentName: "example",
        task: "Inspect the fixture",
        projectRoot: root,
        workRoot: root,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        outputRoot: join(root, "output"),
        models: { test: { id: "test-model" } as any },
        toolDenials,
        outputSchema,
      });

    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      direct = await prepare(undefined, Type.Object({ decision: Type.String() }));
      expect(direct.prepared.tools.map((tool) => tool.name)).toEqual(["read", "local_probe", "finish"]);
      expect(direct.executionManifest).toEqual({
        agent: "example",
        configuredTools: ["read-only"],
        deniedTools: [],
        effectiveTools: ["read", "local_probe", "finish"],
      });
      direct.cleanup();
      direct = undefined;

      direct = await prepare([{ name: "local_probe", reason: "fixture denial" }]);
      expect(direct.prepared.tools.map((tool) => tool.name)).toEqual(["read"]);
      expect(direct.executionManifest.effectiveTools).toEqual(["read"]);
      direct.cleanup();
      direct = undefined;

      direct = await prepare([{ name: "read", reason: "concrete configured-tool denial" }]);
      expect(direct.prepared.tools.map((tool) => tool.name)).toEqual(["local_probe"]);
      expect(direct.executionManifest.effectiveTools).toEqual(["local_probe"]);
      direct.cleanup();
      direct = undefined;

      direct = await prepare([{ name: "read-only", reason: "configured capability denial" }]);
      expect(direct.prepared.tools.map((tool) => tool.name)).toEqual(["local_probe"]);
      expect(direct.executionManifest.effectiveTools).toEqual(["local_probe"]);
      direct.cleanup();
      direct = undefined;

      await expect(
        prepare(
          [{ name: "finish", reason: "structured call must not expose completion" }],
          Type.Object({ decision: Type.String() }),
        ),
      ).rejects.toThrow('requires denied tool "finish" during preparation');
    } finally {
      direct?.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("distinguishes a coding bundle denial from one concrete tool denial", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-coding-policy-"));
    const agentDir = join(root, "agents", "example");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, "agent.json"),
      JSON.stringify({
        name: "example",
        description: "example",
        domain: "test",
        model: "test",
        tools: ["coding"],
      }),
    );
    const prepare = (name: string) =>
      prepareDirectAgentExecution({
        agentName: "example",
        task: "Inspect the fixture",
        projectRoot: root,
        workRoot: root,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        outputRoot: join(root, "output"),
        models: { test: { id: "test-model" } as any },
        toolDenials: [{ name, reason: "fixture denial" }],
      });

    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      direct = await prepare("bash");
      expect(direct.prepared.tools.map((tool) => tool.name)).toEqual(["read", "edit", "write"]);
      expect(direct.executionManifest.effectiveTools).toEqual(["read", "edit", "write"]);
      direct.cleanup();
      direct = undefined;

      direct = await prepare("coding");
      expect(direct.prepared.tools).toEqual([]);
      expect(direct.executionManifest.effectiveTools).toEqual([]);
    } finally {
      direct?.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("derives effective tools from configured tools and explicit denials in stable order", () => {
    expect(
      resolveDirectToolPolicy(
        "may",
        ["coding", "message", "finish"],
        [{ name: "message", reason: "isolated benchmark must not notify users" }],
      ),
    ).toEqual({
      agent: "may",
      configuredTools: ["coding", "message", "finish"],
      deniedTools: [{ name: "message", reason: "isolated benchmark must not notify users" }],
      effectiveTools: ["coding", "finish"],
    });
  });

  test("rejects unknown, duplicate, and unexplained denials", () => {
    expect(() => resolveDirectToolPolicy("may", ["coding"], [{ name: "message", reason: "not configured" }])).toThrow(
      "unknown tool",
    );
    expect(() => resolveDirectToolPolicy("may", ["coding"], [{ name: " ", reason: "blank" }])).toThrow(
      "no name",
    );
    expect(() =>
      resolveDirectToolPolicy(
        "may",
        ["coding"],
        [
          { name: "coding", reason: "first" },
          { name: "coding", reason: "second" },
        ],
      ),
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
    const options = {
      agentName: "example",
      task: "test",
      projectRoot: root,
      workRoot: root,
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      outputRoot: join(root, "output"),
      models: { test: {} as any },
    };
    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      direct = await prepareDirectAgentExecution({
        ...options,
        toolDenials: [{ name: "message", reason: "direct fixture has no messaging transport" }],
      });
      expect(direct.prepared.tools).toEqual([]);
      expect(direct.executionManifest).toEqual({
        agent: "example",
        configuredTools: ["message"],
        deniedTools: [{ name: "message", reason: "direct fixture has no messaging transport" }],
        effectiveTools: [],
      });
      direct.cleanup();
      direct = undefined;

      await expect(runDirectAgent(options)).rejects.toThrow('cannot construct effective tool "message"');
    } finally {
      direct?.cleanup();
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

  test("loads identity and skills from the readable isolated agent copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-visible-agent-"));
    const sourceAgentDir = join(root, "agents", "example");
    const workRoot = join(root, "work");
    const visibleAgentDir = join(workRoot, "agents", "example");
    await mkdir(sourceAgentDir, { recursive: true });
    await mkdir(join(visibleAgentDir, "skills", "proof-first"), {
      recursive: true,
    });
    await writeFile(
      join(sourceAgentDir, "agent.json"),
      JSON.stringify({
        name: "example",
        description: "example",
        domain: "test",
        model: "test",
        tools: ["read-only"],
      }),
    );
    await writeFile(join(visibleAgentDir, "AGENTS.md"), "Visible identity.");
    await writeFile(
      join(visibleAgentDir, "skills", "proof-first", "SKILL.md"),
      [
        "---",
        "name: proof-first",
        "description: Use for broad changes that need proof before rollout.",
        "---",
        "Run the bounded proof.",
      ].join("\n"),
    );

    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      direct = await prepareDirectAgentExecution({
        agentName: "example",
        task: "Review a broad rollout",
        projectRoot: root,
        workRoot,
        agentsRoot: join(root, "agents"),
        globalAgentsRoot: join(root, "agents"),
        visibleAgentDir,
        sharedRoot: join(root, "shared"),
        outputRoot: join(root, "output"),
        models: { test: { id: "test-model" } as any },
      });

      expect(direct.prepared.definition.agentDir).toBe(visibleAgentDir);
      expect(direct.prepared.systemPrompt).toContain("Visible identity.");
      expect(direct.prepared.systemPrompt).toContain("proof-first");
      expect(direct.prepared.systemPrompt).toContain(join(visibleAgentDir, "skills", "proof-first", "SKILL.md"));
    } finally {
      direct?.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  });
});
