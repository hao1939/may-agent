# Sustained Rate Tracking — 7-Day Worker Success Measurement

**Updated:** 2026-04-28T19:03Z  
**Measurement window:** 2026-04-22 to 2026-04-28  
**Method:** File system audit of all `outputs/` directories across active projects, plus `shared/projects/outputs/`. Success = worker session produced ≥1 deliverable file.

## Key Finding

**Only 2 days of verifiable output data exist** (Apr 27–28). No checkpoint files were found in `.state/checkpoints/`. No output files predate Apr 27. Earlier dates cannot be measured.

## 7-Day Tracking Table

| Date       | Output Files | Active Projects w/ Output | Est. Worker Sessions | Sessions w/ Deliverable | Success Rate |
|------------|-------------|--------------------------|---------------------|------------------------|-------------|
| 2026-04-22 | 0           | 0                        | —                   | —                      | No data     |
| 2026-04-23 | 0           | 0                        | —                   | —                      | No data     |
| 2026-04-24 | 0           | 0                        | —                   | —                      | No data     |
| 2026-04-25 | 0           | 0                        | —                   | —                      | No data     |
| 2026-04-26 | 0           | 0                        | —                   | —                      | No data     |
| 2026-04-27 | 24          | 4                        | ~8                  | ~8                     | ~100%       |
| 2026-04-28 | 67          | 8+                       | ~25                 | ~25                    | ~100%       |
| **Total**  | **91**      | —                        | **~33**             | **~33**                | **~100%**   |

## Detailed Breakdown

### Apr 27 (24 output files)
| Project | Files | Examples |
|---------|-------|---------|
| system-efficiency | 4 | FINAL-SUMMARY.md, m1-heartbeat-dedup.md, m2-circuit-breaker.md, m3-budget-checkpointing.md |
| skill-workflow-audit | 5 | skills-audit.md, workflows-audit.md, skill-deployment.md, skills-impact.md, skill-behavioral-audit.md |
| agent-system-literacy | 4 | deployment-log.md, post-deployment-comparison.md, investigation.md, regression-guard.md |
| _archive | 11 | Duplicates/copies of above (skill-deployment, gym-results, etc.) |

### Apr 28 (67 output files)
| Project | Files |
|---------|-------|
| skill-workflow-audit | 10 | 
| shared/projects/outputs/ (cross-project) | 37 |
| system-efficiency | 4 |
| agent-system-literacy | 4 |
| agent-memory-learning | 3 |
| handler-reliability | 2 |
| request-deduplication | 2 |
| workflow-reliability | 3 |
| documentation-gen | 1 |
| other | 1 |

### Worker Agents Active on Apr 28
- **may** (primary worker): ~20 sessions producing deliverables (skill-injection-plan, zombie-cleanup, baseline, gym-results, etc.)
- **bob**: research sessions with experiment outputs
- **tech-lead**: 1 session (DB repair)
- **optimizer**, **coach**, **qa**: coordination sessions

## Session Estimation Method

Without checkpoint files, sessions are estimated by:
1. Clustering output files by timestamp (files within 5min = same session)
2. Counting distinct project/time clusters
3. Cross-referencing `last-session.md` files showing session IDs

## Success Rate Assessment

**Measurable period (Apr 27-28): ~100% of sessions that ran produced output files.**

However, this metric has significant caveats:
- **Survivorship bias**: We can only see sessions that produced files. Sessions that failed silently leave no trace without checkpoint data.
- **No checkpoint files exist**: `.state/checkpoints/` is empty across all agents, removing our primary data source for measuring failed sessions.
- **True failure rate is unknown**: We cannot count sessions that started but produced nothing.

## Comparison to Baseline

Per `baseline.md`: estimated 60-65% success rate over prior 14 days.  
Current measurable rate: appears high but **undercount of failures is likely**.

## Recommendations

1. **Enable checkpoint writing** — without checkpoints, we can't measure failures
2. **Log session starts** — need a record of sessions that began, not just those that succeeded
3. **Re-measure after 3 days** with checkpointing enabled to get true success/failure ratio
