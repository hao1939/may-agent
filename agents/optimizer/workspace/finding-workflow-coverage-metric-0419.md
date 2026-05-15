# Finding: Workflow Coverage Metric Regression (2026-04-19)

## Summary
The metric shows **13.9%** but has **two measurement bugs** inflating the gap. After correction the true figure is **~24.7%** — still far from 80%, making this both a measurement issue AND a real adoption gap.

## Metric Location
- **Metric ID**: `optimizer.workflow-coverage` in `.state/may.db` → `metrics` table
- **Measured by**: `agents/may/handlers/metrics-snapshot.ts` (hourly auto-measurement)
- **Source query**: Counts sessions with `workflowRunId IS NOT NULL` over sessions with `opCount > 3 AND kind != 'chat'`

## Bug #1: Denominator Double-Counts Workflow Child Sessions
The query counts ALL sessions with opCount > 3, including **child sessions spawned by workflows**. These 986 child sessions appear in the denominator as "multi-step work not using workflows" even though they ARE workflow work — they just don't have `workflowRunId` set directly (only the orchestrator session does).

**Impact**: Denominator is 3202 instead of ~2928 (workflow runs + freestyle roots). Deflates metric by ~3-4 percentage points.

**Fix**: Either:
- Exclude sessions where `parentSessionId IS NOT NULL` (count only root-level work)
- Or count distinct workflow runs as numerator vs (workflow runs + freestyle roots) as denominator

## Bug #2: Target Value is 0.8 (Not 80)
The heartbeat shows `13.9% → 0.8%` — the target is stored as `0.8` in the DB. If the intended target is 80%, it should be `80`. If 0.8 is meant as a fraction (0.8 = 80%), the current value (13.9) uses percentage units, creating a units mismatch.

**Fix**: `UPDATE metrics SET target = 80 WHERE id = 'optimizer.workflow-coverage';`

## Corrected Measurement

| Metric | Current Query | Corrected |
|--------|--------------|-----------|
| Numerator | 897 (sessions with workflowRunId) | 724 (distinct workflow runs) |
| Denominator | 3202 (all multi-step sessions) | 2928 (workflow runs + freestyle roots) |
| **Result** | **28.0%** (or 13.9% at time of snapshot) | **24.7%** |

### Recommended Query
```sql
SELECT ROUND(100.0 * 
  (SELECT COUNT(DISTINCT workflowRunId) FROM sessions 
   WHERE startedAt > (strftime('%%s','now')*1000 - 604800000) AND workflowRunId IS NOT NULL)
  / NULLIF(
    (SELECT COUNT(DISTINCT workflowRunId) FROM sessions 
     WHERE startedAt > (strftime('%%s','now')*1000 - 604800000) AND workflowRunId IS NOT NULL)
    + (SELECT COUNT(*) FROM sessions 
       WHERE startedAt > (strftime('%%s','now')*1000 - 604800000) AND opCount > 3 
       AND kind != 'chat' AND parentSessionId IS NULL AND workflowRunId IS NULL),
  0), 1)
```

## Real Adoption Gap: Top 3 Agents Not Using Workflows

Even with corrected measurement (~25%), there's a real gap to 80%. The top freestyle offenders:

| Agent | Freestyle Root Sessions | % of All Freestyle | Action |
|-------|------------------------|-------------------|--------|
| **coach** | 426 | 19.3% | Review-only assessment pattern — create `review-output` workflow (see finding-freestyle-patterns-0419.md) |
| **tech-lead** | 347 | 15.7% | Similar review/assessment work — same `review-output` workflow would apply |
| **qa** | 284 | 12.9% | QA validation sessions — create `qa-validate` workflow |

These 3 agents account for **1,057 of 2,204 freestyle sessions (48%)**. Converting even half to workflows would push coverage from 25% → ~42%.

### Additional high-impact targets:
- **optimizer** (278 freestyle) — investigation sessions could use an `investigate` workflow
- **may** (238 freestyle) — mostly cron-triggered infra work, harder to workflow-ify
- **scout** (182 freestyle) — research sessions, variable structure

## Recommended Actions
1. **Fix metric query** — use corrected query above (addresses Bug #1)
2. **Fix target value** — set to 80 (addresses Bug #2)
3. **Create `review-output` workflow** — covers coach + tech-lead review patterns (~770 sessions)
4. **Create `qa-validate` workflow** — covers QA validation pattern (~284 sessions)
5. **Re-measure after fixes** — expect jump from 13.9% → ~25% from measurement fix alone
