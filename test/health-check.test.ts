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
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("reports healthy when everything exists", async () => {
    // Create all expected dirs/files
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc1", {});
    expect(result.details.healthy).toBe(true);
    expect(result.details.checks.every((c: any) => c.ok)).toBe(true);
  });

  it("reports unhealthy when package.json is missing", async () => {
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc2", {});
    expect(result.details.healthy).toBe(false);
    const pkgCheck = result.details.checks.find((c: any) => c.name === "package.json");
    expect(pkgCheck.ok).toBe(false);
  });

  it("reports unhealthy when agents/ is missing", async () => {
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc3", {});
    expect(result.details.healthy).toBe(false);
    const agentsCheck = result.details.checks.find((c: any) => c.name === "agents/");
    expect(agentsCheck.ok).toBe(false);
  });

  it("creates .state/ if missing and reports ok", async () => {
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });
    // Do NOT create stateDir

    const missingState = join(projectRoot, "new-state");
    const tool = createHealthCheckTool({
      projectRoot,
      stateDir: missingState,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc4", {});
    const stateCheck = result.details.checks.find((c: any) => c.name === ".state/");
    expect(stateCheck.ok).toBe(true);
    expect(stateCheck.detail).toContain("Created");
  });

  it("reports unhealthy when node_modules/ is missing", async () => {
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc5", {});
    expect(result.details.healthy).toBe(false);
    const nmCheck = result.details.checks.find((c: any) => c.name === "node_modules/");
    expect(nmCheck.ok).toBe(false);
  });

  it("detects stale sessions in registry", async () => {
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });

    // Seed a stale session as meta.json
    mkdirSync(stateDir, { recursive: true });
    writeSessionMeta(stateDir, "stale-1", {
      agent: "coder",
      task: "stuck task",
      status: "running",
      startedAt: 1000,
    });

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc6", {});
    expect(result.details.healthy).toBe(false);
    const staleCheck = result.details.checks.find((c: any) => c.name === "stale_sessions");
    expect(staleCheck.ok).toBe(false);
    expect(staleCheck.detail).toContain("stale-1");
  });

  it("reports no stale sessions when all are completed", async () => {
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });

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

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc7", {});
    const staleCheck = result.details.checks.find((c: any) => c.name === "stale_sessions");
    expect(staleCheck.ok).toBe(true);
  });

  it("reports clean state when no registry.json exists", async () => {
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc8", {});
    const staleCheck = result.details.checks.find((c: any) => c.name === "stale_sessions");
    expect(staleCheck.ok).toBe(true);
    expect(staleCheck.detail).toContain("No sessions stuck");
  });

  it("includes human-readable text in content", async () => {
    writeFileSync(join(projectRoot, "package.json"), '{"name":"test"}');
    mkdirSync(join(projectRoot, "agents"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(join(projectRoot, "node_modules"), { recursive: true });

    const tool = createHealthCheckTool({
      projectRoot,
      stateDir,
      runTypeCheck: false,
      runTests: false,
    });

    const result = await tool.execute("tc9", {});
    const text = result.content[0].text;
    expect(text).toContain("Health check:");
    expect(text).toContain("HEALTHY");
  });
});
