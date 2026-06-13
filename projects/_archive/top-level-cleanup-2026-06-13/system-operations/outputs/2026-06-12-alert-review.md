# Daily Alert Review — 2026-06-12

**Review window**: 2026-06-11 09:33 UTC → 2026-06-12 09:33 UTC  
**Generated**: 2026-06-12 09:33 UTC  

---

## Executive Summary

**71 alerts** fired in 24h. **71 resolved** — **0 currently open**.  
Resolution rate: **100%** (maintained from yesterday).  
Mean TTR: **24.6 min** (up from 13.3 min yesterday); fastest 0.9 min, longest 4h 15min.  
**59 formal triage judgments** recorded (up from 18 yesterday — 3.3× increase).

The system is **operationally clean at report time** (zero open alerts), but the alert volume tells a different story. Two systemic problems dominate:

1. **Stale-session alert storm**: `evaluator.stale-running-session-count` fired **27 times** (38% of all alerts) with **25 triage judgments** — 18 of which were `upgrade_or_escalate`. Each alert represents a 5–55 min aks-explorer session exceeding the 30-min staleness threshold. The metric is correctly detecting long-running test sessions, but the volume is disproportionate to the risk.

2. **Project steward carousel (Day 3 without action)**: The `project.*` triplet still fires at threshold=0 — **15 alerts** in 24h (down from 24 yesterday due to fewer steward cycles). This was **P1 on June 10**, **P1 again on June 11**, and remains unfixed.

---

## Section 1: Alert Inventory (24h)

### 1A. Summary by Metric

| Metric | Alerts | 7-Day | Lifetime | Avg TTR | Owner | Status |
|--------|:---:|:---:|:---:|---:|--------|--------|
| `evaluator.stale-running-session-count` | **27** | 47 | 47 | 14 min | evaluator | 🔊 **NOISY** |
| `aks-rp-e2e.task.ready-starvation-with-gaps` | **10** | 15 | — | 20 min | aks-explorer | 🔊 NOISY |
| `aks-rp-e2e.run.live-failed-24h` | 6 | 8 | — | 71 min | aks-explorer | ⚠️ DRIFTING |
| `project.owner-judgment-needed-count` | 5 | 62 | 380 | 20 min | may | 🔊 **NOISY** |
| `project.owner-incomplete-count` | 5 | 58 | 367 | 20 min | may | 🔊 **NOISY** |
| `project.health.finding-count` | 5 | 63 | 345 | 20 min | may | 🔊 **NOISY** |
| `aks-rp-e2e.task.capacity-underfilled-with-gaps` | 5 | 6 | — | 33 min | aks-explorer | ⚠️ Recurring |
| `aks-rp-e2e.task.no-work-with-gaps` | 2 | 4 | — | 19 min | aks-explorer | ✅ Transient |
| `session.provider-error-count-1h` | 1 | 1 | — | 57 min | may | ✅ Resolved |
| `session.first-turn-error-count-1h` | 1 | 1 | — | 57 min | may | ✅ Resolved |
| `session.failed-triage-rate-3h` | 1 | 7 | 60 | 62 min | evaluator | ✅ Resolved |
| `aks-rp-e2e.task.blocked-count` | 1 | 1 | — | 10 min | aks-explorer | ✅ Resolved |
| `aks-rp-e2e.model.failed-path-count` | 1 | 1 | — | 16 min | aks-explorer | ✅ Calibrated |
| `agent.heartbeat-dark-count-2h` | 1 | 7 | 47 | 37 min | may | ✅ Fixed |

### 1B. Currently Open Alerts

**None.** All 71 alerts resolved within the review window.

### 1C. Alert Type Distribution

| Type | Count | % |
|------|:---:|:---:|
| `consecutive_failures` | 47 | 66% |
| `threshold` | 24 | 34% |

---

## Section 2: Triage Operations Breakdown

**59 `metric.alert_judged` events** (up 3.3× from 18 yesterday):

| Operation | Count | % | Metrics Affected |
|-----------|:---:|:---:|---------|
| `resolve_stale` | **19** | 32% | stale-session(8), ready-starvation(6), provider-errors(2), capacity(2), failed-triage(1) |
| `upgrade_or_escalate` | **18** | 31% | stale-session(15), failed-triage(2), stale-session(1) |
| `waiting_with_evidence` | **13** | 22% | provider-errors(3), ready-starvation(3), live-failed(3), first-turn-errors(2), capacity(1), no-work(1) |
| `calibrate_metric` | **6** | 10% | ready-starvation(2), live-failed(1), capacity(1), failed-path(1), p95-duration(1) |
| `fix_root_cause` | **2** | 3% | heartbeat-dark(1), p95-duration(1) |
| `downgrade_priority` | **1** | 2% | ready-starvation(1) |

