import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createFinishTool, createWorkflowFinishTool } from "@may-agent/sdk/runtime";
import { taskAgentResultSchema } from "@may-agent/sdk";
import { Type } from "typebox";
import { Compile } from "typebox/compile";
import { providerCompatibleToolSchema } from "./lifecycle";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── Test scaffolding ───────────────────────────────────────────────────

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

async function callFinish(tool: ReturnType<typeof createTool>, params: Record<string, unknown>) {
  const result = await tool.execute("test-call-id", params);
  return (result.content[0] as { type: string; text: string }).text;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("createFinishTool", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("returns structured success output", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "success",
      summary: "Implemented the widget feature.",
      deliverables: [{ path: "src/lib/feature.ts", description: "Widget implementation" }],
      verification_facts: ["Step 3: read(src/lib/feature.ts) confirmed export exists"],
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
      next_steps: "Ask admin for permissions.",
    });

    expect(text).toContain("🚫");
    expect(text).toContain("BLOCKED");
    expect(text).toContain("No root access");
    expect(text).toContain("Next steps");
    expect(text).toContain("Ask admin for permissions");
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

  it("returns partial output with next_steps", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "partial",
      summary: "Implemented 2 of 3 endpoints.",
      deliverables: [{ path: "src/lib/feature.ts", description: "Endpoints A and B" }],
      next_steps: "Still need endpoint C.",
    });

    expect(text).toContain("⚠️");
    expect(text).toContain("PARTIAL");
    expect(text).toContain("Still need endpoint C");
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
      verification_facts: ["Step 2: read(README.md) confirmed no issues"],
    });

    expect(text).toContain("✅");
    expect(text).toContain("SUCCESS");
  });

  it("accepts success without optional verification_facts", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "success",
      summary: "Done.",
      deliverables: [{ path: "src/lib/feature.ts", description: "Feature" }],
    });

    expect(text).not.toContain("finish() error");
    expect(text).toContain("SUCCESS");
    expect(text).not.toContain("Verification facts");
  });

  it("includes verification facts in output", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "success",
      summary: "Done.",
      deliverables: [{ path: "src/lib/feature.ts", description: "Feature" }],
      verification_facts: ["Step 5: read(src/lib/feature.ts) confirmed changes", "Step 8: bash test exit code 0"],
    });

    expect(text).toContain("Verification facts");
    expect(text).toContain("Step 5: read(src/lib/feature.ts) confirmed changes");
    expect(text).toContain("Step 8: bash test exit code 0");
  });

  it("allows non-success status without verification_facts", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "partial",
      summary: "Halfway done.",
      next_steps: "Finish remaining items.",
    });

    expect(text).toContain("⚠️");
    expect(text).toContain("PARTIAL");
  });

  it("allows partial with missing deliverables (warning only)", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "partial",
      summary: "Started work.",
      deliverables: [{ path: "not/here.ts", description: "Incomplete file" }],
      next_steps: "Finish the file.",
    });

    // Partial status should NOT reject for missing deliverables (unlike success)
    expect(text).toContain("⚠️");
    expect(text).toContain("PARTIAL");
    expect(text).toContain("MISSING");
  });

  it("has correct tool metadata", () => {
    const tool = createTool();
    expect(tool.name).toBe("finish");
    expect(tool.description).toContain("structured completion");
    // The schema is what the model sees, not just developer documentation.
    const fields = tool.parameters.properties;
    expect(fields.completed_items.description).toContain("does not complete");
    expect(fields.new_items.description).toContain("does not create");
    expect(fields.context_updates.description).toContain("suggestions only");
    expect(fields.context_updates.description).toContain("retains these suggestions in its result");
    expect(fields.context_updates.description).toContain("verified activation");
    expect(fields.lessons.description).toContain("retained in the completion report");
  });

  it.each(["absent", "empty", "historical"])("reports notes without writing memory (state: %s)", async (state) => {
    const streamPath = join(stateDir, "memory-stream.jsonl");
    const historical = '{"agent":"example-agent","category":"insight","content":"Historical evidence"}\n';
    if (state === "absent") rmSync(stateDir, { recursive: true });
    if (state === "historical") writeFileSync(streamPath, historical);
    const text = await callFinish(createTool(), {
      status: "partial",
      summary: "Reviewed the change; follow-up needs an owner decision.",
      next_steps: "Ask the owner to authorize the follow-up.",
      completed_items: ["Reviewed change"],
      new_items: ["Apply follow-up"],
      context_updates: [{ action: "add", content: "Project prefers concise reviews" }],
      lessons: [{ category: "insight", content: "Verify the selected revision" }],
    });
    expect(text).toContain("PARTIAL");
    expect(text).toContain("Lessons reported:");
    expect(text).toContain("Verify the selected revision");
    expect(text).not.toContain("Lessons recorded:");
    expect(existsSync(join(projectRoot, "agents/tech-lead/context.md"))).toBe(false);
    expect(existsSync(stateDir)).toBe(state !== "absent");
    expect(existsSync(streamPath)).toBe(state === "historical");
    if (state === "historical") expect(readFileSync(streamPath, "utf8")).toBe(historical);
  });
});

