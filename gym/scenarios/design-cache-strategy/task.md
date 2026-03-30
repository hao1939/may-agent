# Task: Add Caching to the Data Pipeline

The data pipeline in `pipeline.js` processes user analytics events. It currently
re-fetches user profiles from the "database" (a JSON file) on every event, which
is wasteful since many events come from the same users.

**Your task**: Design and implement a caching layer in `cache.js` that the pipeline
uses to avoid redundant lookups. The cache module must export:

- `get(key)` — returns cached value or `undefined`
- `set(key, value)` — stores a value
- `stats()` — returns `{ hits, misses, size }` object

Then update `pipeline.js` to use your cache instead of reading from the DB every time.

Run `node test.js` to verify your implementation passes all tests.

## Requirements

- Cache must handle at least 10,000 unique keys without issues
- Cache must not grow unboundedly (important for long-running processes)
- Cache hit rate should be > 60% on the test workload
- All existing tests must pass
- `cache.js` must be a new file you create

## Context

The test workload simulates 50,000 events from ~2,000 unique users following a
Zipf distribution (some users generate far more events than others). The pipeline
runs as a long-lived process in production.
