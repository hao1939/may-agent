import { describe, it, expect } from "bun:test";
import { Budget, createBudget, getBudgetConfig } from "../workflows/iteration-budget.js";

describe("iteration-budget", () => {
  describe("Budget", () => {
    it("starts with no tokens consumed", () => {
      const b = new Budget({ maxTimeMs: 10000, maxTokens: 100 });
      expect(b.getTokensConsumed()).toBe(0);
    });

    it("tracks consumed tokens", () => {
      const b = new Budget({ maxTimeMs: 10000, maxTokens: 100 });
      b.consume(30);
      expect(b.getTokensConsumed()).toBe(30);
      b.consume(20);
      expect(b.getTokensConsumed()).toBe(50);
    });

    it("throws on negative tokens", () => {
      const b = new Budget({ maxTimeMs: 10000, maxTokens: 100 });
      expect(() => b.consume(-1)).toThrow("Cannot consume negative tokens");
    });

    it("reports not exceeded when within budget", () => {
      const b = new Budget({ maxTimeMs: 60000, maxTokens: 100 });
      b.consume(50);
      expect(b.isExceeded()).toBe(false);
    });

    it("reports exceeded when tokens over budget", () => {
      const b = new Budget({ maxTimeMs: 60000, maxTokens: 100 });
      b.consume(101);
      expect(b.isExceeded()).toBe(true);
    });

    it("reports exceeded when time over budget", () => {
      const b = new Budget({ maxTimeMs: 100, maxTokens: 10000 });
      b._setStartTime(Date.now() - 200);
      expect(b.isExceeded()).toBe(true);
      expect(b.check().timeExceeded).toBe(true);
    });

    it("check() returns correct remaining values", () => {
      const b = new Budget({ maxTimeMs: 60000, maxTokens: 100 });
      b.consume(40);
      const status = b.check();
      expect(status.tokensRemaining).toBe(60);
      expect(status.exceeded).toBe(false);
      expect(status.tokensExceeded).toBe(false);
    });

    it("remaining clamps to zero", () => {
      const b = new Budget({ maxTimeMs: 60000, maxTokens: 100 });
      b.consume(150);
      expect(b.check().tokensRemaining).toBe(0);
    });

    it("getElapsedMs returns positive value", () => {
      const b = new Budget({ maxTimeMs: 60000, maxTokens: 100 });
      expect(b.getElapsedMs()).toBeGreaterThanOrEqual(0);
    });

    it("getConfig returns a copy", () => {
      const b = new Budget({ maxTimeMs: 60000, maxTokens: 100 });
      const c = b.getConfig();
      expect(c).toEqual({ maxTimeMs: 60000, maxTokens: 100 });
    });
  });

  describe("createBudget", () => {
    it("creates budget for each valid complexity 1-5", () => {
      for (let i = 1; i <= 5; i++) {
        const b = createBudget(i);
        expect(b).toBeInstanceOf(Budget);
      }
    });

    it("throws for complexity 0", () => {
      expect(() => createBudget(0)).toThrow("Invalid complexity score");
    });

    it("throws for complexity 6", () => {
      expect(() => createBudget(6)).toThrow("Invalid complexity score");
    });

    it("throws for non-integer", () => {
      expect(() => createBudget(2.5)).toThrow("Invalid complexity score");
    });

    it("higher complexity gets more tokens", () => {
      const b1 = createBudget(1);
      const b5 = createBudget(5);
      expect(b5.getConfig().maxTokens).toBeGreaterThan(b1.getConfig().maxTokens);
    });
  });

  describe("getBudgetConfig", () => {
    it("returns config for valid scores", () => {
      const c = getBudgetConfig(3);
      expect(c.maxTimeMs).toBeGreaterThan(0);
      expect(c.maxTokens).toBeGreaterThan(0);
    });

    it("throws for invalid score", () => {
      expect(() => getBudgetConfig(0)).toThrow();
    });

    it("returns a copy (not reference)", () => {
      const a = getBudgetConfig(3);
      const b = getBudgetConfig(3);
      expect(a).toEqual(b);
      a.maxTokens = 999;
      expect(getBudgetConfig(3).maxTokens).not.toBe(999);
    });
  });
});
