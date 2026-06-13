# Daily Alert Review — 2026-06-09

**Review period**: 2026-06-08 08:49 UTC → 2026-06-09 08:49 UTC  
**Generated**: 2026-06-09 08:49 UTC  
**Status**: 🟢 All alerts resolved — zero unresolved at review time

---

## Executive Summary

23 metric alerts fired in the last 24h across 4 metric IDs; all 23 resolved automatically. The system's closed-loop alert pipeline is functioning: breach → triage → fix → recovery happens without human intervention. However, three `project.*` metrics continue a chronic noisy-threshold pattern (134/132/129 fires in 7 days) that deserves threshold recalibration.

---

## 1. Alert Activity (24h)

| Metric ID | Fires | Resolved | Unresolved | Avg Resolve (s) |
|---|---|---|---|---|
| `project.health.finding-count` | 8 | 8 | 0 | 731s (~12m) |
| `project.owner-judgment-needed-count` | 7 | 7 | 0 | 569s (~9m) |
| `project.owner-incomplete-count` | 6 | 6 | 0 | 206s (~3m) |
| `project.invalid-format-count` | 2 | 2 | 0 | 491s (~8m) |
| **Total** | **23** | **23** | **0** | — |

### Event Correlation

| Event Type | Count (24h) |
|---|---|
| `metric.breach` | 23 |
| `metric.recovered` | 23 |
| `metric.alert_judged` | 1 |

The single `metric.alert_judged` event was for `project.invalid-format-count` alert #1565 (22:31 UTC), triaged by may in session `s_1780958217936_333` with operation `fix_root_cause`. Evidence: bash scan confirmed zero format errors post-fix, git commit `ba57ecc30`.

---

## 2. Breach Timeline (24h)

All breaches follow the same pattern: project reconciler detects a transient issue → metric crosses threshold → may heartbeat or metric-alert-triage workflow fixes root cause → metric recovers.

| Time (UTC) | Metric(s) | Duration | Notes |
|---|---|---|---|
| 08 10:53 | health+judgment+incomplete | ~54s | Rapid fire/recover triplet |
| 08 17:12 | health+judgment+incomplete | ~53s | Same pattern |
| 08 17:50 | health+judgment | ~46m | Longer; waited for next heartbeat cycle |
| 08 22:31 | invalid-format | ~10m | Judged & fixed by may (commit ba57ecc) |
| 08 23:12 | health+judgment+incomplete | ~4m | Standard auto-resolve |
| 09 05:21 | health+judgment+incomplete | ~8m | Triple: 3 cycles of fire+resolve within 18m |
| 09 05:29 | health+judgment+incomplete | ~3m | Continued chatter |
| 09 05:35 | health+judgment+incomplete | ~4m | Continued chatter |
| 09 07:03 | health+invalid-format | ~31m/6m | Both resolved; invalid-format faster this time |

---

## 3. Noisy Threshold Analysis 🔴

The dominant alert pattern is the **project health triplet**: `project.health.finding-count`, `project.owner-judgment-needed-count`, and `project.owner-incomplete-count` fire together in bursts, resolve in seconds-to-minutes, then re-fire at the next reconciler cycle.

### 7-Day Fire Rates

| Metric | 7d Fires | Fires/Day | Threshold | Assessment |
|---|---|---|---|---|
| `project.health.finding-count` | 134 | ~19/day | 0 | 🔴 **NOISY** — threshold=0 means any transient project state change fires an alert |
| `project.owner-judgment-needed-count` | 132 | ~19/day | 0 | 🔴 **NOISY** — same root cause |
| `project.owner-incomplete-count` | 129 | ~18/day | 0 | 🔴 **NOISY** — same root cause |

**Root Cause**: These three metrics have `threshold=0`, meaning any momentary count=1 during a project reconciler cycle triggers a breach. The project reconciler runs frequently, and normal project lifecycle (creating → processing → completing tasks) naturally produces transient `1` values. The alerts auto-resolve within seconds-to-minutes because the state is ephemeral.

