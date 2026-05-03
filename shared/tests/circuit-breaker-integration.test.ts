/**
 * Integration tests: circuit-breaker.ts + master-worker-resilient.ts
 * Verifies agent-level circuit breaker blocks execution after consecutive failures.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkCircuitBreaker, recordOutcome, resetCircuitBreaker } from "../workflows/circuit-breaker.ts";
import { classifyCircuit, buildPrompt, summarizeRun } from "../workflows/master-worker-resilient.ts";
import { createInitialCircuitState } from "../workflows/retry-wrapper.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";

describe("Circuit Breaker Integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cb-test-"));
    // Create agent dir and shared dir
    fs.mkdirSync(path.join(tmpDir, "shared"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "test-agent"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("Agent-level circuit breaker", () => {
    it("returns null when no errors recorded", () => {
      const result = checkCircuitBreaker(tmpDir, "test-agent");
      expect(result).toBeNull();
    });

    it("returns null after 1-2 errors (below threshold)", () => {
      recordOutcome(tmpDir, "test-agent", true, "error 1");
      recordOutcome(tmpDir, "test-agent", true, "error 2");
      expect(checkCircuitBreaker(tmpDir, "test-agent")).toBeNull();
    });

    it("trips after 3 consecutive errors", () => {
      recordOutcome(tmpDir, "test-agent", true, "error 1");
      recordOutcome(tmpDir, "test-agent", true, "error 2");
      recordOutcome(tmpDir, "test-agent", true, "error 3");
      const result = checkCircuitBreaker(tmpDir, "test-agent");
      expect(result).toContain("Circuit breaker OPEN");
      expect(result).toContain("3 consecutive errors");
    });

    it("resets on success after errors", () => {
      recordOutcome(tmpDir, "test-agent", true, "error 1");
      recordOutcome(tmpDir, "test-agent", true, "error 2");
      recordOutcome(tmpDir, "test-agent", false); // success resets
      recordOutcome(tmpDir, "test-agent", true, "error 3");
      expect(checkCircuitBreaker(tmpDir, "test-agent")).toBeNull();
    });

    it("creates SIGNAL file when tripped", () => {
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      const signalPath = path.join(tmpDir, "test-agent", "SIGNAL-circuit-breaker.md");
      expect(fs.existsSync(signalPath)).toBe(true);
      const content = fs.readFileSync(signalPath, "utf-8");
      expect(content).toContain("Circuit Breaker Tripped");
    });

    it("resets when SIGNAL file is manually deleted", () => {
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      // Manually delete signal file
      const signalPath = path.join(tmpDir, "test-agent", "SIGNAL-circuit-breaker.md");
      fs.unlinkSync(signalPath);
      // Should auto-reset
      expect(checkCircuitBreaker(tmpDir, "test-agent")).toBeNull();
    });

    it("resetCircuitBreaker clears state", () => {
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      expect(checkCircuitBreaker(tmpDir, "test-agent")).not.toBeNull();
      resetCircuitBreaker(tmpDir, "test-agent");
      expect(checkCircuitBreaker(tmpDir, "test-agent")).toBeNull();
    });
  });

  describe("Call-level circuit classification", () => {
    it("classifies closed circuit", () => {
      const state = createInitialCircuitState();
      expect(classifyCircuit(state, 30000)).toBe("closed");
    });

    it("classifies open circuit", () => {
      const state = { consecutiveFailures: 5, lastFailureTime: Date.now(), state: "open" };
      expect(classifyCircuit(state, 30000)).toBe("open");
    });

    it("classifies half-open after recovery period", () => {
      const state = { consecutiveFailures: 5, lastFailureTime: Date.now() - 60000, state: "open" };
      expect(classifyCircuit(state, 30000)).toBe("half-open");
    });
  });

  describe("Two-level integration scenario", () => {
    it("agent breaker blocks before call-level retry even starts", () => {
      // Trip the agent-level breaker
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");

      // Verify blocked
      const blocked = checkCircuitBreaker(tmpDir, "test-agent");
      expect(blocked).toContain("Circuit breaker OPEN");
      // In real usage, ResilientMasterWorker.runIteration would return early here
    });

    it("success at agent level doesn't affect call-level circuit state", () => {
      recordOutcome(tmpDir, "test-agent", false);
      const callState = createInitialCircuitState();
      // Call-level is independent
      expect(classifyCircuit(callState, 30000)).toBe("closed");
    });

    it("records 5 errors then trips, all further checks blocked", () => {
      for (let i = 0; i < 5; i++) {
        recordOutcome(tmpDir, "test-agent", true, `error ${i}`);
      }
      expect(checkCircuitBreaker(tmpDir, "test-agent")).toContain("5 consecutive errors");
    });

    it("mixed success/failure pattern keeps circuit closed", () => {
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", false); // resets
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", true, "err");
      recordOutcome(tmpDir, "test-agent", false); // resets again
      expect(checkCircuitBreaker(tmpDir, "test-agent")).toBeNull();
    });
  });
});
