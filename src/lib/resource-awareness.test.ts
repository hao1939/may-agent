import { describe, it, expect } from "bun:test";
import { COST_SIGNAL_DURATION_MS, COST_SIGNAL_BYTES } from "./manager-receipts.js";

describe("Resource Awareness (Agent-RRM)", () => {
  // ── Cost Signal (P113) ───────────────────────────────────────────────

  describe("Cost Signal (P113)", () => {
    describe("threshold constants", () => {
      it("COST_SIGNAL_DURATION_MS is 2000", () => {
        expect(COST_SIGNAL_DURATION_MS).toBe(2000);
      });

      it("COST_SIGNAL_BYTES is 10000", () => {
        expect(COST_SIGNAL_BYTES).toBe(10000);
      });
    });

    describe("injection logic", () => {
      // Mirror the exact conditional from wrapToolsWithReceipts:
      //   if (execDurationMs > COST_SIGNAL_DURATION_MS || outputBytes > COST_SIGNAL_BYTES)

      function shouldInjectCostSignal(durationMs: number, outputBytes: number): boolean {
        return durationMs > COST_SIGNAL_DURATION_MS || outputBytes > COST_SIGNAL_BYTES;
      }

      function formatCostSignal(durationMs: number, outputBytes: number): string {
        const kb = (outputBytes / 1024).toFixed(1);
        return `\n\n<system_note>[COST: ${durationMs}ms, ${kb}KB]</system_note>`;
      }

      it("injects when duration exceeds threshold", () => {
        expect(shouldInjectCostSignal(2500, 100)).toBe(true);
      });

      it("injects when output bytes exceeds threshold", () => {
        expect(shouldInjectCostSignal(100, 15000)).toBe(true);
      });

      it("injects when both exceed threshold", () => {
        expect(shouldInjectCostSignal(5000, 20000)).toBe(true);
      });

      it("does not inject when both below threshold", () => {
        expect(shouldInjectCostSignal(1999, 9999)).toBe(false);
      });

      it("does not inject at exact threshold (strict >)", () => {
        expect(shouldInjectCostSignal(2000, 10000)).toBe(false);
      });

      it("formats cost signal with duration and KB", () => {
        const signal = formatCostSignal(3500, 15360);
        expect(signal).toContain("[COST: 3500ms, 15.0KB]");
        expect(signal).toContain("<system_note>");
        expect(signal).toContain("</system_note>");
      });

      it("formats KB with one decimal place", () => {
        const signal = formatCostSignal(100, 1536);
        expect(signal).toContain("1.5KB");
      });
    });
  });
});
