import { describe, it, expect, beforeEach } from 'bun:test';
import { IterationTimer, formatDuration } from '../workflows/iteration-timer';

/**
 * Helper: inject a completed timing record with a known duration.
 * Avoids needing fake timers — we test the stats/format logic directly.
 */
function injectCompleted(timer: any, id: string, durationMs: number) {
  const now = Date.now();
  timer.completed.push({ id, startMs: now - durationMs, endMs: now, durationMs });
}

describe('IterationTimer', () => {
  let timer: IterationTimer;

  beforeEach(() => {
    timer = new IterationTimer();
  });

  describe('startIteration', () => {
    it('starts an iteration without error', () => {
      expect(() => timer.startIteration('iter-1')).not.toThrow();
    });

    it('throws if iteration already started', () => {
      timer.startIteration('iter-1');
      expect(() => timer.startIteration('iter-1')).toThrow('already started');
    });

    it('allows multiple different iterations', () => {
      timer.startIteration('iter-1');
      timer.startIteration('iter-2');
      expect(timer.getActiveIterations()).toEqual(['iter-1', 'iter-2']);
    });
  });

  describe('endIteration', () => {
    it('returns duration after ending', () => {
      timer.startIteration('iter-1');
      const result = timer.endIteration('iter-1');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationFormatted).toBeDefined();
    });

    it('throws if iteration never started', () => {
      expect(() => timer.endIteration('unknown')).toThrow('never started');
    });

    it('removes iteration from active list after ending', () => {
      timer.startIteration('iter-1');
      timer.endIteration('iter-1');
      expect(timer.getActiveIterations()).toEqual([]);
    });

    it('measures elapsed time', () => {
      // Use injected record for deterministic test
      injectCompleted(timer, 'iter-1', 500);
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
      expect(stats.avg).toBe(500);
    });

    it('formats milliseconds correctly', () => {
      expect(formatDuration(250)).toBe('250ms');
    });

    it('formats seconds correctly', () => {
      expect(formatDuration(5500)).toBe('5.5s');
    });

    it('formats minutes correctly', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('getStats', () => {
    it('returns zeros when no iterations completed', () => {
      const stats = timer.getStats();
      expect(stats).toEqual({ avg: 0, median: 0, p95: 0, count: 0, min: 0, max: 0 });
    });

    it('computes stats for single iteration', () => {
      injectCompleted(timer, 'iter-1', 1000);
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
      expect(stats.avg).toBe(1000);
      expect(stats.median).toBe(1000);
      expect(stats.p95).toBe(1000);
    });

    it('computes correct average', () => {
      injectCompleted(timer, 'a', 100);
      injectCompleted(timer, 'b', 300);
      const stats = timer.getStats();
      expect(stats.avg).toBe(200);
    });

    it('computes correct median for odd count', () => {
      for (const dur of [100, 200, 300]) {
        injectCompleted(timer, `iter-${dur}`, dur);
      }
      const stats = timer.getStats();
      expect(stats.median).toBe(200);
    });

    it('computes p95 correctly with many samples', () => {
      for (let i = 1; i <= 20; i++) {
        injectCompleted(timer, `iter-${i}`, i * 100);
      }
      const stats = timer.getStats();
      expect(stats.count).toBe(20);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(2000);
      expect(stats.p95).toBe(1900);
    });

    it('computes min and max', () => {
      injectCompleted(timer, 'fast', 50);
      injectCompleted(timer, 'slow', 5000);
      const stats = timer.getStats();
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(5000);
    });
  });

  describe('getActiveIterations', () => {
    it('returns empty array initially', () => {
      expect(timer.getActiveIterations()).toEqual([]);
    });

    it('tracks active iterations', () => {
      timer.startIteration('a');
      timer.startIteration('b');
      expect(timer.getActiveIterations()).toContain('a');
      expect(timer.getActiveIterations()).toContain('b');
    });
  });

  describe('getCompletedCount', () => {
    it('returns 0 initially', () => {
      expect(timer.getCompletedCount()).toBe(0);
    });

    it('increments after completion', () => {
      timer.startIteration('a');
      timer.endIteration('a');
      expect(timer.getCompletedCount()).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      timer.startIteration('a');
      timer.endIteration('a');
      timer.startIteration('b');
      timer.reset();
      expect(timer.getActiveIterations()).toEqual([]);
      expect(timer.getCompletedCount()).toBe(0);
      expect(timer.getStats().count).toBe(0);
    });
  });
});

describe('formatDuration', () => {
  it('formats ms', () => expect(formatDuration(42)).toBe('42ms'));
  it('formats seconds', () => expect(formatDuration(3200)).toBe('3.2s'));
  it('formats minutes', () => expect(formatDuration(90000)).toBe('1m 30s'));
});
