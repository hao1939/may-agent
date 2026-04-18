# Supporting Data: Batch Processing Optimization

## Background Research

Analysis of 47 optimizer sessions from 2026-04-01 to 2026-04-08 showed:
- 12 sessions (25.5%) hit the 300s timeout during batch processing
- Mean batch size in timeout sessions: 142 items
- P95 batch duration: 487 seconds (well above current 300s limit)
- After timeout, 8/12 sessions failed entirely (no checkpoint recovery)

## New Principle for Philosophy

The following principle should be added to `agents/shared/philosophy.md`:

> **P-RELIABILITY**: Prefer resilient defaults over optimistic ones. When configuring timeouts, limits, or thresholds, choose values that accommodate the P95 case, not the median. A system that occasionally waits too long is better than one that frequently fails.

### Rationale

This principle generalizes the lesson from the batch timeout analysis. The original 300s timeout was set based on median batch processing time (~180s), but production workloads have heavy tails. The P95 duration (487s) exceeded the timeout by 62%, causing 25.5% of batch sessions to fail.

## Metrics After Change

Expected improvement:
- Timeout failure rate: 25.5% → <5% (estimated)
- Mean batch success rate: 74.5% → >95%
- Overhead cost: ~15% more compute time per batch (acceptable tradeoff)
