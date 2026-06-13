# Daily Alert Review — 2026-06-02

## Executive Summary

**64 alerts** fired in the last 24h across **8 unique metrics**. Three remain unresolved: two new guard-count alerts (#1130, #1131) and the long-standing scout knowledge preamble coverage (#415, now **43 days old**). The dominant pattern remains **high-frequency flapping** on project health metrics with threshold=0 — unchanged from prior reviews despite repeated recommendations.

**2 remediation sessions** ran via `metric.alert_judged`: one `fix_root_cause` on task-parser-error and **11 `upgrade_or_escalate`** judgments on `session.failed-triage-rate-3h` — all escalating the same evaluator-aftermath routing drift issue that remains unfixed.

---

## Alert Breakdown by Metric

| Metric | Alerts (24h) | Priority | Pattern |
|--------|-------------|----------|---------|
| `project.owner-incomplete-count` | 19 | P2 | 🔴 Noisy flapper (threshold=0, always current=1) |
| `project.owner-judgment-needed-count` | 16 | P2 | 🔴 Noisy flapper |
| `project.health.finding-count` | 13 | P1 | 🔴 Noisy flapper |
| `session.failed-triage-rate-3h` | 6 | P1 | ⚠️ Recurring — 11 escalations, no fix |
| `project.task-parser-error-count` | 4 | P1 | ✅ Fixed (parser error resolved via commit ab8bc61cf) |
| `evaluator.aftermath-coverage-rate-3h` | 3 | P3 | ⚠️ Borderline flapper (0.19 vs 0.20 threshold) |
| `guard.triggered-count-24h` | 1 | — | 🔴 **NEW** Unresolved (current=3514, threshold=1500) |
| `guard.warned-count-24h` | 1 | — | 🔴 **NEW** Unresolved (current=3514, threshold=1500) |

---

## Unresolved Alerts

| ID | Metric | Age | Status |
|----|--------|-----|--------|
| 415 | `scout.knowledge-preamble-coverage` | **43 days** | No owner, no remediation |
| 1130 | `guard.triggered-count-24h` | <1 day | **NEW** — No triage yet |
| 1131 | `guard.warned-count-24h` | <1 day | **NEW** — No triage yet |

---

## Noisy Thresholds — Action Required

### 🚨 CRITICAL (Day 4+ of same recommendation): Project metrics with threshold=0

These three metrics generated **48 of 64 alerts** (75%) in the last 24h:

- `project.owner-incomplete-count` — 19 alerts, always current=1, threshold=0
- `project.owner-judgment-needed-count` — 16 alerts, always current=1, threshold=0
- `project.health.finding-count` — 13 alerts, always current=1, threshold=0

**Status:** This has been called out in every daily review since 2026-05-30. No action taken. These generate ~48 breach/recover cycles/day — pure noise.

**Recommendation:** Raise thresholds to ≥1 immediately. This is a 2-line config change.

### ⚠️ NEW: `evaluator.aftermath-coverage-rate-3h` borderline flapping

Threshold=0.20, metric oscillates between 0.19-0.20. Generated 3 breach/recover cycles today.

**Recommendation:** Lower threshold to 0.15 or add hysteresis/cooldown.

---

## Remediation Sessions

| Alert | Operation | Outcome |
|-------|-----------|---------|
| #1137 `project.task-parser-error-count` | `fix_root_cause` | ✅ Parser error fixed, commit ab8bc61cf |
| #1137 `project.task-parser-error-count` | `resolve_stale` | ✅ Confirmed transient condition cleared |
| #1118/#1141/#1145/#1146/#1156/#1164 `session.failed-triage-rate-3h` | `upgrade_or_escalate` ×11 | ⚠️ All escalated, none resolved |

---

## Recurring Systemic Patterns

### 1. 🔴 Evaluator-aftermath routing drift (ESCALATING)
`session.failed-triage-rate-3h` has been breaching continuously. **11 separate `upgrade_or_escalate` judgments** were emitted in the last 24h alone — all identifying the same root cause: selective evaluator-aftermath routing skips. Failed sessions stop at `session.completed` + `handler.skipped` with no evaluator `context.read` or `evaluation.routed` events. The evaluator process is live (producing evaluations) but selectively missing certain failed sessions.

**Root cause identified:** Fenced-markdown trigger parser in aftermath routing (documented in `projects/evaluator-aftermath-routing-drift/outputs/package-code-path-root-cause.md`).

**Impact:** This alert fires, gets judged, escalated, self-recovers as the 3h window slides, then re-fires — a perpetual cycle consuming triage capacity with no forward progress.

### 2. 🔴 Guard count explosion (NEW)
`guard.triggered-count-24h` and `guard.warned-count-24h` both at 3514 vs threshold 1500. This is a new unresolved alert pair with no triage session yet. Likely related to the high-frequency project scan flapping generating guard triggers.

### 3. Project scan flap cycle (UNCHANGED)
Every project health scan triggers breach→recover within seconds. Steady-state is current=1 but threshold=0, creating guaranteed flap every scan cycle.

---

## Missing Owners

| Metric | Current Owner | Issue |
|--------|--------------|-------|
| `scout.knowledge-preamble-coverage` | None assigned | 43 days unresolved, no triage |
| `guard.triggered-count-24h` | Unknown | New alert, needs owner assignment |
| `guard.warned-count-24h` | Unknown | New alert, needs owner assignment |

---

## Unresolved Validation

- Alert #415 (`scout.knowledge-preamble-coverage`): **43 days** with no `metric.alert_judged` event. No triage attempted.
- Alerts #1130/#1131 (`guard.*-count-24h`): New as of today, no triage session dispatched yet.
- `session.failed-triage-rate-3h`: Has been triaged **11+ times** in 24h with identical `upgrade_or_escalate` verdict each time — the triage loop is running but producing no remediation.

---

## Recommendations

1. **[P0] Fix project metric thresholds NOW.** Set `project.owner-incomplete-count`, `project.owner-judgment-needed-count`, and `project.health.finding-count` thresholds to ≥1. This eliminates 75% of daily alert volume. This is the 4th consecutive daily review making this recommendation.

2. **[P0] Break the failed-triage-rate escalation loop.** The evaluator has escalated the same issue 11 times in 24h with no result. Either:
   - Apply the fenced-markdown trigger parser fix identified in the root-cause analysis
   - Or suppress/calibrate the metric until the fix ships
   - The current state wastes ~11 triage sessions/day on a known, documented, unfixed issue

3. **[P1] Triage guard count alerts (#1130, #1131).** Current=3514 vs threshold=1500 suggests either the threshold is too low or there's a real guard trigger explosion (possibly correlated with the 48 noisy project alerts).

4. **[P1] Assign owner for scout.knowledge-preamble-coverage.** 43 days unresolved is unacceptable for any monitored metric.

5. **[P2] Add alert deduplication/cooldown.** The system currently allows the same metric to fire unlimited alerts per day. A 30-min cooldown per metric would reduce today's 64 alerts to ~15.

6. **[P2] Lower `evaluator.aftermath-coverage-rate-3h` threshold to 0.15** or add hysteresis to prevent borderline flapping.
