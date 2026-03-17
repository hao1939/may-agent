import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createFinishTool } from "../src/lib/tools/lifecycle.js";
import type { FinishToolOptions } from "../src/lib/tools/lifecycle.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
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

function createTool(overrides?: Partial<FinishToolOptions>) {
  return createFinishTool({
    agentName: "tech-lead",
    projectRoot,
    persistDir: stateDir,
    ...overrides,
  });
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
      deliverables: [
        { path: "src/lib/feature.ts", description: "Widget implementation" },
      ],
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

  it("requires blockers for blocked status", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "blocked",
      summary: "Can't proceed.",
    });

    expect(text).toContain("error");
    expect(text).toContain("blockers");
  });

  it("requires blockers for failure status", async () => {
    const tool = createTool();
    const text = await callFinish(tool, {
      status: "failure",
      summary: "Failed.",
    });

    expect(text).toContain("error");
    expect(text).toContain("blockers");
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
  });
});
