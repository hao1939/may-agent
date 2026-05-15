# Mode D: Workflow Health — 2026-04-21 Late

## Scan Parameters
- **Window**: ~18.7h (1046 sessions since 1776600000000)
- **Sessions with opCount ≥ 4**: 517

## Per-Agent Workflow Coverage

| Agent | Total | With WF | Coverage |
|-------|-------|---------|----------|
| bob | 46 | 30 | 65.2% |
| optimizer | 121 | 73 | 60.3% |
| coach | 80 | 29 | 36.3% |
| scout | 51 | 16 | 31.4% |
| tech-lead | 51 | 10 | 19.6% |
| qa | 38 | 5 | 13.2% |
| amy | 76 | 0 | 0% |
| may | 54 | 0 | 0% |

**Overall**: 163/517 = 31.5% (vs 30.8% baseline, +0.7pp)

## Assessment

- **No regression** — stable at ~31.5%, marginal improvement from baseline
- **Bob surged** from 50.3% → 65.2% — strongest adopter
- **Optimizer** holding at 60.3% (was 59.4%)
- **amy and may still at 0%** — these agents don't use workflows at all
- **No workflow errors** in this window

## Verdict

NO_DISPATCH — system stable, no anomalies. The 80% target remains far (48.5pp gap) but progress requires structural changes (workflow-first heartbeat rewrites for amy/may), not quick fixes. Per KE-123, don't stack interventions.
