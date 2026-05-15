import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

// ── Replicate the pure functions from dispatch-validator.ts ──

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  projectDir?: string;
  status?: string;
}

function parseProjectDir(task: string | undefined): string | null {
  if (!task) return null;
  const match = task.match(/project:\s*(\S+)/);
  return match ? match[1] : null;
}

function validateDispatch(
  task: string | undefined,
  projectRoot: string
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const relPath = parseProjectDir(task);
  if (!relPath) {
    result.valid = false;
    result.errors.push("No project path found in task. Expected: 'project: <path>'");
    return result;
  }

  const { resolve } = require("path");
  const { existsSync: exists, readFileSync: readFile } = require("fs");

  const projectDir = resolve(projectRoot, relPath);
  result.projectDir = projectDir;

  if (!exists(projectDir)) {
    result.valid = false;
    result.errors.push(`Project directory does not exist: ${projectDir}`);
    return result;
  }

  const projectFile = join(projectDir, "project.md");
  if (!exists(projectFile)) {
    result.valid = false;
    result.errors.push(`No project.md found at: ${projectFile}`);
    return result;
  }

  try {
    const content = readFile(projectFile, "utf-8");
    const statusMatch = content.match(/\*\*Status\*\*:\s*(\w+)/);
    const status = statusMatch ? statusMatch[1].toLowerCase() : "unknown";
    result.status = status;

    const nonDispatchable = ["closed", "paused", "cancelled", "blocked", "waiting"];
    if (nonDispatchable.includes(status)) {
      result.valid = false;
      result.errors.push(`Project status is '${status}' — not dispatchable`);
    }

    const stopMatch = content.match(/\*\*Stop Reason\*\*:\s*(.+)/);
    if (stopMatch) {
      result.warnings.push(`Project has stop reason: ${stopMatch[1].trim()}`);
      if (status !== "active") {
        result.valid = false;
        result.errors.push(`Project stopped: ${stopMatch[1].trim()}`);
      }
    }

    const iterMatch = content.match(/\*\*Iteration\*\*:\s*(\d+)/);
    if (iterMatch) {
      const iteration = parseInt(iterMatch[1]);
      if (iteration >= 50) {
        result.warnings.push(`Project at iteration ${iteration} (safety cap is 50)`);
      }
    }
  } catch (e) {
    result.valid = false;
    result.errors.push(`Failed to read project.md: ${(e as Error).message}`);
  }

  return result;
}

function isDispatchable(task: string | undefined, projectRoot: string): boolean {
  return validateDispatch(task, projectRoot).valid;
}

// ── Tests ──

const TEST_ROOT = "/tmp/dispatch-validator-test";

describe("parseProjectDir", () => {
  it("returns null for undefined", () => {
    expect(parseProjectDir(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseProjectDir("")).toBeNull();
  });

  it("returns null for task without project:", () => {
    expect(parseProjectDir("do something")).toBeNull();
  });

  it("parses simple project path", () => {
    expect(parseProjectDir("project: my-project")).toBe("my-project");
  });

  it("parses nested project path", () => {
    expect(parseProjectDir("project: projects/foo")).toBe("projects/foo");
  });

  it("handles extra whitespace after colon", () => {
    expect(parseProjectDir("project:   some/path")).toBe("some/path");
  });

  it("extracts first project reference", () => {
    expect(parseProjectDir("run project: path/a then stop")).toBe("path/a");
  });
});

describe("validateDispatch", () => {
  beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("fails for undefined task", () => {
    const r = validateDispatch(undefined, TEST_ROOT);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("No project path");
  });

  it("fails for non-existent project directory", () => {
    const r = validateDispatch("project: ghost-project", TEST_ROOT);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("does not exist");
  });

  it("fails when project dir exists but no project.md", () => {
    mkdirSync(join(TEST_ROOT, "empty-proj"), { recursive: true });
    const r = validateDispatch("project: empty-proj", TEST_ROOT);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("No project.md");
  });

  it("succeeds for active project", () => {
    const dir = join(TEST_ROOT, "good-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: active\n**Iteration**: 3\n");
    const r = validateDispatch("project: good-proj", TEST_ROOT);
    expect(r.valid).toBe(true);
    expect(r.status).toBe("active");
    expect(r.errors).toHaveLength(0);
  });

  it("fails for closed project", () => {
    const dir = join(TEST_ROOT, "closed-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: closed\n");
    const r = validateDispatch("project: closed-proj", TEST_ROOT);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("closed");
  });

  it("fails for paused project", () => {
    const dir = join(TEST_ROOT, "paused-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: paused\n");
    const r = validateDispatch("project: paused-proj", TEST_ROOT);
    expect(r.valid).toBe(false);
  });

  it("fails for blocked project", () => {
    const dir = join(TEST_ROOT, "blocked-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: blocked\n**Stop Reason**: needs input\n");
    const r = validateDispatch("project: blocked-proj", TEST_ROOT);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("blocked"))).toBe(true);
  });

  it("warns about stop reason on active project", () => {
    const dir = join(TEST_ROOT, "warn-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: active\n**Stop Reason**: approaching limit\n");
    const r = validateDispatch("project: warn-proj", TEST_ROOT);
    expect(r.valid).toBe(true); // active with stop reason is still dispatchable
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("warns about high iteration count", () => {
    const dir = join(TEST_ROOT, "iter-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: active\n**Iteration**: 50\n");
    const r = validateDispatch("project: iter-proj", TEST_ROOT);
    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.includes("50"))).toBe(true);
  });

  it("fails for waiting project", () => {
    const dir = join(TEST_ROOT, "waiting-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: waiting\n");
    const r = validateDispatch("project: waiting-proj", TEST_ROOT);
    expect(r.valid).toBe(false);
  });

  it("fails for cancelled project", () => {
    const dir = join(TEST_ROOT, "cancelled-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: cancelled\n");
    const r = validateDispatch("project: cancelled-proj", TEST_ROOT);
    expect(r.valid).toBe(false);
  });
});

describe("isDispatchable", () => {
  beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("returns false for missing project", () => {
    expect(isDispatchable("project: nope", TEST_ROOT)).toBe(false);
  });

  it("returns true for active project", () => {
    const dir = join(TEST_ROOT, "ok-proj");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "project.md"), "# Project\n**Status**: active\n");
    expect(isDispatchable("project: ok-proj", TEST_ROOT)).toBe(true);
  });

  it("returns false for undefined task", () => {
    expect(isDispatchable(undefined, TEST_ROOT)).toBe(false);
  });
});
