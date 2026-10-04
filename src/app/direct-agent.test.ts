import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { prepareAgentExecution } from "../lib/agent-execution.js";
import { prepareDirectAgentExecution, resolveDirectToolPolicy, runDirectAgent } from "./direct-agent.js";

describe("direct agent tool policy", () => {
  test("preserves protections and grants in a distinct execution root", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-policy-"));
    const projectRoot = join(root, "installation");
    const workRoot = join(root, "checkout");
    const sharedRoot = join(projectRoot, "shared");
    const agentDir = join(projectRoot, "agents", "example");
    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      await mkdir(agentDir, { recursive: true });
      await mkdir(sharedRoot, { recursive: true });
      await writeFile(join(agentDir, "agent.json"), JSON.stringify({
        name: "example", description: "example", domain: "test", model: "test", tools: ["coding"],
      }));
      await writeFile(join(sharedRoot, "file-write-policy.json"), JSON.stringify({
        protectedPaths: ["criteria/**"],
        grants: [{ paths: ["agents/reviewer/agent.json"], writers: ["example"] }],
      }));
      for (const targetRoot of [projectRoot, workRoot]) {
        await mkdir(join(targetRoot, "criteria"), { recursive: true });
        await mkdir(join(targetRoot, "agents", "reviewer"), { recursive: true });
        await writeFile(join(targetRoot, "criteria", "rules.md"), "original");
        await writeFile(join(targetRoot, "agents", "reviewer", "agent.json"), '{"version":1}');
      }
      direct = await prepareDirectAgentExecution({
        agentName: "example", task: "Inspect the fixture", projectRoot, workRoot,
        agentsRoot: join(projectRoot, "agents"), sharedRoot, outputRoot: join(root, "output"),
        models: { test: { id: "test-model" } as any },
      });
      const write = direct.prepared.tools.find(tool => tool.name === "write")!;
      const edit = direct.prepared.tools.find(tool => tool.name === "edit")!;
      // Relative paths exercise the checkout; absolute paths retain installation protection.
      for (const prefix of ["", projectRoot]) {
        const protectedPath = join(prefix, "criteria", "rules.md");
        for (const { tool, params } of [
          { tool: write, params: { path: protectedPath, content: "rewritten" } },
          { tool: edit, params: { path: protectedPath, oldText: "original", newText: "rewritten" } },
        ]) {
          const denied = await tool.execute("blocked-write", params);
          expect(denied.content).toMatchObject([{ type: "text", text: expect.stringContaining("WRITE BLOCKED") }]);
        }
        const grantedPath = join(prefix, "agents", "reviewer", "agent.json");
        await write.execute("granted-write", { path: grantedPath, content: '{"version":2}' });
        await edit.execute("granted-edit", { path: grantedPath, oldText: "2", newText: "3" });
        const targetRoot = prefix || workRoot;
        expect(await readFile(join(targetRoot, "criteria", "rules.md"), "utf8")).toBe("original");
        expect(await readFile(join(targetRoot, "agents", "reviewer", "agent.json"), "utf8")).toBe('{"version":3}');
      }
    } finally {
      direct?.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  });

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
      expect(direct.prepared.tools.map((tool) => tool.name)).toEqual(["read", "finish"]);
      expect(direct.executionManifest.effectiveTools).toEqual(["read", "finish"]);
      expect(direct.prepared.systemPrompt).toContain("schema-validated result payload");
    } finally {
      direct?.cleanup();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("reports expanded coding and agent-local tools from actual preparation", async () => {
    const root = await mkdtemp(join(tmpdir(), "may-direct-manifest-"));
    const agentDir = join(root, "agents", "example");
    await mkdir(join(agentDir, "tools"), { recursive: true });
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

    await mkdir(join(root, "shared"), { recursive: true });
    await writeFile(join(root, "shared", "file-write-policy.json"), JSON.stringify({
      protectedPaths: ["criteria/**"], grants: [],
    }));
    let direct: Awaited<ReturnType<typeof prepareDirectAgentExecution>> | undefined;
    try {
      direct = await prepareDirectAgentExecution({
        agentName: "example",
        task: "Inspect the fixture",
        projectRoot: root,
        workRoot: root,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        outputRoot: join(root, "output"),
        models: { test: { id: "test-model" } as any },
      });

      const guardedWrite = direct.prepared.tools.find((tool) => tool.name === "write")!;
      const denied = await guardedWrite.execute("policy-probe", { path: "criteria/rules.md", content: "rewrite" });
      expect(denied.content).toMatchObject([{ type: "text", text: expect.stringContaining("WRITE BLOCKED") }]);
      expect(direct.prepared.definition.fileWritePolicy?.protectedPaths).toEqual(["criteria/**"]);
      expect(direct.executionManifest).toEqual({
        agent: "example",
        configuredTools: ["coding"],
        deniedTools: [],
        effectiveTools: ["read", "bash", "edit", "write", "local_probe"],
      });
      expect(direct.prepared.tools.map((tool) => tool.name)).toEqual(direct.executionManifest.effectiveTools);
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
      "unconfigured tool",
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
    await writeFile(join(agentDir, "AGENTS.md"), "Example agent instruction. See [context](context.md) in your agent directory when relevant.");
    await writeFile(join(agentDir, "context.md"), "Supporting context is read on demand.");
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
      });

      expect(parityView(direct.prepared)).toEqual(parityView(hosted));
      expect(direct.prepared.systemPrompt).toContain(`- Environment captured at: ${timestamp}`);
      expect(direct.prepared.systemPrompt).toContain("[context](context.md)");
      expect(direct.prepared.systemPrompt).not.toContain("Supporting context is read on demand.");
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
