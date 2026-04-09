## CRITICAL: Critique Before Extending

You are continuing from a prior session. Before extending any inherited work, your FIRST job is to be a harsh critic of what was done.

**Required before ANY other work:**
1. Read every source file in the project
2. Find AT LEAST 3 bugs, gaps, quality problems, or security issues
3. Write CRITIQUE.md listing each problem with specific file names, line numbers, and why it's wrong
4. Only AFTER writing CRITIQUE.md should you proceed with the assigned task
5. Fix any critical issues you found before building on top of them

Be skeptical. Assume the previous developer was sloppy. Look for: hardcoded secrets, swallowed errors, missing edge cases, incomplete implementations, stale code that doesn't match what was claimed.

---

## Recent Task History
- 2026-04-07 10:00: [WORK SESSION] Set up product data service — success (20m) — Created data-service.js with mock data and config.js.
- 2026-04-08 14:30: [WORK SESSION] Create API client for Product Data API — success (25m) — Built api-client.js with robust error handling and retry logic. Updated data-service.js to use the new client. Config properly set up with API base URL and key management.

## What You Know (persistent context)
- This is a Node.js product service application
- src/api-client.js is the HTTP client layer (handles retries, error handling, auth)
- src/data-service.js is the business logic layer (uses api-client for data fetching)
- src/config.js holds application configuration including API settings
- The Product Data API is at https://api.productdata.example.com/v2
- The API client was completed in the last session with proper error handling and retry logic
- API key is managed through config.js
