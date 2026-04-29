import { describe, it, expect } from 'vitest';

describe('Workflow Modules API Regression', () => {
  describe('incremental-checkpoint', () => {
    it('exports saveIncrementalCheckpoint', async () => {
      const mod = await import('../workflows/incremental-checkpoint');
      expect(typeof mod.saveIncrementalCheckpoint).toBe('function');
    });
    it('exports detectIncompleteCheckpoint', async () => {
      const mod = await import('../workflows/incremental-checkpoint');
      expect(typeof mod.detectIncompleteCheckpoint).toBe('function');
    });
    it('exports markCheckpointComplete', async () => {
      const mod = await import('../workflows/incremental-checkpoint');
      expect(typeof mod.markCheckpointComplete).toBe('function');
    });
  });

  describe('provider-retry', () => {
    it('exports withRetry', async () => {
      const mod = await import('../workflows/provider-retry');
      expect(typeof mod.withRetry).toBe('function');
    });
    it('exports isRetryableError', async () => {
      const mod = await import('../workflows/provider-retry');
      expect(typeof mod.isRetryableError).toBe('function');
    });
    it('exports classifyError', async () => {
      const mod = await import('../workflows/provider-retry');
      expect(typeof mod.classifyError).toBe('function');
    });
  });

  describe('output-validator', () => {
    it('exports validateOutput', async () => {
      const mod = await import('../workflows/output-validator');
      expect(typeof mod.validateOutput).toBe('function');
    });
    it('exports findDuplicate', async () => {
      const mod = await import('../workflows/output-validator');
      expect(typeof mod.findDuplicate).toBe('function');
    });
    it('exports validateContentType', async () => {
      const mod = await import('../workflows/output-validator');
      expect(typeof mod.validateContentType).toBe('function');
    });
  });

  describe('task-validator', () => {
    it('exports validateTask', async () => {
      const mod = await import('../workflows/task-validator');
      expect(typeof mod.validateTask).toBe('function');
    });
    it('exports extractReferencedFiles', async () => {
      const mod = await import('../workflows/task-validator');
      expect(typeof mod.extractReferencedFiles).toBe('function');
    });
    it('exports isDuplicateTask', async () => {
      const mod = await import('../workflows/task-validator');
      expect(typeof mod.isDuplicateTask).toBe('function');
    });
  });

  describe('complexity-estimator', () => {
    it('exports estimateComplexity', async () => {
      const mod = await import('../workflows/complexity-estimator');
      expect(typeof mod.estimateComplexity).toBe('function');
    });
  });

  describe('iteration-timer', () => {
    it('exports IterationTimer class', async () => {
      const mod = await import('../workflows/iteration-timer');
      expect(typeof mod.IterationTimer).toBe('function');
    });
    it('exports formatDuration', async () => {
      const mod = await import('../workflows/iteration-timer');
      expect(typeof mod.formatDuration).toBe('function');
    });
  });

  describe('metrics-dashboard', () => {
    it('exports collectMetrics', async () => {
      const mod = await import('../workflows/metrics-dashboard');
      expect(typeof mod.collectMetrics).toBe('function');
    });
    it('exports formatMetrics', async () => {
      const mod = await import('../workflows/metrics-dashboard');
      expect(typeof mod.formatMetrics).toBe('function');
    });
  });

  describe('fast-path', () => {
    it('exports fastWrite', async () => {
      const mod = await import('../workflows/fast-path');
      expect(typeof mod.fastWrite).toBe('function');
    });
    it('exports shouldUseFastPath', async () => {
      const mod = await import('../workflows/fast-path');
      expect(typeof mod.shouldUseFastPath).toBe('function');
    });
    it('exports getValidationLevel', async () => {
      const mod = await import('../workflows/fast-path');
      expect(typeof mod.getValidationLevel).toBe('function');
    });
  });

  describe('metrics-aggregator', () => {
    it('exports aggregateMetrics', async () => {
      const mod = await import('../workflows/metrics-aggregator');
      expect(typeof mod.aggregateMetrics).toBe('function');
    });
    it('exports getProjectByName', async () => {
      const mod = await import('../workflows/metrics-aggregator');
      expect(typeof mod.getProjectByName).toBe('function');
    });
    it('exports getActiveProjects', async () => {
      const mod = await import('../workflows/metrics-aggregator');
      expect(typeof mod.getActiveProjects).toBe('function');
    });
  });

  describe('iteration-budget', () => {
    it('exports createBudget', async () => {
      const mod = await import('../workflows/iteration-budget');
      expect(typeof mod.createBudget).toBe('function');
    });
    it('exports getBudgetConfig', async () => {
      const mod = await import('../workflows/iteration-budget');
      expect(typeof mod.getBudgetConfig).toBe('function');
    });
    it('exports Budget class', async () => {
      const mod = await import('../workflows/iteration-budget');
      expect(typeof mod.Budget).toBe('function');
    });
    it('Budget instance has check/consume/isExceeded', async () => {
      const mod = await import('../workflows/iteration-budget');
      const budget = mod.createBudget(3);
      expect(typeof budget.check).toBe('function');
      expect(typeof budget.consume).toBe('function');
      expect(typeof budget.isExceeded).toBe('function');
    });
  });
});
