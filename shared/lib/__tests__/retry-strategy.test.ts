import { describe, it, expect, mock } from 'bun:test';
import { retry, createCircuitBreaker } from '../retry-strategy.js';

describe('retry', () => {
  it('succeeds on first try', async () => {
    let calls = 0;
    const fn = async () => { calls++; return 'ok'; };
    const result = await retry(fn);
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) throw new Error('fail1');
      if (calls === 2) throw new Error('fail2');
      return 'ok';
    };
    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws after maxAttempts exceeded', async () => {
    let calls = 0;
    const fn = async () => { calls++; throw new Error('always fails'); };
    await expect(retry(fn, { maxAttempts: 2, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(calls).toBe(2);
  });

  it('respects maxAttempts option', async () => {
    let calls = 0;
    const fn = async () => { calls++; throw new Error('nope'); };
    await expect(retry(fn, { maxAttempts: 5, baseDelayMs: 1 })).rejects.toThrow();
    expect(calls).toBe(5);
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
    const cb = createCircuitBreaker({ threshold: 1, resetMs: 10 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');
    // Wait for reset
    await new Promise(r => setTimeout(r, 15));
    expect(cb.getState()).toBe('half-open');
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('closed');
  });

  it('manual reset works', async () => {
    const cb = createCircuitBreaker({ threshold: 1, resetMs: 99999 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');
    cb.reset();
    expect(cb.getState()).toBe('closed');
  });
});
