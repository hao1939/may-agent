# KE-023: Cache-First Architecture Pattern

**Type**: Pattern
**Status**: VALIDATED
**Related**: H-042
**Created**: 2026-03-22
**Last Updated**: 2026-04-10

## Description
The cache-first architecture pattern involves placing an in-memory LRU cache in front of the primary data store. All read requests check the cache first; on miss, the query falls through to the database and the result is cached.

## Implementation Notes
- Use LRU eviction with configurable max size
- Cache TTL should be set based on data freshness requirements
- Warm-up period of ~100 requests before cache reaches steady-state hit rate

## Validation
- **Validated by EXP-142** (2026-04-08): 62% latency reduction, 78% cache hit rate, 100% correctness, 23MB memory overhead
- N=1,000 requests, Cohen's d=1.84, p<0.001
- See also: KE-071 (validated retrieval pattern details)
