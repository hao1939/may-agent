# Daily Alert Review — 2026-06-07

**Period**: 2026-06-06 08:07 UTC → 2026-06-07 08:07 UTC  
**Generated**: 2026-06-07 08:07 UTC  
**System health at review time**: 🟢 All 56 metrics in range

---

## Executive Summary

46 alerts fired across 7 distinct metrics. All 46 resolved. The day was dominated by one 11-hour P1 incident (`evaluator.substantive-low-quality-rate-24h`) caused by upstream `aks-rp-e2e` session interruption churn, which consumed **33 triage sessions** and **49 related sessions** before natural 24h-window decay resolved it. The remaining 42 alerts came from three project-health metrics with zero-thresholds that fire-and-resolve in 2-3 minute cycles — a clear noisy-threshold antipattern.

**Key numbers**: 99 sessions completed (99% success), 0 handler failures, 0 message delivery failures.

---

## Alert Breakdown

| # | Metric | Priority | Alerts | Resolved | Avg Resolution | Status |
|---|--------|----------|--------|----------|----------------|--------|
| 1 | `project.owner-incomplete-count` | P2 | 14 | 14 | 2m 41s | 🔊 Noisy |
| 2 | `project.owner-judgment-needed-count` | P2 | 14 | 14 | 2m 41s | 🔊 Noisy |
| 3 | `project.health.finding-count` | P1 | 14 | 14 | 2m 59s | 🔊 Noisy |
| 4 | `evaluator.substantive-low-quality-rate-24h` | P1 | 1 | 1 | 10h 58m | ⚠️ Incident |
| 5 | `agent.heartbeat-dark-count-2h` | P0 | 1 | 1 | 15m 0s | ✅ Fixed |
| 6 | `guard.triggered-count-24h` | P3 | 1 | 1 | 10m 30s | ✅ Self-healed |
| 7 | `guard.warned-count-24h` | P3 | 1 | 1 | 10m 30s | ✅ Self-healed |

**Total**: 46 alerts, 46 resolved, 0 unresolved

---

## Incident #1: evaluator.substantive-low-quality-rate-24h — P1, 11-hour breach

### Timeline
- **20:55 UTC Jun 6** — Breach: 0.3022 > 0.30 threshold (target: 0.10)
- **21:00–07:45 UTC** — 33 `metric.alert_judged` events across 49 triage/steward sessions
- **Peak**: 0.3756 at ~04:50 UTC Jun 7
- **07:53 UTC Jun 7** — Recovered: metric dropped below 0.30 as bad sessions aged out of 24h window

### Root Cause
The `aks-rp-e2e` project drove a burst of **~199 interrupted/error `aks-explorer` sessions**. The metric formula counts evaluations whose joined session status is `error` or `interrupted` as "substantive quality failures" — so upstream infrastructure interruptions were misattributed as evaluator quality problems.

### Triage Operations Used (33 judgments)
| Operation | Count | Notes |
|-----------|-------|-------|
| `upgrade_or_escalate` | ~20 | Repeated escalations to human |
| `waiting_with_evidence` | ~7 | Waiting for 24h window to age out |
| `fix_root_cause` | ~3 | Sent requests to aks-explorer |
| `calibrate_metric` | ~2 | Identified design/measurement mismatch |
| `other` | ~1 | Mixed |

### Assessment
**The triage loop was pathological.** 33 sessions reached the same diagnosis but couldn't close the alert because:
1. The root cause was upstream (aks-explorer), not evaluator-side
2. The metric formula conflates infrastructure interruptions with quality failures
3. Dirty worktree prevented safe commits from triage sessions
4. Each 20-minute triage cycle re-investigated the same data

**Recommendation**: 
- ⚡ **Calibrate metric**: Split `evaluator.substantive-low-quality-rate-24h` to exclude external-project interruptions, or add an agent/project exclusion filter
- ⚡ **Add triage dedup**: After 3 consecutive same-conclusion judgments on the same alert, suppress further auto-triage and mark as `waiting_with_evidence` until a validation condition triggers
- ⚡ **aks-rp-e2e stability**: The project generated 199+ interrupted sessions; needs task-sizing or timeout review

---

## Incident #2: agent.heartbeat-dark-count-2h — P0, 15-minute recovery

### Timeline
- **18:05 UTC Jun 6** — `arc` heartbeat sessions entered an error cycle
- **18:16 UTC Jun 6** — May forked a new arc heartbeat session to break the cycle
- **18:20 UTC Jun 6** — Recovered

### Assessment
✅ **Clean fix_root_cause operation.** This is how triage should work: detect → diagnose → fix → validate. Total cost: 1 triage session, 677 seconds.

---

## Incident #3: Guard count spike — P3, self-healed

