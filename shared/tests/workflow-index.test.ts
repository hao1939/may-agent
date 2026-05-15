/**
 * Tests for workflows/index.ts barrel export
 * Ensures all expected symbols are re-exported correctly.
 */
import { describe, it, expect } from 'bun:test';

describe('workflows/index barrel export', () => {
  it('exports saveIncrementalCheckpoint from incremental-checkpoint', async () => {
    const mod = await import('../workflows/index');
    expect(mod.saveIncrementalCheckpoint).toBeTypeOf('function');
  });

  it('exports detectIncompleteCheckpoint from incremental-checkpoint', async () => {
    const mod = await import('../workflows/index');
    expect(mod.detectIncompleteCheckpoint).toBeTypeOf('function');
  });

  it('exports markCheckpointComplete from incremental-checkpoint', async () => {
    const mod = await import('../workflows/index');
    expect(mod.markCheckpointComplete).toBeTypeOf('function');
  });

  it('exports cleanupCheckpoints from incremental-checkpoint', async () => {
    const mod = await import('../workflows/index');
    expect(mod.cleanupCheckpoints).toBeTypeOf('function');
  });

  it('exports withRetry from provider-retry', async () => {
    const mod = await import('../workflows/index');
    expect(mod.withRetry).toBeTypeOf('function');
  });

  it('exports isRetryableError from provider-retry', async () => {
    const mod = await import('../workflows/index');
    expect(mod.isRetryableError).toBeTypeOf('function');
  });

  it('exports validateOutput from output-validator', async () => {
    const mod = await import('../workflows/index');
    expect(mod.validateOutput).toBeTypeOf('function');
  });

  it('exports findDuplicate from output-validator', async () => {
    const mod = await import('../workflows/index');
    expect(mod.findDuplicate).toBeTypeOf('function');
  });

  it('exports validateContentType from output-validator', async () => {
    const mod = await import('../workflows/index');
    expect(mod.validateContentType).toBeTypeOf('function');
  });

  it('exports hashContent from output-validator', async () => {
    const mod = await import('../workflows/index');
    expect(mod.hashContent).toBeTypeOf('function');
  });

  it('exports estimateComplexity from complexity-estimator', async () => {
    const mod = await import('../workflows/index');
    expect(mod.estimateComplexity).toBeTypeOf('function');
  });

  it('exports IterationTimer from iteration-timer', async () => {
    const mod = await import('../workflows/index');
    expect(mod.IterationTimer).toBeTypeOf('function');
  });

  it('exports formatDuration from iteration-timer', async () => {
    const mod = await import('../workflows/index');
    expect(mod.formatDuration).toBeTypeOf('function');
  });

  it('exports createBudget from iteration-budget', async () => {
    const mod = await import('../workflows/index');
    expect(mod.createBudget).toBeTypeOf('function');
  });

  it('exports checkHealth from health-check', async () => {
    const mod = await import('../workflows/index');
    expect(mod.checkHealth).toBeTypeOf('function');
  });

  it('exports analyzeProject from health-check', async () => {
    const mod = await import('../workflows/index');
    expect(mod.analyzeProject).toBeTypeOf('function');
  });

  it('exports parseMetrics from health-check', async () => {
    const mod = await import('../workflows/index');
    expect(mod.parseMetrics).toBeTypeOf('function');
  });

  it('exports isAtTarget from health-check', async () => {
    const mod = await import('../workflows/index');
    expect(mod.isAtTarget).toBeTypeOf('function');
  });

  it('exports isStalled from health-check', async () => {
    const mod = await import('../workflows/index');
    expect(mod.isStalled).toBeTypeOf('function');
  });

  it('exports extractLastActivity from health-check', async () => {
    const mod = await import('../workflows/index');
    expect(mod.extractLastActivity).toBeTypeOf('function');
  });

  it('barrel module loads without error', async () => {
    const mod = await import('../workflows/index');
    expect(mod).toBeDefined();
    expect(Object.keys(mod).length).toBeGreaterThan(15);
  });
});