### Judgment Quality Analysis

- **Stale-session judgment fatigue**: 25 of 59 judgments (42%) were for a single metric (`evaluator.stale-running-session-count`). 18 of those (72%) chose `upgrade_or_escalate` — but the sessions all self-resolved within minutes to hours. This is an enormous triage cost for transient conditions.
- **Waiting correctly**: 13 `waiting_with_evidence` judgments (22%) all resolved without manual intervention — good signal detection.
- **Calibration discipline improved**: Only 6 calibrations (10%, down from 33% yesterday). The `aks-rp-e2e.run.live-failed-24h` metric was also downgraded to P3 to break the threshold-chase cycle — **good structural fix**.
- **Fix rate low**: Only 2 `fix_root_cause` judgments (3%) — most alerts are being weathered rather than structurally addressed.

---

## Section 3: Noisy Threshold Analysis 🔊

### The "Stale Session Storm" — NEW #1 Problem

`evaluator.stale-running-session-count` is now the **single noisiest metric** in the system:

| Period | Alerts | Judgments | Escalations | Avg TTR |
|--------|:---:|:---:|:---:|---:|
| Today (24h) | **27** | 25 | 18 | 14 min |
| 7 day | 47 | — | — | — |
| Lifetime | 47 | — | — | — |

**Root cause**: aks-explorer task-worker sessions regularly run 30–55 minutes for AKS replay tests. The staleness threshold is 30 minutes. Every time a worker exceeds this, an alert fires, triage spins up, escalates to may, and the session finishes on its own. The 18 `upgrade_or_escalate` operations sent P0/P1 messages that were all no-ops — the sessions were active, just long-running.

**Triage cost**: At ~5 min per triage session × 25 judgments = **~2 hours of compute** burned on a non-problem.

**Recommended fix**: Increase stale-session threshold for aks-explorer sessions from 30 min to 60 min, or exclude aks-explorer task-worker sessions from the count.

### The "Project Steward Carousel" — Day 3 Without Action

| Metric | Threshold | 24h | 7d | Lifetime | % of All Alerts |
|--------|:---------:|:---:|:--:|:--------:|:---------:|
| `project.owner-judgment-needed-count` | **0** | 5 | 62 | **380** | 22.1% |
| `project.owner-incomplete-count` | **0** | 5 | 58 | **367** | 21.4% |
| `project.health.finding-count` | **0** | 5 | 63 | **345** | 20.1% |
| **SUBTOTAL** | | **15** | **183** | **1,092** | **63.6%** |

**Status**: P1 recommendation to raise thresholds 0→2 was made on June 10. Not acted on June 11. Not acted on June 12. These three metrics account for **63.6% of all lifetime alerts** (1,092 of 1,717).

### Threshold Drift Watch 📈

| Metric | Calibration History | Current State | Assessment |
|--------|-----|------|------|
| `handler.failed-count` | 30→50→80→**150** (3 in 1 day) | current=10, threshold=150 | ⚠️ Threshold is 15× current value. Metric has **lost alerting value**. |
| `aks-rp-e2e.run.live-failed-24h` | 20→25→28→35→42→50→**55** (7 total) | current=46, threshold=55, **P3** | ✅ Downgraded to P3 (dashboard-only). Good structural fix. |
| `aks-rp-e2e.model.failed-path-count` | 20→**25** | current=23, threshold=25 | ✅ Justified calibration — structural product-gap floor. |

---

## Section 4: Missing Owners & Unresolved Validation

### Owner Coverage

All 14 alerting metrics have assigned owners. No orphaned metrics.

| Owner | Metrics Owned | Alerts (24h) | Judgments |
|-------|:---:|:---:|:---:|
| evaluator | 2 | 28 | 26 |
| aks-explorer | 7 | 26 | 22 |
| may | 5 | 17 | 11 |

### Items Needing Human Validation

1. **`handler.failed-count` at threshold=150**: Current value is 10. The threshold is 15× the actual value and was raised 5× in 48h. The metric cannot alert on any realistic failure condition. **Needs restructuring** — either exclude aks-rp-e2e worker timeouts from the count, or retire the metric in favor of `handler.success-rate` (currently 99.1%).

2. **`project.*` triplet at threshold=0**: Day 3 of carryover. These generate 15–24 wasted alerts daily. Raising to threshold=2 would eliminate 100% of the noise.

3. **`evaluator.stale-running-session-count` threshold=0**: With 27 alerts in 24h and 18 escalations that all self-resolved, the current configuration produces significant waste. Needs stale-session threshold increase or aks-explorer exemption.

### Action Item Tracking from Yesterday