- **10:22 UTC Jun 6** — Guard triggers/warnings hit 2005/2009 (threshold: 2000)
- **10:32 UTC Jun 6** — Dropped below threshold as old triggers aged out

No action required. The guards are working as designed.

---

## 🔊 Noisy Threshold Analysis

The three project-health metrics account for **42 of 46 alerts (91%)** but represent normal operational transients:

| Metric | Threshold | Typical Value | Fire Pattern |
|--------|-----------|---------------|--------------|
| `project.health.finding-count` | 0 | 0 or 1 | Every project reconciler pass |
| `project.owner-judgment-needed-count` | 0 | 0 or 1 | Every project iteration |
| `project.owner-incomplete-count` | 0 | 0 or 1 | Every project transition |

**Pattern**: These fire in triplets every time the project reconciler runs and a project temporarily enters a transitional state. They self-resolve in 1-3 minutes.

### Recommendation
- **Raise threshold to 2** for all three, or **add a debounce/hysteresis** (e.g., only alert if value > 0 for 3+ consecutive snapshots)
- Alternative: **Downgrade to P3 dashboard-only** — these are operational indicators, not actionable alerts
- At minimum, add a `sensitivity` or `min_duration` filter so transient=1 doesn't fire

---

## Missing Owners

None detected. All 7 alerting metrics have explicit owners:
- `evaluator.substantive-low-quality-rate-24h` → evaluator
- `agent.heartbeat-dark-count-2h` → may
- `project.*` → may
- `guard.*` → may

---

## Unresolved Validation

| Issue | Status | Owner |
|-------|--------|-------|
| `evaluator.substantive-low-quality-rate-24h` metric calibration | Resolved (metric recovered), but underlying design mismatch unfixed | evaluator / human |
| aks-rp-e2e interruption pattern | Project paused; needs root-cause review | aks-explorer / human |
| Triage loop dedup gap | No guard against 33 repetitive triage sessions | may (handler) |

---

## Recurring Systemic Patterns

### 1. Triage Loop Amplification (CRITICAL)
A single P1 alert generated **33 triage sessions × ~3 min each ≈ 100 minutes of agent compute** on repeated identical analysis. The system lacks a circuit breaker for repetitive triage. After 3-5 same-conclusion sessions, further triage should be suppressed until the next meaningful state change (metric recovery, human input, or scheduled validation).

### 2. Zero-Threshold Cascade (HIGH)
Three metrics with threshold=0 produce 42 alerts/day for transient operational states. This wastes evaluator aftermath capacity (each alert generates breach + recovered events, each event may trigger handlers). Signal-to-noise ratio for the project-health family is approximately **1:42**.

### 3. Metric Design Mismatch (MEDIUM)
`evaluator.substantive-low-quality-rate-24h` conflates "session ended in error/interrupted" with "evaluator quality failure." When external projects generate interruption bursts, this metric breaches even though the evaluator is working correctly. The metric name suggests evaluator quality but measures upstream session health.

### 4. Dirty Worktree Blocking Triage Closure (MEDIUM)
Multiple triage sessions noted they couldn't commit evidence artifacts because the `/app` worktree had "extensive unrelated dirty paths." This is a systemic friction that forces `partial` finishes on sessions that completed their actual work.

---

## Current Metric State (All Green)

| Category | Metrics | Status |
|----------|---------|--------|
| P0 Health | 5 metrics | ✅ All PASS |
| P1 Gauges | 13 metrics | ✅ All in range |
| P2 Gauges | 18 metrics | ✅ All in range |
| P3 Gauges | 10 metrics | ✅ All in range |
| P1-P2 Health | 10 metrics | ✅ All PASS |

**Noteworthy values** (within threshold but watching):
- DB size: 868 MB (threshold: 2000 MB) — growing; current at ~43% of threshold
- Guard triggers (24h): 1,887 (threshold: 2,000) — close to threshold
- Broad needs-improvement rate: 50.6% (threshold: 80%) — elevated but dashboard-only
- Reviewed good sessions overturned: 10.1% (target: 5%, threshold: 60%) — above target

---

## Action Items

| # | Priority | Item | Owner |
|---|----------|------|-------|
| 1 | P1 | Add triage-loop circuit breaker: max 3-5 same-conclusion sessions per alert before auto-suppressing | may (handler) |
| 2 | P1 | Calibrate `evaluator.substantive-low-quality-rate-24h` to exclude external-project interruptions | evaluator / human |
| 3 | P2 | Raise project.* trio thresholds from 0 → 2, or add hysteresis debounce | may (config) |
| 4 | P2 | Review aks-rp-e2e task sizing/timeouts to prevent interruption bursts | aks-explorer / human |
| 5 | P3 | Investigate dirty-worktree friction blocking triage session commits | dev |
