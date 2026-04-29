/**
 * Error Boundary — Generic error boundary wrapper for workflow modules.
 * Catches errors and returns structured results instead of throwing.
 */

export interface ErrorResult {
  message: string;
  stack?: string;
  timestamp: number;
}

export interface BoundaryResult<T> {
  success: boolean;
  result?: T;
  error?: ErrorResult;
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
): BoundaryResult<T> {
  try {
    const result = fn();
    return { success: true, result };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    if (options?.onError) {
      options.onError(error);
    }
    return {
      success: false,
      result: options?.fallback,
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
 * Returns structured result instead of throwing.
 */
export async function withAsyncErrorBoundary<T>(
  fn: () => Promise<T>,
  options?: ErrorBoundaryOptions<T>
): Promise<BoundaryResult<T>> {
  try {
    const result = await fn();
    return { success: true, result };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    if (options?.onError) {
      options.onError(error);
    }
    return {
      success: false,
      result: options?.fallback,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Wraps all functions of a module object with error boundaries.
 * Returns a new object where each function returns BoundaryResult.
 */
export function wrapModule<M extends Record<string, any>>(
  module: M,
  options?: ErrorBoundaryOptions<any>
): { [K in keyof M]: M[K] extends (...args: any[]) => any ? (...args: Parameters<M[K]>) => BoundaryResult<ReturnType<M[K]>> : M[K] } {
  const wrapped: any = {};
  for (const key of Object.keys(module)) {
    if (typeof module[key] === 'function') {
      wrapped[key] = (...args: any[]) => {
        return withErrorBoundary(() => module[key](...args), options);
      };
    } else {
      wrapped[key] = module[key];
    }
  }
  return wrapped;
}

/**
 * Creates a reusable error boundary with preset options.
 */
export function createErrorBoundary<T>(options: ErrorBoundaryOptions<T>) {
  return {
    wrap: (fn: () => T) => withErrorBoundary(fn, options),
    wrapAsync: (fn: () => Promise<T>) => withAsyncErrorBoundary(fn, options),
  };
}
