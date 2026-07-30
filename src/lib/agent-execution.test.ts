import { afterEach, describe, expect, test } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAgentExecution } from "./agent-execution.js";
import { currentAgentSessionId } from "./agent-session-context.js";
import { createFinishTool } from "./tools/lifecycle.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tool(name: string): AgentTool {
  return {
    name,
    label: name,
    description: name,
    parameters: Type.Object({}),
    execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
  };
}

describe("shared agent execution preparation", () => {
  test("has no autonomous-infrastructure imports", () => {
    const source = readFileSync(new URL("./agent-execution.ts", import.meta.url), "utf8");
    const imports = source
      .split(/\r?\n/)
      .filter((line) => line.startsWith("import "))
      .join("\n");

    for (const forbidden of [
      "event-bus",
      "bun:sqlite",
      "requests.js",
      "persistence.js",
      "project-app",
      "metrics",
      "cron",
      "manager.js",
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });

  test("prepares convention prompts and tools without a manager or database", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-preparation-"));
    roots.push(root);
    const agentDir = join(root, "agents", "sample");
    mkdirSync(join(root, "shared"), { recursive: true });
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(root, "shared", "common-sense.md"), "shared rules\n");
    writeFileSync(join(agentDir, "AGENTS.md"), "sample identity\n");

    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        agentDir,
        projectRoot: root,
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read"), tool("finish")],
      },
      projectRoot: root,
      sessionId: "direct-1",
      task: "do the work",
      promptTimestamp: "2026-07-19T00:00:00.000Z",
    });

    expect(prepared.task).toBe("do the work");
    expect(prepared.prompt).toBe("do the work");
    expect(prepared.tools.map((candidate) => candidate.name)).toEqual(["read", "finish"]);
    expect(prepared.tools.find((candidate) => candidate.name === "read")?.executionMode).toBeUndefined();
    expect(prepared.tools.find((candidate) => candidate.name === "finish")?.executionMode).toBe("sequential");
    expect(prepared.runner.sessionId).toBe("direct-1");
    expect(prepared.runner.streamFn).toBeFunction();
    expect(prepared.systemPrompt).toContain("shared rules\n\nsample identity");
    expect(prepared.systemPrompt).toContain("Available tools: read, finish");
    expect(prepared.systemPrompt).toContain("Current time: 2026-07-19T00:00:00.000Z");
  });

  test("binds shared tools to the exact concurrent agent session", async () => {
    const observations: Array<{ before?: string; after?: string }> = [];
    const sharedTool: AgentTool = {
      ...tool("message"),
      execute: async () => {
        const before = currentAgentSessionId("may");
        await Bun.sleep(before === "session-old" ? 5 : 1);
        observations.push({ before, after: currentAgentSessionId("may") });
        return { content: [{ type: "text", text: "ok" }] };
      },
    };
    const definition = {
      name: "may",
      description: "may",
      domain: "tests",
      systemPrompt: "identity",
      model: { contextWindow: 10_000 } as any,
      tools: [sharedTool],
    };
    const oldTurn = prepareAgentExecution({
      definition,
      projectRoot: "/tmp",
      sessionId: "session-old",
      task: "old turn",
    });
    const latestTurn = prepareAgentExecution({
      definition,
      projectRoot: "/tmp",
      sessionId: "session-latest",
      task: "latest turn",
    });

    await Promise.all([
      oldTurn.tools[0]!.execute("old-call", {} as never),
      latestTurn.tools[0]!.execute("latest-call", {} as never),
    ]);

    expect(observations).toContainEqual({ before: "session-old", after: "session-old" });
    expect(observations).toContainEqual({ before: "session-latest", after: "session-latest" });
  });

  test("injects a rule-activated skill before the task", () => {
    const skill = {
      name: "proof-first",
      description: "Prepare proof before broad rollout.",
      filePath: "/tmp/proof-first/SKILL.md",
      canonicalPath: "/tmp/proof-first/SKILL.md",
      content: "Freeze a baseline and candidate before broad rollout.",
      scope: "agent" as const,
      contentHash: "proof-first-hash",
    };
    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read")],
        skillCatalog: {
          skills: new Map([[skill.name, skill]]),
          diagnostics: [],
          omittedFromPrompt: [],
        },
        skillActivationRules: [{ skill: "proof-first", pattern: "roll(?:out| out).*(?:all|every) agents?" }],
      },
      projectRoot: "/tmp",
      sessionId: "rule-skill-1",
      task: "Roll out this prompt to every agent.",
    });

    expect(prepared.skillActivation).toBe("rule");
    expect(prepared.activatedSkill?.name).toBe("proof-first");
    expect(prepared.prompt).toContain("Freeze a baseline and candidate before broad rollout.");
    expect(prepared.prompt).toContain("Roll out this prompt to every agent.");
  });

  test("adapts the supplied finish capability for structured workflow results", () => {
    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        model: { contextWindow: 10_000 } as any,
        tools: [tool("finish")],
      },
      projectRoot: "/tmp",
      sessionId: "direct-2",
      task: "return a result",
      outputSchema: Type.Object({ verdict: Type.String() }),
    });

    expect(prepared.requireFinish).toBe(true);
    expect(prepared.systemPrompt).toContain("Complete it only by calling finish()");
    expect((prepared.tools[0]!.parameters as any).required).toContain("result");
  });

  test("rebases filesystem tools onto the workflow execution root", async () => {
    const registeredRoot = mkdtempSync(join(tmpdir(), "agent-registered-root-"));
    const executionRoot = mkdtempSync(join(tmpdir(), "agent-execution-root-"));
    roots.push(registeredRoot, executionRoot);
    writeFileSync(join(executionRoot, "proof.txt"), "task workspace\n");

    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        projectRoot: registeredRoot,
        model: { contextWindow: 10_000 } as any,
        tools: [tool("read")],
      },
      projectRoot: registeredRoot,
      executionRoot,
      sessionId: "isolated-1",
      task: "read proof",
    });

    const result = await prepared.tools[0]!.execute("call-1", { path: "proof.txt" } as never);
    expect(JSON.stringify(result)).toContain("task workspace");
    expect(prepared.definition.projectRoot).toBe(executionRoot);
  });

  test("rebases finish deliverable validation onto the workflow execution root", async () => {
    const registeredRoot = mkdtempSync(join(tmpdir(), "agent-finish-registered-root-"));
    const executionRoot = mkdtempSync(join(tmpdir(), "agent-finish-execution-root-"));
    roots.push(registeredRoot, executionRoot);
    writeFileSync(join(executionRoot, "proof.txt"), "task workspace\n");

    const prepared = prepareAgentExecution({
      definition: {
        name: "sample",
        description: "sample",
        domain: "tests",
        systemPrompt: "identity",
        projectRoot: registeredRoot,
        model: { contextWindow: 10_000 } as any,
        tools: [createFinishTool({ agentName: "sample", projectRoot: registeredRoot })],
      },
      projectRoot: registeredRoot,
      executionRoot,
      sessionId: "isolated-finish-1",
      task: "finish with proof",
      requireFinish: true,
      createFinish: () => createFinishTool({ agentName: "sample", projectRoot: executionRoot }),
    });

    const finish = prepared.tools.find((candidate) => candidate.name === "finish");
    const result = await finish!.execute("call-1", {
      status: "success",
      summary: "verified worktree evidence",
      deliverables: [{ path: "proof.txt", description: "worktree proof" }],
      verification_evidence: ["read(proof.txt) showed task workspace"],
    } as never);
    expect(JSON.stringify(result)).not.toContain("Deliverables not found on disk");
    expect(JSON.stringify(result)).toContain("SUCCESS");
  });
});
