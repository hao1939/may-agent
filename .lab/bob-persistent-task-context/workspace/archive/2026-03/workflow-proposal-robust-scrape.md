# Workflow Proposal: Robust Web Scraping

## Problem
Agents (Scout, Amy) frequently fail when scraping modern web pages using `curl` or `fetch`.
- **Bot Detection**: Sites block simple HTTP clients.
- **Dynamic Content**: JS-rendered content is missing from raw HTML.
- **Fragile Parsers**: `grep` or `sed` on HTML is unreliable.

## Pattern Observed
- **Scout** wasted ~38 calls retrying a scrape on arXiv.
- **Amy** struggles with XHS content extraction.

## Proposal
Create a `scrape_url` tool or workflow that uses a headless browser (Puppeteer/Playwright) or a specialized API (ZenRows/ScrapingBee) to handle:
1. **JS Rendering**: Get the full DOM.
2. **Bot Evasion**: Handle headers, cookies, and challenges.
3. **Structured Output**: Return clean markdown or JSON, not raw HTML soup.

## Owner
Tech Lead (implementation)
Scout (primary user)
