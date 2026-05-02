import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateDispatch, isDispatchable } from "../workflows/dispatch-validator.ts";
import { mkdirSync, writeFileSync, rmSync, chmodSync } from "fs";

describe("dispatch-validator deep branches", () => {
  const tmpBase = "/tmp/dispatch-deep-" + Date.now();
  
  beforeEach(() => {
    mkdirSync(tmpBase, { recursive: true });
  });
  
  afterEach(() => {
    rmSync(tmpBase, { recursive: true, force: true });
  });

  function setupProject(content: string, name = "proj") {
    const dir = `${tmpBase}/${name}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/project.md`, content);
    return dir;
  }

  // Line 56: non-dispatchable statuses
  it("rejects closed status", () => {
    setupProject("**Status**: closed\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("closed"))).toBe(true);
  });

  it("rejects paused status", () => {
    setupProject("**Status**: paused\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
  });

  it("rejects cancelled status", () => {
    setupProject("**Status**: cancelled\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
  });

  it("rejects blocked status", () => {
    setupProject("**Status**: blocked\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
  });

  it("rejects waiting status", () => {
    setupProject("**Status**: waiting\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
  });

  // Lines 81-87: stop reason handling
  it("warns about stop reason on active project", () => {
    setupProject("**Status**: active\n**Stop Reason**: budget exceeded\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(true); // active + stop reason = still valid but warning
    expect(r.warnings.some(w => w.includes("budget exceeded"))).toBe(true);
  });

  it("rejects non-active project with stop reason", () => {
    setupProject("**Status**: unknown\n**Stop Reason**: failed tests\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("failed tests"))).toBe(true);
  });

  it("rejects paused project with stop reason", () => {
    setupProject("**Status**: paused\n**Stop Reason**: manual stop\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
    // Should have both the status error and the stop error
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  // Lines 98-100: iteration cap (hard block, not warning)
  it("errors when iteration >= 50", () => {
    setupProject("**Status**: active\n**Iteration**: 50\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("50"))).toBe(true);
  });

  it("errors when iteration is 99", () => {
    setupProject("**Status**: active\n**Iteration**: 99\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("99"))).toBe(true);
  });

  it("no warning when iteration < 50", () => {
    setupProject("**Status**: active\n**Iteration**: 10\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.warnings.length).toBe(0);
  });

  // Line 56: project dir missing
  it("rejects missing project directory", () => {
    const r = validateDispatch(`project: nonexistent`, tmpBase);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("does not exist"))).toBe(true);
  });

  // Unknown status is valid but has no special handling
  it("accepts unknown status without stop reason", () => {
    setupProject("**Status**: unknown\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(true);
  });

  // Combination: stop reason + active status with high iteration
  it("handles combined errors", () => {
    setupProject("**Status**: active\n**Iteration**: 55\n**Stop Reason**: timeout\n");
    const r = validateDispatch(`project: proj`, tmpBase);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(1);
  });
});
