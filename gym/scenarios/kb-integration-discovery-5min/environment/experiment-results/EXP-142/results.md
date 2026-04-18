# EXP-142: Cache-First Retrieval Strategy Validation

**Date**: 2026-04-08
**Status**: Complete
**Hypothesis**: H-042 (Cache-first retrieval reduces response latency)
**Prior Work**: EXP-127 (preliminary test), KE-017 (initial benchmarks), KE-023 (architecture pattern)

## Background and Motivation

The cache-first retrieval pattern has been discussed in the literature as a reliable
approach for reducing read-heavy workload latency. Our initial test (EXP-127) showed
promising results with a 45% latency reduction, but the sample size of N=50 was too
small for statistical significance.

This experiment was designed to provide definitive evidence. The experimental design
followed the protocol in KE-023 (cache-first architecture pattern), using the LRU
cache configuration recommended there.

### Relationship to Other Work

This experiment is part of a broader program of performance optimization research:

- **H-038** (Batch processing reduces error rate) — already validated in EXP-138. 
  The batch processing work reduced error rates by 34%, which was the motivation for
  testing whether cache-first could similarly improve latency. Note: H-038's batch
  approach is orthogonal to cache-first — they can be combined.

- **H-045** (Parallel writes improve throughput) — currently in testing phase. The
  parallel writes hypothesis is independent of cache-first but could interact: if
  both are deployed, the cache might need to handle invalidation from parallel writers.
  This is a known concern but NOT tested in EXP-142.

- **H-051** (Connection pooling reduces timeout errors) — low priority. Connection
  pooling is a separate optimization axis. Some overlap with cache-first since both
  address latency, but through different mechanisms.

- **KE-060** (Write parallelism preliminary data) — these results from EXP-139 showed
  a 20% throughput improvement. Not directly related to EXP-142 but worth cross-
  referencing in the future.

### Literature Context

Cache-first architectures have been widely studied:

- Smith et al. (2024) found 40-70% latency improvements for read-heavy workloads
- Johnson & Lee (2025) showed that LRU outperforms LFU for bursty access patterns
- The CloudCraft white paper (2025) documented cache warm-up periods of 50-200 requests

Our experiment aligns with these findings, particularly the warm-up period observation.

## Experimental Setup

### Test Configuration
- **Environment**: Staging cluster with 4 nodes (same as EXP-127)
- **Cache implementation**: In-memory LRU, max size 10,000 entries, TTL 300s
- **Workload**: 1,000 synthetic read requests with Zipf distribution (α=1.2)
- **Baseline**: Direct database queries (no cache)
- **Treatment**: Cache-first with database fallback
- **Measurement**: End-to-end latency per request, measured at client

### Request Distribution
The Zipf distribution was chosen to simulate realistic access patterns where a small
number of items receive disproportionate traffic:
- Top 10% of items: 67% of requests
- Top 50% of items: 94% of requests
- Bottom 50% of items: 6% of requests

This distribution is typical of production workloads based on our internal metrics
(see KE-015 for error rate baselines that used the same distribution).

### Warm-up Protocol
Following KE-023's recommendation, we allowed 100 warm-up requests before measurement.
The cache hit rate stabilized at approximately request 85, consistent with the
literature (CloudCraft 2025).

## Results

### Primary Finding: Latency Reduction

| Metric | Baseline | Cache-First | Change |
|--------|----------|-------------|--------|
| Mean latency | 340ms | 129ms | -62% |
| P50 latency | 310ms | 95ms | -69% |
| P99 latency | 890ms | 410ms | -54% |
| Max latency | 1,240ms | 870ms | -30% |

The mean latency reduction of 62% exceeds the 40% threshold specified in H-042.

### Secondary Finding: Cache Hit Rate

After warm-up, the cache achieved a 78% hit rate. This is higher than the 60-65%
predicted by the theoretical model in KE-023, likely due to the skewed access pattern.

Cache miss breakdown:
- Cold misses (first access): 12%
- Capacity misses (evicted): 7%
- TTL expiry misses: 3%

### Tertiary Finding: Resource Overhead

