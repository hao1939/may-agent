# Daily Alert Review — 2026-05-10

**Period:** 2026-05-09 00:55 UTC – 2026-05-10 00:55 UTC  
**Total alerts:** 39  
**Resolved:** 37 (94.9%)  
**Still open:** 2 (5.1%)  

## Open Alerts (Require Attention)

| ID | Metric | Message | Since |
|----|--------|---------|-------|
| 273 | `project.iterations-24h` | Active project iterations (24h) = 0 (threshold: 1, target: 10) | 2026-05-09 21:10 UTC |
| 272 | `capability.message-conversation-close-rate` | Message conversation close rate = 0 (threshold: 0.02, target: 0.05) | 2026-05-09 20:55 UTC |

### Recommendations for Open Alerts

1. **project.iterations-24h (ID 273):** No project iterations in the last 24h. This is a recurring issue (also alert 269 earlier today, took ~5h to resolve). Investigate whether project scheduling/dispatching is stalled or if this is expected during low-activity periods.

2. **capability.message-conversation-close-rate (ID 272):** Conversation close rate dropped to 0. This metric fired 4 times today with progressively worsening values (0.2435 → 0.1429 → 0.0635 → 0). Indicates message conversations are being opened but never closed. Check if the close-conversation workflow is broken or if no conversations are completing naturally.

## Alert Frequency by Metric (Top Offenders)

| Metric | Count | Avg TTR (min) | Pattern |
|--------|-------|---------------|---------|
| `session.failed-triage-rate-3h` | 6 | 8.4 | Recurring, auto-resolves quickly |
| `project.invalid-format-count` | 6 | 7.2 | Recurring, auto-resolves quickly |
| `capability.message-conversation-close-rate` | 5 | 10.3* | Worsening trend, latest still open |
| `metric.stale-active-count` | 4 | 5.4 | Transient spikes |
| `project.blocked-count` | 3 | 20.3 | Moderate TTR |
| `project.iterations-24h` | 2 | 299.5* | Slow to resolve, latest still open |
| `v2.spec-coverage-rate` | 2 | 72.5 | Moderate |
| `v2.heartbeat-decision-rate` | 2 | 12.2 | Quick recovery |

*Averages include only resolved instances.

## Key Observations

1. **Noisy metrics:** `session.failed-triage-rate-3h` and `project.invalid-format-count` each fired 6 times but always auto-resolved within minutes. Consider raising thresholds or adding hysteresis to reduce noise.

2. **Worsening trend — message close rate:** Fired 5 times with declining values throughout the day (0.2435 → 0 over ~10h). The latest instance remains open. This is the highest-priority item to investigate.

3. **Session health incidents:** `session.zero-op-error-count-1h` hit 42 (threshold 0) and `session.empty-assistant-stop-count-1h` hit 23. Both resolved but indicate a period of degraded session quality earlier in the day.

4. **LLM evaluation lag:** Alert 241 showed 65.86h lag (threshold 4h). Resolved in ~42min, but the magnitude suggests evaluations were stalled for nearly 3 days before recovery.

5. **Overall resolution rate is strong** — 95% resolved, most within minutes. The system self-heals well for transient issues.

## Status Tracker

| Priority | Item | Owner | Status |
|----------|------|-------|--------|
| P0 | Investigate message-conversation-close-rate = 0 | manager | ⚠️ Open |
| P1 | Investigate project.iterations-24h = 0 | manager | ⚠️ Open |
| P2 | Evaluate noise reduction for failed-triage-rate-3h | manager | 💡 Suggestion |
| P2 | Evaluate noise reduction for project.invalid-format-count | manager | 💡 Suggestion |
| P2 | Root-cause the LLM eval lag (65h) to prevent recurrence | manager | 💡 Suggestion |