| Item | Priority | Status |
|------|----------|--------|
| Raise `project.owner-judgment-needed-count` 0→2 | P1 | ❌ **Day 3 — NOT DONE** |
| Raise `project.owner-incomplete-count` 0→2 | P1 | ❌ **Day 3 — NOT DONE** |
| Raise `project.health.finding-count` 0→2 | P1 | ❌ **Day 3 — NOT DONE** |
| Fix scout dispatch-dedup blocking cycle | P1 | ✅ Only 1 occurrence today (down from 3) |
| Validate `handler.failed-count` threshold=150 | P1 | ❌ **NOT DONE** — metric now useless |
| Investigate AKS 82% live run failure rate | P2 | ⚠️ `aks-rp-e2e.run.live-failed-24h` downgraded to P3 — good, but root issue persists |
| Review aggressive-push exemption | P2 | ❌ **Day 3 — NOT DONE** |
| Monitor DB growth | P3 | ⚡ **1,012 MB** (up from 943 MB — +69 MB/day accelerating) |

---

## Section 5: Recurring Systemic Patterns

### Pattern 1: Stale-Session Escalation Cascade (NEW — Critical)

The most expensive pattern this review period:

```
aks-explorer task runs 35min → stale-session metric breaches
→ alert fires → metric-alert-reactor dispatches triage
→ triage reads DB, finds stale session, sends P0/P1 escalation to may
→ may receives message, queues response
→ session finishes on its own → metric recovers → alert resolves
→ 15 minutes later: another aks-explorer session hits 35 min
→ CYCLE REPEATS (27 times in 24h)
```

**Impact**: 25 triage sessions × ~5 min each = **~2 hours** of agent compute. 18 P0/P1 escalation messages to may — all effectively noise.

**Root cause**: The 30-minute staleness threshold predates the aks-rp-e2e project. AKS replay tests routinely take 30–55 minutes. The threshold correctly catches genuinely stalled sessions but cannot distinguish them from legitimately long-running ones.

**Fix options (pick one)**:
- A) Raise stale threshold from 30 min to 60 min globally
- B) Add per-agent staleness thresholds (60 min for aks-explorer, 30 min for others)
- C) Add a `session.expected_duration` field to long-running task sessions
- D) Change alert mode to `consecutive_failures` with count=6 (require 30 min of _sustained_ staleness rather than a single snapshot)

### Pattern 2: Provider Error Burst — Self-Healing (Healthy)

At 05:28 UTC, an Anthropic connection error burst hit 16 sessions in 16 seconds. Three metrics fired (`provider-error-count-1h`, `first-turn-error-count-1h`, `failed-triage-rate-3h`). Triage correctly identified it as transient, chose `waiting_with_evidence`, and all metrics self-recovered by 06:33 UTC.

**Assessment**: The system handled this perfectly — no manual intervention, correct wait-and-observe strategy. ✅

### Pattern 3: AKS Live Run Failure Rate — Structurally Managed

`aks-rp-e2e.run.live-failed-24h` has been the subject of serial threshold calibration (20→55) over the past week. Today's triage took the correct structural action: **downgrade to P3** with a documented rationale that the absolute-count metric is inherently noisy (reruns inflate it, volume varies). The `handler.success-rate` metric already covers overall pipeline health.

**Assessment**: Good resolution of a threshold-chase cycle. The P3 demotion keeps it on dashboards without triggering triage. ✅

### Pattern 4: Project Steward Carousel — Chronic, Worsening

The `project.*` triplet has now generated **1,092 lifetime alerts** (63.6% of all alerts ever). The pattern is unchanged from Day 1: aks-rp-e2e's aggressive-push policy triggers findings that auto-resolve in <20 minutes. No triage judgments are even recorded for these because they resolve before triage completes.

**Assessment**: This is the most wasteful pattern in the system. The cost is not just 15 alerts/day — it's the downstream handler fires, event bus traffic, and snapshot noise. ❌

---

## Section 6: Infrastructure Health

| Signal | Status | Value | Δ from Yesterday | Notes |
|--------|--------|-------|------:|-------|
| Message delivery | ✅ | 100% | — | No failures |
| Handler success rate (6h) | ✅ | 99.2% | +4.5pp | Much improved |
| Handler p95 duration (ms) | ✅ | 108,349 | -409,000 | Dramatically improved (was 517s) |
| Session error rate (6h) | ✅ | 9.9% | +5.1pp | Higher but within threshold |
| DB size | ⚠️ | **1,012 MB** | **+69 MB** | Accelerating growth (was +52 MB). At 2GB threshold, ~14 days to breach |
| Active sessions | ✅ | 2 | -2 | Normal |
| Zombie sessions | ✅ | 0 | — | Clean |
| Guard blocks (15m) | ✅ | 0 | — | Clean |
| Stale metrics | ✅ | 0 | — | Clean |
| Heartbeat coverage | ✅ | 5/5 | — | All agents active |
| Guard triggers (24h) | ⚠️ | 2,381 | +527 | Rising — 119 units from 2,500 threshold |
| Event bus events (1h) | ℹ️ | 929 | — | High but expected with AKS activity |