describe("provider-compatible workflow finish schema", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("removes negative Task branches from serialized parameters without mutating the contract", () => {
    const original = JSON.stringify(taskAgentResultSchema);
    const tool = createWorkflowFinishTool(createFinishTool({ projectRoot }), taskAgentResultSchema);
    const parameters = JSON.parse(JSON.stringify(tool.parameters));
    const result = parameters.properties.result;

    expect(result).not.toHaveProperty("anyOf");
    expect(JSON.stringify(result)).not.toContain('"not":');
    expect(result.properties.state.anyOf).toEqual(taskAgentResultSchema.properties.state.anyOf);
    expect(result.properties.conditions.items.anyOf).toEqual(
      JSON.parse(JSON.stringify(taskAgentResultSchema.properties.conditions.items.anyOf)),
    );
    expect(result.$id).toBe(taskAgentResultSchema.$id);
    expect(result.additionalProperties).toBe(false);
    expect(parameters.required).toContain("result");
    expect(JSON.stringify(taskAgentResultSchema)).toBe(original);
    expect(taskAgentResultSchema.anyOf).toHaveLength(4);
    expect(tool.parameters.properties.result).not.toBe(taskAgentResultSchema);
  });

  it("recursively strips direct and nested negatives while cloning ordinary unions and metadata", () => {
    const schema = Type.Object({
      value: Type.String({ not: { const: "forbidden" } }),
      nested: Type.Array(Type.Object({
        choice: Type.String({ anyOf: [{ allOf: [{ not: { const: "forbidden" } }] }, { const: "ok" }] }),
        ordinary: Type.Union([Type.Literal("a"), Type.Literal("b")]),
      })),
    });
    const original = JSON.stringify(schema);
    const compatible = providerCompatibleToolSchema(schema);

    expect(compatible.properties.value).not.toHaveProperty("not");
    expect(compatible.properties.nested.items.properties.choice).not.toHaveProperty("anyOf");
    expect(compatible.properties.nested.items.properties.ordinary.anyOf).toEqual(
      schema.properties.nested.items.properties.ordinary.anyOf,
    );
    expect(compatible.properties.nested.items.properties.ordinary.anyOf).not.toBe(
      schema.properties.nested.items.properties.ordinary.anyOf,
    );
    expect(Object.getOwnPropertySymbols(compatible)).toEqual(Object.getOwnPropertySymbols(schema));
    expect(JSON.stringify(schema)).toBe(original);
  });

  it.each([
    { state: "converged", continue: true },
    { state: "waiting", response: "Not allowed while waiting" },
    { state: "incomplete", facts: [] },
    { state: "incomplete", facts: ["Failed"], requests: [] },
  ])("still rejects invalid state/field combinations locally: %j", async (result) => {
    const tool = createWorkflowFinishTool(createFinishTool({ projectRoot }), taskAgentResultSchema);
    const params = {
      status: "partial", summary: "Attempt report",
      result: { summary: "Task report", facts: [], ...result },
    };
    // These combinations are deliberately allowed by the relaxed provider schema.
    expect(Compile(tool.parameters).Check(params)).toBe(true);
    expect(() => tool.prepareArguments!(params)).toThrow("supplied schema");
    await expect(tool.execute("invalid-report", params)).rejects.toThrow("supplied schema");
  });

  it.each([
    { state: "converged", response: "Done" },
    { state: "waiting", facts: ["More work remains"], continue: true },
    { state: "incomplete", facts: ["Unable to finish"] },
  ])("accepts valid Task reports: %j", async (result) => {
    const tool = createWorkflowFinishTool(createFinishTool({ projectRoot }), taskAgentResultSchema);
    const params = {
      status: "partial", summary: "Attempt report",
      result: { summary: "Task report", facts: [], ...result },
    };
    expect(tool.prepareArguments!(params)).toEqual(params);
    expect((await tool.execute("valid-report", params)).terminate).toBe(true);
  });
});
