# Daily Alert Review — 2026-06-11

**Review window**: 2026-06-10 08:51 UTC → 2026-06-11 08:51 UTC  
**Generated**: 2026-06-11 08:51 UTC  

---

## Executive Summary

**47 alerts** fired in the 24h review window. **47 resolved** — **0 currently open**.  
Overall resolution rate: **100%** (up from 80% yesterday).  
Mean time to resolution: **13.3 min** average; fastest 5 min, longest 48 min.  
**18 formal triage judgments** were recorded across 15 distinct alert incidents.

The system is **operationally clean** — zero open alerts at report time. However, two systemic problems intensified:

1. **Project steward alert carousel** produced **24 of 47 alerts (51%)**, all flapping on threshold=0. This was flagged P1 yesterday — **no action was taken**. 7-day total: 225 of these alerts.
2. **Threshold drift** in `handler.failed-count` (calibrated 3× in 24h: 30→50→80→150) and `aks-rp-e2e.run.live-failed-24h` (calibrated 2×: 20→25→28). Chasing structural floors rather than fixing root causes.

---

## Section 1: Alert Inventory (24h)

### 1A. Summary by Metric

| Metric | Alerts (24h) | 7-Day | Lifetime | Avg Resolution | Owner | Status |
|--------|:---:|:---:|:---:|---:|--------|--------|
| `project.owner-judgment-needed-count` | **8** | 76 | 375 | 30 min | may | 🔊 NOISY |
| `project.owner-incomplete-count` | **8** | 72 | 362 | 7 min | may | 🔊 NOISY |
| `project.health.finding-count` | **8** | 77 | 340 | 14 min | may | 🔊 NOISY |
| `handler.failed-count` | 3 | 3 | 10 | 17 min | may | ⚠️ DRIFTING |
| `evaluator.stale-running-session-count` | 3 | 3 | 19 | 17 min | evaluator | ✅ Healthy |
| `agent.heartbeat-dark-count-2h` | 3 | 6 | 46 | 28 min | may | ⚠️ Recurring |
| `session.failed-triage-rate-3h` | 2 | 6 | 59 | 5 min | evaluator | ✅ Transient |
| `metric.stale-active-count` | 2 | 3 | 22 | 5 min | may | ✅ Transient |
| `aks-rp-e2e.task.ready-starvation-with-gaps` | 2 | 3 | — | 21 min | aks-explorer | ✅ Healthy |
| `aks-rp-e2e.task.no-work-with-gaps` | 2 | 2 | — | 5 min | aks-explorer | ✅ Transient |
| `aks-rp-e2e.run.live-failed-24h` | 2 | 2 | — | 22 min | aks-explorer | ⚠️ DRIFTING |
| `guard.warned-count-24h` | 1 | 3 | 10 | 49 min | may | ✅ Resolved |
| `guard.triggered-count-24h` | 1 | 3 | 18 | 49 min | may | ✅ Resolved |
| `aks-rp-e2e.task.capacity-underfilled-with-gaps` | 1 | 1 | — | 31 min | aks-explorer | ✅ Calibrated |
| `aks-rp-e2e.artifact.duplicate-group-count` | 1 | 1 | — | 15 min | aks-explorer | ✅ Fixed |

### 1B. Currently Open Alerts

**None.** All 47 alerts resolved within the review window.

### 1C. Alert Timeline (Condensed)

