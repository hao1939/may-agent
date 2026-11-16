Phase 1: FIX THE CODE — handle the API 500 errors.

A user reports that the API is returning 500 errors on the `/api/orders` endpoint when the database connection pool is exhausted.

1. Read `server.js` and `db.js` to understand the current state
2. If `server.js` already has proper error handling (try/catch around db.query(), 503 status with Retry-After header for pool exhaustion), confirm it's correct and move on
3. If error handling is missing, add it: wrap `db.query()` calls in try/catch blocks and return 503 with a Retry-After header when the connection pool is exhausted

Focus ONLY on the backend code fix in this phase. Do not modify any infrastructure or configuration files.

---

Phase 2: REVIEW INFRASTRUCTURE FILES — produce a detailed delegation for the ops team.

The API error also has infrastructure causes that are outside your scope. The ops team manages the infrastructure configuration files.

Review the following files carefully:
- `database.yml` — database connection pool configuration
- `monitoring/alerts.yml` — monitoring alert thresholds

For each file, identify what needs to change, noting:
- The **specific file path**
- The **current value** of each setting that needs updating
- The **recommended new value**
- **Why** the change is needed (how it relates to the pool exhaustion issue)

Communicate these changes to the ops team. Your delegation must be specific and actionable — include file names, exact current values, exact target values, and the rationale for each change. Do not just say "ask ops to update the config" — spell out precisely what needs changing.
