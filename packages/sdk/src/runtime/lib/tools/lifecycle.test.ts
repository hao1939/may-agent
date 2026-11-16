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

  it("returns structured success output", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "success",
      summary: "Implemented the widget feature.",
      deliverables: [{ path: "src/lib/feature.ts", description: "Widget implementation" }],
    });

    expect(text).toContain("✅");
    expect(text).toContain("SUCCESS");
    expect(text).toContain("Implemented the widget feature.");
    expect(text).toContain("src/lib/feature.ts");
    expect(text).toContain("Widget implementation");
  });

  it("rejects success with missing deliverables", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "success",
      summary: "Done.",
      deliverables: [{ path: "nonexistent/file.ts", description: "Ghost file" }],
    });

    expect(text).toContain("error");
    expect(text).toContain("nonexistent/file.ts");
    expect(text).toContain("missing");
  });

  it.each(["blocked", "failure"])("accepts a %s summary without optional blocker details", async (status) => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status,
      summary: "Test environment is unavailable.",
    });

    expect(text).not.toContain("finish() error");
    expect(text).toContain(status.toUpperCase());
    expect(text).toContain("Test environment is unavailable.");
  });

  it("returns blocked output with blockers", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "blocked",
      summary: "Waiting on permissions.",
      blockers: [{ reason: "No root access", context: "Need sudo for node_modules" }],
    });

    expect(text).toContain("🚫");
    expect(text).toContain("BLOCKED");
    expect(text).toContain("No root access");
  });

  it("returns failure output", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "failure",
      summary: "Tests are broken.",
      blockers: [{ reason: "Type errors", context: "5 tsc failures in module X" }],
    });

    expect(text).toContain("❌");
    expect(text).toContain("FAILURE");
    expect(text).toContain("Type errors");
  });

  it("returns partial output", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "partial",
      summary: "Implemented 2 of 3 endpoints.",
      deliverables: [{ path: "src/lib/feature.ts", description: "Endpoints A and B" }],
    });

    expect(text).toContain("⚠️");
    expect(text).toContain("PARTIAL");
    expect(text).toContain("Implemented 2 of 3 endpoints.");
  });

  it("rejects missing summary", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "success",
      summary: "",
    });

    expect(text).toContain("error");
    expect(text).toContain("summary");
  });

  it("works without deliverables for success", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "success",
      summary: "Reviewed and found no issues.",
    });

    expect(text).toContain("✅");
    expect(text).toContain("SUCCESS");
  });

  it("allows partial with missing deliverables (warning only)", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "partial",
      summary: "Started work.",
      deliverables: [{ path: "not/here.ts", description: "Incomplete file" }],
    });

    // Partial status should NOT reject for missing deliverables (unlike success)
    expect(text).toContain("⚠️");
    expect(text).toContain("PARTIAL");
    expect(text).toContain("MISSING");
  });

  it("has a minimal 4-field schema without vestigial memory/task fields", () => {
    const tool = createTool();
    expect(tool.name).toBe("finish");
    expect(tool.description).toContain("structured completion");
    const fields = Object.keys(tool.parameters.properties).sort();
    expect(fields).toEqual(["blockers", "deliverables", "status", "summary"]);
  });

  it("does not write context or memory files when executed", async () => {
    const text = await callFinish(createTool(), {
      status: "partial",
      summary: "Reviewed the change; follow-up needs an owner decision.",
    });
    expect(text).toContain("PARTIAL");
    expect(existsSync(join(projectRoot, "agents/tech-lead/context.md"))).toBe(false);
  });
});

describe("provider-compatible workflow finish schema", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("unifies taskReconcileResultSchema and taskAgentResultSchema as one canonical schema without JSON Schema not keywords", () => {
    expect(taskAgentResultSchema).toBe(taskReconcileResultSchema);
    const tool = createWorkflowFinishTool(createFinishTool({ projectRoot }), taskReconcileResultSchema);
    const serialized = JSON.stringify(tool.parameters.properties.result);

    expect(serialized).not.toContain('"not":');
    expect(taskReconcileResultSchema).not.toHaveProperty("anyOf");
    expect(tool.parameters.properties.result).toBe(taskReconcileResultSchema);
    expect(Object.keys(tool.parameters.properties).sort()).toEqual([
      "blockers",
      "deliverables",
      "result",
      "status",
      "summary",
    ]);
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
      status: "partial",
      summary: "Attempt report",
      result: { summary: "Task report", facts: [], ...result },
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
      status: "partial",
      summary: "Attempt report",
      result: { summary: "Task report", facts: [], ...result },
    };
    expect(tool.prepareArguments!(params)).toEqual(params);
    expect((await tool.execute("valid-report", params)).terminate).toBe(true);
  });
});
