/**
 * classify-error.ts — Pure string-matching error classifier.
 *
 * Extracted from requests.ts to avoid any transitive dependency on bun:sqlite
 * when consumers only need error classification.
 */

export type ErrorClass = "infra" | "logic" | "abort" | "overflow";

/**
 * Classify an error string into a category.
 * Pure function — no IO, no database, no Bun-specific deps.
 */
export function classifyError(error: string | undefined | null): ErrorClass {
  if (!error) return "infra";
  const e = error.toLowerCase();

  // Infrastructure errors (retryable)
  if (
    e.includes("empty response") ||
    e.includes("0 output tokens") ||
    e.includes("stream") ||
    e.includes("502") ||
    e.includes("503") ||
    e.includes("econnreset") ||
    e.includes("rate limit") ||
    e.includes("timeout") ||
    e.includes("connection") ||
    e.includes("network")
  ) {
    return "infra";
  }

  // Context overflow (not retryable without modification)
  if (
    e.includes("context window") ||
    e.includes("max tokens") ||
    e.includes("context_length_exceeded") ||
    e.includes("too many tokens")
  ) {
    return "overflow";
  }

  // Abort (user or system initiated)
  if (e.includes("abort") || e.includes("cancel")) {
    return "abort";
  }

  // Logic errors (not retryable — bug or permission issue)
  if (
    e.includes("tool not found") ||
    e.includes("permission denied") ||
    e.includes("call depth exceeded") ||
    e.includes("not allowed")
  ) {
    return "logic";
  }

  // Default to infra (conservative — retry by default)
  return "infra";
}
