/**
 * scrape_webpage tool — robust web page fetcher for agents.
 *
 * Eliminates the "curl → 403 → retry with headers → fail → waste 10 turns" loop
 * by centralizing HTTP fetching with proper headers, redirect handling, and
 * HTML-to-text conversion in a single deterministic tool call.
 *
 * Philosophy: P1 (Simplest Thing That Works) + P17 (Offload to Infra).
 * No external dependencies — uses Node 20 built-in fetch + regex-based HTML stripping.
 */

import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

const ScrapeParams: TSchema = Type.Object({
  url: Type.String({ description: "URL of the web page to fetch" }),
  raw: Type.Optional(Type.Boolean({ description: "If true, return raw HTML instead of cleaned text. Default: false" })),
  maxLength: Type.Optional(Type.Number({ description: "Maximum character length of returned content. Default: 20000" })),
});

interface ScrapeInput {
  url: string;
  raw?: boolean;
  maxLength?: number;
}

// ── User-Agent rotation ─────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── HTML → clean text conversion ────────────────────────────────────────

/**
 * Convert HTML to readable plain text.
 *
 * Strategy (zero dependencies):
 * 1. Remove <script>, <style>, <noscript>, <svg>, <nav>, <footer>, <header> blocks entirely
 * 2. Replace block-level tags with newlines
 * 3. Strip remaining HTML tags
 * 4. Decode common HTML entities
 * 5. Collapse whitespace
 */
function htmlToText(html: string): string {
  let text = html;

  // 1. Remove entire blocks that never contain useful content
  // Use case-insensitive, dotAll matching
  text = text.replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, "");
  text = text.replace(/<style[\s>][\s\S]*?<\/style\s*>/gi, "");
  text = text.replace(/<noscript[\s>][\s\S]*?<\/noscript\s*>/gi, "");
  text = text.replace(/<svg[\s>][\s\S]*?<\/svg\s*>/gi, "");
  text = text.replace(/<nav[\s>][\s\S]*?<\/nav\s*>/gi, "");
  text = text.replace(/<footer[\s>][\s\S]*?<\/footer\s*>/gi, "");

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Block-level tags → newlines (headings, paragraphs, divs, list items, etc.)
  text = text.replace(/<\/?(?:div|p|br|hr|h[1-6]|li|ul|ol|table|tr|blockquote|section|article|aside|main|figure|figcaption|details|summary)\b[^>]*>/gi, "\n");

  // Table cells → tab separator
  text = text.replace(/<\/?(?:td|th)\b[^>]*>/gi, "\t");

  // 3. Extract link hrefs for context (turns <a href="url">text</a> → text [url])
  text = text.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, (_, href, inner) => {
    const cleanInner = inner.replace(/<[^>]*>/g, "").trim();
    // Only append URL if it looks useful (not javascript:, #, or empty)
    if (href && !href.startsWith("#") && !href.startsWith("javascript:") && cleanInner) {
      return `${cleanInner} [${href}]`;
    }
    return cleanInner;
  });

  // 4. Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // 5. Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // 6. Collapse whitespace: multiple blank lines → max 2 newlines, trailing spaces
  text = text.replace(/[ \t]+/g, " "); // horizontal whitespace collapse
  text = text.replace(/ *\n */g, "\n"); // trim spaces around newlines
  text = text.replace(/\n{3,}/g, "\n\n"); // collapse multiple blank lines

  return text.trim();
}

// ── Fetch with retries and proper headers ───────────────────────────────

interface FetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string;
  url: string; // final URL after redirects
  body: string;
  redirected: boolean;
}

