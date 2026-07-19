import { afterEach, describe, expect, test } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAgentExecution } from "./agent-execution.js";

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
    expect(prepared.systemPrompt).toContain("shared rules\n\nsample identity");
    expect(prepared.systemPrompt).toContain("Available tools: read, finish");
    expect(prepared.systemPrompt).toContain("Current time: 2026-07-19T00:00:00.000Z");
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
});
