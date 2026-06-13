# Daily Alert Review — 2026-05-21

## Executive Summary

**132 alerts fired in 24h** across 10 distinct metrics. The system is overwhelmingly noisy: 3 project-health metrics account for **109 of 132 alerts** (83%) through rapid breach→recover→breach cycling every ~5 minutes. One persistent unresolved alert remains (`scout.knowledge-preamble-coverage`). The stale-session metric triggered repeated expensive triage sessions that could not self-resolve due to read-only constraints.

## Alert Volume by Metric

| Metric | Alerts (24h) | Priority | Pattern |
|--------|-------------|----------|---------|
| project.owner-judgment-needed-count | 38 | P2 | Flapping (threshold=0) |
| project.owner-incomplete-count | 36 | P2 | Flapping (threshold=0) |
| project.health.finding-count | 35 | P1 | Flapping (threshold=0) |
| project.task-parser-error-count | 8 | P1 | Real breaches, fixed 4× via root-cause |
| evaluator.stale-running-session-count | 6 | P1 | Real, long-running aks-explorer sessions |
| guard.triggered-count-24h | 3 | P3 | Marginal (1305-1318 vs 1300 threshold) |
| metric.stale-active-count | 2 | P1 | Transient |
| session.provider-error-count-1h | 1 | P1 | Resolved |
| session.failed-triage-rate-3h | 1 | P1 | Resolved |
| guard.warned-count-24h | 1 | P3 | Resolved |

## Unresolved Alerts

| ID | Metric | Created | Age |
|----|--------|---------|-----|
| 415 | scout.knowledge-preamble-coverage | 2026-05-20T21:28Z | ~27h |

**No owner** has triaged alert #415. Coverage is at 0.215 vs 0.25 threshold (target 0.8).

## Triage & Remediation Activity

- **`project.task-parser-error-count`**: Fixed root-cause 4 times (commits ace26aebc, fe1c3974f, e7ab54706, 8f6c1ecce, 876459759). Parser errors keep recurring because upstream project.md edits introduce malformed task blocks.
- **`evaluator.stale-running-session-count`**: 10+ triage sessions (alert_judged events), all concluded `upgrade_or_escalate` to human. The aks-explorer probe (`bootstrap-profile-byo-acr-lifecycle.ts`) is legitimately long-running but exceeds the 30-min inactivity cutoff. One session was documented as an exception.
- **Project health trio** (owner-incomplete, owner-judgment-needed, health.finding): All self-resolve within seconds to minutes. No remediation needed — these are threshold-sensitivity issues.

## 🚨 Findings & Recommendations

### 1. Noisy Thresholds (Critical)
The three project-health metrics use **threshold=0 with target=0**, meaning ANY momentary value of 1 triggers an alert. They fired **109 times in 24h** — pure noise.

**Recommendation**: Raise thresholds to ≥1 or add a sustained-breach window (e.g., must breach for ≥5 min before alerting). This would eliminate ~83% of alert volume.

### 2. Missing Owner: scout.knowledge-preamble-coverage
Alert #415 has been unresolved for 27h with no triage session. No `metric.alert_judged` event exists for it.

**Recommendation**: Assign scout-agent or human review. Coverage at 0.215 needs attention.

### 3. Unresolved Validation: Stale Session Handling
The evaluator cannot terminate stale sessions from read-only triage environments. This causes repeated escalation loops (6 alerts, 10+ triage sessions, all ending in `upgrade_or_escalate`).

**Recommendation**: Implement an auto-handler that can safely cancel sessions flagged as STALL by `monitor-session.cjs`, or add a session-age exception for aks-explorer probes with known long runtimes.

### 4. Recurring Systemic Pattern: Parser Error Cycle
`project.task-parser-error-count` breached 8 times and was fixed 4 times — the fixes work but new edits re-introduce errors. The root cause is that project.md task-block formatting is fragile.

**Recommendation**: Add a pre-commit or pre-write validation hook that rejects malformed task blocks before they reach the metric.

### 5. Guard Trigger Threshold Marginal
`guard.triggered-count-24h` hovers at 1300-1318 against a 1300 threshold. This is borderline noise.

**Recommendation**: Raise threshold to 1400 or add hysteresis.

## Metrics Health Summary

- **Total breaches (24h)**: ~70 breach events
- **Total recoveries (24h)**: ~65 recovery events  
- **Triage judgments**: 15 `metric.alert_judged` events
- **Fix operations**: 5 (all `project.task-parser-error-count`)
- **Escalations**: 8 (all `evaluator.stale-running-session-count`)
- **Signal-to-noise ratio**: ~17% (23 meaningful alerts out of 132)
