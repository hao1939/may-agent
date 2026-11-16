import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createFinishTool, createWorkflowFinishTool } from "@may-agent/sdk/runtime";
import { taskAgentResultSchema, taskReconcileResultSchema } from "@may-agent/sdk/app";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── Test scaffolding ─────────────────────────────────────────────────────

let testDir: string;
let projectRoot: string;
let stateDir: string;

function setup() {
  testDir = join(tmpdir(), `finish-tool-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  projectRoot = testDir;
  stateDir = join(testDir, ".state");

  mkdirSync(stateDir, { recursive: true });
  mkdirSync(join(testDir, "src", "lib"), { recursive: true });

  // Create test deliverables
  writeFileSync(join(testDir, "src", "lib", "feature.ts"), "export const x = 1;\n", "utf-8");
  writeFileSync(join(testDir, "README.md"), "# Test\n", "utf-8");
}

function cleanup() {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup */
  }
}

function createTool() {
  return createFinishTool({ projectRoot });
}

async function callFinish(tool: ReturnType<typeof createFinishTool>, params: Record<string, unknown>) {
  const result = await tool.execute("call-1", params);
  return (result.content[0] as { type: string; text: string }).text;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("createFinishTool", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it.each([
    ["done", "✅", "DONE"],
    ["blocked", "🚫", "BLOCKED"],
  ] as const)("returns an ExecutionResult-aligned %s report", async (status, marker, label) => {
    const text = await callFinish(createTool(), {
      status,
      summary: "Bounded work reported.",
      output: { value: 1 },
      facts: { evidence: "checked" },
    });
    expect(text).toContain(marker);
    expect(text).toContain(label);
    expect(text).toContain("Bounded work reported.");
  });

  it("rejects missing summary", async () => {
    const text = await callFinish(createTool(), { status: "done", summary: "" });
    expect(text).toContain("finish() error");
  });

  it("creates finish without a meaningless project root", async () => {
    const tool = createFinishTool();
    const text = await callFinish(tool, { status: "done", summary: "No filesystem contract" });
    expect(text).toContain("No filesystem contract");
  });

  it("has only the ExecutionResult result vocabulary", () => {
    const tool = createTool();
    expect(tool.name).toBe("finish");
    expect(Object.keys(tool.parameters.properties).sort()).toEqual(["facts", "output", "status", "summary"]);
    expect(JSON.stringify(tool.parameters)).not.toContain("success");
    expect(JSON.stringify(tool.parameters)).not.toContain("partial");
    expect(JSON.stringify(tool.parameters)).not.toContain('"result"');
    expect(existsSync(join(projectRoot, "agents/tech-lead/context.md"))).toBe(false);
  });
});

describe("provider-compatible workflow finish schema", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("unifies taskReconcileResultSchema and taskAgentResultSchema as one canonical schema without JSON Schema not keywords", () => {
    expect(taskAgentResultSchema).toBe(taskReconcileResultSchema);
    const tool = createWorkflowFinishTool(createFinishTool({ projectRoot }), taskReconcileResultSchema);
    const serialized = JSON.stringify(tool.parameters.properties.output);

    expect(serialized).not.toContain('"not":');
    expect(taskReconcileResultSchema).not.toHaveProperty("anyOf");
    expect(tool.parameters.properties.output).toBe(taskReconcileResultSchema);
    expect(Object.keys(tool.parameters.properties).sort()).toEqual(["facts", "output", "status", "summary"]);
  });

  it.each([
    { state: "converged", continue: true },
    { state: "converged", report: true, facts: ["ok"] },
    { state: "waiting", response: "Not allowed while waiting" },
    { state: "waiting", report: true, facts: [] },
    { state: "incomplete", facts: [] },
    { state: "incomplete", facts: ["Failed"], requests: [] },
    { state: "incomplete", facts: ["Failed"], communication: [] },
  ])("uses only the declared TypeBox schema at finish execution: %j", async (result) => {
    const tool = createWorkflowFinishTool(createFinishTool({ projectRoot }), taskReconcileResultSchema);
    const params = {
      status: "blocked",
      summary: "Attempt report",
      output: { summary: "Task report", facts: [], ...result },
    };
    expect(tool.prepareArguments!(params)).toEqual(params);
    expect((await tool.execute("schema-valid-report", params)).terminate).toBe(true);
  });

  it.each([
    { state: "converged", response: "Done" },
    { state: "waiting", facts: ["More work remains"], continue: true },
    { state: "incomplete", facts: ["Unable to finish"] },
  ])("accepts valid Task reports: %j", async (result) => {
    const tool = createWorkflowFinishTool(createFinishTool({ projectRoot }), taskReconcileResultSchema);
    const params = {
      status: "blocked",
      summary: "Attempt report",
      output: { summary: "Task report", facts: [], ...result },
    };
    expect(tool.prepareArguments!(params)).toEqual(params);
    expect((await tool.execute("valid-report", params)).terminate).toBe(true);
  });
});
