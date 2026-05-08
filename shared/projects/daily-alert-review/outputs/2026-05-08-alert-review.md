# Daily Alert Review — 2026-05-08

**Period:** 2026-05-08 04:12 – 17:10 UTC  
**Total alerts:** 26  
**Unresolved:** 3

## Summary by Metric

| Metric | Alerts | Unresolved | Severity |
|--------|--------|------------|----------|
| project.invalid-format-count | 10 | 0 | Low (all self-resolved) |
| scout.good-session-rate-24h | 5 | 1 | **Medium** |
| metric.stale-active-count | 3 | 0 | Low (all self-resolved) |
| evaluator.low-quality-rate-24h | 3 | 1 | **High** |
| scout.operational-friction-rate-24h | 1 | 1 | **High** |
| v2.spec-coverage-rate | 1 | 0 | Medium (resolved) |
| capability.self-directed-iteration-rate-24h | 1 | 0 | Medium (resolved) |
| capability.process-uptime-h | 2 | 0 | Low (restarts, self-resolved) |
| session.failed-triage-rate-3h | 1 | 0 | Low (resolved) |

## Active/Unresolved Alerts (Require Attention)

### 1. evaluator.low-quality-rate-24h — 49.8% (threshold: 30%, target: 10%)
- **Since:** 07:28 UTC
- **Impact:** Nearly half of evaluated sessions are low-quality. This is the most critical systemic issue.
- **Recommendation:** Investigate common failure modes in recent evaluations. Consider tightening session guidance or adding pre-flight checks.

### 2. scout.operational-friction-rate-24h — 53.1% (threshold: 30%, target: 10%)
- **Since:** 08:03 UTC
- **Impact:** Over half of scout sessions hit operational friction (tooling issues, unclear context, etc).
- **Recommendation:** Review recent scout session logs for recurring friction patterns. May need tooling or documentation improvements.

### 3. scout.good-session-rate-24h — 46.9% (threshold: 65%, target: 85%)
- **Since:** 16:35 UTC
- **Impact:** Correlated with the above two — low quality + high friction = low good-session rate.
- **Recommendation:** This is a downstream symptom. Fixing #1 and #2 should improve this.

## Patterns & Observations

1. **project.invalid-format-count** fired 10 times but always self-resolved within minutes. This is a noisy alert — consider adding a debounce/cooldown or raising the threshold to reduce alert fatigue.

2. **Stale metrics** alerts (3 occurrences) also self-resolved quickly — likely transient during low-activity periods.

3. The three unresolved alerts are all interrelated quality/friction metrics and represent the primary systemic concern for the system today.

## Recommended Actions

- [ ] **P0:** Root-cause the 50% low-quality session rate — pull recent "needs-improvement" evaluations and categorize failure reasons
- [ ] **P1:** Audit scout operational friction — identify top friction sources (missing context? tool failures? unclear tasks?)
- [ ] **P2:** Add cooldown to `project.invalid-format-count` alert to reduce noise (10 alerts in 24h, all transient)
