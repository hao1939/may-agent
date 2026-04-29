import { describe, it, expect, vi } from 'vitest';
import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  wrapModule,
  createErrorBoundary,
} from '../workflows/error-boundary';

describe('error-boundary', () => {
  describe('withErrorBoundary', () => {
    it('returns success for normal function', () => {
      const result = withErrorBoundary(() => 42);
      expect(result).toEqual({ success: true, result: 42 });
    });

    it('returns success with string result', () => {
      const result = withErrorBoundary(() => 'hello');
      expect(result.success).toBe(true);
      expect(result.result).toBe('hello');
    });

    it('catches thrown errors', () => {
      const result = withErrorBoundary(() => { throw new Error('fail'); });
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('fail');
    });

    it('includes timestamp on error', () => {
      const before = Date.now();
      const result = withErrorBoundary(() => { throw new Error('x'); });
      expect(result.error?.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('includes stack trace on error', () => {
      const result = withErrorBoundary(() => { throw new Error('x'); });
      expect(result.error?.stack).toBeDefined();
    });

    it('uses fallback value on error', () => {
      const result = withErrorBoundary(() => { throw new Error('x'); }, { fallback: 99 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(99);
    });

    it('calls onError callback', () => {
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
      const result = withErrorBoundary(() => ({ a: 1, b: 2 }));
      expect(result.result).toEqual({ a: 1, b: 2 });
    });

    it('fallback with onError both work', () => {
      const onError = vi.fn();
      const result = withErrorBoundary(() => { throw new Error('x'); }, { fallback: 0, onError });
      expect(result.success).toBe(true);
      expect(result.result).toBe(0);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('withAsyncErrorBoundary', () => {
    it('handles resolved promise', async () => {
      const result = await withAsyncErrorBoundary(async () => 42);
      expect(result).toEqual({ success: true, result: 42 });
    });

    it('handles rejected promise', async () => {
      const result = await withAsyncErrorBoundary(async () => { throw new Error('async fail'); });
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('async fail');
    });

    it('uses fallback on async error', async () => {
      const result = await withAsyncErrorBoundary(async () => { throw new Error('x'); }, { fallback: 'default' });
      expect(result.success).toBe(true);
      expect(result.result).toBe('default');
    });

    it('calls onError on async failure', async () => {
      const onError = vi.fn();
      await withAsyncErrorBoundary(async () => { throw new Error('y'); }, { onError });
      expect(onError).toHaveBeenCalled();
    });

    it('handles async function returning object', async () => {
      const result = await withAsyncErrorBoundary(async () => ({ x: 1 }));
      expect(result.result).toEqual({ x: 1 });
    });
  });

  describe('wrapModule', () => {
    it('wraps all functions in a module', () => {
      const mod = { add: (a: number, b: number) => a + b, name: 'test' };
      const wrapped = wrapModule(mod);
      const result = (wrapped.add as any)(1, 2);
      expect(result.success).toBe(true);
      expect(result.result).toBe(3);
    });

    it('preserves non-function values', () => {
      const mod = { value: 42, fn: () => 'ok' };
      const wrapped = wrapModule(mod);
      expect(wrapped.value).toBe(42);
    });

    it('catches errors in wrapped functions', () => {
      const mod = { fail: () => { throw new Error('mod error'); } };
      const wrapped = wrapModule(mod);
      const result = (wrapped.fail as any)();
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('mod error');
    });

    it('applies shared onError to all functions', () => {
      const onError = vi.fn();
      const mod = { a: () => { throw new Error('a'); }, b: () => { throw new Error('b'); } };
      const wrapped = wrapModule(mod, { onError });
      (wrapped.a as any)();
      (wrapped.b as any)();
      expect(onError).toHaveBeenCalledTimes(2);
    });
  });

  describe('createErrorBoundary', () => {
    it('creates reusable boundary with defaults', () => {
      const boundary = createErrorBoundary({ fallback: 0 });
      const result = boundary.wrap(() => { throw new Error('x'); });
      expect(result.success).toBe(true);
      expect(result.result).toBe(0);
    });

    it('wraps async with defaults', async () => {
      const boundary = createErrorBoundary({ fallback: 'safe' });
      const result = await boundary.wrapAsync(async () => { throw new Error('x'); });
      expect(result.success).toBe(true);
      expect(result.result).toBe('safe');
    });
  });
});
