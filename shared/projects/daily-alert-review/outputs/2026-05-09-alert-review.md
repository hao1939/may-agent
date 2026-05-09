# Daily Alert Review — 2026-05-09

**Period:** Last 24 hours | **Total alerts:** 50 | **Unresolved:** 3

## Summary

| Metric | Alerts | Resolved | Open | Owner | Priority |
|--------|--------|----------|------|-------|----------|
| project.invalid-format-count | 20 | 20 | 0 | may | P1 |
| session.failed-triage-rate-3h | 6 | 6 | 0 | evaluator | P1 |
| scout.good-session-rate-24h | 6 | 5 | **1** | scout | P3 |
| evaluator.false-good-rate-sample | 5 | 5 | 0 | evaluator | P2 |
| metric.stale-active-count | 3 | 3 | 0 | may | P1 |
| evaluator.low-quality-rate-24h | 3 | 2 | **1** | evaluator | P2 |
| capability.process-uptime-h | 2 | 2 | 0 | may | P3 |
| scout.operational-friction-rate-24h | 1 | 0 | **1** | scout | P3 |
| v2.spec-coverage-rate | 1 | 1 | 0 | may | P2 |
| evaluator.triage-closure-rate-24h | 1 | 1 | 0 | evaluator | P2 |
| evaluator.meaningful-review-rate-24h | 1 | 1 | 0 | evaluator | P2 |
| capability.self-directed-iteration-rate-24h | 1 | 1 | 0 | may | P2 |

## Top Issues

### 1. 🔴 project.invalid-format-count — 20 alerts (P1, all resolved)
**Owner:** may | **Pattern:** Highly flapping — fires and self-resolves repeatedly (~every 30-60 min)  
**Current value:** 0 (at target)  
**Assessment:** This metric is extremely noisy. The threshold is 0, meaning any single invalid project.md triggers an alert that auto-resolves once fixed. **Recommend raising the threshold or adding a cooldown** to reduce noise.

### 2. 🟡 session.failed-triage-rate-3h — 6 alerts (P1, all resolved)
**Owner:** evaluator | **Current value:** 1.0 (at target)  
**Assessment:** Intermittent dips below 0.8 threshold, always self-correcting. Suggests evaluator occasionally falls behind on triage but catches up within ~5 minutes.

### 3. 🟡 evaluator.false-good-rate-sample — 5 alerts (P2, all resolved)
**Owner:** evaluator | **Current value:** 0.41 (threshold 0.6, target 0.05)  
**Assessment:** The current value (0.41) is still far from target. The alert threshold was recently changed from 0.2 to 0.6, masking the underlying issue. **41% of "good" evaluations are being overturned** — evaluator quality calibration needs attention.

### 4. 🔴 scout.good-session-rate-24h — 6 alerts, **1 OPEN** (P3)
**Owner:** scout | **Current value:** 0.28 (threshold 0.65, target 0.85)  
**Assessment:** Significantly below target. Only 28% of scout sessions rated good. This is a persistent, worsening trend (was 0.65 earlier in the period, now 0.28). **Scout session quality is the most concerning systemic issue.**

### 5. 🔴 evaluator.low-quality-rate-24h — 3 alerts, **1 OPEN** (P2)
**Owner:** evaluator | **Current value:** 0.68 (threshold 0.3, target 0.1)  
**Assessment:** 68% of evaluated sessions are needs-improvement/low-score. Corroborates the scout quality issue above.

### 6. 🔴 scout.operational-friction-rate-24h — 1 alert, **1 OPEN** (P3)
**Owner:** scout | **Current value:** 0.72 (threshold 0.3, target 0.1)  
**Assessment:** 72% operational friction rate. Scouts are hitting operational issues (tooling, infra, config) rather than doing productive work.

## Open Alerts Requiring Attention

| # | Metric | Current | Target | Owner | Action Needed |
|---|--------|---------|--------|-------|---------------|
| 225 | scout.good-session-rate-24h | 0.28 | 0.85 | scout | Investigate root cause of low session quality |
| 195 | evaluator.low-quality-rate-24h | 0.68 | 0.10 | evaluator | Related to scout quality; may resolve with scout fixes |
| 197 | scout.operational-friction-rate-24h | 0.72 | 0.10 | scout | Identify and fix top friction sources |

## Recommendations

1. **Reduce noise from `project.invalid-format-count`**: 20 alerts/day for a self-healing issue is excessive. Add debounce/cooldown or raise threshold to ≥1.
2. **Investigate scout operational friction (0.72)**: This is likely the root cause of low scout quality. If 72% of sessions hit operational issues, fixing those will improve the good-session rate.
3. **Evaluator calibration**: False-good rate at 41% suggests the evaluator's "good" criteria is too lenient. Review evaluation rubric.
4. **Priority mismatch**: Scout metrics are P3 but represent the most impactful systemic issues. Consider elevating priority.
