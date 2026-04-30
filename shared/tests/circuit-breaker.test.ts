import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkCircuitBreaker, recordOutcome, resetCircuitBreaker } from "../workflows/circuit-breaker.js";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TEST_ROOT = "/tmp/cb-test-agents";

function setup() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(join(TEST_ROOT, "shared"), { recursive: true });
  mkdirSync(join(TEST_ROOT, "test-agent"), { recursive: true });
}

describe("circuit-breaker", () => {
  beforeEach(setup);
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  describe("checkCircuitBreaker", () => {
    it("returns null for unknown agent", () => {
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("returns null when errors below threshold", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("returns reason string when breaker is tripped", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      const result = checkCircuitBreaker(TEST_ROOT, "test-agent");
      expect(result).toContain("Circuit breaker OPEN");
      expect(result).toContain("3 consecutive errors");
    });

    it("resets when SIGNAL file is manually deleted", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      // Delete signal file to simulate manual re-enable
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      rmSync(signalPath, { force: true });
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });
  });

  describe("recordOutcome", () => {
    it("increments error count on failure", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      // Still below threshold
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("resets error count on success", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", false); // success resets
      recordOutcome(TEST_ROOT, "test-agent", true);
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("creates SIGNAL file when breaker trips", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(true);
    });

    it("SIGNAL file contains agent name and error info", () => {
      recordOutcome(TEST_ROOT, "test-agent", true, "provider timeout");
      recordOutcome(TEST_ROOT, "test-agent", true, "provider timeout");
      recordOutcome(TEST_ROOT, "test-agent", true, "provider timeout");
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      const content = readFileSync(signalPath, "utf-8");
      expect(content).toContain("test-agent");
      expect(content).toContain("Circuit Breaker Tripped");
    });

    it("removes SIGNAL file on success after trip", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(true);
      recordOutcome(TEST_ROOT, "test-agent", false); // success
      expect(existsSync(signalPath)).toBe(false);
    });

    it("stores error detail string", () => {
      recordOutcome(TEST_ROOT, "test-agent", true, "rate limit exceeded");
      const state = JSON.parse(readFileSync(join(TEST_ROOT, "shared", "circuit-breaker-state.json"), "utf-8"));
      expect(state.agents["test-agent"].lastError).toBe("rate limit exceeded");
    });

    it("handles multiple agents independently", () => {
      mkdirSync(join(TEST_ROOT, "agent-a"), { recursive: true });
      mkdirSync(join(TEST_ROOT, "agent-b"), { recursive: true });
      recordOutcome(TEST_ROOT, "agent-a", true);
      recordOutcome(TEST_ROOT, "agent-a", true);
      recordOutcome(TEST_ROOT, "agent-a", true);
      recordOutcome(TEST_ROOT, "agent-b", false);
      expect(checkCircuitBreaker(TEST_ROOT, "agent-a")).not.toBeNull();
      expect(checkCircuitBreaker(TEST_ROOT, "agent-b")).toBeNull();
    });
  });

  describe("resetCircuitBreaker", () => {
    it("resets a tripped breaker", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).not.toBeNull();
      resetCircuitBreaker(TEST_ROOT, "test-agent");
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("removes SIGNAL file", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      resetCircuitBreaker(TEST_ROOT, "test-agent");
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(false);
    });

    it("is safe to call on non-tripped agent", () => {
      resetCircuitBreaker(TEST_ROOT, "test-agent");
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });
  });
});
