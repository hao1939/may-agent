/**
 * Scrape Dedup Guard — beforeToolCall hook for scrape_webpage.
 *
 * Prevents agents from scraping the same URL multiple times in a session.
 * Scout sessions showed 5-6 scrapes of the same URL with escalating maxLength,
 * producing 400KB+ duplicate content in context (1.7MB sessions).
 *
 * After 1 scrape of a URL, warns the agent to use existing content.
 * After 2 scrapes of the same URL, blocks further scrapes.
 *
 * Source: Optimizer cost finding 2026-03-19.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** After this many scrapes of the same URL, block further scrapes. */
export const SCRAPE_BLOCK_THRESHOLD = 2;

/**
 * Normalize a URL for dedup tracking.
 * Strips trailing slash and fragment, lowercases host.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove fragment
    u.hash = "";
    // Normalize trailing slash on path
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Create a beforeToolCall hook that detects and blocks excessive scrapes of
 * the same URL within a single session.
 *
 * Returns a stateful closure — one instance per agent session.
 */
export function createScrapeDedupGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  /** Per-URL scrape count for this session. */
  const scrapeCounts = new Map<string, number>();

  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    // Only intercept scrape_webpage calls
    if (ctx.toolCall.name !== "scrape_webpage") return undefined;

    const args = ctx.args as { url?: string; maxLength?: number; raw?: boolean };
    if (!args.url) return undefined;

    const normalizedUrl = normalizeUrl(args.url);
    const count = (scrapeCounts.get(normalizedUrl) ?? 0) + 1;
    scrapeCounts.set(normalizedUrl, count);

    // First scrape — allow
    if (count <= 1) return undefined;

    // Second scrape — warn
    if (count === SCRAPE_BLOCK_THRESHOLD) {
      return {
        block: false,
        reason:
          `⚠️ SCRAPE_DEDUP: You already scraped "${args.url}" earlier this session. ` +
          `Re-scraping with a higher maxLength won't give you significantly more useful content. ` +
          `Use the content you already have. This is your last scrape of this URL.`,
      };
    }

    // Third+ scrape — block
    return {
      block: true,
      reason:
        `🚫 SCRAPE_DEDUP: You have already scraped "${args.url}" ${count - 1} times this session. ` +
        `Further scrapes of this URL are blocked. ` +
        `The page content hasn't changed — use the information from your earlier scrape. ` +
        `If you need a different section, try a more specific URL or extract what you need from existing content.`,
    };
  };
}
