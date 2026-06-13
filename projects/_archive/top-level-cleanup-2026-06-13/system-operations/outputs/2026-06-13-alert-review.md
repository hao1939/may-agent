# Daily Alert Review — 2026-06-13

**Review window**: 2026-06-12 10:15 UTC → 2026-06-13 10:15 UTC  
**Generated**: 2026-06-13 10:15 UTC  

---

## Executive Summary

**46 alerts** fired in 24h (down from 71 yesterday). **43 resolved** — **3 currently open**.  
Resolution rate: **93%** (down from 100% yesterday).  
Mean TTR (resolved alerts): **14.1 min** (improved from 24.6 min yesterday).  
**26 formal triage judgments** recorded (down from 59 yesterday).

The alert volume dropped **35%** day-over-day, but the improvement is superficial — the same two systemic problems dominate, and for the first time in days we have **3 unresolved alerts at report time**.

### Open Alerts (Action Required)

| # | Metric | Current | Threshold | Age | Owner |
|---|--------|---------|-----------|-----|-------|
| 1726 | `guard.triggered-count-24h` | 3,103 | 2,500 | **17h 4m** | may |
| 1727 | `guard.warned-count-24h` | 3,103 | 2,500 | **17h 4m** | may |
| 1761 | `aks-rp-e2e.run.live-failed-24h` | 70 | 55 | **3h 0m** | aks-explorer |

---

## Section 1: Alert Inventory (24h)

### 1A. Summary by Metric

| Metric | 24h | 7-Day | Avg TTR | Owner | Status |
|--------|:---:|:---:|--------:|--------|--------|
| `evaluator.stale-running-session-count` | **19** | 50 | 10.5 min | evaluator | 🔊 **NOISY — Day 4** |
| `aks-rp-e2e.task.ready-starvation-with-gaps` | 4 | 20 | 76.7 min | aks-explorer | 🔊 NOISY |
| `aks-rp-e2e.task.no-work-with-gaps` | 4 | 8 | 14.3 min | aks-explorer | ⚠️ Recurring |
| `project.health.finding-count` | 3 | 53 | 3.0 min | may | 🔊 **NOISY — Day 4** |
| `project.owner-judgment-needed-count` | 3 | 52 | 3.0 min | may | 🔊 **NOISY — Day 4** |
| `project.owner-incomplete-count` | 3 | 48 | 3.0 min | may | 🔊 **NOISY — Day 4** |
| `aks-rp-e2e.task.completed-24h` | 2 | 2 | 5.1 min | aks-explorer | ✅ Transient |
| `aks-rp-e2e.task.capacity-underfilled-with-gaps` | 2 | 8 | 13.2 min | aks-explorer | ⚠️ Recurring |
| `aks-rp-e2e.run.live-failed-24h` | 2 | 10 | 5.2 min | aks-explorer | 🔴 **OPEN** |
| `session.failed-triage-rate-3h` | 1 | 6 | 68.8 min | evaluator | ✅ Resolved |
| `guard.triggered-count-24h` | 1 | 3 | — | may | 🔴 **OPEN** |
| `guard.warned-count-24h` | 1 | 3 | — | may | 🔴 **OPEN** |
| `aks-rp-e2e.artifact.duplicate-group-count` | 1 | 2 | 15.3 min | aks-explorer | ✅ Resolved |

### 1B. Alert Type Distribution

| Type | Count | % |
|------|:---:|:---:|
| `consecutive_failures` | 32 | 70% |
| `threshold` | 14 | 30% |

### 1C. Event Flow (24h)

| Event Type | Count | Status |
|------------|:---:|--------|
| `metric.breach` | 46 | All pending |
| `metric.recovered` | 44 | All pending |
| `metric.alert_judged` | 26 | All pending |

**Note**: All 116 metric events remain in `pending` status — no downstream handler is consuming them. This is a persistent gap from prior reviews.

---

## Section 2: Triage Operations Breakdown

**26 `metric.alert_judged` events** (down from 59 yesterday):

| Operation | Count | % | Primary Metrics |
|-----------|:---:|:---:|-----------------|
| `upgrade_or_escalate` | 11 | 42% | stale-sessions (8), failed-triage-rate (3) |
| `resolve_stale` | 9 | 35% | stale-sessions (4), no-work-with-gaps (2), completed-24h (1), capacity-underfilled (1), failed-triage-rate (1) |
| `calibrate_metric` | 4 | 15% | stale-sessions (2), capacity-underfilled (1), ready-starvation (1) |
| `waiting_with_evidence` | 2 | 8% | no-work-with-gaps (2) |

