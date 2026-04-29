/**
 * Error Boundary — Generic error boundary wrapper for workflow modules.
 * Catches errors and returns structured results instead of throwing.
 */

export interface ErrorBoundaryResult<T> {
  success: boolean;
  result?: T;
  error?: {
    message: string;
    stack?: string;
    timestamp: number;
  };
}

export interface ErrorBoundaryOptions<T> {
  fallback?: T;
  onError?: (e: Error) => void;
  timeout?: number;
}

/**
 * Wraps a synchronous function in an error boundary.
 * Returns structured result instead of throwing.
 */
export function withErrorBoundary<T>(
  fn: () => T,
  options?: ErrorBoundaryOptions<T>
): ErrorBoundaryResult<T> {
  try {
    const result = fn();
    return { success: true, result };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    if (options?.onError) {
      options.onError(error);
    }
    if (options?.fallback !== undefined) {
      return { success: true, result: options.fallback };
    }
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Wraps an async function in an error boundary.
 */
export async function withAsyncErrorBoundary<T>(
  fn: () => Promise<T>,
  options?: ErrorBoundaryOptions<T>
): Promise<ErrorBoundaryResult<T>> {
  try {
    const result = await fn();
    return { success: true, result };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    if (options?.onError) {
      options.onError(error);
    }
    if (options?.fallback !== undefined) {
      return { success: true, result: options.fallback };
    }
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Wraps all functions in a module object with error boundaries.
 */
export function wrapModule<M extends Record<string, unknown>>(
  module: M,
  options?: ErrorBoundaryOptions<unknown>
): { [K in keyof M]: M[K] extends (...args: infer A) => infer R
  ? (...args: A) => ErrorBoundaryResult<R>
  : M[K] } {
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(module)) {
    if (typeof value === 'function') {
      wrapped[key] = (...args: unknown[]) => {
        return withErrorBoundary(() => (value as Function)(...args), options);
      };
    } else {
      wrapped[key] = value;
    }
  }
  return wrapped as any;
}

/**
 * Creates a reusable error boundary with preset options.
 */
export function createErrorBoundary<T>(defaultOptions: ErrorBoundaryOptions<T>) {
  return {
    wrap: (fn: () => T) => withErrorBoundary(fn, defaultOptions),
    wrapAsync: (fn: () => Promise<T>) => withAsyncErrorBoundary(fn, defaultOptions),
  };
}
