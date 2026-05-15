import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync } from "node:fs";
import {
  checkCircuitBreaker,
  recordOutcome,
  resetCircuitBreaker,
} from "../shared/workflows/circuit-breaker.js";

describe("circuit-breaker", () => {
  let agentsRoot: string;

  beforeEach(() => {
    agentsRoot = mkdtempSync(join(tmpdir(), "cb-test-"));
    mkdirSync(join(agentsRoot, ".state"), { recursive: true });
  });

  afterEach(() => {
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  it("exports checkCircuitBreaker, recordOutcome, resetCircuitBreaker", () => {
    expect(typeof checkCircuitBreaker).toBe("function");
    expect(typeof recordOutcome).toBe("function");
    expect(typeof resetCircuitBreaker).toBe("function");
  });

  it("returns null for unknown agent (circuit closed)", () => {
    expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
  });

  it("stays closed after fewer than 3 errors", () => {
    recordOutcome(agentsRoot, "test-agent", true, "err1");
    recordOutcome(agentsRoot, "test-agent", true, "err2");
    expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
  });

  it("trips after 3 consecutive errors", () => {
    for (let i = 0; i < 3; i++) {
      recordOutcome(agentsRoot, "test-agent", true, `err${i}`);
    }
    const result = checkCircuitBreaker(agentsRoot, "test-agent");
    expect(result).toContain("Circuit breaker OPEN");
    expect(result).toContain("3 consecutive errors");
  });

  it("creates SIGNAL file when tripped", () => {
    mkdirSync(join(agentsRoot, "test-agent"), { recursive: true });
    for (let i = 0; i < 3; i++) {
      recordOutcome(agentsRoot, "test-agent", true);
    }
    const signalPath = join(agentsRoot, "test-agent", "SIGNAL-circuit-breaker.md");
    expect(existsSync(signalPath)).toBe(true);
  });

  it("resets on success after errors", () => {
    recordOutcome(agentsRoot, "test-agent", true);
    recordOutcome(agentsRoot, "test-agent", true);
    recordOutcome(agentsRoot, "test-agent", false); // success resets
    expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
  });

  it("resetCircuitBreaker clears state", () => {
    for (let i = 0; i < 3; i++) {
      recordOutcome(agentsRoot, "test-agent", true);
    }
    resetCircuitBreaker(agentsRoot, "test-agent");
    expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
  });
});