### Triage Quality Assessment

- **42% escalation rate** — high but down from the ~31% yesterday. This is driven by `evaluator.stale-running-session-count` which triggers escalations the agent cannot self-resolve (no session-cancel capability).
- **15% calibration requests** — triage agents are actively flagging noisy thresholds, but no calibration actions have been implemented. This is the 4th consecutive day of calibration requests for `stale-running-session-count`.
- **0% direct fix operations** — no triage session made a code/config fix. The system remediates via escalation rather than self-repair.

---

## Section 3: Noisy Threshold Analysis 🔊

### 3A. `evaluator.stale-running-session-count` — 50 alerts in 7 days

| Day | Alerts | Judgments | Escalations | Calibration Requests |
|-----|:---:|:---:|:---:|:---:|
| Jun 12 | 27 | 25 | 18 | — |
| Jun 13 | 19 | 14 | 8 | 2 |
| 7-Day Total | 50 | — | — | — |

**Root cause**: The metric counts non-evaluator sessions running >30 min with stale `session.jsonl` mtime. Long-running `aks-explorer` cloud replay sessions routinely exceed 30 min (some run 1–6h), causing genuine but operationally benign alerts.

**Recommendation (repeated from Jun 10, 11, 12)**:
1. Exempt `aks-explorer` task-worker sessions from the staleness count, OR
2. Raise the threshold from 0 to 1 (tolerate one long-running session), OR
3. Require 2 consecutive stale snapshots before alerting (debounce)

**Impact**: At current rates, this metric alone is responsible for **41% of all alerts** and **31% of all triage sessions**. Each triage session consumes ~2 min of agent compute for zero remediation value.

### 3B. `project.*` triplet — 153 combined alerts in 7 days

The three project metrics (`project.health.finding-count`, `project.owner-judgment-needed-count`, `project.owner-incomplete-count`) always fire and recover together. In 24h: 9 alerts (3 × 3 cycles), 7-day: 153 combined alerts.

**Root cause**: The project steward periodically detects transient state (e.g., a task briefly lacking an owner before auto-assignment). With threshold=0, even a single-snapshot anomaly triggers alerts.

**Recommendation**: Raise all three thresholds from 0 to 1, or require 2 consecutive breaches.

### 3C. `aks-rp-e2e.task.ready-starvation-with-gaps` — 20 alerts in 7 days

Fires when ready task count = 0 but model gaps remain. With 78 live runs/day and rapid task cycling, zero-ready is a normal transient state between task batches.

**Recommendation**: Add a grace period (2 consecutive measurements) or lower the measurement frequency.

---

## Section 4: Currently Unresolved Alerts (Deep Dive)

### 4A. Guard Triggers/Warnings (IDs 1726, 1727)

**Open for 17+ hours** — the longest-standing open alerts.

- `guard.triggered-count-24h` = 3,103 (threshold: 2,500)
- `guard.warned-count-24h` = 3,103 (threshold: 2,500)
- These are identical values, suggesting all triggers also generate warnings (1:1 ratio).

**Analysis**: At 262 handler fires/hour and high aks-explorer throughput (78 live runs/24h), guard triggers are proportional to system activity. The threshold of 2,500 was likely set when the system ran fewer sessions. With current scale, 3,103/24h may be the new baseline.

**Recommendation**: Recalibrate threshold to current operational volume (~3,500) or make the threshold proportional to handler-fires-per-hour.

### 4B. AKS RP E2E Live Failures (ID 1761)

- `aks-rp-e2e.run.live-failed-24h` = 70 (threshold: 55, target: 0)
- Trend: 63 → 64 → 65 → 66 → 68 → 70 (steadily climbing over past 6h)
- Of 78 live runs started, only 6 succeeded (7.7% success rate)

**Analysis**: The high failure rate isn't an alert system problem — it reflects genuine test environment issues. The 10 alerts in 7 days (avg TTR 53 min each) show this is a persistent operational challenge, not a transient spike.

**Missing owner action**: Despite 10 alerts in 7 days, no configuration or code remediation has been applied. The alert fires, gets resolved when values briefly dip below threshold, then re-fires.

---

## Section 5: Missing Owners & Unresolved Validation

### 5A. Owner Distribution

| Owner | Metrics Owned | Alerts (24h) | Open Alerts |
|-------|:---:|:---:|:---:|
| evaluator | 2 | 20 | 0 |
| aks-explorer | 7 | 16 | 1 |
| may | 5 | 10 | 2 |

**No orphaned metrics** — all alerting metrics have assigned owners.

