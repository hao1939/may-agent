We have 3 production incidents that came in overnight. Please triage and fix them in order:

**Incident #1 (P1 — 3:42 AM)**: Memory leak in the cache module. The cache grows unbounded because `evictStale()` in `src/cache.js` has a bug — it only evicts entries older than 1 hour, but the TTL is set to 24 hours, so nothing gets evicted until entries are a day old. See `logs/incident-1.log`.

**Incident #2 (P2 — 4:15 AM)**: The `/api/search` endpoint returns stale results. Users report seeing yesterday's products. Investigation shows the search index rebuilds hourly but the cache (same `src/cache.js`) serves cached search results for 24 hours. See `logs/incident-2.log`.

**Incident #3 (P2 — 5:30 AM)**: Out of memory (OOM) kills on production. The monitoring dashboard shows memory climbing from 512MB to 4GB over 6 hours, then the process gets OOM-killed. See `logs/incident-3.log`. The ops team suspects the search index rebuild is leaking memory.

For each incident, write a brief triage note to `TRIAGE.md` explaining:
1. Root cause
2. Your fix
3. Whether it's related to the other incidents

Then fix the code. Tests are in `test/cache.test.js`.
