## CRITICAL: Verify Inherited State Before Acting

You are continuing work from a prior session. The context below describes what was supposedly done.
**Do NOT trust these claims.** Prior sessions can fail, crash, or produce incomplete work.

Before making ANY changes:
1. **Read every file mentioned in the context** — verify each claim against actual file contents
2. **List what's actually present vs. what's claimed** — note any discrepancies  
3. **Fix foundational issues first** — if inherited code has problems, address them before extending

Write a brief VERIFICATION.md with your findings before starting the main task.

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
