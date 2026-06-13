# Daily Alert Review — 2026-05-30

## Executive Summary

**49 alerts** fired in the last 24h across **7 unique metrics**. All resolved except one long-standing unresolved alert (scout knowledge preamble coverage, open since 2026-04-20). The dominant pattern is **high-frequency flapping** on project health metrics with threshold=0, generating massive noise.

**4 remediation sessions** were triggered via `metric.alert_judged` events, all successfully resolved their targets.

---

## Alert Breakdown by Metric

| Metric | Alerts (24h) | Priority | Pattern |
|--------|-------------|----------|---------|
| `project.owner-incomplete-count` | 16 | P2 | 🔴 Noisy flapper |
| `project.owner-judgment-needed-count` | 15 | P2 | 🔴 Noisy flapper |
| `project.health.finding-count` | 11 | P1 | 🔴 Noisy flapper |
| `handler.heartbeat-coverage` | 1 | P0 | ✅ Resolved (token expiry) |
| `agent.heartbeat-dark-count-2h` | 1 | P0 | ✅ Resolved (auto-blocked heartbeats) |
| `session.first-turn-error-count-1h` | 1 | P1 | ✅ Resolved (threshold calibrated 10→15) |
| `session.failed-triage-rate-3h` | 4 | P1 | ⚠️ Recurring (evaluator throughput) |

## Unresolved Alerts

| ID | Metric | Age | Status |
|----|--------|-----|--------|
| 415 | `scout.knowledge-preamble-coverage` | **40 days** | No owner, no remediation |

---

## Noisy Thresholds — Action Required

### 🚨 Critical: Project metrics with threshold=0 are generating ~42 alerts/day

The following three metrics fire every time the scan runs and recover seconds later:

- `project.owner-incomplete-count` (threshold=0, always current=1)
- `project.owner-judgment-needed-count` (threshold=0, always current=1)
- `project.health.finding-count` (threshold=0, always current=1)

**Recommendation:** Raise thresholds to 1 (or 2) since current=1 is the steady-state. These generate ~14 breach/recover cycles per day each — pure noise drowning out real signals.

---

## Remediation Sessions

| Alert | Operation | Session | Outcome |
|-------|-----------|---------|---------|
| #1016 `handler.heartbeat-coverage` | upgrade_or_escalate → fix | s_1780092874472_181 | ✅ IDE token expired; agents restarted |
| #1017 `agent.heartbeat-dark-count-2h` | fix_root_cause | s_1780091851402_149 | ✅ Unblocked 5 auto-blocked heartbeats |
| #1045 `project.task-parser-error-count` | fix_root_cause | s_1780127353301_419 | ✅ Parser error fixed in project.md |
| #1014 `session.first-turn-error-count-1h` | calibrate_metric | s_1780085074377_137 | ✅ Threshold raised 10→15 |

---

## Recurring Systemic Patterns

### 1. Heartbeat auto-blocking cascade
When provider errors (401/token expiry) cause heartbeat failures, the auto-block mechanism (3 errors in 7d) disables all agents simultaneously. This creates a P0 cascade: dark count spikes → coverage drops → two P0 alerts fire. **Root cause:** single token dependency with no graceful retry window before blocking.

### 2. Failed triage rate instability
`session.failed-triage-rate-3h` breached 4 times. The evaluator struggles to keep up with burst failures. Each breach triggers an escalation to may, but the metric self-recovers as the window slides. **Pattern:** evaluator is reactive, not proactive — it only triages after breach notification.

### 3. Project scan flap cycle
Every project health scan triggers breach→recover within seconds. The scan itself creates the transient state it detects. This is a measurement artifact, not a real operational concern.

---

## Missing Owners

| Metric | Current Owner | Issue |
|--------|--------------|-------|
| `scout.knowledge-preamble-coverage` | None assigned | 40 days unresolved, no triage |

---

## Unresolved Validation

- Alert #415 (`scout.knowledge-preamble-coverage` at 0.2081 vs threshold 0.25) has had **no validation attempt** in 40 days. No `metric.alert_judged` event exists for it.

---

## Recommendations

1. **[P0] Calibrate project thresholds:** Set `project.owner-incomplete-count`, `project.owner-judgment-needed-count`, and `project.health.finding-count` thresholds to ≥1. This eliminates ~42 noisy alerts/day.
2. **[P1] Add debounce/cooldown:** Prevent re-alerting on the same metric within 30min if no state change occurred.
3. **[P1] Assign owner for scout.knowledge-preamble-coverage:** Either fix the coverage gap or calibrate the threshold downward.
4. **[P2] Review heartbeat auto-block policy:** Consider requiring 3 _consecutive_ errors rather than 3 in 7d, to prevent cascade blocking from transient provider outages.
5. **[P2] Proactive triage scheduling:** Have evaluator run triage on a timer (not just on breach notification) to prevent failed-triage-rate breaches.
