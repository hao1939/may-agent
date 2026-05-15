interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: number;
}

interface BoundaryResult<T> {
  success: boolean;
  result?: T;
  error?: ErrorInfo;
}

interface BoundaryOptions<T = any> {
  fallback?: T;
  onError?: (error: ErrorInfo) => void;
}

function toErrorInfo(e: unknown): ErrorInfo {
  if (e instanceof Error) {
    return { message: e.message, stack: e.stack, timestamp: Date.now() };
  }
  return { message: String(e), timestamp: Date.now() };
}

export function withErrorBoundary<T>(fn: () => T, options?: BoundaryOptions<T>): BoundaryResult<T> {
  try {
    const result = fn();
    return { success: true, result };
  } catch (e) {
    const error = toErrorInfo(e);
    options?.onError?.(error);
    return { success: false, error, result: options?.fallback };
  }
}

export async function withAsyncErrorBoundary<T>(fn: () => Promise<T>, options?: BoundaryOptions<T>): Promise<BoundaryResult<T>> {
  try {
    const result = await fn();
    return { success: true, result };
  } catch (e) {
    const error = toErrorInfo(e);
    options?.onError?.(error);
    return { success: false, error, result: options?.fallback };
  }
}

export function wrapModule<M extends Record<string, any>>(mod: M, options?: BoundaryOptions): any {
  const wrapped: any = {};
  for (const [key, value] of Object.entries(mod)) {
    if (typeof value === 'function') {
      wrapped[key] = (...args: any[]) => withErrorBoundary(() => value(...args), options);
    } else {
      wrapped[key] = value;
    }
  }
  return wrapped;
}

export function createErrorBoundary<D = any>(defaults: BoundaryOptions<D>) {
  return {
    wrap<T>(fn: () => T): BoundaryResult<T> {
      return withErrorBoundary(fn, defaults as any);
    },
    async wrapAsync<T>(fn: () => Promise<T>): Promise<BoundaryResult<T>> {
      return withAsyncErrorBoundary(fn, defaults as any);
    },
  };
}
