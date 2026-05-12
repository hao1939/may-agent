import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IterationTimer, formatDuration } from '../workflows/iteration-timer';

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

    it('measures elapsed time', async () => {
      vi.useFakeTimers();
      timer.startIteration('iter-1');
      vi.advanceTimersByTime(500);
      const result = timer.endIteration('iter-1');
      expect(result.durationMs).toBe(500);
      vi.useRealTimers();
    });

    it('formats milliseconds correctly', async () => {
      vi.useFakeTimers();
      timer.startIteration('iter-1');
      vi.advanceTimersByTime(250);
      const result = timer.endIteration('iter-1');
      expect(result.durationFormatted).toBe('250ms');
      vi.useRealTimers();
    });

    it('formats seconds correctly', async () => {
      vi.useFakeTimers();
      timer.startIteration('iter-1');
      vi.advanceTimersByTime(5500);
      const result = timer.endIteration('iter-1');
      expect(result.durationFormatted).toBe('5.5s');
      vi.useRealTimers();
    });

    it('formats minutes correctly', async () => {
      vi.useFakeTimers();
      timer.startIteration('iter-1');
      vi.advanceTimersByTime(125000); // 2m 5s
      const result = timer.endIteration('iter-1');
      expect(result.durationFormatted).toBe('2m 5s');
      vi.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('returns zeros when no iterations completed', () => {
      const stats = timer.getStats();
      expect(stats).toEqual({ avg: 0, median: 0, p95: 0, count: 0, min: 0, max: 0 });
    });

    it('computes stats for single iteration', () => {
      vi.useFakeTimers();
      timer.startIteration('iter-1');
      vi.advanceTimersByTime(1000);
      timer.endIteration('iter-1');
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
      expect(stats.avg).toBe(1000);
      expect(stats.median).toBe(1000);
      expect(stats.p95).toBe(1000);
      vi.useRealTimers();
    });

    it('computes correct average', () => {
      vi.useFakeTimers();
      timer.startIteration('a');
      vi.advanceTimersByTime(100);
      timer.endIteration('a');
      timer.startIteration('b');
      vi.advanceTimersByTime(300);
      timer.endIteration('b');
      const stats = timer.getStats();
      expect(stats.avg).toBe(200);
      vi.useRealTimers();
    });

    it('computes correct median for odd count', () => {
      vi.useFakeTimers();
      for (const dur of [100, 200, 300]) {
        const id = `iter-${dur}`;
        timer.startIteration(id);
        vi.advanceTimersByTime(dur);
        timer.endIteration(id);
      }
      const stats = timer.getStats();
      expect(stats.median).toBe(200);
      vi.useRealTimers();
    });

    it('computes p95 correctly with many samples', () => {
      vi.useFakeTimers();
      for (let i = 1; i <= 20; i++) {
        timer.startIteration(`iter-${i}`);
        vi.advanceTimersByTime(i * 100);
        timer.endIteration(`iter-${i}`);
      }
      const stats = timer.getStats();
      expect(stats.count).toBe(20);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(2000);
      expect(stats.p95).toBe(1900); // 19th element at 95th percentile
      vi.useRealTimers();
    });

    it('computes min and max', () => {
      vi.useFakeTimers();
      timer.startIteration('fast');
      vi.advanceTimersByTime(50);
      timer.endIteration('fast');
      timer.startIteration('slow');
      vi.advanceTimersByTime(5000);
      timer.endIteration('slow');
      const stats = timer.getStats();
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(5000);
      vi.useRealTimers();
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
