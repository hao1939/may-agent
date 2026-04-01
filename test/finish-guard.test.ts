/**
 * Tests for finish-guard.ts — C1.5 Ghost Deliverable Enforcement.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  validateFinishDeliverables,
  enforceFinishDeliverables,
} from "../src/lib/finish-guard.js";

// ── Test fixtures ─────────────────────────────────────────────────────

const TEST_ROOT = join(process.cwd(), ".test-finish-guard");

beforeAll(() => {
  // Create a temporary project root with some files
  mkdirSync(join(TEST_ROOT, "src"), { recursive: true });
  mkdirSync(join(TEST_ROOT, "reports"), { recursive: true });
  writeFileSync(join(TEST_ROOT, "src", "foo.ts"), "export const x = 1;\n");
  writeFileSync(join(TEST_ROOT, "reports", "output.md"), "# Report\n");
  writeFileSync(join(TEST_ROOT, "README.md"), "# README\n");
});

afterAll(() => {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  }
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("validateFinishDeliverables", () => {
  it("returns valid when all deliverables exist", () => {
    const result = validateFinishDeliverables(
      [
        { path: "src/foo.ts", description: "Module" },
        { path: "reports/output.md", description: "Report" },
      ],
      "success",
      TEST_ROOT,
    );
    expect(result.valid).toBe(true);
    expect(result.existingPaths).toEqual(["src/foo.ts", "reports/output.md"]);
    expect(result.missingPaths).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it("returns invalid when a deliverable is missing", () => {
    const result = validateFinishDeliverables(
      [
        { path: "src/foo.ts", description: "Exists" },
        { path: "src/bar.ts", description: "Missing" },
      ],
      "success",
      TEST_ROOT,
    );
    expect(result.valid).toBe(false);
    expect(result.existingPaths).toEqual(["src/foo.ts"]);
    expect(result.missingPaths).toEqual(["src/bar.ts"]);
    expect(result.error).toContain("FM-3.1 Ghost Deliverable");
    expect(result.error).toContain("src/bar.ts");
  });

  it("returns invalid when all deliverables are missing", () => {
    const result = validateFinishDeliverables(
      [
        { path: "ghost1.md", description: "Ghost 1" },
        { path: "ghost2.md", description: "Ghost 2" },
      ],
      "success",
      TEST_ROOT,
    );
    expect(result.valid).toBe(false);
    expect(result.missingPaths).toEqual(["ghost1.md", "ghost2.md"]);
    expect(result.error).toContain("ghost1.md");
    expect(result.error).toContain("ghost2.md");
  });

  it("skips validation for failure status", () => {
    const result = validateFinishDeliverables(
      [{ path: "nonexistent.md", description: "Doesn't matter" }],
      "failure",
      TEST_ROOT,
    );
    expect(result.valid).toBe(true);
  });

  it("skips validation for blocked status", () => {
    const result = validateFinishDeliverables(
      [{ path: "nonexistent.md" }],
      "blocked",
      TEST_ROOT,
    );
    expect(result.valid).toBe(true);
  });

  it("validates for partial status", () => {
    const result = validateFinishDeliverables(
      [{ path: "nonexistent.md" }],
      "partial",
      TEST_ROOT,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("FM-3.1 Ghost Deliverable");
  });

  it("returns valid when deliverables is undefined", () => {
    const result = validateFinishDeliverables(undefined, "success", TEST_ROOT);
    expect(result.valid).toBe(true);
  });

  it("returns valid when deliverables is empty array", () => {
    const result = validateFinishDeliverables([], "success", TEST_ROOT);
    expect(result.valid).toBe(true);
  });

  it("returns valid when deliverables is null", () => {
    const result = validateFinishDeliverables(null, "success", TEST_ROOT);
    expect(result.valid).toBe(true);
  });

  it("handles empty path string", () => {
    const result = validateFinishDeliverables(
      [{ path: "", description: "Empty" }],
      "success",
      TEST_ROOT,
    );
    expect(result.valid).toBe(false);
    expect(result.missingPaths).toContain("(empty path)");
  });

  it("handles absolute paths", () => {
    const absPath = join(TEST_ROOT, "README.md");
    const result = validateFinishDeliverables(
      [{ path: absPath, description: "Absolute" }],
      "success",
      TEST_ROOT,
    );
    expect(result.valid).toBe(true);
    expect(result.existingPaths).toEqual([absPath]);
  });

  it("handles absolute paths that don't exist", () => {
    const result = validateFinishDeliverables(
      [{ path: "/nonexistent/path/file.md" }],
      "success",
      TEST_ROOT,
    );
    expect(result.valid).toBe(false);
    expect(result.missingPaths).toEqual(["/nonexistent/path/file.md"]);
  });

  it("handles directories as valid deliverables", () => {
    const result = validateFinishDeliverables(
      [{ path: "src", description: "Source directory" }],
      "success",
      TEST_ROOT,
    );
    // Directories exist on disk — existsSync returns true
    expect(result.valid).toBe(true);
  });
});

describe("enforceFinishDeliverables", () => {
  it("does not throw when all deliverables exist", () => {
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "README.md" }],
        "success",
        TEST_ROOT,
      ),
    ).not.toThrow();
  });

  it("throws FM-3.1 error when deliverables are missing", () => {
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "ghost.md" }],
        "success",
        TEST_ROOT,
      ),
    ).toThrow("FM-3.1 Ghost Deliverable");
  });

  it("does not throw for failure status even with missing files", () => {
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "ghost.md" }],
        "failure",
        TEST_ROOT,
      ),
    ).not.toThrow();
  });

  it("throws for partial status with missing files", () => {
    expect(() =>
      enforceFinishDeliverables(
        [{ path: "ghost.md" }],
        "partial",
        TEST_ROOT,
      ),
    ).toThrow("FM-3.1 Ghost Deliverable");
  });
});
