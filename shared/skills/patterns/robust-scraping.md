# Robust Web Scraping

## Context
Extract structured data from a web page when you need fresh, external information.
Use when the data isn't available in existing knowledge files and must be fetched live.

## Agents Involved
- **May** — dispatches and tracks
- **Scout** — executes the scraping via `scrape_webpage` tool

## Steps
1. **Check knowledge first.** Search `agents/shared/knowledge-index.md` and
   Scout's existing workspace for cached results before scraping.
2. **Dispatch to Scout** with a clear task:
   - Target URL(s)
   - What data to extract (be specific: "the title, author list, and abstract")
   - Output file path (e.g., `agents/scout/workspace/scraped-<topic>.md`)
3. **Scout scrapes** using `scrape_webpage` tool with appropriate selectors.
4. **Scout validates** the output — checks for empty results, error pages, or
   rate-limiting indicators. If the page blocks scraping, try:
   - A different URL (cached version, API endpoint, alternate source)
   - Simplified extraction (raw text instead of structured selectors)
5. **Scout writes results** to the specified output file.
6. **May reads results** and routes to the next step (synthesis, analysis, etc.).

## Key Lessons
- Always specify an output file path — don't rely on Scout returning data in-session.
- Web pages change. If scraping fails, the first instinct should be "try a different source" not "retry the same URL harder."
- For multi-page scraping, dispatch one page per Scout task to parallelize.
- Check if the data is available via an API before scraping HTML.
