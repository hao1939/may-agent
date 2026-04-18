# Context Cache — Previous Session (s_prev_001)

This file records the files read in the previous session with their timestamps
and content summaries. Use this to decide what needs re-reading.

## Files Read

### docs/architecture.md
- **Last modified**: 1705286400 (2024-01-15T00:00:00Z)
- **Size**: 7536 bytes
- **Summary**: Architecture doc for Analytics Dashboard Service. Express server,
  Redis queue, PostgreSQL database. Key components: event ingestion layer,
  processing pipeline (dedup → enrich → aggregate → store), caching layer
  (TTL-based, LRU eviction, max 10k entries), API layer (JWT auth, rate limiting).
  Known perf issues: O(n) cache eviction, single-event processing, pool exhaustion.

### docs/api-reference.md
- **Last modified**: 1705286400 (2024-01-15T00:00:00Z)
- **Size**: 5836 bytes
- **Summary**: API reference. Endpoints: GET /api/metrics/:name, GET /api/metrics/:name/history,
  GET /api/dashboard/summary, POST /api/events. Rate limit: 100/min/user. Auth: JWT bearer tokens.
  Error format: {error: {code, message, details}}. Max 100 events per POST.

### src/server.js
- **Last modified**: 1705286400 (2024-01-15T00:00:00Z)
- **Size**: 10391 bytes
- **Summary**: Express HTTP server. Config from env vars. Redis + PG connections.
  JWT auth middleware, rate limiter (Redis-based, 100/min). Endpoints for metrics,
  history, dashboard summary, events. Queue-based event ingestion. Graceful shutdown.

### src/database.js
- **Last modified**: 1705286400 (2024-01-15T00:00:00Z)
- **Size**: 8802 bytes
- **Summary**: PostgreSQL module. Pool config (2-20 connections). Query helpers:
  getLatestMetric, getMetricHistory, upsertMetricBucket, insertEvent,
  markEventProcessed. Migration runner (3 migrations). Health check function.

### src/cache.js
- **Last modified**: 1705286400 (2024-01-15T00:00:00Z)
- **Size**: 4200 bytes (OUTDATED — file has been modified since this read)
- **Summary**: CacheManager class. Local Map + Redis backing. TTL-based expiration.
  LRU eviction using array-based access tracking. Stats tracking (hits/misses/evictions).
