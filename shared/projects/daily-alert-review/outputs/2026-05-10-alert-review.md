# Daily Alert Review — 2026-05-10

**Period**: 2026-05-09 00:00 UTC → 2026-05-10 01:00 UTC
**Total alerts**: 39 (down from 56 yesterday)
**Resolved**: 37 (95%)
**Unresolved**: 2

## Unresolved Alerts

| # | Metric | Message | Open Since |
|---|--------|---------|------------|
| 273 | project.iterations-24h | Below threshold: current=0, threshold=1 | 2026-05-09 ~20:30 |
| 272 | capability.message-conversation-close-rate | Below threshold: current=0, threshold=0.02 | 2026-05-09 ~20:16 |

**Assessment**: Both unresolved alerts fired during overnight low-activity period. `project.iterations-24h` at 0 is expected overnight — threshold may need time-of-day awareness. `message-conversation-close-rate` at 0 reflects no message activity overnight.

## Top Noise Sources (repeat firings)

| Metric | Fires | % of Total | Trend vs Yesterday |
|--------|-------|------------|-------------------|
| session.failed-triage-rate-3h | 6 | 15% | — |
| project.invalid-format-count | 6 | 15% | ↓ (was 43%) |
| metric.stale-active-count | 4 | 10% | — |
| capability.message-conversation-close-rate | 4 | 10% | — |
| project.blocked-count | 3 | 8% | new |

**Key improvement**: `project.invalid-format-count` dropped from 24 fires (43% of yesterday's 56) to 6 fires (15% of today's 39). Still noisy but trending in the right direction.

## Notable Incidents

### 1. Zero-op session errors spike (#247)
- **What**: 42 zero-op session errors in 1h (threshold: 0)
- **Resolved**: Yes, within ~4 min
- **Root cause**: Likely transient provider issue — correlated with first-turn provider errors (#248, 12 errors) and empty assistant stops (#249, 23 stops)
- **Recommendation**: These three metrics appear correlated; consider a composite "provider health" alert instead of 3 separate ones

### 2. LLM evaluation lag at 66h (#241)
- **What**: No non-heuristic eval in 66 hours (threshold: 4h)
- **Resolved**: Yes
- **Root cause**: Evaluator may not be running LLM evals regularly
- **Recommendation**: This has been a recurring theme — evaluator scheduling needs attention

### 3. Status/reality mismatches at 8 (#251)
- **What**: 8 metrics have status that doesn't match reality (threshold: 3)
- **Resolved**: Yes
- **Root cause**: Metric statuses drifting from actual values

## Systemic Patterns

1. **Flappy alerts**: `session.failed-triage-rate-3h` (6 fires), `project.invalid-format-count` (6 fires), and `metric.stale-active-count` (4 fires) are firing and resolving repeatedly. These need either hysteresis/cooldown periods or threshold adjustments.

2. **Overnight false positives**: `project.iterations-24h` and `message-conversation-close-rate` alert overnight when activity is naturally zero. **Recommendation**: Add time-of-day suppression (e.g., suppress 00:00–08:00 UTC) or increase measurement window.

3. **Provider error correlation**: Alerts 247–249 (zero-op errors, first-turn errors, empty assistant stops) all fired within a 1h window, suggesting a single provider outage. Consolidating into one composite alert would reduce noise by ~8%.

## Threshold Recommendations

| Metric | Current Threshold | Suggested | Rationale |
|--------|-------------------|-----------|-----------|
| project.invalid-format-count | 0 | 1 | Minor format issues self-resolve; 0 is too strict |
| session.failed-triage-rate-3h | 0.8 | 0.6 | Fires too often at 0.8, most resolve quickly |
| project.iterations-24h | 1 | 0 (overnight) | Zero iterations overnight is normal |

## Summary

39 alerts today (down 30% from 56). The `project.invalid-format-count` noise problem is improving significantly. Two alerts remain unresolved but are overnight low-activity artifacts. The main actionable finding is the correlated provider error cluster and the ongoing flappy alert pattern in 3 metrics that need cooldown logic.
