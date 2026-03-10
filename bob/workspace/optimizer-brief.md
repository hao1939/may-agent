# STATUS: DONE (Implemented)

# Optimizer Brief: Implement Robust Scraping Tool

## 1. Context
**Issue:** Agents (Scout, Amy) are experiencing high failure rates when scraping modern websites (arXiv, XHS).
**Evidence:**
- Scout wasted ~38 calls ($4.85) retrying `curl` on arXiv due to bot detection/captchas.
- Amy struggles to extract content from JS-heavy pages using simple `fetch`.
- Current "manual" scraping (curl + grep) is fragile and violates **P17 (Offload to Infra)**.

## 2. Recommendation
**Implement a `scrape_webpage` tool.**

Move the complexity of HTTP headers, user-agent rotation, and DOM parsing out of the agent's prompt and into a deterministic tool.

**Requirements:**
1. **Tool Name:** `scrape_webpage`
2. **Input:** `url` (string)
3. **Behavior:**
   - Uses a robust fetcher (e.g., proper User-Agent headers to avoid 403s).
   - OPTIONAL: Basic DOM processing (e.g., `cheerio` or `jsdom`) to strip scripts/styles and return clean Markdown/Text.
   - Handles redirects and basic bot detection (where possible without full browser).
4. **Target Agents:** Add to `agents/scout/package.json` (or shared tools) and `agents/amy/package.json`.

## 3. Why This Matters
- **Efficiency:** Eliminates "try curl, fail, try wget, fail, try headers..." loops.
- **Reliability:** Scout can rely on data retrieval being a solved problem.
- **Philosophy:** Aligns with **P1 (Simplest Thing That Works)** and **P17 (Offload to Infra)**.

## 4. Action
Delegate to Tech Lead (via Optimizer) to implement `src/tools/scrape.ts` (or similar) and register it.
