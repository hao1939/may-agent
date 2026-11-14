/**
 * Shared abort-signal utilities for tool implementations.
 *
 * All three file tools (read, write, edit) share the same abort-signal
 * boilerplate: check if already aborted, set up a listener, wrap async
 * work in a Promise, and clean up the listener on every exit path.
 *
 * This module extracts that pattern into a single helper.
 */

/**
 * Wraps an async operation with abort-signal support.
 *
 * Handles:
 * - Pre-check: rejects immediately if signal is already aborted
 * - Listener: registers an "abort" listener that rejects and sets a flag
 * - Cleanup: removes the listener on success, error, or abort
 * - Flag: passes an `isAborted()` function so the inner work can bail early
 *
 * @template T - The type of the value the wrapped operation resolves to
 * @param signal - Optional AbortSignal from the tool call. If undefined,
 *                 the work runs without abort support.
 * @param work - Async function that does the real work. Receives an `isAborted`
 *               checker so it can bail early during long-running operations.
 *               Must return the resolved value of type T.
 * @returns A promise that resolves with the result of `work`, or rejects with
 *          an `Error("Operation aborted")` if the signal fires before completion.
 * @throws {Error} "Operation aborted" — if `signal` is already aborted at call time,
 *         or if `signal` fires while `work` is still running.
 *
 * @example
 * ```ts
 * const result = await withAbortSignal(signal, async (isAborted) => {
 *   const data = await readFile(path);
 *   if (isAborted()) return "";
 *   return data.toString();
 * });
 * ```
 */
export function withAbortSignal<T>(
  signal: AbortSignal | undefined,
  work: (isAborted: () => boolean) => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation aborted"));
      return;
    }

    let aborted = false;
    const onAbort = () => {
      aborted = true;
      reject(new Error("Operation aborted"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    work(() => aborted)
      .then((result) => {
        if (!aborted) {
          cleanup();
          resolve(result);
        }
      })
      .catch((error) => {
        cleanup();
        if (!aborted) {
          reject(error);
        }
      });
  });
}
