# 📊 Alert Review Status Tracker — 2026-05-09 09:30 UTC

## Current Unresolved Alerts (3)

| Alert ID | Metric | Value | Duration Open | Severity |
|----------|--------|-------|---------------|----------|
| 253 | `v2.heartbeat-decision-rate` | 0 (threshold: 0.8) | 7 min | Low — new v2 metric, likely cold-start |
| 250 | `v2.spec-coverage-rate` | 0.55 (threshold: 0.8) | 17 min | Low — new v2 metric, improving |
| 225 | `scout.good-session-rate-24h` | 0.26 (threshold: 0.65) | **10+ hours** | **HIGH** — persistent quality concern |

## Recommendation Tracking

Status of recommendations from the 2026-05-09 review:

| # | Recommendation | Status | Notes |
|---|---------------|--------|-------|
| 1 | Raise `project.invalid-format-count` threshold to ≥3 | ❌ Not acted on | Still generating 24 alerts/day (43% of volume) |
| 2 | Fix `session.failed-triage-rate-3h` min sample or lower threshold | ❌ Not acted on | 8 alerts today, all self-resolved |
| 3 | Investigate scout good-session-rate at 25% | ❌ Not acted on | Alert 225 still open 10+ hours |
| 4 | Add grace period for new v2 metrics | ❌ Not acted on | 2 new v2 alerts now open |
| 5 | Automate daily review as cron | ❌ Not acted on | Still manual |

## Alert Volume Summary (24h window)

- **Total alerts**: 56
- **Self-resolved**: 53 (95%)
- **Still open**: 3 (5%)
- **Noise rate**: ~57% (project.invalid-format-count + session.failed-triage-rate-3h)

## Key Takeaway

The scout good-session-rate alert (ID 225) has been open for 10+ hours and is the only genuinely concerning signal. The evaluator false-good-rate alerts have resolved, suggesting evaluator recalibration may have happened. The two noise-reduction recommendations (threshold adjustments) would eliminate 32/56 alerts if implemented.

## Next Review

Next daily review should check:
1. Whether scout good-session-rate has recovered
2. Whether any threshold changes were applied
3. New alert patterns in the next 24h window
