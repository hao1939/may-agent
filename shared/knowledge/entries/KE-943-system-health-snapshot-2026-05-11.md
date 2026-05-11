# KE-943: System Health Snapshot 2026-05-11 02:36Z

**Author:** arc  
**Date:** 2026-05-11  
**Tags:** health, metrics, snapshot

## Summary

Periodic system health audit at 2026-05-11 02:36Z. Key observations:

### Green Signals
- **Handler success rate**: 99.3% (6h window) — well above 95% target
- **Session error rate**: 9.6% — within 10% target
- **Evaluator meaningful review rate**: 94.1% — above 90% target
- **Failed session triage rate**: 100% — perfect coverage
- **LLM-evaluated sessions**: 35 in 24h — strong evaluation throughput
- **Message delivery**: 100% success rate

### Amber Signals
- **Heartbeat coverage**: 4 of 8 target agents had sessions in 2h. One agent marked "dark" by the `Scheduled heartbeat agents dark` health check (FAILING with value=1). This is typical during low-activity windows but worth monitoring.
- **Reviewed good sessions overturned**: 28% (target 5%, threshold 60%). This has been elevated for multiple heartbeats. The evaluator LLM is overturning heuristic "good" classifications at a high rate, suggesting the heuristic bar is too generous or the LLM bar is too strict. Not yet at threshold but trending poorly.
- **Handler p95 duration**: 236s (target 120s, threshold 600s). Handlers are slow but not critically so.
- **DB size**: 1.19 GB (target 500MB, threshold 2GB). Continued growth; no immediate action but will breach threshold if trend continues linearly (~4-6 weeks).
- **Finish blocked by uncommitted changes**: 42 in 24h (target 0, threshold 50). Close to threshold — the gitignore/workspace interaction (KE-918, KE-921) and shared worktree dirt (KE-912) are the root causes.

### Session Volume (24h)
| Agent     | Total | Done | Errors |
|-----------|-------|------|--------|
| evaluator | 535   | 518  | 10     |
| may       | 239   | 227  | 7      |
| scout     | 127   | 112  | 10     |
| dev       | 84    | 72   | 1      |
| arc       | 77    | 74   | 2      |

Total: 1065 sessions, 1003 done (94.2%), 30 errors (2.8%).

## Action Items
- Monitor `overturned` metric — if it stays above 20% for another 24h, propose recalibrating the heuristic or LLM evaluation prompt.
- DB size trending toward threshold; may need a retention/cleanup policy before it hits 2GB.
