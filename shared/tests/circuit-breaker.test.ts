import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkCircuitBreaker, recordOutcome, resetCircuitBreaker } from "../workflows/circuit-breaker.js";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEST_ROOT = "/tmp/cb-test-agents";

function setup() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(join(TEST_ROOT, ".state"), { recursive: true });
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
      rmSync(signalPath);
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("auto-resets stale tripped breakers after the retry window", () => {
      const statePath = join(TEST_ROOT, ".state", "circuit-breaker-state.json");
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      writeFileSync(signalPath, "signal", "utf-8");
      writeFileSync(statePath, JSON.stringify({
        agents: {
          "test-agent": {
            consecutiveErrors: 3,
            trippedAt: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
          },
        },
      }), "utf-8");

      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
      expect(existsSync(signalPath)).toBe(false);
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      expect(state.agents["test-agent"].consecutiveErrors).toBe(0);
    });
  });

  describe("recordOutcome", () => {
    it("increments consecutive errors on failure", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      // Still below threshold
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("resets on success", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", false);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      // Only 2 consecutive after reset
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).toBeNull();
    });

    it("trips breaker at 3 consecutive errors", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      expect(checkCircuitBreaker(TEST_ROOT, "test-agent")).not.toBeNull();
    });

    it("writes SIGNAL file when tripped", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(true);
      const content = readFileSync(signalPath, "utf-8");
      expect(content).toContain("Circuit Breaker Tripped");
    });

    it("removes SIGNAL file on success after trip", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", false);
      const signalPath = join(TEST_ROOT, "test-agent", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(false);
    });

    it("stores error detail", () => {
      recordOutcome(TEST_ROOT, "test-agent", true, "provider timeout");
      const state = JSON.parse(readFileSync(join(TEST_ROOT, ".state", "circuit-breaker-state.json"), "utf-8"));
      expect(state.agents["test-agent"].lastError).toBe("provider timeout");
    });

    it("handles multiple agents independently", () => {
      mkdirSync(join(TEST_ROOT, "agent-a"), { recursive: true });
      mkdirSync(join(TEST_ROOT, "agent-b"), { recursive: true });
      recordOutcome(TEST_ROOT, "agent-a", true);
      recordOutcome(TEST_ROOT, "agent-a", true);
      recordOutcome(TEST_ROOT, "agent-a", true);
      recordOutcome(TEST_ROOT, "agent-b", true);
      expect(checkCircuitBreaker(TEST_ROOT, "agent-a")).not.toBeNull();
      expect(checkCircuitBreaker(TEST_ROOT, "agent-b")).toBeNull();
    });
  });

  describe("resetCircuitBreaker", () => {
    it("resets a tripped breaker", () => {
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
      recordOutcome(TEST_ROOT, "test-agent", true);
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
  });
});