| Time (UTC) | Event | Metric | Detail |
|------------|-------|--------|--------|
| 09:31 | 🔴 Breach | `guard.triggered/warned-count-24h` | 2016 > 2000 threshold |
| 10:19 | 🟢 Recovery | `guard.triggered/warned-count-24h` | Natural decay below threshold |
| 10:50–16:46 | 🔴🟢×5 | `project.*` triplet | 5 fire-resolve cycles (threshold=0) |
| 13:44 | 🔴 Breach | `agent.heartbeat-dark-count-2h` | Scout dispatch-dedup blocked |
| 13:55 | 🟡 Judged | `agent.heartbeat-dark-count-2h` | `fix_root_cause` — reset dispatch-dedup |
| 14:09 | 🟢 Recovery | `agent.heartbeat-dark-count-2h` | Scout heartbeat resumed |
| 18:25–18:55 | 🔴🟢×2 | `session.failed-triage-rate-3h` | Transient dips to 0.77, auto-recovered |
| 20:20 | 🔴 Breach | `aks-rp-e2e.artifact.duplicate-group-count` | 46 > 30 threshold |
| 20:35 | 🟡 Judged | `aks-rp-e2e.artifact.duplicate-group-count` | `fix_root_cause` — cleanup script ran |
| 20:40 | 🔴 Breach | `agent.heartbeat-dark-count-2h` | Scout blocked again |
| 20:46 | 🟡 Judged | `agent.heartbeat-dark-count-2h` | `fix_root_cause` — dispatch-dedup reset again |
| 21:10 | 🟢 Recovery | `agent.heartbeat-dark-count-2h` | Scout heartbeat resumed |
| 21:40 | 🔴 Breach | `aks-rp-e2e.run.live-failed-24h` | 21 > 20 |
| 22:05 | 🟡 Judged | `aks-rp-e2e.run.live-failed-24h` | `calibrate_metric` — threshold 20→25 |
| 22:40 | 🔴 Breach | `evaluator.stale-running-session-count` | Stale aks-explorer session |
| 23:10 | 🔴 Breach | `metric.stale-active-count` | 22 stale metrics during snapshot gap |
| 23:12 | 🟡 Judged | `evaluator.stale-running-session-count` | `upgrade_or_escalate` → P0 human msg |
| 23:15 | 🟢 Recovery | Both stale metrics | Session completed, metrics refreshed |
| 00:05 | 🔴 Breach ×2 | `handler.failed-count` + `aks-rp-e2e.run.live-failed-24h` | 31>30 and 26>25 |
| 00:17–00:22 | 🟡 Judged ×2 | Both | `calibrate_metric` — handler 30→50, failed 25→28 |
| 01:20 | 🔴 Breach | `handler.failed-count` | 51>50 (already re-breaching) |
| 01:41 | 🟡 Judged | `handler.failed-count` | `calibrate_metric` — 50→80 |
| 02:36 | 🔴 Breach | `handler.failed-count` | 81>80 (re-breaching AGAIN) |
| 02:46 | 🟡 Judged | `handler.failed-count` | `calibrate_metric` — 80→150 |
| 03:42 | 🔴 Breach | `agent.heartbeat-dark-count-2h` | Scout blocked 3rd time |
| 03:53 | 🟡 Judged | `agent.heartbeat-dark-count-2h` | `fix_root_cause` — dispatch-dedup reset |
| 04:12 | 🟢 Recovery | `agent.heartbeat-dark-count-2h` | Scout resumed |
| 04:47–08:35 | 🔴🟢×3 | `project.*` triplet | 3 more fire-resolve cycles |
| 06:57–08:19 | 🔴🟢×2 | `evaluator.stale-running-session-count` | AKS session stalls |
| 07:02–07:28 | 🔴🟢×2 | `aks-rp-e2e.task.no-work-with-gaps` | Transient work gaps |
| 07:48–08:19 | 🔴🟢 | `aks-rp-e2e.task.ready-starvation-with-gaps` | Transient starvation |
| 08:25–08:35 | 🔴🟢 | `aks-rp-e2e.task.ready-starvation-with-gaps` | Rapid repeat |

---

## Section 2: Triage Operations Breakdown

**18 `metric.alert_judged` events** across the window:

