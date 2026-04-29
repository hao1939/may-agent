import { describe, it, expect } from "vitest";
import { validateDispatch, isDispatchable } from "../workflows/dispatch-validator.ts";

describe("dispatch-validator uncovered branches", () => {
  it("isDispatchable returns true for valid task", () => {
    expect(isDispatchable("write a test file", "/tmp")).toBe(true);
  });

  it("isDispatchable returns false for empty task", () => {
    expect(isDispatchable("", "/tmp")).toBe(false);
    expect(isDispatchable(undefined, "/tmp")).toBe(false);
  });

  it("handles project.md read failure gracefully", () => {
    // Point to a directory that doesn't have project.md to trigger the catch
    const result = validateDispatch("do something", "/nonexistent-dir-xyz-12345");
    // Should still return a result (may have errors about project.md)
    expect(result).toBeDefined();
    expect(typeof result.valid).toBe("boolean");
  });

  it("warns about high iteration count", () => {
    // This tests the iteration >= 50 branch
    const { mkdirSync, writeFileSync, rmSync } = require("fs");
    const dir = "/tmp/dispatch-val-test-" + Date.now();
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/project.md`, "**Iteration**: 55\n## Status\nactive");
    try {
      const result = validateDispatch("do something", dir);
      expect(result.warnings.some((w: string) => w.includes("iteration") || w.includes("50"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
