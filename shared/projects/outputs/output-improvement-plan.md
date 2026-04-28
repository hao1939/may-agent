# Output Improvement Plan

## Post-Cleanup Snapshot
- Active shared projects: 5 (system-efficiency, agent-system-literacy, skill-workflow-audit, request-deduplication, handler-reliability)
- Archived: 51 zombie projects
- Projects producing deliverables: ~3
- Worker iterations with actual output: ~5 in last 7 days

## Top 3 Actions to Increase Throughput

1. **Fix worker instruction-following**: Workers announce intent but don't execute. Root cause: they read/analyze instead of writing. Fix: orchestrators must require write() as first tool call in every worker iteration. If a worker's first action is read() or bash(), the iteration is wasted.

2. **Close finished projects**: request-deduplication and handler-reliability have completed their core deliverables. Close them to reduce orchestrator context noise and free up iteration budget for new work.

3. **Increase active project count**: Only 3 projects are iterating regularly. Target: 5+ projects with regular iterations. Open new high-value projects to fill the pipeline.

## Next Milestones

| Milestone | Target | Timeframe |
|-----------|--------|-----------|
| Deliverables per day | 5+ files/day | Immediate |
| Every worker iteration produces a file | 100% | Immediate |
| Close completed projects | 2 projects closed | Next 2 days |
| Open new high-value projects | 2 new projects | Next 3 days |
| Reduce wasted iterations | <10% no-output rate | 1 week |

## Measurement

- **Primary metric**: deliverables produced per day (files written to outputs/)
- **Secondary metric**: iteration waste rate (iterations with no file written)
- **Review cadence**: daily check on output volume, weekly review of project pipeline health
