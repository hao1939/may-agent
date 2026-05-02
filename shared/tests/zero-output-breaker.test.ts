/**
 * Tests for the Zero-Output Loop Circuit Breaker (DeliverableTracker)
 */
import { describe, it, expect } from "vitest";
import {
  createDeliverableTracker,
  hasDeliverableOutput,
  checkZeroOutput,
  updateDeliverableTracker,
  ZERO_OUTPUT_ESCALATE,
  ZERO_OUTPUT_TERMINATE,
  type DeliverableTracker,
} from "../workflows/master-worker-resilient.ts";
import type { IterationResult } from "../workflows/master-worker-resilient.ts";

function makeResult(overrides: Partial<IterationResult> = {}): IterationResult {
  return {
    iteration: 1,
    success: true,
    output: "some output",
    retryAttempts: 0,
    circuitState: "closed",
    durationMs: 100,
    ...overrides,
  };
}

describe("DeliverableTracker", () => {
  it("creates with zeroed state", () => {
    const t = createDeliverableTracker();
    expect(t.consecutiveZeroOutput).toBe(0);
    expect(t.totalIterations).toBe(0);
    expect(t.iterationsWithOutput).toBe(0);
  });

  describe("hasDeliverableOutput", () => {
    it("successful iteration with output is productive", () => {
      expect(hasDeliverableOutput(makeResult())).toBe(true);
    });

    it("failed iteration is not productive", () => {
      expect(hasDeliverableOutput(makeResult({ success: false, output: null }))).toBe(false);
    });

    it("stopped iteration counts as productive (not a loop)", () => {
      expect(hasDeliverableOutput(makeResult({ success: false, output: null, error: "Stopped: done" }))).toBe(true);
    });

    it("success with empty output is not productive", () => {
      expect(hasDeliverableOutput(makeResult({ output: "" }))).toBe(false);
    });
  });

  describe("checkZeroOutput thresholds", () => {
    it("returns continue below escalate threshold", () => {
      const t: DeliverableTracker = { consecutiveZeroOutput: 2, totalIterations: 3, iterationsWithOutput: 0 };
      expect(checkZeroOutput(t)).toBe("continue");
    });

    it("returns escalate at threshold", () => {
      const t: DeliverableTracker = { consecutiveZeroOutput: ZERO_OUTPUT_ESCALATE, totalIterations: 4, iterationsWithOutput: 0 };
      expect(checkZeroOutput(t)).toBe("escalate");
    });

    it("returns terminate at threshold", () => {
      const t: DeliverableTracker = { consecutiveZeroOutput: ZERO_OUTPUT_TERMINATE, totalIterations: 6, iterationsWithOutput: 0 };
      expect(checkZeroOutput(t)).toBe("terminate");
    });
  });

  describe("updateDeliverableTracker", () => {
    it("first iteration gets grace period", () => {
      const t = createDeliverableTracker();
      const action = updateDeliverableTracker(t, makeResult({ success: false, output: null }));
      expect(action).toBe("continue");
      expect(t.consecutiveZeroOutput).toBe(0); // not incremented
    });

    it("second iteration without output increments counter", () => {
      const t = createDeliverableTracker();
      updateDeliverableTracker(t, makeResult({ success: false, output: null })); // iter 1 (grace)
      updateDeliverableTracker(t, makeResult({ success: false, output: null })); // iter 2
      expect(t.consecutiveZeroOutput).toBe(1);
    });

    it("productive iteration resets counter", () => {
      const t = createDeliverableTracker();
      t.totalIterations = 1; // past grace
      t.consecutiveZeroOutput = 2;
      updateDeliverableTracker(t, makeResult());
      expect(t.consecutiveZeroOutput).toBe(0);
      expect(t.iterationsWithOutput).toBe(1);
    });

    it("triggers escalate after consecutive failures", () => {
      const t = createDeliverableTracker();
      t.totalIterations = 1; // past grace
      const failResult = makeResult({ success: false, output: null });
      let action: string = "continue";
      for (let i = 0; i < ZERO_OUTPUT_ESCALATE; i++) {
        action = updateDeliverableTracker(t, failResult);
      }
      expect(action).toBe("escalate");
    });

    it("triggers terminate after more consecutive failures", () => {
      const t = createDeliverableTracker();
      t.totalIterations = 1; // past grace
      const failResult = makeResult({ success: false, output: null });
      let action: string = "continue";
      for (let i = 0; i < ZERO_OUTPUT_TERMINATE; i++) {
        action = updateDeliverableTracker(t, failResult);
      }
      expect(action).toBe("terminate");
    });
  });
});
