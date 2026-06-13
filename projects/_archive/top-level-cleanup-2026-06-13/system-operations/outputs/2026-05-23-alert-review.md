# Daily Alert Review — 2026-05-23

## Summary

| Metric | 24h Fires | Recoveries | Status |
|--------|-----------|------------|--------|
| project.owner-incomplete-count | 8 | 8 | ⚠️ Noisy |
| project.owner-judgment-needed-count | 8 | 8 | ⚠️ Noisy |
| project.health.finding-count | 8 | 8 | ⚠️ Noisy |
| session.failed-triage-rate-3h | 3 | 2 | 🔴 Open |
| session.provider-error-count-1h | 2 | 1 | ✅ Resolved |
| guard.triggered-count-24h | 2 | 2 | ✅ Resolved |
| session.first-turn-error-count-1h | 1 | 1 | ✅ Resolved |
| scout.sourced-artifacts-24h | 1 | 1 | ✅ Resolved |
| project.task-parser-error-count | 1 | 1 | ✅ Resolved |
| guard.warned-count-24h | 1 | 1 | ✅ Resolved |

**Total: 35 breaches, 33 recoveries, 12 alert_judged events**

## Unresolved Alerts

| ID | Metric | Since | Age | Message |
|----|--------|-------|-----|---------|
| 415 | scout.knowledge-preamble-coverage | 2026-05-20 | 3 days | Coverage 0.22, threshold 0.25, target 0.80 |
| 757 | session.failed-triage-rate-3h | 2026-05-23 | <1h | Rate 0.71, threshold 0.80, target 1.0 |

## 🚨 Critical Findings

### 1. Project Health Trio — Still Extremely Noisy (Day 4)

The three metrics `project.owner-incomplete-count`, `project.owner-judgment-needed-count`, and `project.health.finding-count` collectively fired **24 times** in the last 24h — every single one immediately resolved. This is pure threshold=0 chatter with no actionable signal.

**Recommendation:** Raise thresholds to ≥2 or add a cooldown/debounce of ≥30min. These have been flagged in 3 consecutive daily reviews with no remediation.

### 2. scout.knowledge-preamble-coverage — Unresolved 3 Days

Coverage stuck at 0.22 vs target 0.80. No owner has picked this up. This is a genuine gap (preambles not being generated for new knowledge entries).

**Missing owner:** No remediation session found. Needs assignment.

### 3. session.failed-triage-rate-3h — Recurring Dips

Fired 3 times today (values: 0.43, 0.71, 0.77). Two recovered, one still open. Pattern: triage failures spike during low-volume periods where a single failed session skews the rate.

**Recommendation:** Consider minimum-sample threshold (e.g., rate only alerts if ≥5 sessions in window).

### 4. Provider Errors — Transient Burst

`session.provider-error-count-1h` and `session.first-turn-error-count-1h` fired during same window (~11 errors). Both auto-resolved within ~30min. Likely a brief upstream provider issue.

**No action needed** — resolved organically.

### 5. Guard Metrics Breaking Thresholds

`guard.triggered-count-24h` (1403–1405 vs threshold 1400) and `guard.warned-count-24h` (1514 vs threshold 1500) each fired once. These are cumulative 24h counters that naturally grow with system activity.

**Recommendation:** Either raise thresholds proportionally to session volume or switch to a rate-based metric.

## Systemic Patterns

| Pattern | Recurrence | Impact |
|---------|-----------|--------|
| Project health trio noise | 4 consecutive days | Alert fatigue, drowns real signals |
| Triage rate low-volume skew | 3 of last 4 days | False positives during quiet hours |
| Guard counters crossing static thresholds | 2 of last 4 days | Misleading — correlated with healthy growth |
| Knowledge preamble coverage stall | 3 days unresolved | Genuine gap, no owner |

## Action Items

1. **[P0]** Debounce or raise thresholds on project health trio — this is the #1 noise source
2. **[P1]** Assign owner for scout.knowledge-preamble-coverage remediation
3. **[P1]** Add minimum-sample guard to session.failed-triage-rate-3h
4. **[P2]** Convert guard.triggered-count-24h / guard.warned-count-24h to rate-per-session metrics
