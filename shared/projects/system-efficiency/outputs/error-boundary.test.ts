import { describe, it, expect, vi } from 'vitest';
import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  wrapModule,
  createErrorBoundary,
} from '../workflows/error-boundary';

describe('withErrorBoundary', () => {
  it('returns success for normal function', () => {
    const result = withErrorBoundary(() => 42);
    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.error).toBeUndefined();
  });

  it('returns success for string result', () => {
    const result = withErrorBoundary(() => 'hello');
    expect(result.success).toBe(true);
    expect(result.result).toBe('hello');
  });

  it('catches thrown errors', () => {
    const result = withErrorBoundary(() => { throw new Error('boom'); });
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('boom');
  });

  it('includes timestamp on error', () => {
    const before = Date.now();
    const result = withErrorBoundary(() => { throw new Error('x'); });
    expect(result.error!.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('includes stack trace on error', () => {
    const result = withErrorBoundary(() => { throw new Error('x'); });
    expect(result.error!.stack).toContain('Error: x');
  });

  it('uses fallback value on error', () => {
    const result = withErrorBoundary(() => { throw new Error('x'); }, { fallback: 99 });
    expect(result.success).toBe(false);
    expect(result.result).toBe(99);
  });

  it('calls onError callback on error', () => {
    const onError = vi.fn();
    withErrorBoundary(() => { throw new Error('cb'); }, { onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'cb' }));
  });

  it('does not call onError on success', () => {
    const onError = vi.fn();
    withErrorBoundary(() => 1, { onError });
    expect(onError).not.toHaveBeenCalled();
  });

  it('handles non-Error throws', () => {
    const result = withErrorBoundary(() => { throw 'string error'; });
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('string error');
  });

  it('handles undefined return', () => {
    const result = withErrorBoundary(() => undefined);
    expect(result.success).toBe(true);
    expect(result.result).toBeUndefined();
  });

  it('handles null return', () => {
    const result = withErrorBoundary(() => null);
    expect(result.success).toBe(true);
    expect(result.result).toBeNull();
  });

  it('handles object return', () => {
    const result = withErrorBoundary(() => ({ a: 1, b: 'x' }));
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ a: 1, b: 'x' });
  });
});

describe('withAsyncErrorBoundary', () => {
  it('returns success for resolved promise', async () => {
    const result = await withAsyncErrorBoundary(async () => 42);
    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
  });

  it('catches rejected promise', async () => {
    const result = await withAsyncErrorBoundary(async () => { throw new Error('async boom'); });
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('async boom');
  });

  it('uses fallback on async error', async () => {
    const result = await withAsyncErrorBoundary(async () => { throw new Error('x'); }, { fallback: 'default' });
    expect(result.result).toBe('default');
  });

  it('calls onError for async errors', async () => {
    const onError = vi.fn();
    await withAsyncErrorBoundary(async () => { throw new Error('ae'); }, { onError });
    expect(onError).toHaveBeenCalled();
  });

  it('handles async function returning object', async () => {
    const result = await withAsyncErrorBoundary(async () => ({ x: 1 }));
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ x: 1 });
  });
});

describe('wrapModule', () => {
  it('wraps all functions of a module', () => {
    const mod = { add: (a: number, b: number) => a + b, name: 'test' };
    const wrapped = wrapModule(mod);
    const result = wrapped.add(2, 3);
    expect(result.success).toBe(true);
    expect(result.result).toBe(5);
  });

  it('preserves non-function values', () => {
    const mod = { val: 42, fn: () => 'x' };
    const wrapped = wrapModule(mod);
    expect(wrapped.val).toBe(42);
  });

  it('catches errors in wrapped functions', () => {
    const mod = { fail: () => { throw new Error('mod error'); } };
    const wrapped = wrapModule(mod);
    const result = wrapped.fail();
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('mod error');
  });

  it('applies shared onError to all functions', () => {
    const onError = vi.fn();
    const mod = { a: () => { throw new Error('a'); }, b: () => { throw new Error('b'); } };
    const wrapped = wrapModule(mod, { onError });
    wrapped.a();
    wrapped.b();
    expect(onError).toHaveBeenCalledTimes(2);
  });
});

describe('createErrorBoundary', () => {
  it('creates reusable boundary with preset options', () => {
    const boundary = createErrorBoundary({ fallback: 0 });
    const result = boundary.wrap(() => { throw new Error('x'); });
    expect(result.success).toBe(false);
    expect(result.result).toBe(0);
  });

  it('wraps async functions with preset options', async () => {
    const boundary = createErrorBoundary({ fallback: 'fallback' });
    const result = await boundary.wrapAsync(async () => { throw new Error('x'); });
    expect(result.result).toBe('fallback');
  });

  it('preset onError is called', () => {
    const onError = vi.fn();
    const boundary = createErrorBoundary({ onError });
    boundary.wrap(() => { throw new Error('preset'); });
    expect(onError).toHaveBeenCalled();
  });
});