| Operation | Count | Metrics |
|-----------|:---:|---------|
| `calibrate_metric` | **6** | handler.failed-count (×3), aks-rp-e2e.run.live-failed-24h (×2), capacity-underfilled (×1) |
| `fix_root_cause` | **5** | agent.heartbeat-dark-count-2h (×3), evaluator.stale-running-session-count (×1), aks-rp-e2e.artifact.duplicate-group-count (×1) |
| `resolve_stale` | **5** | agent.heartbeat-dark-count-2h (×1), aks-rp-e2e.task.ready-starvation (×1), aks-rp-e2e.task.no-work (×1), session.failed-triage-rate (×1) |
| `waiting_with_evidence` | **1** | aks-rp-e2e.task.ready-starvation-with-gaps |
| `upgrade_or_escalate` | **1** | evaluator.stale-running-session-count — P0 escalation to human |

### Judgment Quality Notes

- **Effective fixes**: Dispatch-dedup resets (3×) and artifact deduplication cleanup (1×) all resolved root causes cleanly.
- **Concerning pattern**: 6 of 18 judgments (33%) were `calibrate_metric` — threshold adjustments rather than root-cause fixes. This suggests metrics are tracking structural baselines, not anomalies.
- **Escalation**: 1 P0 escalation for a stale aks-explorer session — correctly identified and the session self-resolved within 35 minutes.

---

## Section 3: Noisy Threshold Analysis 🔊

### The "Project Steward Carousel" — Day 23

The top 3 noisiest metrics continue their unabated flapping:

| Metric | Threshold | 24h | 7d | Lifetime | % of All Alerts |
|--------|:---------:|:---:|:--:|:--------:|:---------:|
| `project.owner-judgment-needed-count` | **0** | 8 | 76 | **375** | 22.8% |
| `project.owner-incomplete-count` | **0** | 8 | 72 | **362** | 22.1% |
| `project.health.finding-count` | **0** | 8 | 77 | **340** | 20.7% |
| **SUBTOTAL** | | **24** | **225** | **1,077** | **65.6%** |

**This was called out as P1 in yesterday's report (June 10). No action was taken.**

The pattern is unchanged: aks-rp-e2e.app's aggressive-push policy triggers `owner_judgment_needed` on every steward scan. The finding appears, creates 3 alerts, and auto-resolves within 7–30 minutes. This cycle repeats ~8× per day, generating **~24 wasted triage events daily**.

### Threshold Drift Watch 📈

Two metrics are being serially calibrated upward without addressing structural causes:

| Metric | 7d Calibrations | Threshold History | Current Position |
|--------|:---:|------|------|
| `handler.failed-count` | **3 today + prior** | 30→50→80→**150** | Current=63, safe margin=87 |
| `aks-rp-e2e.run.live-failed-24h` | **2 today** | 20→25→**28** | Current=27, margin=**1** ⚠️ |

**`handler.failed-count`**: The root cause is aks-rp-e2e-task-execution-worker timeouts (71/83 = 86% of failures). These are structural — long-running AKS replay tests hitting the handler timeout. Moving the threshold from 30 to 150 in one day is symptom-chasing, not a fix. The handler success rate is 94.7%, well within the `handler.success-rate` threshold of 80%.

**`aks-rp-e2e.run.live-failed-24h`**: Now at threshold=28 with current=27 — **1 unit away from re-breach**. With 33 live runs started and 27 failed/blocked in 24h, this is an 18% success rate. The threshold is being raised to accommodate the failure rate rather than investigating why 82% of runs fail.

---

## Section 4: Missing Owners & Unresolved Validation

### Owner Coverage

All 15 alerting metrics have assigned owners. No orphaned metrics.

| Owner | Metrics Owned | Alerts (24h) |
|-------|:---:|:---:|
| may | 9 | 33 |
| aks-explorer | 4 | 8 |
| evaluator | 2 | 5 |

### Unresolved Validation

No alerts are currently open, but the following need human attention:

1. **`handler.failed-count` at threshold=150**: After 3 calibrations in 24h (30→50→80→150), the threshold is 5× its value from yesterday. No validation that 150 is a meaningful threshold vs. just silencing noise. The metric may have lost alerting value.

