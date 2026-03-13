---
description: Guide for scraping web content efficiently.
version: 1.0.0
tools:
  - scrape
---

# Skill: Web Scraping

## Context
You need to extract information from a URL. Do not use `curl` or `wget` — they are fragile and often blocked. Use the `scrape` tool.

## The `scrape` Tool
This tool handles headers, User-Agent rotation, and HTML cleaning for you.

### Usage
```json
{
  "name": "scrape",
  "arguments": {
    "url": "https://arxiv.org/abs/2603.05520"
  }
}
```

### When to use
- **Reading Papers**: Use `scrape` on the abstract page (not the PDF link).
- **Reading Docs**: Use `scrape` on documentation pages.
- **Reading News**: Use `scrape` on article pages.

### Handling Failures
If `scrape` fails (e.g., 403 Forbidden or CAPTCHA):
1. **Do NOT retry blindly.** The site has blocked us.
2. **Search for mirrors/alternatives.** (e.g., use a different paper aggregator or cached version).
3. **If critical**, ask a human to provide the content.

## Anti-Patterns
- ❌ `curl <url>` (Fragile, often blocked)
- ❌ `wget <url>` (Fragile)
- ❌ `fetch(<url>)` (No headers, no cleaning)
- ❌ Scraping a PDF directly (The tool expects HTML)
