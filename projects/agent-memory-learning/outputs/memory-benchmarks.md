# Memory System Benchmarks

## Retrieval Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Query latency (p50) | <50ms | Must not slow agent turns |
| Query latency (p99) | <200ms | Acceptable for cold cache |
| Storage per lesson | ~500 bytes | JSON + embedding vector |
| Max lessons per agent | 10,000 | ~5MB storage budget |
| Retrieval accuracy (top-5) | >80% | Relevant lesson in top 5 results |

## Storage Size Estimates

| Scale | Lessons | Raw Size | With Embeddings |
|-------|---------|----------|-----------------|
| Single agent, 1 week | ~50 | 25KB | 225KB |
| Single agent, 1 month | ~200 | 100KB | 900KB |
| All agents, 1 month | ~1,000 | 500KB | 4.5MB |
| All agents, 6 months | ~6,000 | 3MB | 27MB |

Embedding vectors assumed at 384 dimensions × 4 bytes = 1.5KB each.

## Query Patterns

### 1. Context-Match Query
- Input: Current task description (free text)
- Output: Top-5 lessons ranked by semantic similarity
- Expected latency: 20-40ms (in-memory index)

### 2. Category Filter
- Input: Category (fix|pattern|insight) + optional project filter
- Output: All matching lessons, newest first
- Expected latency: <10ms (indexed lookup)

### 3. Recency-Weighted Search
- Input: Query text + decay factor (default 0.95/day)
- Output: Lessons ranked by relevance × recency
- Expected latency: 30-50ms

## Benchmark Test Plan

1. **Load test**: Insert 10,000 lessons, measure insert throughput (target: >100/sec)
2. **Search test**: 1,000 random queries against 10K lessons, measure p50/p99 latency
3. **Accuracy test**: 50 hand-labeled query→lesson pairs, measure top-5 hit rate
4. **Concurrency test**: 10 parallel agents querying simultaneously, measure degradation

## Baseline Results (Projected)

Using flat JSON file with linear scan:
- 100 lessons: ~5ms query time ✅
- 1,000 lessons: ~50ms query time ⚠️ borderline
- 10,000 lessons: ~500ms query time ❌ too slow

**Recommendation**: Switch to SQLite FTS5 at ~500 lessons, or use in-memory vector index from the start for semantic search.
