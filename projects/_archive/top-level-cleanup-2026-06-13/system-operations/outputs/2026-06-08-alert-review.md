# Daily Alert Review — 2026-06-08

## Executive Summary

**Window**: 2026-06-07 07:00 UTC → 2026-06-08 07:00 UTC  
**Total alerts fired**: 40 (all resolved)  
**Unresolved alerts**: 0  
**P0 alerts**: 1 (heartbeat dark — resolved in 30min)  
**P1 alerts**: 1 (session.failed-triage-rate — resolved)  
**Triage sessions**: 4 (all judged with evidence)  
**System status at review time**: ALL GREEN — 0 active alerts

---

## 1. Alert Volume by Metric

| Metric ID | Fires (24h) | Priority | Owner | Avg TTR (min) | Pattern |
|-----------|-------------|----------|-------|---------------|---------|
| `project.health.finding-count` | 13 | P1 | may | ~4 | 🔴 NOISY |
| `project.owner-judgment-needed-count` | 12 | P2 | may | ~4 | 🔴 NOISY |
| `project.owner-incomplete-count` | 9 | P2 | may | ~5 | 🔴 NOISY |
| `project.task-parser-error-count` | 2 | P1 | may | ~22 | ✅ Normal |
| `agent.heartbeat-dark-count-2h` | 1 | P0 | may | ~30 | ✅ Normal |
| `session.failed-triage-rate-3h` | 1 | P1 | evaluator | ~21 | ✅ Normal |

**Total distinct metric IDs alerting**: 6  
**Total breach events**: 85 (metric.breach + metric.recovered + metric.alert_judged)

---

## 2. Critical Incidents

### 2.1 P0: Heartbeat Agent Dark (alert #1538)
- **Fired**: 2026-06-08 02:30 UTC
- **Resolved**: 2026-06-08 03:00 UTC (30 min TTR)
- **Root cause**: Transient scheduling gap — `arc` agent heartbeat delayed >2h
- **Remediation session**: `s_1780869012805_1139` — investigated dispatch-dedup and circuit-breaker state, confirmed both clean
- **Second triage**: `s_1780870674563_1150` — confirmed arc recovery, all 5 agents running
- **Verdict**: Resolved organically; no systemic fault found

### 2.2 P1: Failed Session Triage Rate (alert #1520)
- **Fired**: 2026-06-07 18:29 UTC (current=0.2, threshold=0.8)
- **Resolved**: 2026-06-07 18:50 UTC  
- **Root cause**: Evaluator-aftermath selectively missing some failed sessions in the 3h window
- **Triage operation**: `upgrade_or_escalate` — escalated the recurring selective miss pattern to human/runtime ownership
- **Verdict**: Resolved by natural session throughput catching up; structural fix still pending

---

## 3. Noisy Threshold Analysis

### 🔴 `project.health.finding-count` — 13 fires in 24h
- **Threshold**: 0 (fires on any finding)
- **Typical breach value**: 1
- **Behavior**: Fires every ~90 min, auto-resolves within 4 min
- **Assessment**: This is a **zero-tolerance threshold on a metric that naturally oscillates**. Project health scans find transient issues (parser errors, incomplete tasks) that the next heartbeat cycle fixes. Threshold=0 means every transient spike alerts.
- **Recommendation**: Raise threshold to ≥2, or add a `min_duration_ms: 600000` (10min) debounce before alerting.

### 🔴 `project.owner-judgment-needed-count` — 12 fires in 24h  
- **Threshold**: 0 (fires when any project task needs judgment)
- **Typical breach value**: 1 (briefly 2 once)
- **Behavior**: Fires → resolves within 4-8 minutes as may's heartbeat processes judgment tasks
- **Assessment**: Working as designed but **too sensitive**. The system self-heals within one heartbeat cycle.
- **Recommendation**: Either raise threshold to ≥2, or suppress re-alerting within 30 min of last resolution.

### 🔴 `project.owner-incomplete-count` — 9 fires in 24h
- **Threshold**: 0
- **Same pattern** as above — transient, self-healing within 5 min
- **Recommendation**: Same as `owner-judgment-needed-count`