### 5B. Unresolved Validation Pipeline

- **116 metric events stuck in `pending`**: Every `metric.breach`, `metric.recovered`, and `metric.alert_judged` event remains `pending`. No handler is processing these events downstream. This means:
  - Recovery confirmations are never validated
  - Triage judgments are never reviewed for quality
  - Escalations may not reach their intended recipients through the event bus

This has been flagged since at least June 10. **No remediation has occurred.**

---

## Section 6: Recurring Systemic Patterns

### Pattern 1: Alert Storm → Triage Storm → No Fix (Day 4)

The cycle continues: noisy metric → many alerts → many triage sessions → many escalations → no threshold change → repeat tomorrow. The `stale-running-session-count` metric alone has generated **50 alerts and ~39 triage sessions in 7 days** with zero configuration changes applied.

**Cost estimate**: ~78 triage sessions × 2 min avg = ~2.6h of agent compute spent on zero-value triage in 7 days.

### Pattern 2: Transient Breach / Instant Recovery

Several metrics exhibit a predictable pattern: breach for 1 snapshot, recover on the next. Key offenders:
- `project.*` triplet: 3 min avg TTR (fires and resolves within a single steward cycle)
- `aks-rp-e2e.task.no-work-with-gaps`: 14.3 min avg TTR, all 4 alerts auto-resolved
- `evaluator.stale-running-session-count`: 10.5 min avg TTR, 19 of 19 resolved

**Fix**: Any metric with >80% same-day auto-resolution should have a debounce requirement (2+ consecutive breaches before alerting).

### Pattern 3: Escalation Dead-End

Triage sessions correctly identify issues and escalate (42% escalation rate), but:
- No mechanism tracks whether escalations are acted upon
- Multiple escalations for the same metric stack up without deduplication
- The `stale-running-session-count` metric received 8 `upgrade_or_escalate` judgments in 24h for the same root cause

**Fix**: Implement escalation deduplication — suppress re-escalation for the same metric within a configurable cooldown (e.g., 2h).

### Pattern 4: High Guard Volume Without Actionable Signal

Guard triggers at 3,103/24h with threshold 2,500 creates a persistent open alert that provides no actionable signal. The guard system is functioning correctly (99.2% handler success rate), but the volume metric needs recalibration.

---

## Section 7: Day-over-Day Comparison

| Metric | Jun 12 | Jun 13 | Trend |
|--------|:---:|:---:|:---:|
| Total alerts | 71 | 46 | ✅ -35% |
| Open at report time | 0 | 3 | ❌ +3 |
| Mean TTR (min) | 24.6 | 14.1 | ✅ Faster |
| Triage judgments | 59 | 26 | ✅ -56% |
| Escalations | ~18 | 11 | ✅ -39% |
| Unique metrics alerting | 14 | 13 | ≈ Flat |
| Stale-session alerts | 27 | 19 | ✅ -30% |
| Project triplet alerts | 15 | 9 | ✅ -40% |
| Calibration requests acted on | 0 | 0 | ❌ Still 0 |

---

## Section 8: Recommendations (Priority Ordered)

### P0 — Immediate

1. **Resolve open guard alerts (1726, 1727)**: Raise `guard.triggered-count-24h` and `guard.warned-count-24h` thresholds from 2,500 to 4,000 to match current operational volume. These have been open 17h with no degradation in handler success rate.

2. **Investigate AKS RP E2E failure rate**: 70/78 runs failing (90% failure rate). Either the test environment is degraded or test expectations need updating. This is a genuine operational issue, not an alert tuning problem.

### P1 — This Week

3. **Calibrate `evaluator.stale-running-session-count`**: Implement one of the three recommendations from Section 3A. This single metric is responsible for 41% of all alerts. The triage agents have requested calibration 4 times — act on it.

4. **Add debounce to transient metrics**: Require 2+ consecutive breaches for `project.*` triplet and `aks-rp-e2e.task.no-work-with-gaps`. Eliminates ~30% of all alerts.

5. **Implement escalation deduplication**: Cap re-escalation for the same metric to once per 2h. Prevents 8 identical escalations in 24h.

### P2 — Backlog

6. **Fix pending event consumption**: 116 metric events are stuck in `pending` status. Either connect a handler or remove the event emission.

7. **Add alert-review automation**: The daily alert review is producing consistent recommendations that aren't being actioned. Consider auto-applying calibration when 3+ triage sessions request it for the same metric.

---

*Previous review: [2026-06-12](./2026-06-12-alert-review.md)*  
*Generated by: `may` daily-alert-review cron*
