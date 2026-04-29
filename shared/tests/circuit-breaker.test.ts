/**
 * Tests for workflows/circuit-breaker.ts
 * Tests use real filesystem with temp directories.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkCircuitBreaker,
  recordOutcome,
  resetCircuitBreaker,
} from "../workflows/circuit-breaker.ts";

describe("circuit-breaker", () => {
  let agentsRoot: string;

  beforeEach(() => {
    agentsRoot = mkdtempSync(join(tmpdir(), "cb-test-"));
    mkdirSync(join(agentsRoot, "shared"), { recursive: true });
  });

  describe("checkCircuitBreaker", () => {
    it("returns null when no state exists", () => {
      expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
    });

    it("returns null after 1 error (under threshold)", () => {
      recordOutcome(agentsRoot, "test-agent", true, "err1");
      expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
    });

    it("returns null after 2 errors (under threshold)", () => {
      recordOutcome(agentsRoot, "test-agent", true, "err1");
      recordOutcome(agentsRoot, "test-agent", true, "err2");
      expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
    });

    it("returns reason string after 3 consecutive errors", () => {
      recordOutcome(agentsRoot, "test-agent", true, "err1");
      recordOutcome(agentsRoot, "test-agent", true, "err2");
      recordOutcome(agentsRoot, "test-agent", true, "err3");
      const result = checkCircuitBreaker(agentsRoot, "test-agent");
      expect(result).toContain("Circuit breaker OPEN");
      expect(result).toContain("3 consecutive errors");
    });

    it("resets when SIGNAL file is manually deleted", () => {
      recordOutcome(agentsRoot, "test-agent", true, "e1");
      recordOutcome(agentsRoot, "test-agent", true, "e2");
      recordOutcome(agentsRoot, "test-agent", true, "e3");
      const signalPath = join(agentsRoot, "test-agent", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(true);
      unlinkSync(signalPath);
      expect(checkCircuitBreaker(agentsRoot, "test-agent")).toBeNull();
    });
  });

  describe("recordOutcome", () => {
    it("increments error count", () => {
      recordOutcome(agentsRoot, "a1", true, "fail");
      recordOutcome(agentsRoot, "a1", true, "fail2");
      expect(checkCircuitBreaker(agentsRoot, "a1")).toBeNull();
    });

    it("creates SIGNAL file at threshold", () => {
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      const signalPath = join(agentsRoot, "a1", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(true);
      const content = readFileSync(signalPath, "utf-8");
      expect(content).toContain("Circuit Breaker Tripped");
      expect(content).toContain("a1");
    });

    it("success resets error count", () => {
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", false);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      expect(checkCircuitBreaker(agentsRoot, "a1")).toBeNull();
    });

    it("success after trip removes SIGNAL file", () => {
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      const signalPath = join(agentsRoot, "a1", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(true);
      recordOutcome(agentsRoot, "a1", false);
      expect(existsSync(signalPath)).toBe(false);
    });

    it("handles multiple agents independently", () => {
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a2", true);
      expect(checkCircuitBreaker(agentsRoot, "a1")).not.toBeNull();
      expect(checkCircuitBreaker(agentsRoot, "a2")).toBeNull();
    });
  });

  describe("resetCircuitBreaker", () => {
    it("clears error state", () => {
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      expect(checkCircuitBreaker(agentsRoot, "a1")).not.toBeNull();
      resetCircuitBreaker(agentsRoot, "a1");
      expect(checkCircuitBreaker(agentsRoot, "a1")).toBeNull();
    });

    it("removes SIGNAL file", () => {
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      recordOutcome(agentsRoot, "a1", true);
      const signalPath = join(agentsRoot, "a1", "SIGNAL-circuit-breaker.md");
      expect(existsSync(signalPath)).toBe(true);
      resetCircuitBreaker(agentsRoot, "a1");
      expect(existsSync(signalPath)).toBe(false);
    });

    it("works even when no prior state", () => {
      resetCircuitBreaker(agentsRoot, "unknown-agent");
      expect(checkCircuitBreaker(agentsRoot, "unknown-agent")).toBeNull();
    });
  });
});
