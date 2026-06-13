# Daily Alert Review — 2026-05-11

**Period:** 2026-05-10 00:55 UTC – 2026-05-11 01:00 UTC  
**New alerts in period:** 0  
**Carryover open alerts:** 4  

## Summary

No new alerts fired in the last 24 hours. However, 4 alerts remain unresolved from prior periods, 2 of which were flagged in yesterday's review and have not improved.

## Open Alerts (Require Attention)

| ID | Metric | Current Value | Threshold | Target | Open Since | Age (h) |
|----|--------|--------------|-----------|--------|------------|---------|
| 197 | `scout.operational-friction-rate-24h` | 0.803 | < 0.3 | 0.1 | 2026-05-08 06:43 UTC | ~66h |
| 225 | `scout.good-session-rate-24h` | 0.379 | > 0.65 | 0.85 | 2026-05-09 00:04 UTC | ~49h |
| 272 | `capability.message-conversation-close-rate` | 0 | > 0.02 | 0.05 | 2026-05-09 20:55 UTC | ~28h |
| 273 | `project.iterations-24h` | 0 | > 1 | 10 | 2026-05-09 21:10 UTC | ~28h |

## Analysis & Recommendations

### 1. `scout.operational-friction-rate-24h` (ID 197) — 🔴 Critical, 66h open
- **Friction rate stuck at 80%**, well above the 30% threshold. No improvement in latest snapshots (0.803 → 0.803).
- **Action:** Investigate what causes friction in scout sessions. This is the longest-standing open alert. Consider whether the threshold is miscalibrated or if there's a systematic issue with session tooling/context loading.
- **Owner:** Scout agent / system operator.

### 2. `scout.good-session-rate-24h` (ID 225) — 🔴 Critical, 49h open
- **Good session rate at 37.9%**, target is 85%. Correlated with the high friction rate above.
- **Action:** These two metrics likely share a root cause. Prioritize friction reduction which should lift good-session rate.
- **Owner:** Scout agent / system operator.

### 3. `capability.message-conversation-close-rate` (ID 272) — 🟠 High, 28h open
- **Close rate at 0**, dropped from 0.24 → 0.14 → 0.06 → 0 over the prior day. Still at 0 in latest snapshots.
- **Action:** Check if the conversation-close workflow is broken. No conversations are being marked as closed. This may indicate a code regression or a stalled process.
- **Owner:** Manager / message handling system.

### 4. `project.iterations-24h` (ID 273) — 🟠 High, 28h open
- **Zero project iterations** for 28+ hours. Previously resolved (ID 269 took ~5h), but this instance is persisting much longer.
- **Action:** Check if project scheduling is stalled. No iterations means no forward progress on any project. This is a systemic concern.
- **Owner:** Manager / project scheduler.

## Trends vs Yesterday

| Aspect | Yesterday (May 10) | Today (May 11) |
|--------|-------------------|----------------|
| New alerts | 39 | 0 |
| Open at end of day | 2 | 4 |
| Resolved | 37 | 0 |
| Alert frequency | High churn, mostly auto-resolving | Quiet — but persistent open issues |

**Key observation:** The system stopped generating new alerts, but the 4 open alerts are stagnating. This is worse than yesterday's pattern of high-churn-but-resolving alerts. The lack of new alerts may itself indicate reduced system activity (consistent with 0 project iterations).

## Priority Actions

1. **Immediate:** Investigate why project iterations are at 0 for 28h — this blocks all project progress.
2. **Immediate:** Debug message conversation close-rate = 0 — likely a workflow or code issue.
3. **Short-term:** Address scout friction rate (80%) — longest-standing open alert at 66h.
