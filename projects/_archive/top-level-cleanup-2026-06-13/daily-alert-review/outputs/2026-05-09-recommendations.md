# 🔧 Alert System Recommendations — 2026-05-09

Based on 3 days of alert reviews (iterations 1-3), here are concrete improvements.

## 1. Immediate Noise Reduction (57% of alerts are noise)

### `project.invalid-format-count` — 43% of all alerts
- **Problem**: Threshold=0 fires on every transient format error. All 24 firings self-resolved in minutes.
- **Fix**: Raise threshold to ≥3. A single project.md briefly malformed is not actionable.
- **Who**: Whoever owns metric definitions (likely in the metrics config/spec files).
- **Impact**: Eliminates ~24 alerts/day.

### `session.failed-triage-rate-3h` — 14% of all alerts
- **Problem**: Threshold=0.8 flickers during low-volume periods. 1 untriaged session out of 3 = 0.67 rate = alert.
- **Fix**: Either lower threshold to 0.6, or add a minimum sample size (require ≥5 sessions in window before alerting).
- **Who**: Same metric owner.
- **Impact**: Eliminates ~8 alerts/day.

## 2. Investigate: Scout Good Session Rate at 25%

This is the most concerning finding — open for 28+ hours.

**Two possible causes:**
1. **Real quality degradation**: Agent sessions are genuinely producing worse output. Look at recent session logs for patterns (more errors, less useful output).
2. **Evaluator miscalibration**: The evaluator's false-good-rate hit 60%, suggesting the evaluation pipeline itself is unreliable. The 25% "good" rate may reflect broken scoring, not broken agents.

**Who should investigate**: The evaluator/scout system owner. Start by sampling 10 recent "bad" sessions manually — are they actually bad?

## 3. v2 Metrics Cold-Start

`v2.heartbeat-decision-rate` (current=0) and `v2.spec-coverage-rate` (current=0.55) are newly deployed metrics. Both are below threshold but may just need pipeline warmup.

**Suggestion**: Add a grace period for new metrics — don't alert for the first 24h after a metric goes active, or until it has ≥N data points.

## 4. Process Improvement: Make This Recurring

The daily alert review should run automatically. Recommendations:
- Set up a cron job to produce this report daily at a consistent time (e.g., 10:00 UTC)
- Track threshold change recommendations as actionable tickets — none of the iteration 1 recommendations were acted on
- Add a "days since recommendation" counter to flag stale pushback items

## Summary Table

| Priority | Action | Owner | Expected Impact |
|----------|--------|-------|-----------------|
| P0 | Investigate scout good-session-rate 25% | evaluator/scout owner | Resolve persistent quality alert |
| P1 | Raise project.invalid-format-count threshold to ≥3 | metric config owner | -43% alert volume |
| P1 | Fix session.failed-triage-rate-3h (lower threshold or min sample) | metric config owner | -14% alert volume |
| P2 | Add grace period for new v2 metrics | metric system owner | Fewer false alerts during rollout |
| P2 | Automate daily review as cron job | may | Consistent daily reporting |
