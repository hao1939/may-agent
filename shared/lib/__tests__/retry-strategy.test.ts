import { describe, it, expect, vi, afterEach, setSystemTime } from 'bun:test';
import { retry, createCircuitBreaker } from '../retry-strategy.js';

afterEach(() => {
  setSystemTime();
});

describe('retry', () => {
  it('succeeds on first try', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const outcomes: Array<Error | string> = [new Error('fail1'), new Error('fail2'), 'ok'];
    const fn = vi.fn(async () => {
      const next = outcomes.shift();
      if (next instanceof Error) throw next;
      return next;
    });
    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after maxAttempts exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(retry(fn, { maxAttempts: 2, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects maxAttempts option', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(retry(fn, { maxAttempts: 5, baseDelayMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(5);
  });
});

describe('createCircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = createCircuitBreaker({ threshold: 3, resetMs: 1000 });
    expect(cb.getState()).toBe('closed');
  });

  it('opens after threshold failures', async () => {
    const cb = createCircuitBreaker({ threshold: 2, resetMs: 1000 });
    const fn = () => Promise.reject(new Error('fail'));
    await expect(cb.execute(fn)).rejects.toThrow('fail');
    await expect(cb.execute(fn)).rejects.toThrow('fail');
    expect(cb.getState()).toBe('open');
    await expect(cb.execute(fn)).rejects.toThrow('Circuit breaker is open');
  });

  it('resets after resetMs', async () => {
    const now = Date.now();
    setSystemTime(now);
    const cb = createCircuitBreaker({ threshold: 1, resetMs: 100 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');
    setSystemTime(now + 100);
    expect(cb.getState()).toBe('half-open');
    // Successful call in half-open resets to closed
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('closed');
    setSystemTime();
  });

  it('manual reset works', async () => {
    const cb = createCircuitBreaker({ threshold: 1, resetMs: 99999 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');
    cb.reset();
    expect(cb.getState()).toBe('closed');
  });
});
