# Daily Alert Review — 2026-05-28

## Executive Summary

**26 alerts** fired in the last 24h across 4 metric IDs. All but 1 are resolved. The system is overwhelmingly noisy on three project-health metrics that fire and self-resolve within seconds, creating a flood of useless breach→recover cycles.

## Alert Inventory (Last 24h)

| Metric ID | Fires | Self-Resolved | Avg Duration | Priority |
|---|---|---|---|---|
| `project.health.finding-count` | 9 | 9 | ~17s | P1 |
| `project.owner-incomplete-count` | 9 | 9 | ~17s | P2 |
| `project.owner-judgment-needed-count` | 9 | 9 | ~17s | P2 |
| `scout.sourced-artifacts-24h` | 1 | 1 | ~52min | P2 |

### Unresolved (Older)

| Alert ID | Metric | Age | Status |
|---|---|---|---|
| 415 | `scout.knowledge-preamble-coverage` | ~7.9 days | ⚠️ **UNRESOLVED** — current=0.21, threshold=0.25 |

## Remediation Activity

- **`scout.sourced-artifacts-24h`** (alert #960): Properly triaged via `metric-alert-triage` workflow. Three `alert_judged` events show progressive response — initial wait-with-evidence → second wait → `fix_root_cause` (scout wrote a knowledge article with sourced URLs, commit fbd4007e6). Alert resolved ~52min after breach.

## 🚨 Findings & Recommendations

### 1. NOISY THRESHOLDS (Critical)

The three `project.*` metrics fire **9 times each per day** with breach→recover cycles lasting <20 seconds. This is pure noise — they trigger every time the health-check runs, detect a momentary state, then immediately recover.

**Recommendation:** Add a **debounce/cooldown** of at least 5 minutes before these metrics emit alerts. A threshold of `0` (zero tolerance) for counts that fluctuate by 1 during normal operations is too aggressive. Consider:
- Raising threshold from 0 → 1 for `owner-incomplete-count` and `owner-judgment-needed-count`
- Adding a `sustained_for: 300000` (5min) condition before alerting
- Or suppressing repeat alerts within a configurable cooldown window

### 2. UNRESOLVED ALERT: Knowledge Preamble Coverage (Alert #415)

`scout.knowledge-preamble-coverage` has been below threshold (0.21 < 0.25) for **~8 days** with no owner, no `alert_judged` event, and no remediation session.

**Recommendation:** Assign ownership. Either the scout agent needs a task to improve preamble coverage, or the threshold should be revised if 0.21 is acceptable.

### 3. MISSING OWNERS

- Alert #415 has no owner/handler — `resolved_at` is null and no corresponding triage events exist in the events table for this alert.
- The `project.*` alerts have no meaningful handler because they self-resolve before triage can engage.

### 4. RECURRING SYSTEMIC PATTERN

The `project.health.finding-count` (P1!) fires identically 9× in 24h with `current=1, threshold=0`. This is the same single finding being detected repeatedly. The system should either:
- Deduplicate: don't re-alert on a known, acknowledged finding
- Track acknowledged findings and exclude them from count

## Metrics Health Score

| Aspect | Score | Notes |
|---|---|---|
| Signal-to-noise ratio | 🔴 **Poor** | 27 of 28 alerts are noise (96%) |
| Mean time to resolve | 🟢 Good | Real alerts (scout) resolved in <1h |
| Unresolved backlog | 🟡 Fair | 1 alert unresolved for 8 days |
| Triage coverage | 🟡 Fair | Only scout alerts get proper triage |

## Action Items

1. **[P0]** Add debounce/cooldown to `project.health.finding-count`, `project.owner-incomplete-count`, `project.owner-judgment-needed-count`
2. **[P1]** Resolve or adjust threshold for `scout.knowledge-preamble-coverage` (alert #415)
3. **[P2]** Consider alert deduplication — don't re-fire for the same finding within a configurable window