---

## 4. Remediation Sessions

| Alert ID | Metric | Triage Session | Operation | Duration | Outcome |
|----------|--------|---------------|-----------|----------|---------|
| #1538 | heartbeat-dark-2h | s_1780869012805_1139 | fix_root_cause | ~12 min | Clean — no fault |
| #1538 | heartbeat-dark-2h | s_1780870674563_1150 | resolve_stale | ~4 min | Confirmed recovery |
| #1547 | task-parser-error | s_1780891477321_1305 | resolve_stale | ~5 min | Transient spike, already fixed |
| #1551 | task-parser-error | s_1780893951673_1325 | fix_root_cause | ~3 min | Fixed parser issue, committed |
| #1520 | failed-triage-rate | s_1780834341587_919 | upgrade_or_escalate | ~6 min | Escalated to human |

**Triage success rate**: 5/5 (100%) — all sessions produced evidence and chose appropriate operations

---

## 5. Missing Owners

All alerts in this window have clear owners:
- `agent:may` owns 5 of 6 metric IDs (project.* and agent.heartbeat-dark)
- `agent:evaluator` owns 1 (session.failed-triage-rate-3h)

**No orphaned alerts.** Owner assignment is comprehensive.

---

## 6. Unresolved Validation

No alerts are pending validation. All `metric.alert_judged` events include `nextValidationAt: null`, meaning the triage sessions resolved definitively without scheduling follow-up checks.

The one escalation (`session.failed-triage-rate-3h` → `upgrade_or_escalate`) was handed to human/runtime ownership. The metric has since recovered to 1.0, suggesting the underlying issue was transient selective coverage, but no structural fix was deployed.

---

## 7. Recurring Systemic Patterns

### Pattern A: Project-Health Metrics Oscillation Loop
The top 3 alert sources (`project.health.finding-count`, `project.owner-judgment-needed-count`, `project.owner-incomplete-count`) form a **synchronized oscillation pattern**:
1. Every ~90 min, a heartbeat scan detects a transient condition
2. Metric breaches → alert fires → event emitted
3. Next heartbeat (or the same session) resolves the condition
4. Metric recovers → recovered event

This produces **34 out of 40 alerts** (85%) in the 24h window. The system is generating noise that obscures real signals.

### Pattern B: Parser Error Transients  
`project.task-parser-error-count` fired twice — both were transient spikes from mid-edit project files that resolved within minutes. The triage correctly identified them as not requiring structural fixes.

### Pattern C: Heartbeat Dark is Genuinely Rare
Only 1 P0 alert in 24h. The heartbeat monitoring system correctly escalates real gaps and doesn't false-positive. This metric's threshold=0 is appropriate for P0.

---

## 8. Recommendations

| # | Priority | Action | Owner |
|---|----------|--------|-------|
| 1 | P2 | Add 10-min debounce to `project.health.finding-count` threshold or raise to ≥2 | may/runtime |
| 2 | P2 | Add 10-min debounce to `project.owner-judgment-needed-count` or raise to ≥2 | may/runtime |
| 3 | P2 | Add 10-min debounce to `project.owner-incomplete-count` or raise to ≥2 | may/runtime |
| 4 | P3 | Monitor `session.failed-triage-rate-3h` for recurrence — structural fix not yet deployed | evaluator |
| 5 | P3 | Consider alert-fatigue metric: track alerts/day and alert if >20 fires without a genuine P0/P1 | may |

---

## 9. Health Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Alert response time | ✅ A | All alerts triaged within 30 min |
| Resolution completeness | ✅ A | 40/40 resolved, 0 unresolved |
| Signal-to-noise ratio | ⚠️ C | 85% of alerts are noisy oscillation |
| Owner coverage | ✅ A | 100% of metrics have owners |
| Triage quality | ✅ A | 5/5 sessions with evidence |

**Overall**: System is **operationally healthy** but suffering from **alert fatigue** due to zero-tolerance thresholds on naturally oscillating metrics. Recommend threshold calibration as top priority.

---

*Generated: 2026-06-08 07:08 UTC | Review period: 24h | Next review: 2026-06-09*
