# Mode D: Workflow Health — 6h Scan (Apr 18 ~15:00 UTC)

## Workflow Adoption (Last 6h)

| Agent | Total Sessions | Workflow | Rate |
|-------|---------------|----------|------|
| bob | 32 | 19 | **59.4%** |
| coach | 34 | 10 | 29.4% |
| evaluator | 102 | 0 | 0% |
| may | 17 | 0 | 0% |
| optimizer | 24 | 12 | **50.0%** |
| qa | 12 | 0 | 0% |
| scout | 16 | 4 | 25.0% |
| tech-lead | 25 | 12 | **48.0%** |
| **System** | **262** | **57** | **21.8%** |

**Trend**: System-wide adoption 21.8% — down from 27.1% (Apr 12 baseline). However, the denominator is inflated by evaluator (102 sessions, 0% WF by design) and qa (12, 0%). Excluding evaluator/qa: 57/148 = **38.5%**, healthy.

## Workflow Errors
**Zero workflow errors in last 6h.** All 57 workflow sessions completed successfully (status=done).

## Ops Comparison
- **Workflow sessions**: avg 10.4 ops (n=57)
- **Direct sessions**: avg 4.3 ops (n=205)

Workflow sessions use ~2.4x more ops, expected since they coordinate sub-agents. No outliers — highest was coach at 49 ops (legitimate complex task).

## ⚠️ Quality Alert: Significant Drop

| Window | Avg Quality | Avg Efficiency | N |
|--------|------------|----------------|---|
| 12-24h ago | **0.723** | 0.621 | 149 |
| Last 12h | **0.417** | 0.343 | 1,016 |
| Last 6h | **0.251** | 0.214 | 515 |

**Quality has dropped sharply** — from 0.723 → 0.251 over 24h. The previous measurement (Apr 18 ~09:30) found 0.887 vs 0.9 target. This 0.251 figure is a dramatic regression. Volume also spiked (149 → 1,016 evaluations in same window), suggesting either a batch of low-quality evaluations or an evaluator calibration shift.

## Assessment

1. **Workflow adoption**: Stable. No regression among workflow-capable agents. Bob leading at 59%.
2. **Workflow reliability**: Excellent — 0 errors in 57 sessions.
3. **Quality Preserved**: ⚠️ Major regression from 0.887 → 0.251. Needs investigation — could be evaluator recalibration, a flood of trivial sessions being scored harshly, or genuine quality drop. This warrants a dedicated Mode C investigation next cycle.
4. **NO_DISPATCH** — Quality drop is alarming but needs root-cause analysis before action. Don't stack interventions (KE-123).