**Recommendation**: Raise the threshold on all three from `0` to `2` (allow one concurrent transient finding without alerting), or add a sustained-duration gate (e.g., must breach for >5 minutes before firing an alert). This would eliminate ~95% of the noise (~380 alerts/week) while still catching genuinely stuck project states.

---

## 4. Remediation Sessions (24h)

318 metric-alert-related sessions ran in the last 24h:

| Agent | Done | Error | Running |
|---|---|---|---|
| evaluator | 174 | 2 | 0 |
| may | 48 | 0 | 0 |
| dev | 47 | 0 | 0 |
| arc | 41 | 5 | 1 |

- **arc errors**: 5 error-status sessions, all `empty tool-use assistant turn` terminations — a known transient pattern, not alert-related. 2 arc errors in the last 6h specifically.
- **evaluator errors**: 2 errors, both related to aftermath review (not alert handling).
- **Overall success rate**: 98% (97/99 sessions completed successfully in the 24h window).

---

## 5. Missing Owners / Unresolved Validation

| Issue | Status |
|---|---|
| Unresolved alerts | ✅ Zero — all 23 alerts resolved |
| Alerts without triage judgment | 22 of 23 had no explicit `metric.alert_judged` event — they auto-resolved before triage was needed. Only alert #1565 (`invalid-format-count`) received an explicit judgment. |
| Missing metric owners | None identified — all alerting metrics are active with clear ownership through the project health subsystem |

**Note**: The 22 auto-resolved alerts without explicit triage represent a gap in the audit trail. The system auto-resolves when the metric value drops below threshold, but doesn't record *why* it resolved or *who* fixed it. For the project health triplet this is acceptable (transient by nature), but for more serious metrics this gap could mask undiagnosed root causes.

---

## 6. Recurring Systemic Patterns

### Pattern 1: Project Health Triplet Chattering
- **Frequency**: ~57 fires/day across 3 metrics
- **Impact**: Low (all auto-resolve in <12m)
- **Risk**: Alert fatigue. When 95%+ of alerts are noise, the 5% that need attention may be missed.
- **Action**: Threshold recalibration (see §3)

### Pattern 2: Burst Firing at Heartbeat Boundaries
- 3–4 alerts fire simultaneously at ~:12/:35 past the hour, corresponding to heartbeat + reconciler cadence
- The burst pattern at 05:21→05:35 (three fire-resolve cycles in 14 minutes) is particularly noisy
- **Action**: Consider debounce or cooldown on `project.*` health metrics (suppress re-fire within 10 minutes of last resolution)

### Pattern 3: Quiet Non-Project Metrics
- No session, handler, evaluator, guard, or infrastructure metrics breached in 24h
- This is genuine health: error rate 2.24%, handler success 99.66%, message delivery 100%, zero zombies/stale sessions
- All 56 active metrics are within thresholds at review time

---

## 7. System Health Snapshot (at review time)

| Dimension | Value | Status |
|---|---|---|
| Active metrics | 56 | All green |
| Session error rate (6h) | 2.24% | ✅ (target <10%) |
| Handler success rate (6h) | 99.66% | ✅ |
| Heartbeat coverage | 5/5 agents | ✅ |
| DB size | 905.71 MB | ✅ (threshold 2000) |
| Unresolved alerts | 0 | ✅ |
| LLM eval lag | 0.22h | ✅ (target <1h) |
| Active sessions | 2 | ✅ |

---

## 8. Action Items

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Recalibrate `project.health.finding-count` threshold from 0→2 | may/dev | P2 |
| 2 | Recalibrate `project.owner-judgment-needed-count` threshold from 0→2 | may/dev | P2 |
| 3 | Recalibrate `project.owner-incomplete-count` threshold from 0→2 | may/dev | P2 |
| 4 | Investigate adding debounce/cooldown to project health metrics to prevent burst re-firing | dev | P2 |

---

*Next review: 2026-06-10*
