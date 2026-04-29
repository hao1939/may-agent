import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateTask,
  estimateComplexity,
  createBudget,
  startIteration,
  endIteration,
  getStats,
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  withRetry,
  validateOutput,
  fastWrite,
  aggregateMetrics,
  runHealthCheck,
} from '../workflows/index';

describe('Full Stack Integration — Complete Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path — Full Pipeline', () => {
    it('runs the complete pipeline from validation to metrics', () => {
      const task = 'Write a markdown report to outputs/report.md summarizing test results';
      
      // Step 1: Validate task
      const validation = validateTask(task, { outputDir: '/tmp/outputs' });
      expect(validation.valid).toBe(true);

      // Step 2: Estimate complexity
      const complexity = estimateComplexity(task);
      expect(complexity.score).toBeGreaterThanOrEqual(1);
      expect(complexity.score).toBeLessThanOrEqual(5);
      expect(complexity.timeoutMs).toBeGreaterThan(0);

      // Step 3: Create budget from complexity score
      const budget = createBudget(complexity.score);
      expect(budget.check().exceeded).toBe(false);
      expect(budget.check().remaining).toBeGreaterThan(0);

      // Step 4: Start iteration timer
      const iterationId = 'test-iter-001';
      startIteration(iterationId);

      // Step 5: Simulate work with budget consumption
      budget.consume(10);
      expect(budget.check().exceeded).toBe(false);

      // Step 6: End iteration
      const timing = endIteration(iterationId);
      expect(timing.durationMs).toBeGreaterThanOrEqual(0);
      expect(timing.durationFormatted).toBeDefined();
    });

    it('accumulates stats across multiple iterations', () => {
      startIteration('iter-a');
      endIteration('iter-a');
      startIteration('iter-b');
      endIteration('iter-b');
      startIteration('iter-c');
      endIteration('iter-c');

      const stats = getStats();
      expect(stats.count).toBeGreaterThanOrEqual(3);
      expect(stats.avg).toBeGreaterThanOrEqual(0);
      expect(stats.median).toBeGreaterThanOrEqual(0);
      expect(stats.p95).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Task Validation Rejection', () => {
    it('rejects invalid task before other modules run', () => {
      const task = '';
      const validation = validateTask(task, {});
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBeDefined();
    });

    it('rejects duplicate tasks', () => {
      const task = 'duplicate task';
      const context = { recentTasks: ['duplicate task', 'other task'] };
      const validation = validateTask(task, context);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Provider Retry on Error', () => {
    it('retries on transient error then succeeds', async () => {
      let attempts = 0;
      const flakyfn = async () => {
        attempts++;
        if (attempts < 3) {
          const err: any = new Error('Service Unavailable');
          err.status = 503;
          throw err;
        }
        return 'success';
      };

      const result = await withRetry(flakyfn, { maxRetries: 3, baseDelayMs: 10 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('does not retry on non-retryable errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        const err: any = new Error('Unauthorized');
        err.status = 401;
        throw err;
      };

      await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toThrow('Unauthorized');
      expect(attempts).toBe(1);
    });
  });

  describe('Output Validation', () => {
    it('rejects empty output', () => {
      const result = validateOutput('', 'report.md');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/empty/i);
    });

    it('accepts valid markdown output', () => {
      const content = '# Report\n\n## Summary\nAll tests passed.';
      const result = validateOutput(content, 'report.md');
      expect(result.valid).toBe(true);
    });

    it('rejects duplicate content', () => {
      const content = '# Report\nSome content';
      const existing = ['# Report\nSome content'];
      const result = validateOutput(content, 'report.md', { existingContents: existing });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/duplicate/i);
    });
  });

  describe('Fast Path Write', () => {
    it('skips duplicate check for low complexity tasks', () => {
      const content = '# Simple doc\nHello world';
      const result = fastWrite(content, '/tmp/simple.md', 1);
      expect(result.written).toBe(true);
      expect(result.skippedValidation).toContain('duplicate');
    });

    it('runs full validation for high complexity tasks', () => {
      const content = '# Complex implementation\nDetailed code here';
      const result = fastWrite(content, '/tmp/complex.md', 4);
      expect(result.written).toBe(true);
      expect(result.skippedValidation).toHaveLength(0);
    });

    it('rejects empty files at all complexity levels', () => {
      const result1 = fastWrite('', '/tmp/empty1.md', 1);
      const result2 = fastWrite('', '/tmp/empty2.md', 5);
      expect(result1.written).toBe(false);
      expect(result2.written).toBe(false);
    });
  });

  describe('Budget Exceeded Triggers Early Exit', () => {
    it('detects budget exceeded after over-consumption', () => {
      const budget = createBudget(1); // tight budget for simple task
      const limit = budget.check().remaining;
      budget.consume(limit + 1);
      expect(budget.check().exceeded).toBe(true);
    });

    it('complex tasks have generous budgets', () => {
      const simpleBudget = createBudget(1);
      const complexBudget = createBudget(5);
      expect(complexBudget.check().remaining).toBeGreaterThan(simpleBudget.check().remaining);
    });
  });

  describe('Checkpoint — Crash and Resume', () => {
    it('saves checkpoint and detects incomplete on resume', () => {
      const sessionId = 'crash-test-session';
      const checkpointData = {
        sessionId,
        step: 3,
        partialResults: { filesWritten: ['a.md', 'b.md'] },
        timestamp: Date.now(),
      };

      saveIncrementalCheckpoint(checkpointData);
      
      const incomplete = detectIncompleteCheckpoint(sessionId);
      expect(incomplete).toBeDefined();
      expect(incomplete?.step).toBe(3);
      expect(incomplete?.partialResults.filesWritten).toHaveLength(2);
    });

    it('marks checkpoint complete so it is not detected on next run', () => {
      const sessionId = 'complete-test-session';
      saveIncrementalCheckpoint({
        sessionId,
        step: 5,
        partialResults: {},
        timestamp: Date.now(),
      });

      markCheckpointComplete(sessionId);
      
      const incomplete = detectIncompleteCheckpoint(sessionId);
      expect(incomplete).toBeNull();
    });
  });

  describe('End-to-End Scenario', () => {
    it('full pipeline with checkpoint, retry, validation, and timing', async () => {
      // Validate
      const task = 'Create agents/shared/workflows/new-module.ts with exported functions';
      const validation = validateTask(task, { outputDir: '/tmp' });
      expect(validation.valid).toBe(true);

      // Complexity
      const complexity = estimateComplexity(task);
      expect(complexity.score).toBeGreaterThanOrEqual(2);

      // Budget
      const budget = createBudget(complexity.score);

      // Timer
      const id = 'e2e-iter-001';
      startIteration(id);

      // Checkpoint
      saveIncrementalCheckpoint({ sessionId: id, step: 1, partialResults: {}, timestamp: Date.now() });

      // Simulate provider call with retry
      let callCount = 0;
      const providerCall = async () => {
        callCount++;
        if (callCount === 1) {
          const err: any = new Error('Timeout');
          err.status = 504;
          throw err;
        }
        return '# New Module\nexport function doThing() {}';
      };

      const output = await withRetry(providerCall, { maxRetries: 3, baseDelayMs: 10 });
      budget.consume(50);

      // Validate output
      const outputValidation = validateOutput(output, 'new-module.ts');
      expect(outputValidation.valid).toBe(true);

      // Complete
      markCheckpointComplete(id);
      const timing = endIteration(id);
      expect(timing.durationMs).toBeGreaterThanOrEqual(0);
      expect(budget.check().exceeded).toBe(false);
    });
  });
});
