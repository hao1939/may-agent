/**
 * string-helpers.ts — String utility functions.
 */

/**
 * Truncate a string to `maxLen` characters, appending "…" if truncated.
 *
 * - If `str.length <= maxLen`, returns `str` unchanged.
 * - If `maxLen < 1`, returns "…" (cannot fit any content).
 * - The returned string (including the ellipsis) is at most `maxLen` characters.
 *
 * @param str    The input string.
 * @param maxLen Maximum length of the returned string (including ellipsis).
 * @returns The original or truncated string.
 */
export function truncateWithEllipsis(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  if (maxLen < 1) return "…";
  return str.slice(0, maxLen - 1) + "…";
}
