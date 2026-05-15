import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { recordIteration, getMetrics } from '../iteration-monitor';
import { unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('iteration-monitor', () => {
  const logPath = join(tmpdir(), `iteration-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

  afterEach(() => {
    try { unlinkSync(logPath); } catch {}
  });

  it('returns zero metrics for empty log', () => {
    const metrics = getMetrics(undefined, logPath);
    expect(metrics).toEqual({ deliverableRate: 0, firstAttemptRate: 0, avgDuration: 0, totalIterations: 0 });
  });

  it('records an iteration and retrieves metrics', () => {
    recordIteration({ id: 'iter-1', deliverableProduced: true, firstAttempt: true, durationMs: 5000 }, logPath);
    const metrics = getMetrics(undefined, logPath);
    expect(metrics.deliverableRate).toBe(1);
    expect(metrics.firstAttemptRate).toBe(1);
    expect(metrics.avgDuration).toBe(5000);
    expect(metrics.totalIterations).toBe(1);
  });

  it('computes rates from multiple records', () => {
    recordIteration({ id: 'iter-1', deliverableProduced: true, firstAttempt: true, durationMs: 2000 }, logPath);
    recordIteration({ id: 'iter-2', deliverableProduced: false, firstAttempt: true, durationMs: 4000 }, logPath);
    recordIteration({ id: 'iter-3', deliverableProduced: true, firstAttempt: false, durationMs: 6000 }, logPath);
    const metrics = getMetrics(undefined, logPath);
    expect(metrics.deliverableRate).toBeCloseTo(2 / 3);
    expect(metrics.firstAttemptRate).toBeCloseTo(2 / 3);
    expect(metrics.avgDuration).toBe(4000);
    expect(metrics.totalIterations).toBe(3);
  });

  it('respects lastN parameter', () => {
    recordIteration({ id: 'iter-1', deliverableProduced: false, firstAttempt: false, durationMs: 1000 }, logPath);
    recordIteration({ id: 'iter-2', deliverableProduced: true, firstAttempt: true, durationMs: 3000 }, logPath);
    recordIteration({ id: 'iter-3', deliverableProduced: true, firstAttempt: true, durationMs: 5000 }, logPath);
    const metrics = getMetrics(2, logPath);
    expect(metrics.deliverableRate).toBe(1);
    expect(metrics.firstAttemptRate).toBe(1);
    expect(metrics.avgDuration).toBe(4000);
    expect(metrics.totalIterations).toBe(2);
  });

  it('stores targetPath when provided', () => {
    recordIteration({ id: 'iter-1', deliverableProduced: true, firstAttempt: true, durationMs: 1000, targetPath: '/app/out.ts' }, logPath);
    const metrics = getMetrics(undefined, logPath);
    expect(metrics.totalIterations).toBe(1);
  });
});
