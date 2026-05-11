/**
 * Integration tests: iteration-timer.ts in an iterative workflow loop.
 * Verifies that timer starts/ends with each iteration and stats accumulate.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IterationTimer } from '../workflows/iteration-timer.ts';

describe('iteration-timer integration', () => {
  let timer: IterationTimer;
  let logs: string[];

  // Simulates an iterative workflow loop with timer calls.
  function simulateIteration(iteration: number, durationMs: number) {
    const iterationId = `iter-${iteration}`;
    timer.startIteration(iterationId);
    logs.push(`[work] Iteration ${iteration} starting...`);

    // Simulate work duration
    const start = timer['timings'].get(iterationId)!;
    start.startMs = Date.now() - durationMs; // backdate start

    const timing = timer.endIteration(iterationId);
    logs.push(`[work] ⏱️ Iteration ${iteration} took ${timing.durationFormatted}`);
    
    const stats = timer.getStats();
    if (stats.count > 1) {
      logs.push(`[work] 📈 Stats: avg=${Math.round(stats.avg)}ms, median=${Math.round(stats.median)}ms, p95=${Math.round(stats.p95)}ms (n=${stats.count})`);
    }
  }

  beforeEach(() => {
    timer = new IterationTimer();
    logs = [];
  });

  it('starts and ends timer for each iteration', () => {
    simulateIteration(1, 5000);
    const stats = timer.getStats();
    expect(stats.count).toBe(1);
  });

  it('accumulates stats across multiple iterations', () => {
    simulateIteration(1, 3000);
    simulateIteration(2, 5000);
    simulateIteration(3, 7000);
    const stats = timer.getStats();
    expect(stats.count).toBe(3);
    expect(stats.avg).toBeGreaterThan(0);
  });

  it('logs duration after each iteration', () => {
    simulateIteration(1, 2000);
    expect(logs.some(l => l.includes('⏱️'))).toBe(true);
  });

  it('logs stats only after 2+ iterations', () => {
    simulateIteration(1, 2000);
    expect(logs.some(l => l.includes('📈'))).toBe(false);
    simulateIteration(2, 3000);
    expect(logs.some(l => l.includes('📈'))).toBe(true);
  });

  it('computes correct median with odd number of iterations', () => {
    simulateIteration(1, 1000);
    simulateIteration(2, 3000);
    simulateIteration(3, 5000);
    const stats = timer.getStats();
    expect(stats.median).toBeGreaterThanOrEqual(2500);
    expect(stats.median).toBeLessThanOrEqual(3500);
  });

  it('computes p95 correctly with many iterations', () => {
    for (let i = 1; i <= 20; i++) {
      simulateIteration(i, i * 1000);
    }
    const stats = timer.getStats();
    expect(stats.p95).toBeGreaterThan(18000);
    expect(stats.count).toBe(20);
  });

  it('formats duration as human-readable string', () => {
    simulateIteration(1, 65000); // 1m 5s
    expect(logs.some(l => l.includes('1m'))).toBe(true);
  });

  it('handles rapid iterations (< 100ms)', () => {
    simulateIteration(1, 50);
    simulateIteration(2, 30);
    const stats = timer.getStats();
    expect(stats.avg).toBeLessThan(100);
  });

  it('prevents duplicate iteration starts', () => {
    timer.startIteration('iter-1');
    expect(() => timer.startIteration('iter-1')).toThrow();
  });

  it('tracks min and max durations', () => {
    simulateIteration(1, 1000);
    simulateIteration(2, 10000);
    const stats = timer.getStats();
    expect(stats.min).toBeLessThanOrEqual(1500);
    expect(stats.max).toBeGreaterThanOrEqual(9000);
  });

  it('iteration IDs follow iter-N pattern', () => {
    for (let i = 1; i <= 5; i++) {
      const id = `iter-${i}`;
      timer.startIteration(id);
      timer.endIteration(id);
    }
    expect(timer.getStats().count).toBe(5);
  });

  it('stats are empty before any iterations', () => {
    const stats = timer.getStats();
    expect(stats.count).toBe(0);
    expect(stats.avg).toBe(0);
  });
});
