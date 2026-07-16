# ProductSearch API — Cache Architecture

## Cache Module (`src/cache.js`)
In-memory cache with TTL-based expiration. Used by search and product APIs.

## Search Module (`src/search.js`)
Product search with caching. Index rebuilds hourly.

## Known Issue
The `evictStale()` function has timing issues — entries sometimes aren't evicted properly. Ops has a workaround (restart the service daily).
