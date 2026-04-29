import { describe, it, expect } from 'vitest';
import { createBudget, getBudgetConfig, Budget } from '../workflows/iteration-budget';

describe('iteration-budget', () => {
  describe('createBudget', () => {
    it('creates budget for score 1 with tight limits', () => {
      const budget = createBudget(1);
      const config = budget.getConfig();
      expect(config.maxTimeMs).toBe(60_000);
      expect(config.maxTokens).toBe(1000);
    });

    it('creates budget for score 2', () => {
      const budget = createBudget(2);
      const config = budget.getConfig();
      expect(config.maxTimeMs).toBe(120_000);
      expect(config.maxTokens).toBe(3000);
    });

    it('creates budget for score 3', () => {
      const budget = createBudget(3);
      const config = budget.getConfig();
      expect(config.maxTimeMs).toBe(180_000);
      expect(config.maxTokens).toBe(5000);
    });

    it('creates budget for score 4', () => {
      const budget = createBudget(4);
      const config = budget.getConfig();
      expect(config.maxTimeMs).toBe(240_000);
      expect(config.maxTokens).toBe(8000);
    });

    it('creates budget for score 5 with generous limits', () => {
      const budget = createBudget(5);
      const config = budget.getConfig();
      expect(config.maxTimeMs).toBe(300_000);
      expect(config.maxTokens).toBe(10000);
    });

    it('throws for score 0', () => {
      expect(() => createBudget(0)).toThrow('Invalid complexity score');
    });

    it('throws for score 6', () => {
      expect(() => createBudget(6)).toThrow('Invalid complexity score');
    });

    it('throws for non-integer score', () => {
      expect(() => createBudget(2.5)).toThrow('Invalid complexity score');
    });

    it('throws for negative score', () => {
      expect(() => createBudget(-1)).toThrow('Invalid complexity score');
    });
  });

  describe('Budget.consume', () => {
    it('tracks token consumption', () => {
      const budget = createBudget(3);
      budget.consume(100);
      expect(budget.getTokensConsumed()).toBe(100);
    });

    it('accumulates multiple consumptions', () => {
      const budget = createBudget(3);
      budget.consume(100);
      budget.consume(200);
      budget.consume(300);
      expect(budget.getTokensConsumed()).toBe(600);
    });

    it('throws for negative consumption', () => {
      const budget = createBudget(3);
      expect(() => budget.consume(-10)).toThrow('Cannot consume negative tokens');
    });

    it('allows zero consumption', () => {
      const budget = createBudget(3);
      budget.consume(0);
      expect(budget.getTokensConsumed()).toBe(0);
    });
  });

  describe('Budget.check', () => {
    it('returns not exceeded when fresh', () => {
      const budget = createBudget(3);
      const status = budget.check();
      expect(status.exceeded).toBe(false);
      expect(status.timeExceeded).toBe(false);
      expect(status.tokensExceeded).toBe(false);
    });

    it('detects token budget exceeded', () => {
      const budget = createBudget(1); // 1000 token limit
      budget.consume(1001);
      const status = budget.check();
      expect(status.exceeded).toBe(true);
      expect(status.tokensExceeded).toBe(true);
      expect(status.tokensRemaining).toBe(0);
    });

    it('detects time budget exceeded', () => {
      const budget = createBudget(1); // 60s limit
      budget._setStartTime(Date.now() - 61_000);
      const status = budget.check();
      expect(status.exceeded).toBe(true);
      expect(status.timeExceeded).toBe(true);
      expect(status.timeRemaining).toBe(0);
    });

    it('shows remaining tokens correctly', () => {
      const budget = createBudget(2); // 3000 tokens
      budget.consume(1500);
      const status = budget.check();
      expect(status.tokensRemaining).toBe(1500);
    });

    it('exceeded when both time and tokens over', () => {
      const budget = createBudget(1);
      budget._setStartTime(Date.now() - 61_000);
      budget.consume(1500);
      const status = budget.check();
      expect(status.exceeded).toBe(true);
      expect(status.timeExceeded).toBe(true);
      expect(status.tokensExceeded).toBe(true);
    });
  });

  describe('Budget.isExceeded', () => {
    it('returns false when within budget', () => {
      const budget = createBudget(5);
      budget.consume(500);
      expect(budget.isExceeded()).toBe(false);
    });

    it('returns true when tokens exceeded', () => {
      const budget = createBudget(1);
      budget.consume(2000);
      expect(budget.isExceeded()).toBe(true);
    });
  });

  describe('getBudgetConfig', () => {
    it('returns config for valid scores', () => {
      const config = getBudgetConfig(3);
      expect(config.maxTimeMs).toBe(180_000);
      expect(config.maxTokens).toBe(5000);
    });

    it('throws for invalid scores', () => {
      expect(() => getBudgetConfig(0)).toThrow('Invalid complexity score');
    });

    it('returns a copy (immutable)', () => {
      const config1 = getBudgetConfig(3);
      const config2 = getBudgetConfig(3);
      config1.maxTokens = 999;
      expect(config2.maxTokens).toBe(5000);
    });
  });

  describe('budget scaling', () => {
    it('higher scores get more time', () => {
      const b1 = createBudget(1).getConfig();
      const b5 = createBudget(5).getConfig();
      expect(b5.maxTimeMs).toBeGreaterThan(b1.maxTimeMs);
    });

    it('higher scores get more tokens', () => {
      const b1 = createBudget(1).getConfig();
      const b5 = createBudget(5).getConfig();
      expect(b5.maxTokens).toBeGreaterThan(b1.maxTokens);
    });

    it('budgets increase monotonically', () => {
      for (let i = 1; i < 5; i++) {
        const lower = getBudgetConfig(i);
        const higher = getBudgetConfig(i + 1);
        expect(higher.maxTimeMs).toBeGreaterThan(lower.maxTimeMs);
        expect(higher.maxTokens).toBeGreaterThan(lower.maxTokens);
      }
    });
  });
});
