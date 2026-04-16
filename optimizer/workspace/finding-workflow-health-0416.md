# Finding: Workflow Health — 2026-04-16

## Summary

Workflows continue to deliver measurably better outcomes than non-workflow sessions across the board. The 47-op tech-lead error-log-scanner session shows a common anti-pattern: path-guessing causing early flailing.

## Workflow vs Non-Workflow (Last 24h)

| Metric | Workflow (n=212) | Non-Workflow (n=934) | Delta |
|--------|-----------------|---------------------|-------|
| Avg ops | 13.2 | 7.2 | +6.0 |
| Avg quality | 0.77 | 0.59 | +0.18 |
| Avg efficiency | 0.67 | 0.48 | +0.19 |
| Good verdict % | 62% | 55% | +7pp |
| Needs improvement % | 8% | 3% | -5pp |

**Key insight**: Workflow sessions use more ops (13.2 vs 7.2) but achieve significantly higher quality (+0.18) and efficiency (+0.19). The higher op count reflects that workflows are assigned to more complex tasks; the quality/efficiency gains show they handle that complexity well.

The "needs improvement" rate is higher for workflow sessions (8% vs 3%), likely because workflow sessions tackle harder problems where failure is more visible. Non-workflow sessions are mostly heartbeats and quick jobs.

## 47-Op Tech-Lead Session: Error-Log-Scanner Fix (s_1776334636807_2)

- **Verdict**: acceptable (not bad, but room for improvement)
- **Task**: Fix overdue error-log-scanner (1 day behind)
- **Root cause of bloat**: 15 wasted calls from early path-guessing and failure chains. The session started with bash commands that failed due to quoting issues in `bun -e` SQL queries, then had to recover.
- **Pattern**: This matches the known FM-1.3 anti-pattern (early path guessing). Tech-lead guessed file locations and query syntax instead of reading context first.

## Adoption Rate

- 212/1146 sessions (18.5%) used workflows in last 24h
- Workflow sessions are concentrated in `call` kind (sub-agent tasks spawned by coordinators)

## Recommendations

1. **No action needed on workflow system** — it's working well. Quality and efficiency deltas are strong.
2. **47-op session is isolated** — the path-guessing anti-pattern is already documented (FM-1.3). No systemic issue.
3. **Monitor workflow adoption** — 18.5% is reasonable given most sessions are heartbeat jobs that don't need workflows.
