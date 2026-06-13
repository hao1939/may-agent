# Proposal: Extend db-retention to uncapped tables

**Author:** arc
**Date:** 2026-06-15
**Priority:** P2
**Status:** proposed

## Problem

The `db-retention` handler (`agents/may/handlers/db-retention.ts`) currently
enforces retention on 3 tables: `events` (7d), `sessions` (14d), and
`metric_snapshots` (30d). Six other tables have no retention policy and
accumulate unboundedly:

| Table | Current rows | Oldest data | Growth rate |
|---|---|---|---|
| `session_digests` | 51,185 | 29.5 days | ~1,700/day |
| `workflow_runs` | 47,579 | 36.8 days | ~1,300/day |
| `evaluations` | 19,460 | 51 days | ~380/day |
| `file_reads` | 6,280 | unknown | unknown |
| `notification_messages` | 2,555 | unknown | unknown |
| `metric_alerts` | 1,762 | unknown | unknown |

The DB is at 1.2GB (57% of the 2GB `infra.persist.db-size-mb` threshold).
The three fastest-growing tables add ~3,380 rows/day combined. Without
retention, they will grow from ~118k rows today to ~219k rows in 30 days.

## Proposed change

Add three DELETE statements to `db-retention.ts`:

```typescript
// session_digests: 14 days (matches session retention)
db.run("DELETE FROM session_digests WHERE created_at < ?", [now - 14 * 86_400_000]);

// workflow_runs: 14 days (matches session retention — runs are session-linked)
db.run("DELETE FROM workflow_runs WHERE startedAt < ?", [now - 14 * 86_400_000]);

// evaluations: 30 days (evaluations reference sessions but have independent
// analytical value — retain longer)
db.run("DELETE FROM evaluations WHERE createdAt < ?", [now - 30 * 86_400_000]);
```

The remaining three tables (`file_reads`, `notification_messages`,
`metric_alerts`) total ~10k rows combined and are low-priority. They can be
addressed later if they grow.

## Why these windows

- `session_digests` is a session-linked summary table. No point keeping digests
  for sessions that were already purged (14d).
- `workflow_runs` are session-linked workflow execution records. Same reasoning.
- `evaluations` have analytical value (quality/efficiency trends). 30 days
  provides sufficient window for trend analysis while bounding growth.

## Risk

Low. All three tables are write-once (no updates after creation). The DELETE
conditions use the same pattern as existing retention statements. Agents
querying these tables already respect windowed queries.

## Validation

After deployment, verify:
1. `SELECT COUNT(*) FROM session_digests` drops by ~37k (rows older than 14d)
2. `SELECT COUNT(*) FROM workflow_runs` drops by ~30k (rows older than 14d)
3. `SELECT COUNT(*) FROM evaluations` drops by ~8k (rows older than 30d)
4. DB size (`infra.persist.db-size-mb`) decreases after next VACUUM
5. No evaluator, project, or metric workflow errors referencing these tables

## Location

Change: `agents/may/handlers/db-retention.ts` (not `src/` — this is an
agent-owned handler file)

Update: `shared/may-agent-docs/2a-design/events.md` Data Retention table
(already done in this session)
