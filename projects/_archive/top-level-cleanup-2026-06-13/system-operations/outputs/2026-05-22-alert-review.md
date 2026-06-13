# Daily Alert Review — 2026-05-22

## Summary

| Metric | 24h Fires | Status |
|--------|-----------|--------|
| project.owner-incomplete-count | 54 | ⚠️ Noisy |
| project.owner-judgment-needed-count | 53 | ⚠️ Noisy |
| project.health.finding-count | 39 | ⚠️ Noisy |
| project.task-parser-error-count | 16 | ⚠️ Noisy |
| session.failed-triage-rate-3h | 1 | ✅ Resolved |
| scout.sourced-artifacts-24h | 1 | ✅ Resolved |
| metric.stale-active-count | 1 | ✅ Resolved |
| handler.heartbeat-coverage | 1 | ✅ Resolved |
| eval.llm-coverage-lag-h | 1 | ✅ Resolved |
| capability.status-reality-mismatch-count | 1 | ✅ Resolved |
| agent.heartbeat-dark-count-2h | 1 | ✅ Resolved |

**Total alerts fired: 170 | Events: 169 breach, 169 recovered, 26 judged**

## Unresolved Alerts

| ID | Metric | Since | Message |
|----|--------|-------|---------|
| 415 | scout.knowledge-preamble-coverage | 2026-05-18 | Coverage 0.21, threshold 0.25, target 0.80 |

## 🚨 Critical Findings

### 1. Extreme Alert Noise — Project Health Trio

The three metrics `project.owner-incomplete-count`, `project.owner-judgment-needed-count`, and `project.health.finding-count` are firing **~50× per day each** (every ~25 minutes on average). They breach at value=1, immediately auto-resolve, then re-fire on the next scan cycle.

**Root cause:** Threshold of 0 is unrealistic for operational metrics that naturally fluctuate to 1 during normal work cycles. These are not actionable alerts — they are monitoring noise.

**Recommendation:** Raise thresholds to ≥1 (or add hysteresis/cooldown). Current state makes the alert system useless for detecting real degradation in these dimensions.

### 2. Task Parser Errors — Recurring (16 fires)

`project.task-parser-error-count` fires repeatedly as parser errors appear and get fixed. The pattern suggests task files are regularly edited in ways that temporarily break parsing. Consider:
- Adding a grace period (e.g., 5-min debounce) before alerting
- Or raising threshold to 2+

### 3. Unresolved: Knowledge Preamble Coverage (4 days stale)

Alert #415 has been unresolved since May 18. Coverage is at 21.4% vs 25% threshold (target 80%). **No owner is actively working this.** This represents the scout agent's knowledge base having insufficient preamble documentation.

### 4. Missing Alert Judgment Coverage

Only 26 of 169 breach events (15%) received `metric.alert_judged` treatment. The majority of alerts fire and resolve without any remediation session or human judgment, confirming they are noise rather than signals.

## Systemic Patterns

1. **Flap-and-resolve cycle**: The dominant pattern is breach→recover within seconds/minutes. The system is monitoring transient states, not sustained degradation.
2. **No sustained outages in 24h**: All operational alerts resolved. System health is good beneath the noise.
3. **Bootstrap batch**: IDs 554-558 fired simultaneously at system startup (stale metrics, dark agents, eval lag). All resolved within ~20 min of agents becoming active — expected cold-start behavior.

## Recommendations

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Raise thresholds for owner-incomplete, owner-judgment-needed, health.finding-count to ≥1 | metrics-owner |
| P1 | Add cooldown/hysteresis to task-parser-error alerting | metrics-owner |
| P1 | Assign owner & create task for scout.knowledge-preamble-coverage remediation | scout / human |
| P2 | Improve alert_judged coverage — auto-judge transient alerts that resolve in <60s | metrics-owner |
