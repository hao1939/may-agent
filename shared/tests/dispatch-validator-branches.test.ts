import { describe, it, expect } from "bun:test";
import { validateDispatch, isDispatchable } from "../workflows/dispatch-validator.ts";

describe("dispatch-validator uncovered branches", () => {
  it("isDispatchable returns false for empty task", () => {
    expect(isDispatchable("", "/tmp")).toBe(false);
    expect(isDispatchable(undefined, "/tmp")).toBe(false);
  });

  it("isDispatchable returns true for valid project task", () => {
    const { mkdirSync, writeFileSync, rmSync } = require("fs");
    const dir = "/tmp/dispatch-val-test-valid-" + Date.now();
    const projDir = `${dir}/myproj`;
    mkdirSync(projDir, { recursive: true });
    writeFileSync(`${projDir}/project.md`, "**Iteration**: 1\n## Status\nactive");
    try {
      expect(isDispatchable(`project: myproj`, dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("handles project.md read failure gracefully", () => {
    const { mkdirSync, rmSync } = require("fs");
    const dir = "/tmp/dispatch-val-test-nomd-" + Date.now();
    const projDir = `${dir}/myproj`;
    mkdirSync(projDir, { recursive: true });
    // No project.md file — triggers catch block
    try {
      const result = validateDispatch("project: myproj", dir);
      expect(result).toBeDefined();
      expect(result.errors.some((e: string) => e.includes("project.md"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("errors on high iteration count", () => {
    const { mkdirSync, writeFileSync, rmSync } = require("fs");
    const dir = "/tmp/dispatch-val-test-iter-" + Date.now();
    const projDir = `${dir}/myproj`;
    mkdirSync(projDir, { recursive: true });
    writeFileSync(`${projDir}/project.md`, "**Iteration**: 55\n## Status\nactive");
    try {
      const result = validateDispatch("project: myproj", dir);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("iteration") || e.includes("50"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
