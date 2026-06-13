# Daily Alert Review — 2026-05-20

## Summary

**Total alerts fired (24h):** 37  
**Resolved:** 35 | **Unresolved:** 2  
**Resolution rate:** 94.6%

## Alert Breakdown by Metric

| Metric | Fires | Resolved | Unresolved |
|--------|-------|----------|------------|
| project.owner-judgment-needed-count | 12 | 11 | 1 |
| project.health.finding-count | 11 | 10 | 1 |
| project.task-parser-error-count | 4 | 4 | 0 |
| project.invalid-format-count | 2 | 2 | 0 |
| metric.stale-active-count | 2 | 2 | 0 |
| evaluator.stale-running-session-count | 2 | 2 | 0 |
| session.failed-triage-rate-3h | 1 | 1 | 0 |
| project.missing-owner-workflow-count | 1 | 1 | 0 |
| guard.warned-count-24h | 1 | 1 | 0 |
| capability.status-reality-mismatch-count | 1 | 1 | 0 |

## Systemic Patterns Identified

### 🔴 Pattern 1: Project Health Alerts are Noisy (23 fires from 2 metrics)

`project.owner-judgment-needed-count` and `project.health.finding-count` account for **62% of all alerts** in the last 24h. Both have threshold=0, meaning ANY occurrence fires an alert. These fire repeatedly (~every 30-90 min), resolve, then re-fire.

**Diagnosis:** Threshold of 0 is too sensitive for metrics that fluctuate naturally. These are expected operational states, not emergencies.

**Recommendation:** Raise thresholds:
- `project.owner-judgment-needed-count`: threshold → 2 (alert only when backlog grows)
- `project.health.finding-count`: threshold → 2 (alert only when multiple findings accumulate)

### 🟡 Pattern 2: Task Parser Errors are Transient

4 fires, all resolved quickly. These appear to be self-correcting (likely fixed on next project scan). The threshold=0 causes noise for single transient errors.

**Recommendation:** Raise threshold to 2, or add a cooldown/dedup window.

### 🟢 Pattern 3: Infrastructure Alerts are Well-Calibrated

`metric.stale-active-count`, `evaluator.stale-running-session-count`, and other infra alerts fired sparingly and resolved quickly. No action needed.

## Currently Unresolved

1. **project.owner-judgment-needed-count** — current=2 (needs human decision on project tasks)
2. **project.health.finding-count** — current=2 (active project health findings)

## Threshold Calibration Recommendations

| Metric | Current Threshold | Recommended | Rationale |
|--------|------------------|-------------|-----------|
| project.owner-judgment-needed-count | 0 | 2 | Fires 12x/day, normal operational state |
| project.health.finding-count | 0 | 2 | Fires 11x/day, normal fluctuation |
| project.task-parser-error-count | 0 | 2 | Transient self-correcting errors |

## Comparison to Previous Trends

Looking at the broader dataset (IDs 213-412), the most chronic offenders historically are:
- `agent.heartbeat-dark-count-2h` — fires constantly (agents briefly going dark is normal with 2h window)
- `session.failed-triage-rate-3h` — fires when rate dips below 0.8, which happens frequently
- `project.invalid-format-count` — was very noisy in earlier period, now reduced

The system is maturing — fewer unique metric types firing in the last 24h compared to earlier periods, suggesting previous calibration work is paying off.
