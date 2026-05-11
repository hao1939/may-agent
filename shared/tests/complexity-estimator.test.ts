import { describe, it, expect } from 'vitest';
import { estimateComplexity } from '../workflows/complexity-estimator';

describe('complexity-estimator', () => {
  describe('score 1 — trivial tasks', () => {
    it('rates reading without file refs as trivial', () => {
      expect(estimateComplexity('Read the report and summarize').score).toBe(1);
    });

    it('rates listing files as trivial', () => {
      expect(estimateComplexity('List all files in the outputs directory').score).toBe(1);
    });

    it('rates checking a value as trivial', () => {
      expect(estimateComplexity('Check if the test count is above 500').score).toBe(1);
    });
  });

  describe('score 2 — simple tasks', () => {
    it('rates writing a document as simple', () => {
      expect(estimateComplexity('Write a summary report to outputs/summary.md').score).toBe(2);
    });

    it('rates an audit as simple', () => {
      expect(estimateComplexity('Write an audit of the error recovery in file.ts').score).toBe(2);
    });

    it('rates documenting an API as simple', () => {
      expect(estimateComplexity('Document the API in docs/api.md').score).toBe(2);
    });

    it('rates empty/generic tasks as simple', () => {
      expect(estimateComplexity('12345').score).toBe(2);
    });
  });

  describe('score 3 — moderate tasks', () => {
    it('rates multi-file reads as moderate', () => {
      expect(estimateComplexity('Read project.ts and circuit-breaker.ts and provider-retry.ts then write a summary').score).toBe(3);
    });
  });

  describe('score 4 — complex tasks', () => {
    it('rates creating a module with tests as complex', () => {
      expect(estimateComplexity('Create module at workflows/validator.ts with 5 test cases').score).toBe(4);
    });

    it('rates implementing a function in a file as complex', () => {
      expect(estimateComplexity('Implement a retry function in provider-retry.ts').score).toBe(4);
    });

    it('rates implement + wire with tests as complex', () => {
      expect(estimateComplexity('Implement a new module at validator.ts with tests').score).toBe(4);
    });

    it('rates integration with tests as complex', () => {
      expect(estimateComplexity('Integrate module into project.ts with tests').score).toBe(4);
    });
  });

  describe('score 5 — very complex tasks', () => {
    it('rates integration with multiple files as very complex', () => {
      expect(estimateComplexity('Integrate retry.ts into project.ts and write integration tests').score).toBe(5);
    });

    it('rates multi-file implement+wire as very complex', () => {
      expect(estimateComplexity('Implement a module at validator.ts, wire into project.ts, update config.ts and types.ts').score).toBe(5);
    });

    it('rates cross-system integration as very complex', () => {
      expect(estimateComplexity('Implement cross-system integration connecting validator.ts, retry.ts, checkpoint.ts, project.ts, and config.ts with 20+ test cases').score).toBe(5);
    });

    it('rates end-to-end with many files as very complex', () => {
      expect(estimateComplexity('Build end-to-end resilience integrating provider-retry.ts, output-validator.ts, checkpoint.ts, project.ts, and tests.ts').score).toBe(5);
    });
  });

  describe('timeout assignment', () => {
    it('assigns 60s for score 1', () => {
      expect(estimateComplexity('Check file exists').timeoutMs).toBe(60_000);
    });

    it('assigns 120s for score 2', () => {
      expect(estimateComplexity('Write a document summary to report.md').timeoutMs).toBe(120_000);
    });

    it('assigns 600s for score 4', () => {
      expect(estimateComplexity('Implement a new module at validator.ts with tests').timeoutMs).toBe(600_000);
    });

    it('assigns 900s for score 5', () => {
      expect(estimateComplexity('Build end-to-end cross-system integration connecting validator.ts, retry.ts, checkpoint.ts, project.ts, and config.ts with 20+ test cases').timeoutMs).toBe(900_000);
    });
  });

  describe('description field', () => {
    it('provides Trivial for score 1', () => {
      expect(estimateComplexity('Check a value').description).toContain('Trivial');
    });

    it('provides Simple for score 2', () => {
      expect(estimateComplexity('Write a summary to output.md').description).toContain('Simple');
    });

    it('provides Complex for score 4', () => {
      expect(estimateComplexity('Integrate module into project.ts with tests').description).toContain('Complex');
    });

    it('provides Very complex for score 5', () => {
      expect(estimateComplexity('Build end-to-end integrating a.ts, b.ts, c.ts, d.ts, e.ts').description).toContain('Very complex');
    });
  });

  describe('edge cases', () => {
    it('handles empty task string', () => {
      expect(estimateComplexity('').score).toBeGreaterThanOrEqual(1);
      expect(estimateComplexity('').score).toBeLessThanOrEqual(5);
    });

    it('never returns below 1', () => {
      expect(estimateComplexity('list').score).toBe(1);
    });

    it('never returns above 5', () => {
      expect(estimateComplexity('Implement cross-system end-to-end integration connecting multiple files validator.ts retry.ts checkpoint.ts project.ts config.ts types.ts utils.ts with 30+ test cases across several modules').score).toBe(5);
    });

    it('returns valid ComplexityEstimate shape', () => {
      const result = estimateComplexity('any task');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('timeoutMs');
      expect(result).toHaveProperty('description');
      expect(typeof result.score).toBe('number');
      expect(typeof result.timeoutMs).toBe('number');
      expect(typeof result.description).toBe('string');
    });
  });
});
