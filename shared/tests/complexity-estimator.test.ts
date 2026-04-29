import { describe, it, expect } from 'vitest';
import { estimateComplexity, ComplexityScore } from '../workflows/complexity-estimator';

describe('complexity-estimator', () => {
  describe('score 1 — trivial tasks', () => {
    it('rates reading a single file as trivial', () => {
      const result = estimateComplexity('Read the report and summarize');
      expect(result.score).toBe(1);
    });

    it('rates listing files as trivial', () => {
      const result = estimateComplexity('List all files in the outputs directory');
      expect(result.score).toBe(1);
    });

    it('rates checking a value as trivial', () => {
      const result = estimateComplexity('Check if the test count is above 500');
      expect(result.score).toBe(1);
    });
  });

  describe('score 2 — simple tasks', () => {
    it('rates writing a document as simple', () => {
      const result = estimateComplexity('Write a summary report to outputs/summary.md');
      expect(result.score).toBe(2);
    });

    it('rates a plan/audit as simple', () => {
      const result = estimateComplexity('Write an audit of the error recovery in file.ts');
      expect(result.score).toBe(2);
    });

    it('rates a single-file documentation task as simple', () => {
      const result = estimateComplexity('Document the API in docs/api.md');
      expect(result.score).toBe(2);
    });
  });

  describe('score 3 — moderate tasks', () => {
    it('rates creating a new module as moderate', () => {
      const result = estimateComplexity('Create module at workflows/validator.ts with 5 test cases');
      expect(result.score).toBe(3);
    });

    it('rates implementation with few files as moderate', () => {
      const result = estimateComplexity('Implement a retry function in provider-retry.ts');
      expect(result.score).toBe(3);
    });

    it('rates multi-file reads as moderate', () => {
      const result = estimateComplexity('Read master-worker.ts and circuit-breaker.ts and provider-retry.ts then write a summary');
      expect(result.score).toBe(3);
    });
  });

  describe('score 4 — complex tasks', () => {
    it('rates integration tasks as complex', () => {
      const result = estimateComplexity('Integrate provider-retry.ts into master-worker.ts and write integration tests');
      expect(result.score).toBe(4);
    });

    it('rates multi-file implementation as complex', () => {
      const result = estimateComplexity('Implement a module at validator.ts, wire into master-worker.ts, update config.ts and types.ts');
      expect(result.score).toBe(4);
    });

    it('rates tasks with 15+ tests as complex', () => {
      const result = estimateComplexity('Create module with 15+ test cases covering edge cases');
      expect(result.score).toBe(4);
    });
  });

  describe('score 5 — very complex tasks', () => {
    it('rates cross-system implementation as very complex', () => {
      const result = estimateComplexity('Implement cross-system integration connecting validator.ts, retry.ts, checkpoint.ts, master-worker.ts, and config.ts with 20+ test cases');
      expect(result.score).toBe(5);
    });

    it('rates end-to-end with many files as very complex', () => {
      const result = estimateComplexity('Build end-to-end resilience integrating provider-retry.ts, output-validator.ts, checkpoint.ts, master-worker.ts, and tests.ts');
      expect(result.score).toBe(5);
    });
  });

  describe('timeout assignment', () => {
    it('assigns 60s for score 1', () => {
      const result = estimateComplexity('Check file exists');
      expect(result.timeoutMs).toBe(60_000);
    });

    it('assigns 120s for score 2', () => {
      const result = estimateComplexity('Write a document summary to report.md');
      expect(result.timeoutMs).toBe(120_000);
    });

    it('assigns 300s for score 3', () => {
      const result = estimateComplexity('Implement a new module at validator.ts with tests');
      expect(result.timeoutMs).toBe(300_000);
    });

    it('assigns 600s for score 4', () => {
      const result = estimateComplexity('Integrate retry.ts into master-worker.ts and write integration tests');
      expect(result.timeoutMs).toBe(600_000);
    });

    it('assigns 900s for score 5', () => {
      const result = estimateComplexity('Build end-to-end cross-system integration connecting validator.ts, retry.ts, checkpoint.ts, master-worker.ts, and config.ts with 20+ test cases');
      expect(result.timeoutMs).toBe(900_000);
    });
  });

  describe('description field', () => {
    it('provides human-readable description', () => {
      const result = estimateComplexity('Read a file');
      expect(result.description).toContain('Trivial');
    });

    it('describes complex tasks accurately', () => {
      const result = estimateComplexity('Integrate module into master-worker.ts with tests');
      expect(result.description).toContain('Complex');
    });
  });

  describe('edge cases', () => {
    it('handles empty task string', () => {
      const result = estimateComplexity('');
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(5);
    });

    it('never returns below 1', () => {
      const result = estimateComplexity('list');
      expect(result.score).toBe(1);
    });

    it('never returns above 5', () => {
      const result = estimateComplexity('Implement cross-system end-to-end integration connecting multiple files validator.ts retry.ts checkpoint.ts master-worker.ts config.ts types.ts utils.ts with 30+ test cases across several modules');
      expect(result.score).toBe(5);
    });

    it('handles task with only numbers', () => {
      const result = estimateComplexity('12345');
      expect(result.score).toBe(1);
    });
  });
});