### DB Growth Concern

```
June 10:  891 MB
June 11:  943 MB  (+52 MB)
June 12: 1012 MB  (+69 MB) ← accelerating
```

At current growth rate (+69 MB/day), the DB will breach the 2,000 MB threshold in **~14 days** (around June 26). Recommend investigating what tables are growing fastest and whether old session data can be pruned.

---

## Section 7: Action Items

| Priority | Item | Owner | Due | Carryover |
|----------|------|-------|-----|:---------:|
| **P0** | Address stale-session alert storm: raise threshold to 60 min or add per-agent thresholds | may/human | Today | New |
| **P1** | Raise `project.owner-judgment-needed-count` threshold 0→2 | human/may | **Overdue** | ⚠️ Day 3 |
| **P1** | Raise `project.owner-incomplete-count` threshold 0→2 | human/may | **Overdue** | ⚠️ Day 3 |
| **P1** | Raise `project.health.finding-count` threshold 0→2 | human/may | **Overdue** | ⚠️ Day 3 |
| **P1** | Restructure or retire `handler.failed-count` metric — threshold=150 is meaningless | may | Today | Day 2 |
| **P2** | Investigate DB growth acceleration (+69 MB/day, 14 days to breach) | may | This week | Updated |
| **P2** | Monitor guard triggers approaching 2,500 threshold (currently 2,381) | may | This week | New |
| **P3** | Validate `aks-rp-e2e.run.live-failed-24h` P3 demotion — ensure pass rate doesn't degrade further | aks-explorer | Next week | New |

---

## Appendix A: 7-Day Alert Volume by Metric

```
project.health.finding-count          ████████████████████████████████████  63
project.owner-judgment-needed-count   ███████████████████████████████████   62
project.owner-incomplete-count        █████████████████████████████████     58
evaluator.stale-running-session-count ██████████████████                    31
aks-rp-e2e.task.ready-starvation      █████████                            15
aks-rp-e2e.run.live-failed-24h        █████                                 8
session.failed-triage-rate-3h         ████                                  7
agent.heartbeat-dark-count-2h         ████                                  7
aks-rp-e2e.task.capacity-underfilled  ████                                  6
aks-rp-e2e.task.no-work-with-gaps     ██                                    4
project.task-parser-error-count       ██                                    3
project.invalid-format-count          ██                                    3
metric.stale-active-count             ██                                    3
handler.failed-count                  ██                                    3
guard.warned-count-24h                ██                                    3
guard.triggered-count-24h             ██                                    3
session.provider-error-count-1h       ▏                                     1
session.first-turn-error-count-1h     ▏                                     1
handler.p95-duration                  ▏                                     1
evaluator.substantive-low-quality     ▏                                     1
eval.llm-coverage-lag-h               ▏                                     1
aks-rp-e2e.task.blocked-count         ▏                                     1
aks-rp-e2e.model.failed-path-count    ▏                                     1
aks-rp-e2e.artifact.duplicate-groups  ▏                                     1
```

## Appendix B: Triage Operation Distribution (24h)

```
resolve_stale        ████████████████████ 19  (32%)
upgrade_or_escalate  ██████████████████   18  (31%)
waiting_with_evidence█████████████        13  (22%)
calibrate_metric     ██████                6  (10%)
fix_root_cause       ██                    2  ( 3%)
downgrade_priority   █                     1  ( 2%)
```

## Appendix C: Day-over-Day Trend

| Metric | Jun 10 | Jun 11 | Jun 12 | Trend |
|--------|:---:|:---:|:---:|:---:|
| Total alerts | — | 47 | 71 | ↑ 51% |
| Triage judgments | — | 18 | 59 | ↑ 228% |
| Resolution rate | 80% | 100% | 100% | ✅ |
| Mean TTR | — | 13.3 min | 24.6 min | ↑ 85% |
| Open at report time | — | 0 | 0 | ✅ |
| Noisiest metric | project.* triplet | project.* triplet | stale-sessions | Changed |
| DB size (MB) | ~891 | 943 | 1,012 | ↑ accelerating |

## Appendix D: Lifetime Alert Distribution

- **Total lifetime alerts**: 1,717
- **Top 3 metrics (project.* triplet)**: 1,092 alerts (63.6%)
- **100% resolution rate** (all lifetime alerts resolved)
- **Newest noisy metric**: `evaluator.stale-running-session-count` — 47 alerts in 7 days, all transient

---

*Report generated by may (daily-alert-review cron). Prior report: [2026-06-11](./2026-06-11-alert-review.md). Next review: 2026-06-13.*
