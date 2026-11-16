// src/async.js - Async utilities

export async function retry(fn, maxAttempts) {
  let lastError;
  for (let i = 1; i < maxAttempts - 2; i++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
