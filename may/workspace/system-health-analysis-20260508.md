# System Health Analysis — 2026-05-08 03:39 UTC

## Executive Summary
System is running well overall: 89% success rate across 46 sessions in the last 3h, all cron jobs healthy, most metrics green. Two areas need attention.

## Key Metrics Status

### 🟢 Healthy
| Metric | Current | Target |
|--------|---------|--------|
| Session error rate (6h) | 5% | <10% |
| Handler success rate (6h) | 100% | >95% |
| Handler failures (6h) | 0 | 0 |
| Evaluator aftermath liveness (3h) | 1.0 | >0.8 |
| Real output (24h) | 436 | >100 |
| Heartbeat coverage | 4/4 | 4 |
| All agent consecutive low-quality | 0 (PASS) | 0 |

### ⚠️ Needs Attention
| Metric | Current | Target | Threshold |
|--------|---------|--------|-----------|
| **v2 spec measurement coverage** | **0.1364** | 1.0 | 0.8 |
| Low-quality sessions (24h) | 13.2% | <10% | <30% |
| Session trace completeness (24h) | 0.002 | 1.0 | 0.001 |

### 📋 Projects
| Project | Status | Priority | Action Needed |
|---------|--------|----------|---------------|
| closed-loop-reliability | active | P1 | On track, iteration 1 |
| proof-of-life-dashboard | waiting | P1 | Unblock — check what it's waiting on |
| v2-spec-coverage-buildout | pending-review | P2 | Review and close/iterate |

## Red Metric Deep Dive: v2 spec measurement coverage (0.1364)

This is the only metric breaching its threshold. At 13.6% coverage vs 80% threshold, this is significantly below target. The `v2-spec-coverage-buildout` project is in `pending-review` status — it appears work was done but needs review/merge. **Action: review the pending deliverables and either advance the project or iterate.**

## Evaluation Quality (Last 15 Sessions)

- 13/15 rated "good" (quality 0.85)
- 2/15 rated "needs_improvement" (quality 0.55, 0.20)
- The 0.20 was an error session (agent ended without response)
- The 0.55 was a schema assumption issue (using wrong column names in queries)
- **Pattern**: schema drift errors are a recurring issue — agents assume column names instead of checking with PRAGMA first

## Stale Sessions Alert

61 "active" sessions showing, but most are interrupted/done sessions from 10-18h ago. Only 2 are genuinely running. The session cleanup mechanism may need attention — these stale entries could inflate metrics or confuse monitoring.

## Recommended Actions

1. **Review v2-spec-coverage-buildout** — this could resolve the red metric
2. **Unblock proof-of-life-dashboard** — P1 project sitting in waiting state
3. **Consider lesson propagation** — the "PRAGMA before query" pattern should be in agent context to prevent recurring schema errors
