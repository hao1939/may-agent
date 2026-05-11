import { describe, it, expect } from 'vitest';
import { createBudget, getBudgetConfig } from '../workflows/iteration-budget.ts';
import { estimateComplexity } from '../workflows/complexity-estimator.ts';

describe('iteration-budget integration', () => {
  describe('budget creation from complexity score', () => {
    it('creates budget after complexity estimation', () => {
      const task = 'Write a simple markdown file';
      const complexity = estimateComplexity(task);
      const budget = createBudget(complexity.score);
      expect(budget).toBeDefined();
      expect(budget.check().exceeded).toBe(false);
    });

    it('simple tasks get tight budgets', () => {
      const complexity = estimateComplexity('Write a short README.md');
      const config = getBudgetConfig(complexity.score);
      expect(config.maxTimeMs).toBeLessThanOrEqual(180_000);
      expect(config.maxTokens).toBeLessThanOrEqual(5000);
    });

    it('complex tasks get generous budgets', () => {
      const complexity = estimateComplexity('Implement a full module with 5 files, integrate into project.ts, write 20 tests covering edge cases');
      const config = getBudgetConfig(complexity.score);
      expect(config.maxTimeMs).toBeGreaterThanOrEqual(180_000);
      expect(config.maxTokens).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('budget consumption during iteration', () => {
    it('tracks token consumption from worker response', () => {
      const budget = createBudget(3);
      const workerResponse = 'x'.repeat(2000); // ~500 tokens
      const approxTokens = Math.ceil(workerResponse.length / 4);
      budget.consume(approxTokens);
      expect(budget.getTokensConsumed()).toBe(500);
      expect(budget.isExceeded()).toBe(false);
    });

    it('detects token budget exceeded', () => {
      const budget = createBudget(1); // 1000 token limit
      budget.consume(1001);
      expect(budget.isExceeded()).toBe(true);
      expect(budget.check().tokensExceeded).toBe(true);
    });

    it('detects time budget exceeded', () => {
      const budget = createBudget(1); // 60s limit
      budget._setStartTime(Date.now() - 61_000);
      expect(budget.isExceeded()).toBe(true);
      expect(budget.check().timeExceeded).toBe(true);
    });

    it('reports remaining budget correctly', () => {
      const budget = createBudget(2); // 3000 tokens, 120s
      budget.consume(1000);
      const status = budget.check();
      expect(status.tokensRemaining).toBe(2000);
      expect(status.exceeded).toBe(false);
    });
  });

  describe('budget integrates with complexity flow', () => {
    it('full flow: estimate → create budget → consume → check', () => {
      const task = 'Create a test file with 10 test cases';
      const complexity = estimateComplexity(task);
      const budget = createBudget(complexity.score);
      
      // Simulate worker response
      budget.consume(200);
      expect(budget.isExceeded()).toBe(false);
      
      // Simulate large response
      budget.consume(budget.getConfig().maxTokens);
      expect(budget.isExceeded()).toBe(true);
    });

    it('budget logs provide useful diagnostics', () => {
      const budget = createBudget(3);
      const config = budget.getConfig();
      const logMsg = `💰 Budget: ${config.maxTimeMs / 1000}s time, ${config.maxTokens} tokens`;
      expect(logMsg).toContain('180s');
      expect(logMsg).toContain('5000');
    });

    it('each iteration gets a fresh budget', () => {
      const budget1 = createBudget(2);
      budget1.consume(2000);
      
      const budget2 = createBudget(2);
      expect(budget2.getTokensConsumed()).toBe(0);
      expect(budget2.isExceeded()).toBe(false);
    });

    it('budget exceeded does not crash — just warns', () => {
      const budget = createBudget(1);
      budget.consume(5000); // Way over
      const status = budget.check();
      expect(status.exceeded).toBe(true);
      expect(status.tokensRemaining).toBe(0);
      // Can still call consume after exceeded
      expect(() => budget.consume(100)).not.toThrow();
    });
  });
});
