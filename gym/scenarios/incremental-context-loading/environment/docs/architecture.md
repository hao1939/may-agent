# Service Architecture

## Overview

This document describes the architecture of the Analytics Dashboard Service (ADS).
The service is a Node.js application that processes analytics events in real-time
and serves aggregated metrics to a React-based dashboard frontend.

## System Components

### 1. Event Ingestion Layer

The event ingestion layer accepts analytics events via HTTP POST requests.
Events are validated against a JSON schema, then enqueued in a Redis-backed
message queue for asynchronous processing.

Key components:
- `src/server.js` — Express HTTP server, handles incoming requests
- `src/validators/event-schema.js` — JSON Schema validation for events
- `src/queue/publisher.js` — Redis queue publisher

### 2. Processing Pipeline

Events are consumed from the queue by worker processes. Each worker runs
a multi-stage pipeline:

1. **Deduplication** — Events with duplicate IDs (within a 1-hour window) are dropped
2. **Enrichment** — Events are enriched with geo-IP data, user-agent parsing, etc.
3. **Aggregation** — Events are rolled up into per-minute metric buckets
4. **Storage** — Aggregated metrics are written to PostgreSQL

Key components:
- `src/workers/consumer.js` — Queue consumer that drives the pipeline
- `src/pipeline/dedup.js` — Deduplication stage
- `src/pipeline/enrichment.js` — Event enrichment
- `src/pipeline/aggregation.js` — Time-bucket aggregation
- `src/database.js` — PostgreSQL connection pool and query helpers

### 3. Caching Layer

The caching layer sits between the API and the database. When dashboard
requests come in for metrics, the cache is checked first. If the data is
present and fresh (within TTL), it's returned without a database query.

Key components:
- `src/cache.js` — Cache manager with TTL-based eviction
- `src/cache/redis-adapter.js` — Redis-backed cache storage

Cache behavior:
- Default TTL: 60 seconds for real-time metrics
- Extended TTL: 300 seconds for historical aggregations
- Cache keys: `metric:{name}:{granularity}:{timestamp}`
- Eviction: LRU with max 10,000 entries

### 4. API Layer

The API layer serves RESTful endpoints for the dashboard frontend.
All endpoints require authentication via JWT tokens.

Endpoints:
- `GET /api/metrics/:name` — Get a specific metric's current value
- `GET /api/metrics/:name/history` — Get time series data
- `GET /api/dashboard/summary` — Get aggregated dashboard summary
- `POST /api/events` — Submit analytics events

### 5. Database Schema

The PostgreSQL database uses the following tables:

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    INDEX idx_events_type (event_type),
    INDEX idx_events_timestamp (timestamp)
);

CREATE TABLE metric_buckets (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(200) NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    bucket_end TIMESTAMPTZ NOT NULL,
    granularity VARCHAR(20) NOT NULL,
    value NUMERIC NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (metric_name, bucket_start, granularity)
);

CREATE TABLE cache_metadata (
    cache_key VARCHAR(500) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0
);
```

## Configuration

The service is configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP server port |
| REDIS_URL | redis://localhost:6379 | Redis connection URL |
| DATABASE_URL | (required) | PostgreSQL connection URL |
| JWT_SECRET | (required) | Secret for JWT token verification |
| CACHE_TTL | 60 | Default cache TTL in seconds |
| CACHE_MAX_ENTRIES | 10000 | Maximum cache entries |
| WORKER_CONCURRENCY | 4 | Number of pipeline workers |
| LOG_LEVEL | info | Logging level |
| DEDUP_WINDOW | 3600 | Deduplication window in seconds |
| METRIC_GRANULARITIES | 1m,5m,1h,1d | Supported metric granularities |

## Deployment

The service runs in Docker containers orchestrated by Kubernetes:

- 2 replicas of the web server (for API and event ingestion)
- 4 replicas of the worker (for event processing)
- 1 Redis instance (for queue and cache)
- 1 PostgreSQL instance (with streaming replication)

### Health Checks

- Liveness: `GET /health` — returns 200 if the process is running
- Readiness: `GET /health/ready` — returns 200 if Redis and PostgreSQL are connected

### Monitoring

The service exposes Prometheus metrics at `/metrics`:
- `ads_events_received_total` — Total events received
- `ads_events_processed_total` — Total events processed
- `ads_cache_hits_total` — Cache hit count
- `ads_cache_misses_total` — Cache miss count
- `ads_api_latency_seconds` — API response latency histogram
- `ads_queue_depth` — Current queue depth

## Error Handling

### Retry Strategy

Failed database writes are retried with exponential backoff:
- Initial delay: 100ms
- Max delay: 30 seconds
- Max retries: 5
- Jitter: ±25%

Failed queue operations trigger a circuit breaker:
- Failure threshold: 5 consecutive failures
- Recovery timeout: 60 seconds
- Half-open: 1 request allowed to test recovery

### Dead Letter Queue

Events that fail all retry attempts are moved to a dead letter queue
for manual review. The DLQ is checked daily by an automated job that
either reprocesses recoverable events or marks them as permanently failed.

## Security

### Authentication

All API endpoints (except /health) require a valid JWT token in the
Authorization header. Tokens are issued by an external identity provider
and verified using the configured JWT_SECRET.

### Rate Limiting

API requests are rate-limited per user:
- Default: 100 requests per minute per user
- Burst: 20 requests in 1 second
- Rate limit headers are included in all responses

### Input Validation

All event payloads are validated against a strict JSON schema.
Maximum payload size: 1MB. Fields are sanitized to prevent injection.

## Performance Considerations

### Database Connection Pool

The PostgreSQL connection pool is configured with:
- Min connections: 2
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds

### Cache Performance

The cache layer is critical for dashboard performance. Without caching,
each dashboard load would trigger 10-20 database queries. With caching:
- P50 response time: 5ms (cache hit) vs 150ms (cache miss)
- P99 response time: 25ms (cache hit) vs 500ms (cache miss)
- Cache hit ratio target: >85%

### Known Performance Issues

- The cache eviction algorithm currently scans all entries to find LRU
  candidates. This is O(n) and becomes slow when the cache is full.
  A heap-based eviction would be O(log n).
- The aggregation pipeline processes events one at a time. Batch processing
  would reduce database round-trips.
- Connection pool exhaustion under load spikes has been observed. The pool
  may need dynamic sizing.

## Development

### Running Locally

```bash
docker-compose up -d redis postgres
npm install
npm run migrate
npm start
```

### Running Tests

```bash
npm test                    # Unit tests
npm run test:integration    # Integration tests (requires Docker)
npm run test:load          # Load tests
```

### Code Style

- ESLint with standard config
- Prettier for formatting
- JSDoc comments for all public functions
- No TypeScript (pure JavaScript with JSDoc types)
