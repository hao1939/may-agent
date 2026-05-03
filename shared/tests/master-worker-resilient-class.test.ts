import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyCircuit,
  buildPrompt,
  summarizeRun,
  shouldAbort,
  formatJournalEntry,
  successRate,
  mergeResilientConfig,
  ResilientMasterWorker,
  type IterationResult,
  type ResilientConfig,
} from '../workflows/master-worker-resilient';

// Mock retry-wrapper
vi.mock('../workflows/retry-wrapper', async () => {
  const actual = await vi.importActual('../workflows/retry-wrapper');
  return {
    ...actual as any,
    createRetryWrapper: vi.fn(() => ({
      execute: vi.fn(async (fn: () => Promise<string>, _label: string) => {
        try {
          const value = await fn();
          return { success: true, value, attempts: 1 };
        } catch (error: any) {
          return { success: false, error, attempts: 2 };
        }
      }),
      getCircuitState: vi.fn(() => ({ consecutiveFailures: 0, lastFailureTime: null, state: "closed" })),
      getCircuit: vi.fn(() => ({ consecutiveFailures: 0, lastFailureTime: null, state: "closed" })),
    })),
  };
});

// Mock the cached module
vi.mock('../workflows/master-worker-cached', () => ({
  createCachedContext: vi.fn(() => ({
    projectDir: '/tmp/test',
    cache: {},
  })),
  buildIterationSnapshot: vi.fn((ctx: any, iteration: number) => ({
    iteration,
    maxIterations: 5,
    status: 'active',
    journalTail: 'previous entry',
    discussionContent: '',
  })),
  shouldStop: vi.fn(() => ({ stop: false, reason: '' })),
  formatOrchestratorContext: vi.fn(() => 'orchestrator context here'),
  appendJournalEntry: vi.fn(),
  flushBetweenIterations: vi.fn(),
  getCacheReport: vi.fn(() => 'hits: 5, misses: 1'),
}));

describe('master-worker-resilient (class)', () => {
  const config: ResilientConfig = {
    projectDir: '/tmp/test-proj',
    maxIterations: 3,
    cacheTtlMs: 5000,
    retry: { maxRetries: 1, baseDelayMs: 10, circuitThreshold: 5 },
  };

  describe('ResilientMasterWorker.run - success path', () => {
    it('completes all iterations on success', async () => {
      const worker = new ResilientMasterWorker(config);
      const llm = vi.fn().mockResolvedValue('output text');
      
      const result = await worker.run(llm);
      expect(result.totalIterations).toBe(3);
      expect(result.successfulIterations).toBe(3);
      expect(result.failedIterations).toBe(0);
      expect(result.stoppedEarly).toBe(false);
      expect(result.stopReason).toBe('completed');
    });

    it('records iteration results', async () => {
      const worker = new ResilientMasterWorker(config);
      const llm = vi.fn().mockResolvedValue('done');
      
      await worker.run(llm);
      const results = worker.getResults();
      expect(results.length).toBe(3);
      expect(results[0].iteration).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toBe('done');
    });
  });

  describe('ResilientMasterWorker.run - failure path', () => {
    it('aborts after 3 consecutive failures', async () => {
      const worker = new ResilientMasterWorker({ ...config, maxIterations: 5 });
      const llm = vi.fn().mockRejectedValue(new Error('LLM down'));
      
      const result = await worker.run(llm);
      expect(result.stoppedEarly).toBe(true);
      expect(result.stopReason).toContain('consecutive failures');
      expect(result.failedIterations).toBeGreaterThanOrEqual(3);
    });
  });

  describe('ResilientMasterWorker.run - stop condition', () => {
    it('stops early when shouldStop returns true', async () => {
      const { shouldStop } = await import('../workflows/master-worker-cached');
      (shouldStop as any).mockReturnValueOnce({ stop: true, reason: 'all milestones done' });
      
      const worker = new ResilientMasterWorker(config);
      const llm = vi.fn().mockResolvedValue('output');
      
      const result = await worker.run(llm);
      expect(result.stoppedEarly).toBe(true);
      expect(result.stopReason).toContain('Stopped');
    });
  });

  describe('ResilientMasterWorker.runIteration - snapshot failure', () => {
    it('returns failure when snapshot is null', async () => {
      const { buildIterationSnapshot } = await import('../workflows/master-worker-cached');
      (buildIterationSnapshot as any).mockReturnValueOnce(null);
      
      const worker = new ResilientMasterWorker(config);
      const llm = vi.fn();
      
      const result = await worker.runIteration(1, llm);
      expect(result.success).toBe(false);
      expect(result.error).toContain('snapshot');
      expect(llm).not.toHaveBeenCalled();
    });
  });

  describe('ResilientMasterWorker.getCircuitState', () => {
    it('returns circuit state', () => {
      const worker = new ResilientMasterWorker(config);
      const state = worker.getCircuitState();
      expect(state).toHaveProperty('state');
      expect(state.state).toBe('closed');
    });
  });
});
