import { describe, it, expect, beforeEach, afterEach, setSystemTime } from 'bun:test';
import { IterationTimer, formatDuration } from '../workflows/iteration-timer';

describe('IterationTimer', () => {
  let timer: IterationTimer;
  let now: number;

  function advanceTime(ms: number): void {
    now += ms;
    setSystemTime(now);
  }

  beforeEach(() => {
    now = Date.now();
    setSystemTime(now);
    timer = new IterationTimer();
  });

  afterEach(() => {
    setSystemTime();
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
      timer.startIteration('iter-1');
      advanceTime(500);
      const result = timer.endIteration('iter-1');
      expect(result.durationMs).toBe(500);
      setSystemTime();
    });

    it('formats milliseconds correctly', async () => {
      timer.startIteration('iter-1');
      advanceTime(250);
      const result = timer.endIteration('iter-1');
      expect(result.durationFormatted).toBe('250ms');
      setSystemTime();
    });

    it('formats seconds correctly', async () => {
      timer.startIteration('iter-1');
      advanceTime(5500);
      const result = timer.endIteration('iter-1');
      expect(result.durationFormatted).toBe('5.5s');
      setSystemTime();
    });

    it('formats minutes correctly', async () => {
      timer.startIteration('iter-1');
      advanceTime(125000); // 2m 5s
      const result = timer.endIteration('iter-1');
      expect(result.durationFormatted).toBe('2m 5s');
      setSystemTime();
    });
  });

  describe('getStats', () => {
    it('returns zeros when no iterations completed', () => {
      const stats = timer.getStats();
      expect(stats).toEqual({ avg: 0, median: 0, p95: 0, count: 0, min: 0, max: 0 });
    });

    it('computes stats for single iteration', () => {
      timer.startIteration('iter-1');
      advanceTime(1000);
      timer.endIteration('iter-1');
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
      expect(stats.avg).toBe(1000);
      expect(stats.median).toBe(1000);
      expect(stats.p95).toBe(1000);
      setSystemTime();
    });

    it('computes correct average', () => {
      timer.startIteration('a');
      advanceTime(100);
      timer.endIteration('a');
      timer.startIteration('b');
      advanceTime(300);
      timer.endIteration('b');
      const stats = timer.getStats();
      expect(stats.avg).toBe(200);
      setSystemTime();
    });

    it('computes correct median for odd count', () => {
      for (const dur of [100, 200, 300]) {
        const id = `iter-${dur}`;
        timer.startIteration(id);
        advanceTime(dur);
        timer.endIteration(id);
      }
      const stats = timer.getStats();
      expect(stats.median).toBe(200);
      setSystemTime();
    });

    it('computes p95 correctly with many samples', () => {
      for (let i = 1; i <= 20; i++) {
        timer.startIteration(`iter-${i}`);
        advanceTime(i * 100);
        timer.endIteration(`iter-${i}`);
      }
      const stats = timer.getStats();
      expect(stats.count).toBe(20);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(2000);
      expect(stats.p95).toBe(1900); // 19th element at 95th percentile
      setSystemTime();
    });

    it('computes min and max', () => {
      timer.startIteration('fast');
      advanceTime(50);
      timer.endIteration('fast');
      timer.startIteration('slow');
      advanceTime(5000);
      timer.endIteration('slow');
      const stats = timer.getStats();
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(5000);
      setSystemTime();
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
