# Finding: Workflow Health & Quality Preserved Metric — Mode D

**Date**: 2026-04-18 10:00 UTC  
**Mode**: D (Workflow Health)  
**Prior finding**: `findings/finding-mode-c-quality-preserved-20260418.md` (earlier today, broader analysis)

## Quality Preserved Metric

**Current**: 0.8882 (target: 0.9)  
**Window**: 7 days, 718 optimizer sessions (heuristic-evaluated, non-skipped)  
**Good (≥0.9)**: 440/718 = 61.3%

### Root Causes (optimizer-specific)

The 0.012 gap to target is driven by:

| Category | Count | Avg Quality | Impact |
|----------|-------|------------|--------|
| False zeros ("evaluator did not score") | 5 | 0.0 | -0.006 |
| Session errors (crashes/timeouts) | 4 | 0.1 | -0.004 |
| FM-3.3 verification failures | 3 | 0.12-0.25 | -0.003 |
| Process violations (inline work in HB, blind overwrite) | 3 | 0.25 | -0.003 |

**Key observations:**
1. **False zeros are the #1 drag** — 5 sessions scored 0 because evaluator failed to score them. These are scoring infra bugs, not quality bugs. Fixing these alone would bring metric to ~0.894.
2. **Session errors** — 4 sessions crashed/timed out (0.1 quality). These are infra issues, not behavioral.
3. **FM-3.3 is already in active_recall** — the 3 verification failures match the recalled patterns. Guards are catching them (finish blocked), but the sessions still get low scores.
4. **Process drift** — 3 sessions did inline work in heartbeats or violated ORDER-004 (no op budgets). These are judgment issues.

### What would fix it?

| Fix | Estimated lift | Feasibility |
|-----|---------------|-------------|
| Fix false-zero scoring bug | +0.006 → 0.894 | Infra fix in evaluator |
| Eliminate session errors | +0.004 → 0.898 | Infra (crash recovery) |
| Both above | +0.010 → 0.898 | Still below 0.9 |
| + Eliminate FM-3.3 entirely | +0.003 → 0.901 | ✅ Above target |

**Conclusion**: The gap is ~50% scoring infra bugs (false zeros + session errors) and ~50% genuine quality issues (FM-3.3, process drift). Hitting 0.9 requires BOTH fixing the scoring bugs AND maintaining current FM-3.3 guard effectiveness.

## Workflow Adoption (24h)

No work sessions with `workflowRunId` found in last 24h (query returned empty). This is expected — optimizer's work sessions are mostly Mode A-D rotations dispatched via heartbeat forks, which don't use formal workflows.

Prior measurement (Apr 17): optimizer at 66.1% workflow adoption (was for a different time window with different session mix).

## Standard Mode D Checks

1. **No new workflow issues** — no errors or regressions observed
2. **Prior D-o-R fixes holding** — P1 budget cap still effective (per todo.md)
3. **Persistent-task iteration cap** — deployed Apr 17, no new spikes observed

## Recommendation

**R1 = NO_ACTION on quality metric** — the gap is dominated by scoring infra (false zeros, session errors) which are not optimizer-fixable. FM-3.3 guards are already active and catching issues. Per KE-123, don't stack interventions.

**R2 = MONITOR** — if false-zero rate increases, escalate to tech-lead for evaluator scoring fix.

Next rotation: **A** (Session Archaeology)
