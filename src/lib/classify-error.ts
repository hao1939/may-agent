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
  if (!error) return "logic";
  const e = error.toLowerCase();

  // Infrastructure errors (retryable)
  if (
    e.includes("empty response") ||
    e.includes("0 output tokens") ||
    e.includes("stream error") ||
    e.includes("stream closed") ||
    e.includes("502") ||
    e.includes("503") ||
    e.includes("429") ||
    e.includes("econnreset") ||
    e.includes("rate limit") ||
    e.includes("timeout") ||
    e.includes("connection") ||
    e.includes("network") ||
    e.includes("no deployments available for selected model") ||
    (e.includes("model is not supported") && e.includes("model group")) ||
    (e.includes("bad request") && e.includes("model group"))
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
    e.includes("not allowed") ||
    e.includes("401") ||
    e.includes("403") ||
    e.includes("unauthorized") ||
    e.includes("forbidden")
  ) {
    return "logic";
  }

  // Default to logic (conservative — unknown errors shouldn't auto-retry)
  return "logic";
}
