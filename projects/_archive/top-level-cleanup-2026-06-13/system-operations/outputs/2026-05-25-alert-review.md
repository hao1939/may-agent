# Daily Alert Review — 2026-05-25

## Summary

| Metric | Alerts (24h) | Breach/Recover Cycles | Status |
|--------|---:|---:|--------|
| project.health.finding-count | 8 | 8 breach→recover | ⚠️ Noisy |
| project.owner-incomplete-count | 8 | 8 breach→recover | ⚠️ Noisy |
| project.owner-judgment-needed-count | 8 | 8 breach→recover | ⚠️ Noisy |
| scout.sourced-artifacts-24h | 1 | 1 breach→recover | ✅ Resolved |
| handler.heartbeat-coverage | 1 | 1 breach→recover | ✅ Resolved |
| agent.heartbeat-dark-count-2h | 1 | 1 breach→recover | ✅ Resolved |
| scout.knowledge-preamble-coverage | 1 (old) | — | 🔴 Unresolved |

**Total alerts fired: 28 | Unique incidents: ~7 | Unresolved: 1**

---

## 🚨 Noisy Thresholds (Action Required)

### `project.health.finding-count`, `project.owner-incomplete-count`, `project.owner-judgment-needed-count`

These three metrics fired **8 times each** in 24h with identical breach/recover cycles every ~2-6 hours. Every single alert breached at `current=1, threshold=0` and auto-resolved within 20-45 seconds.

**Root cause:** Threshold of 0 is too tight. Any transient project scan finding triggers a breach that resolves on the next scan. This is pure noise — no human action was ever needed.

**Recommendation:**
- Raise threshold to ≥1 for all three, or
- Add a `min_duration` / debounce (e.g., must be breached for ≥5 minutes before alerting), or
- Downgrade to P3/informational so they don't trigger triage workflows

---

## ✅ Resolved Incidents

### `scout.sourced-artifacts-24h` (P2)
- **Breach:** Scout sourced artifacts dropped to 0 (rolling window expiry)
- **Resolution:** Three `alert_judged` events — first diagnosed as rolling-window expiry, second fixed regex (`Sources:` vs `Source:`), third confirmed fix with actual KE entry. Recovered after ~57 minutes.
- **Verdict:** Good triage. Regex fix was a real improvement (commit b289f657, aff7ebd2).

### `handler.heartbeat-coverage` + `agent.heartbeat-dark-count-2h` (P0)
- **Breach:** 4 agents went dark simultaneously due to auto-blocking (3 error outcomes in 7d window)
- **Resolution:** Judged as auto-block issue; `blocked=True` flags reset. Recovered in ~30 minutes.
- **Verdict:** Correct remediation. The auto-block safety mechanism was overly aggressive.

---

## 🔴 Unresolved Alerts

### `scout.knowledge-preamble-coverage` (Alert #415)
- **Created:** 2026-05-20 (5 days ago)
- **Current value:** 0.217, threshold: 0.25, target: 0.8
- **Owner:** None assigned
- **Status:** No `alert_judged` event found; no remediation sessions detected.

**This alert has no owner and no triage.** It needs assignment.

---

## Systemic Patterns

1. **Flapping trio:** The 3 `project.*` metrics account for **24 of 28 alerts** (86%) and deliver zero signal. This is the #1 noise source in the system.

2. **Auto-block cascade:** The heartbeat-dark incident shows that the auto-block mechanism can take down all agents simultaneously. A single correlated failure window (likely a transient infra issue) triggered blocks across may/arc/scout/evaluator. Consider: requiring staggered block decisions or raising the error threshold from 3→5.

3. **Missing owners:** Alert #415 (`scout.knowledge-preamble-coverage`) has been open 5 days with no owner. The alert system lacks an escalation path for unowned alerts.

4. **Validation gap:** None of the `project.*` rapid-fire alerts triggered `alert_judged` events — they resolve too fast for triage to engage. The system wastes compute spawning triage for ephemeral breaches.

---

## Recommendations

| Priority | Action |
|----------|--------|
| P1 | Add debounce/min-duration to `project.health.finding-count`, `project.owner-incomplete-count`, `project.owner-judgment-needed-count` |
| P1 | Assign owner to `scout.knowledge-preamble-coverage` alert |
| P2 | Review auto-block thresholds to prevent correlated agent shutdowns |
| P2 | Add escalation rule: unresolved alerts >48h without owner → notify human |
