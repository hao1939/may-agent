# Daily Alert Review — 2026-05-24

## Summary

| Metric | 24h Fires | Recoveries | Status |
|--------|-----------|------------|--------|
| project.owner-incomplete-count | 6 | 6 | ⚠️ Noisy |
| project.owner-judgment-needed-count | 6 | 6 | ⚠️ Noisy |
| project.health.finding-count | 6 | 6 | ⚠️ Noisy |
| session.failed-triage-rate-3h | 2 | 2 | ✅ Resolved |
| agent.heartbeat-dark-count-2h | 2 | 2 | ✅ Resolved |
| scout.sourced-artifacts-24h | 1 | 1 | ✅ Resolved |

**Total: 23 breaches, 23 recoveries, 0 currently open (24h window)**

## Unresolved Alerts (Older)

| ID | Metric | Since | Age | Message |
|----|--------|-------|-----|---------|
| 415 | scout.knowledge-preamble-coverage | 2026-05-20 | 4 days | Coverage 0.21, threshold 0.25, target 0.80 |

## 🚨 Critical Findings

### 1. Project Health Trio — Day 5 of Noise, No Remediation

`project.owner-incomplete-count`, `project.owner-judgment-needed-count`, and `project.health.finding-count` collectively fired **18 times** in 24h — all immediately auto-resolved. Every single fire is current=1 against threshold=0.

**This is now the 5th consecutive daily review flagging this.** Zero action has been taken. These three metrics account for 78% of all alert volume.

**Recommendation (unchanged):** Raise thresholds to ≥2 or add 30min cooldown. Escalating to P0.

### 2. scout.knowledge-preamble-coverage — 4 Days Unresolved, No Owner

Coverage remains ~0.21 vs target 0.80. No remediation session has been initiated.

**Missing owner.** This is a genuine product gap that needs assignment.

### 3. session.failed-triage-rate-3h — Improved

Fired twice (values: 0.71, 0.71), both recovered. Down from 3 fires yesterday. The low-volume skew pattern persists but is less frequent today.

### 4. agent.heartbeat-dark-count-2h — Transient

Two fires during a ~1h window (current=1), both resolved. An agent briefly went dark and recovered. No persistent issue.

### 5. scout.sourced-artifacts-24h — Brief Gap

Scout had a period with 0 artifacts sourced; resolved within ~20min. Likely a timing window issue with the 24h rolling counter.

## Systemic Patterns

| Pattern | Recurrence | Impact |
|---------|-----------|--------|
| Project health trio noise | **5 consecutive days** | #1 source of alert fatigue |
| Triage rate low-volume skew | 4 of last 5 days | False positives during quiet hours |
| Knowledge preamble coverage stall | 4 days unresolved | Genuine gap, no owner assigned |

## Noisy Thresholds (Tuning Needed)

| Metric | Current Threshold | Suggested | Rationale |
|--------|------------------|-----------|-----------|
| project.owner-incomplete-count | 0 | ≥2 or 30min cooldown | Fires on transient =1, resolves in seconds |
| project.owner-judgment-needed-count | 0 | ≥2 or 30min cooldown | Same pattern |
| project.health.finding-count | 0 | ≥2 or 30min cooldown | Same pattern |
| session.failed-triage-rate-3h | 0.8 | Add min-sample ≥5 | Single failures skew rate |

## Action Items

1. **[P0]** Debounce or raise thresholds on project health trio — **5 days unfixed, escalated**
2. **[P1]** Assign owner for scout.knowledge-preamble-coverage remediation (4 days stale)
3. **[P1]** Add minimum-sample guard to session.failed-triage-rate-3h
4. **[P2]** Investigate why no metric.breach/recovered/alert_judged events appear in events table (correlation gap)

## Health Assessment

**Overall: 🟡 Yellow** — No active outages, but chronic alert noise from unfixed thresholds is eroding signal quality. The system self-heals well (100% recovery rate today), but the lack of threshold tuning action across 5 days suggests a process gap in closing alert-review action items.
