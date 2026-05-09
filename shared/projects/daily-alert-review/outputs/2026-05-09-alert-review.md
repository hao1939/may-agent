# 📊 Daily Alert Review — 2026-05-09

**Period**: 2026-05-08 09:30 UTC → 2026-05-09 09:30 UTC  
**Total alerts**: 56 (53 resolved, 3 unresolved)

## Fired (56 alerts)

### project.invalid-format-count — 24 firings (43% of all alerts) 🔴 NOISY
- Threshold: >0 → alert. Fires every time any project.md has a formatting issue.
- All 24 resolved automatically (self-healing or agent fixes).
- **This is the #1 noise source**, same as last report. Each firing resolves in ~5-15 min.

### session.failed-triage-rate-3h — 8 firings
- Threshold: <0.8 triage rate. Values ranged 0.46–0.75.
- All resolved. Flickers around threshold repeatedly throughout the day.
- Pattern: rate dips during low-volume periods when a single untriaged session tanks the ratio.

### scout.good-session-rate-24h — 6 firings
- Good session rate dropped as low as 0.25 (target 0.85, threshold 0.65).
- 1 still **unresolved** (id 225, current=0.2542). Significant quality concern.

### evaluator.false-good-rate-sample — 5 firings
- Rate spiked to 0.47–0.60 (threshold 0.20, target 0.05).
- All resolved. Evaluator was marking sessions "good" that were later overturned.
- Indicates evaluator quality calibration issues.

### metric.stale-active-count — 4 firings
- Stale metrics accumulate periodically. All resolved.

### One-off alerts (all resolved)
- `session.empty-assistant-stop-count-1h`: 23 empty stops (threshold 15) → resolved
- `session.first-turn-error-count-1h`: 12 provider errors (threshold 10) → resolved
- `session.zero-op-error-count-1h`: 42 zero-op errors (threshold 0) → resolved
- `eval.llm-coverage-lag-h`: 65.9h lag (threshold 4h) → resolved
- `evaluator.triage-closure-rate-24h`: 50% (threshold 70%) → resolved
- `evaluator.meaningful-review-rate-24h`: 50% (threshold 70%) → resolved
- `capability.status-reality-mismatch-count`: 8 mismatches (threshold 3) → resolved

## Unresolved (3)

| ID | Metric | Message | Since |
|----|--------|---------|-------|
| 253 | v2.heartbeat-decision-rate | current=0, threshold=0.8 | 09:23 UTC |
| 250 | v2.spec-coverage-rate | current=0.5455, threshold=0.8 | 09:12 UTC |
| 225 | scout.good-session-rate-24h | current=0.2542, threshold=0.65 | ~28h ago |

- **v2.heartbeat-decision-rate** and **v2.spec-coverage-rate**: Both v2 metrics are new and may not have enough data yet. Need investigation into whether v2 measurement pipeline is running.
- **scout.good-session-rate-24h**: Open for ~28h. Only 25% of sessions rated "good" — well below 65% threshold. This is the most concerning unresolved alert.

## Pushback — Threshold Recommendations

| Metric | Current Threshold | Firings/24h | Recommendation |
|--------|------------------|-------------|----------------|
| project.invalid-format-count | >0 | 24 | **Raise to ≥3**. Single transient format errors self-resolve in minutes. Threshold of 0 creates 43% of all alert noise. |
| session.failed-triage-rate-3h | <0.8 | 8 | **Lower to 0.6** or use minimum sample size (e.g., ignore when <5 sessions in window). Flickering around threshold during low-volume periods. |

These two metrics account for **32 of 56 alerts (57%)** — consistent with iteration 1 finding that ~50% of alerts are noise from 2 metrics.

## Patterns

1. **Alert volume down from 244 → 56** compared to the period analyzed in iteration 1. Significant improvement, but still noisy.
2. **project.invalid-format-count remains the top noise source** (24/56 = 43%). No action taken since last report's recommendation.
3. **Evaluator quality is a systemic concern**: false-good-rate hit 60%, scout good-session-rate at 25%. The evaluation pipeline is not accurately judging session quality.
4. **Session quality declining**: scout.good-session-rate-24h has been persistently below threshold, dropping from ~0.64 to 0.25 over the period. This may indicate a real degradation in agent output quality or a miscalibrated evaluator — needs investigation.
5. **v2 metrics are new and cold-starting**: two v2 alerts opened but may just need pipeline warmup time.

## Action Items

1. **Urgent**: Investigate why scout.good-session-rate is at 25% — is this real quality degradation or evaluator miscalibration?
2. **Reduce noise**: Adjust `project.invalid-format-count` threshold from 0→3 and `session.failed-triage-rate-3h` threshold from 0.8→0.6 (or add minimum sample size).
3. **Monitor**: v2 metric pipeline — confirm heartbeat-decision-rate and spec-coverage-rate are measuring correctly.
