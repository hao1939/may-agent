import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHealthCheckTool } from "../src/tools.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { writeSessionMeta } from "../src/persistence.js";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("health check tool", () => {
  let projectRoot: string;
  let stateDir: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "health-test-"));
    stateDir = join(projectRoot, ".state");
    mkdirSync(stateDir, { recursive: true });
    // The tool checks for critical files relative to cwd, so we set up from projectRoot
    process.chdir(projectRoot);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("returns a health report with checks array", async () => {
    const tool = createHealthCheckTool(stateDir);
    const result = await tool.execute("tc1", {});
    expect(result.details).toBeDefined();
    expect(result.details.checks).toBeInstanceOf(Array);
    expect(result.details.checks.length).toBeGreaterThan(0);
  });

  it("includes human-readable text in content", async () => {
    const tool = createHealthCheckTool(stateDir);
    const result = await tool.execute("tc2", {});
    const text = result.content[0].text;
    expect(text).toContain("Health check:");
  });

  it("detects stale sessions", async () => {
    writeSessionMeta(stateDir, "stale-1", {
      agent: "coder",
      task: "stuck task",
      status: "running",
      startedAt: 1000,
    });

    const tool = createHealthCheckTool(stateDir);
    const result = await tool.execute("tc3", {});
    expect(result.details.healthy).toBe(false);
    const staleCheck = result.details.checks.find((c: any) => c.name === "stale_sessions");
    expect(staleCheck.ok).toBe(false);
    expect(staleCheck.detail).toContain("stale-1");
  });

  it("reports no stale sessions when all are completed", async () => {
    writeSessionMeta(stateDir, "done-1", {
      agent: "coder",
      task: "finished",
      status: "done",
      startedAt: 1000,
    });
    writeSessionMeta(stateDir, "err-1", {
      agent: "coder",
      task: "failed",
      status: "error",
      startedAt: 2000,
    });

    const tool = createHealthCheckTool(stateDir);
    const result = await tool.execute("tc4", {});
    const staleCheck = result.details.checks.find((c: any) => c.name === "stale_sessions");
    expect(staleCheck.ok).toBe(true);
  });

  it("reports clean state when no sessions exist", async () => {
    const tool = createHealthCheckTool(stateDir);
    const result = await tool.execute("tc5", {});
    const staleCheck = result.details.checks.find((c: any) => c.name === "stale_sessions");
    expect(staleCheck.ok).toBe(true);
    expect(staleCheck.detail).toContain("No sessions stuck");
  });
});