| Resource | Baseline | Cache-First | Change |
|----------|----------|-------------|--------|
| Memory | 512MB | 535MB | +23MB (+4.5%) |
| CPU (idle) | 2.1% | 2.3% | +0.2pp |
| CPU (load) | 45% | 38% | -7pp |

The 23MB memory overhead is well within acceptable bounds. The CPU reduction under
load is a bonus — fewer database queries means less CPU spent on query processing.

### Correctness Verification

We compared every cache response to the direct-query response for the same request:
- **Match rate**: 100% (1,000/1,000 requests)
- **No stale data issues**: TTL of 300s was conservative enough for our test duration
- **Note**: Production deployment should consider shorter TTL for frequently-updated data

## Statistical Analysis

### Hypothesis Test
- **Null hypothesis**: Cache-first does not reduce latency (μ_baseline = μ_cache)
- **Alternative**: Cache-first reduces latency by ≥40% (μ_cache ≤ 0.6 × μ_baseline)
- **Test**: One-sided Welch's t-test
- **Result**: t(1842) = 47.3, p < 0.001

### Effect Size
- **Cohen's d = 1.84** (large effect)
- **95% CI for latency reduction**: [58%, 66%]
- **Practical significance**: The lower bound (58%) exceeds our threshold of 40%

### Power Analysis
- **Achieved power**: >0.999 (overpowered — N=200 would have sufficed)
- **Minimum detectable effect at N=1000**: 5% latency change

## Discussion

### Comparison with EXP-127

| Metric | EXP-127 (N=50) | EXP-142 (N=1000) |
|--------|----------------|-------------------|
| Latency reduction | 45% | 62% |
| Cache hit rate | 65% | 78% |
| Statistical power | Low | >0.999 |
| Conclusion | Inconclusive | Strongly supported |

The higher latency reduction in EXP-142 is likely due to:
1. Larger sample allowing the cache to reach steady state
2. More realistic access pattern (Zipf vs. uniform in EXP-127)

### Implications for H-042

H-042 predicted "at least 40% latency reduction." The observed 62% reduction strongly
supports this hypothesis. We recommend:
- **Updating P(H-042)** from the current 0.35 to **0.72** (strong positive evidence)
- **Not 0.90+** because:
  - Only tested on staging, not production
  - Zipf distribution may overstate cache effectiveness for some workloads
  - Long-term cache invalidation patterns not tested

### Implications for KE-023

KE-023 (cache-first architecture pattern) described the approach as "TESTING." 
Given these results, the status should be updated to **VALIDATED** — the pattern
works as described, with performance matching or exceeding literature claims.

The validation date should be set to **2026-04-09** (date of analysis completion).

### Implications for Knowledge Base

Based on these results, the following KB updates are recommended:

1. **KE-017** (cache retrieval benchmarks): Update with EXP-142 findings — the initial
   benchmarks are now superseded by definitive results
2. **KE-023** (cache-first architecture pattern): Mark as VALIDATED
3. **H-042** (hypothesis): Update probability and evidence section
4. **INDEX.md**: Add new entry KE-071 for the validated retrieval pattern
5. **PRIORITY-TRACKER.md**: H-042 should be elevated to High Priority given strong evidence
6. **todo.md**: Mark EXP-142 integration as complete

### Limitations

1. **Staging only**: Results are from a 4-node staging cluster. Production has
   16 nodes and different traffic patterns.
2. **Read-only workload**: EXP-142 only tested reads. Mixed read-write workloads
   may see different cache performance due to invalidation overhead.
3. **Short duration**: Test ran for ~30 minutes. Long-running deployments may face
   cache drift, memory fragmentation, or GC pressure.
4. **No failure injection**: We didn't test behavior during node failures, which
   could cause cache inconsistencies.

## Conclusion

H-042 is strongly supported. Cache-first retrieval reduces average response latency
by 62% (95% CI: [58%, 66%], p < 0.001) with minimal resource overhead (23MB memory,
4.5% increase). The cache-first architecture pattern (KE-023) is validated.

## Raw Data

See `experiment-results/EXP-142/raw-data/` for:
- `latency-baseline.csv`: All 1,000 baseline measurements
- `latency-cache.csv`: All 1,000 cache-first measurements
- `cache-hits.log`: Hit/miss log for all requests
- `resource-monitor.csv`: CPU/memory samples at 1s intervals
