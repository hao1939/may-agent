# Finding: Workflow Health — Apr 16, 2026

**Date**: 2026-04-16  
**Window**: Last 48h (Apr 14-16)  
**Previous baseline**: 10.2% adoption (Apr 12-14), 27.1% reported Apr 12

## Workflow Adoption (48h)

| Agent | Workflow | Total | Rate |
|-------|----------|-------|------|
| bob | 91 | 174 | **52.3%** |
| optimizer | 75 | 165 | 45.5% |
| tech-lead | 54 | 204 | 26.5% |
| coder | 31 | 129 | 24.0% |
| coach | 38 | 168 | 22.6% |
| may | 13 | 112 | 11.6% |
| scout | 5 | 89 | 5.6% |
| qa | 2 | 78 | 2.6% |
| evaluator | 0 | 466 | 0.0% |
| amy | 0 | 49 | 0.0% |
| **SYSTEM** | **309** | **1634** | **18.9%** |

### Trend
- Apr 12-14: **10.2%** (107/1049)
- Apr 14-16: **18.9%** (309/1634)
- **+8.7pp increase** — adoption nearly doubled

### Leaders & Laggards
- **Bob** leads at 52.3% — more than half of sessions are workflow-driven
- **Evaluator** (466 sessions, 0%) and **amy** (49, 0%) have zero workflow usage — evaluator sessions are all automated tree evals, so 0% is expected/acceptable
- **Scout** (5.6%) and **QA** (2.6%) have low adoption — potential improvement targets

## Workflow Session Characteristics

- All 309 workflow sessions are `kind=call` (child sessions spawned by workflows)
- 286 completed, 22 interrupted, 2 running
- **No workflow errors** in 48h window — zero failed workflow sessions
- Op counts for workflow call sessions range from 5-86 ops, with top consumers being bob (86), coach (80), coder (74)

## D-o-R Phase 1 Budget Cap

No D-o-R specific sessions found with ops>0 in last 48h — the feature appears dormant or renamed. The only matching sessions are evaluator tree-evals (0 ops). Cannot assess 15-op budget cap effectiveness from current data.

## Anti-Patterns

1. **No non-workflow sessions have opCount>0** — this is suspicious. Either opCount is only tracked for workflow child sessions, or non-workflow sessions complete without incrementing. This means we can't compare efficiency (workflow vs non-workflow) using opCount alone.

2. **High-op workflow children**: Some workflow call sessions hit 80+ ops (coach: 80, bob: 86). If the workflow was meant to constrain work, these are escaping budget limits.

3. **Evaluator volume**: 466 sessions (28% of all sessions) with 0% workflow usage. These are automated and expected, but they dilute the system-wide adoption metric. Excluding evaluator: 309/1168 = **26.4%**.

## Summary

System-wide workflow adoption rose from 10.2% → 18.9% (+8.7pp) over 4 days. Excluding evaluator (automated, expected 0%), effective adoption is 26.4%. Bob is the clear leader at 52.3%. No workflow errors detected. Key gap: scout and QA remain under 6%. The D-o-R budget cap couldn't be assessed — no matching sessions found.