async function robustFetch(url: string, timeoutMs: number = 15000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": randomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity", // Avoid compressed responses that need decompression
        "Cache-Control": "no-cache",
        "DNT": "1",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType,
      url: response.url,
      body,
      redirected: response.redirected,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Tool options ────────────────────────────────────────────────────────

export interface ScrapeToolOptions {
  /** Request timeout in milliseconds. Default: 15000 (15s). */
  timeoutMs?: number;
  /** Maximum response body size in characters before truncation. Default: 200000. */
  maxBodyLength?: number;
  /** Default max length returned to agent. Default: 20000. */
  defaultMaxLength?: number;
}

// ── Tool factory ────────────────────────────────────────────────────────

export function createScrapeTool(options: ScrapeToolOptions = {}): AgentTool {
  const {
    timeoutMs = 15000,
    maxBodyLength = 200_000,
    defaultMaxLength = 20_000,
  } = options;

  return {
    name: "scrape_webpage",
    label: "Scrape Webpage",
    description:
      "Fetch a web page and return its content as clean text (HTML tags, scripts, and styles removed). " +
      "Handles redirects, sets proper User-Agent headers to avoid 403 bot-detection blocks. " +
      "Use this instead of curl for reading web pages. " +
      "Set raw=true to get raw HTML if you need to parse specific elements.",
    parameters: ScrapeParams,
    execute: async (_id, _params) => {
      const params = _params as ScrapeInput;
      const maxLen = params.maxLength ?? defaultMaxLength;

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(params.url);
      } catch {
        return textResult(`Error: Invalid URL "${params.url}". Provide a full URL starting with http:// or https://`);
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return textResult(`Error: Only http:// and https:// URLs are supported. Got: ${parsedUrl.protocol}`);
      }

      try {
        const result = await robustFetch(params.url, timeoutMs);

        // Build metadata header
        const meta: string[] = [];
        meta.push(`URL: ${result.url}`);
        meta.push(`Status: ${result.status} ${result.statusText}`);
        if (result.redirected) {
          meta.push(`Redirected: yes (from ${params.url})`);
        }
        meta.push(`Content-Type: ${result.contentType}`);

        if (!result.ok) {
          // Still return body for non-200 responses (useful for debugging)
          const bodyPreview = result.body.slice(0, 2000);
          meta.push(`\n--- Response Body (error) ---\n${bodyPreview}`);
          return textResult(meta.join("\n"));
        }

        // Truncate excessively large responses before processing
        let body = result.body;
        if (body.length > maxBodyLength) {
          body = body.slice(0, maxBodyLength);
          meta.push(`Warning: Response truncated from ${result.body.length.toLocaleString()} to ${maxBodyLength.toLocaleString()} chars before processing`);
        }

        // Convert HTML to text (unless raw requested or non-HTML content)
        const isHtml = result.contentType.includes("html");
        let content: string;

        if (params.raw || !isHtml) {
          content = body;
        } else {
          content = htmlToText(body);
        }

        // Apply agent-facing length limit
        let truncated = false;
        if (content.length > maxLen) {
          content = content.slice(0, maxLen);
          truncated = true;
        }

        const header = meta.join("\n");
        const separator = "\n\n--- Content ---\n\n";
        const footer = truncated
          ? `\n\n--- Truncated at ${maxLen.toLocaleString()} chars (use maxLength parameter for more) ---`
          : "";

        return textResult(header + separator + content + footer);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        // Provide actionable hints for common failures
        if (msg.includes("abort") || msg.includes("AbortError")) {
          return textResult(`Error: Request timed out after ${timeoutMs}ms for ${params.url}. The site may be slow or blocking automated requests.`);
        }
        if (msg.includes("ENOTFOUND")) {
          return textResult(`Error: DNS resolution failed for ${params.url}. Check the URL for typos.`);
        }
        if (msg.includes("ECONNREFUSED")) {
          return textResult(`Error: Connection refused by ${params.url}. The server may be down.`);
        }
        if (msg.includes("ETIMEDOUT")) {
          return textResult(`Error: Connection timed out for ${params.url}. The server may not support IPv6 — this is a known issue in this environment.`);
        }

        return textResult(`Error fetching ${params.url}: ${msg}`);
      }
    },
  };
}
