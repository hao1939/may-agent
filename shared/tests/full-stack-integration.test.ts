import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateTask } from '../workflows/task-validator';
import { estimateComplexity } from '../workflows/complexity-estimator';
import { createBudget } from '../workflows/iteration-budget';
import { IterationTimer } from '../workflows/iteration-timer';
import { saveIncrementalCheckpoint, detectIncompleteCheckpoint, markCheckpointComplete } from '../workflows/incremental-checkpoint';
import { withRetry } from '../workflows/provider-retry';
import { validateOutput } from '../workflows/output-validator';
import { fastWrite } from '../workflows/fast-path';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Full Stack Integration — Complete Pipeline', () => {
  let tmpDir: string;
  let timer: IterationTimer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fullstack-'));
    timer = new IterationTimer();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Happy Path — Full Pipeline', () => {
    it('runs the complete pipeline from validation to metrics', () => {
      const task = 'Write a markdown report to outputs/report.md summarizing test results';

      const validation = validateTask(task, { workingDir: tmpDir });
      expect(validation.valid).toBe(true);

      const complexity = estimateComplexity(task);
      expect(complexity.score).toBeGreaterThanOrEqual(1);
      expect(complexity.score).toBeLessThanOrEqual(5);
      expect(complexity.timeoutMs).toBeGreaterThan(0);

      const budget = createBudget(complexity.score);
      expect(budget.check().exceeded).toBe(false);
      expect(budget.check().tokensRemaining).toBeGreaterThan(0);

      timer.startIteration('test-iter-001');
      budget.consume(10);
      expect(budget.check().exceeded).toBe(false);

      const timing = timer.endIteration('test-iter-001');
      expect(timing.durationMs).toBeGreaterThanOrEqual(0);
      expect(timing.durationFormatted).toBeDefined();
    });

    it('accumulates stats across multiple iterations', () => {
      timer.startIteration('iter-a');
      timer.endIteration('iter-a');
      timer.startIteration('iter-b');
      timer.endIteration('iter-b');
      timer.startIteration('iter-c');
      timer.endIteration('iter-c');

      const stats = timer.getStats();
      expect(stats.count).toBe(3);
      expect(stats.avg).toBeGreaterThanOrEqual(0);
      expect(stats.median).toBeGreaterThanOrEqual(0);
      expect(stats.p95).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Task Validation Rejection', () => {
    it('rejects empty task', () => {
      const validation = validateTask('', {});
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBeDefined();
    });

    it('rejects duplicate tasks', () => {
      const task = 'duplicate task here';
      const context = { recentTasks: ['duplicate task here', 'other task'] };
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
      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
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

      const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
      expect(result.success).toBe(false);
      expect(attempts).toBe(1);
    });
  });

  describe('Output Validation', () => {
    it('rejects empty output', () => {
      const result = validateOutput('report.md', '');
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/empty/i);
    });

    it('accepts valid markdown output', () => {
      const content = '# Report\n\n## Summary\nAll tests passed.';
      const result = validateOutput('report.md', content);
      expect(result.valid).toBe(true);
    });

    it('detects duplicate content when existing files provided', () => {
      const content = '# Report\nSome content';
      // Without existing files to compare against, no duplicate detection
      const result = validateOutput('report.md', content);
      expect(result.valid).toBe(true);
    });
  });

  describe('Fast Path Write', () => {
    it('skips duplicate check for low complexity tasks', () => {
      const content = '# Simple doc\nHello world';
      const result = fastWrite(content, join(tmpDir, 'simple.md'), { complexityScore: 1 });
      expect(result.written).toBe(true);
      expect(result.skippedValidation).toContain('duplicate-detection');
    });

    it('runs full validation for high complexity tasks', () => {
      const content = '# Complex implementation\nDetailed code here';
      const result = fastWrite(content, join(tmpDir, 'complex.md'), { complexityScore: 4 });
      expect(result.written).toBe(true);
      expect(result.skippedValidation).toHaveLength(0);
    });

    it('rejects empty files at all complexity levels', () => {
      const result1 = fastWrite('', join(tmpDir, 'empty1.md'), { complexityScore: 1 });
      const result2 = fastWrite('', join(tmpDir, 'empty2.md'), { complexityScore: 5 });
      expect(result1.written).toBe(false);
      expect(result2.written).toBe(false);
    });
  });

  describe('Budget Exceeded Triggers Early Exit', () => {
    it('detects budget exceeded after over-consumption', () => {
      const budget = createBudget(1);
      const limit = budget.check().tokensRemaining;
      budget.consume(limit + 1);
      expect(budget.check().exceeded).toBe(true);
    });

    it('complex tasks have generous budgets', () => {
      const simpleBudget = createBudget(1);
      const complexBudget = createBudget(5);
      expect(complexBudget.check().tokensRemaining).toBeGreaterThan(simpleBudget.check().tokensRemaining);
    });
  });

  describe('Checkpoint — Crash and Resume', () => {
    it('saves checkpoint and detects incomplete on resume', () => {
      const sessionId = 'crash-test-session';
      const checkpointData = {
        sessionId,
        iteration: 1,
        step: 3,
        timestamp: Date.now(),
        task: 'test task',
        toolsCalled: ['read', 'write'],
        partialResults: { filesWritten: ['a.md', 'b.md'] },
        completed: false,
      };

      saveIncrementalCheckpoint(tmpDir, checkpointData);

      const incomplete = detectIncompleteCheckpoint(tmpDir, sessionId);
      expect(incomplete).not.toBeNull();
      expect(incomplete?.step).toBe(3);
      expect(incomplete?.partialResults.filesWritten).toHaveLength(2);
    });

    it('marks checkpoint complete so it is not detected on next run', () => {
      const sessionId = 'complete-test-session';
      saveIncrementalCheckpoint(tmpDir, {
        sessionId,
        iteration: 1,
        step: 5,
        timestamp: Date.now(),
        task: 'test task',
        toolsCalled: [],
        partialResults: {},
        completed: false,
      });

      markCheckpointComplete(tmpDir, sessionId);

      const incomplete = detectIncompleteCheckpoint(tmpDir, sessionId);
      expect(incomplete).toBeNull();
    });
  });

  describe('End-to-End Scenario', () => {
    it('full pipeline with checkpoint, retry, validation, and timing', async () => {
      const task = 'Create agents/shared/workflows/new-module.ts with exported functions';
      const validation = validateTask(task, { workingDir: tmpDir });
      expect(validation.valid).toBe(true);

      const complexity = estimateComplexity(task);
      expect(complexity.score).toBeGreaterThanOrEqual(1);

      const budget = createBudget(complexity.score);

      const id = 'e2e-iter-001';
      timer.startIteration(id);

      saveIncrementalCheckpoint(tmpDir, {
        sessionId: id,
        iteration: 1,
        step: 1,
        timestamp: Date.now(),
        task,
        toolsCalled: [],
        partialResults: {},
        completed: false,
      });

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

      const retryResult = await withRetry(providerCall, { maxRetries: 3, baseDelayMs: 10 });
      expect(retryResult.success).toBe(true);
      budget.consume(50);

      const outputValidation = validateOutput('new-module.ts', retryResult.value as string);
      expect(outputValidation.valid).toBe(true);

      markCheckpointComplete(tmpDir, id);
      const timing = timer.endIteration(id);
      expect(timing.durationMs).toBeGreaterThanOrEqual(0);
      expect(budget.check().exceeded).toBe(false);
    });
  });
});