2. **`aks-rp-e2e.run.live-failed-24h` at threshold=28**: With current=27 and rising, this will likely re-breach within hours. The 82% failure rate of live runs may be a legitimate project issue that calibration is masking.

3. **`project.*` triplet at threshold=0**: Still generating 65.6% of all lifetime alerts. Yesterday's P1 recommendation to raise threshold to 2 was not acted on. Every day of inaction adds ~24 more wasted alerts.

### Yesterday's Action Items — Tracking

| Item | Priority | Status |
|------|----------|--------|
| Calibrate `project.owner-judgment-needed-count` 0→2 | P1 | ❌ **NOT DONE** |
| Calibrate `project.owner-incomplete-count` 0→2 | P1 | ❌ **NOT DONE** |
| Calibrate `project.health.finding-count` 0→2 | P1 | ❌ **NOT DONE** |
| Review aggressive-push exemption for owner_judgment_needed | P2 | ❌ **NOT DONE** |
| Investigate project.health.finding-count #1588 (13h open) | P2 | ✅ Auto-resolved |
| Monitor DB size trend | P3 | ⚡ 943 MB (up from 891 MB yesterday) |

---

## Section 5: Recurring Systemic Patterns

### Pattern 1: Scout Dispatch-Dedup Blocking (3× in 24h)

`agent.heartbeat-dark-count-2h` fired 3 times, each time because scout's `dispatch-dedup.json` auto-blocked the heartbeat workflow after detecting 3 error outcomes in a 7-day window.

**Triage response each time**: Reset `dispatch-dedup.json` (set blocked=false, failures=0).

**Root cause**: The dedup guard's "3 errors in 7d = auto-block" rule is too aggressive for heartbeat workflows. 3 scout heartbeat errors (likely provider crashes with opCount=0) trigger an indefinite block that requires manual intervention. This creates a repeating cycle:
1. Scout heartbeat fails 3 times → auto-blocked
2. 2 hours pass → dark alert fires
3. Triage resets dedup → scout resumes
4. Accumulated errors trigger re-block within hours

**Fix needed**: Either exempt heartbeat workflows from dedup blocking, or increase the error threshold for heartbeats from 3 to 10+.

### Pattern 2: Handler Failure Threshold Ratcheting

`handler.failed-count` threshold was raised 5× total (original unknown → 30 → 50 → 80 → 150) over the past week. Each calibration buys a few hours before the metric re-breaches.

The underlying driver is aks-rp-e2e-task-execution-worker timeouts, which are expected for long-running AKS replay test executions. These are not failures in the traditional sense — they're long tests hitting the handler timeout ceiling.

**Fix needed**: Either increase the handler timeout for aks-rp-e2e workers, or exclude known-long-running handler types from the failure count. The separate `handler.success-rate` metric (currently 94.7%, threshold 80%) already monitors overall handler health adequately.

### Pattern 3: AKS Live Run High Failure Rate

With 27 failures out of 33 runs in 24h (82% failure rate), the aks-rp-e2e live execution pipeline has a structural issue. The threshold has been raised from 20→28 to accommodate this, but the metric is currently at 27 — one failure away from re-breach.

This is distinct from the handler timeout issue. The live runs themselves are encountering failures and blocks, likely due to Azure API errors, resource constraints, or test environment issues.

### Pattern 4: Stale Session Flashes

`evaluator.stale-running-session-count` fired 3 times. Each instance was a single aks-explorer session running longer than the staleness threshold (30 min). One escalated to P0 before self-resolving.

These are expected for long-running AKS replay test sessions. Consider either increasing the staleness threshold for aks-explorer sessions or excluding known-long-running session types.

---

## Section 6: Infrastructure Health

| Signal | Status | Value | Notes |
|--------|--------|-------|-------|
| Message delivery | ✅ | 100% | 0 failures in 24h |
| Handler success rate (6h) | ✅ | 94.7% | Within 80% threshold |
| Handler p95 duration | ⚠️ | 517s | Close to 600s threshold |
| Session error rate (6h) | ✅ | 4.8% | Well within 30% threshold |
| DB size | ⚠️ | **943 MB** | +52 MB in 24h (5.8% growth). At 2GB threshold, ~18 days to breach at current rate |
| Active sessions | ✅ | 4 | Healthy |
| Zombie sessions | ✅ | 0 | Clean |
| Guard blocks (15m) | ✅ | 0 | Clean |
| Stale metrics | ✅ | 0 | Clean at report time |
| Heartbeat coverage | ✅ | 5/5 | All agents active |
| Guard triggers (24h) | ⚠️ | 1,854 | High but within 2,500 threshold |

---

## Section 7: Action Items

| Priority | Item | Owner | Due | Carryover? |
|----------|------|-------|-----|:---:|
| **P1** | Raise `project.owner-judgment-needed-count` threshold 0→2 | human/may | **Overdue** | ⚠️ Day 2 |
| **P1** | Raise `project.owner-incomplete-count` threshold 0→2 | human/may | **Overdue** | ⚠️ Day 2 |
| **P1** | Raise `project.health.finding-count` threshold 0→2 | human/may | **Overdue** | ⚠️ Day 2 |
| **P1** | Fix scout dispatch-dedup blocking cycle — exempt heartbeats or raise error threshold | may | Today | New |
| **P1** | Validate `handler.failed-count` threshold=150 — confirm it's meaningful or restructure metric | may | Today | New |
| **P2** | Investigate aks-rp-e2e 82% live run failure rate — is this expected or a project health issue? | aks-explorer | This week | New |
| **P2** | Review aggressive-push exemption for owner_judgment_needed | human | This week | Day 2 |
| **P2** | Monitor DB growth (943 MB, +52 MB/day, threshold 2GB) | may | Ongoing | Updated |
| **P3** | Consider adjusting staleness threshold for aks-explorer sessions (currently 30 min) | evaluator | This sprint | New |

---

## Appendix A: 7-Day Alert Volume

```
project.health.finding-count          ██████████████████████████████████ 77
project.owner-judgment-needed-count   ████████████████████████████████   76
project.owner-incomplete-count        ████████████████████████████████   72
session.failed-triage-rate-3h         ███  6
agent.heartbeat-dark-count-2h         ███  6
project.task-parser-error-count       ██   3
project.invalid-format-count          ██   3
metric.stale-active-count             ██   3
handler.failed-count                  ██   3
guard.warned-count-24h                ██   3
guard.triggered-count-24h             ██   3
evaluator.stale-running-session-count ██   3
aks-rp-e2e.task.ready-starvation      ██   3
aks-rp-e2e.task.no-work-with-gaps     █    2
aks-rp-e2e.run.live-failed-24h        █    2
evaluator.substantive-low-quality     ▏    1
eval.llm-coverage-lag-h               ▏    1
aks-rp-e2e.task.capacity-underfilled  ▏    1
aks-rp-e2e.artifact.duplicate-groups  ▏    1
```

## Appendix B: Triage Operation Distribution (24h)

```
calibrate_metric     ██████ 6  (33%)
fix_root_cause       █████  5  (28%)
resolve_stale        █████  5  (28%)
waiting_with_evidence█     1  ( 6%)
upgrade_or_escalate  █     1  ( 6%)
```

## Appendix C: Lifetime Alert Stats

- **Total lifetime alerts**: 1,642
- **Top 3 metrics**: 1,077 alerts (65.6% of total)
- **100% resolution rate** (all lifetime alerts resolved)
- **Median resolution time**: ~10 minutes
- **Longest-lived alert class**: `guard.warned-count-24h` (avg 7.9 hours to resolve)

---

*Report generated by may (daily-alert-review cron). Prior report: [2026-06-10](./2026-06-10-alert-review.md). Next review: 2026-06-12.*
