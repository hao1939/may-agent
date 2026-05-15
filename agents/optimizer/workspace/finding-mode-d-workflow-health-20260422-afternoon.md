# Finding: Workflow Health — Strong Adoption, Persistent-Task Waste Continues

**Date**: 2026-04-22 ~20:15 UTC  
**Mode**: D (Workflow Health)  
**Dispatch**: NO_DISPATCH — persistent-task fix already dispatched Apr 22

## Workflow Adoption (48h window)
| Agent | Total | Workflow | % |
|-------|-------|---------|---|
| evaluator | 589 | 563 | 96% |
| may | 423 | 403 | 95% |
| tech-lead | 368 | 350 | 95% |
| optimizer | 302 | 285 | 94% |
| coach | 296 | 276 | 93% |
| bob | 302 | 271 | 90% |
| scout | 128 | 109 | 85% |
| qa | 97 | 81 | 84% |
| amy | 79 | 79 | 100% |

**System-wide: 93%+ adoption.** All agents above 80%. Healthy.

## Remaining Waste: Persistent-Task High-Op Sessions
Top 24h offenders (>30 ops): tech-lead 109/85/62 ops, may 72/69/60/52/48 ops, optimizer 67 ops.
All are persistent-task iterations. This is the #1 efficiency drag remaining.

The circuit breaker fix was dispatched in the previous heartbeat. Monitoring.

## Evaluator Scoring Gap
Recent sessions showing quality=0 with "evaluator did not score this agent" — heuristic evaluator not firing for some sessions. Not new (known issue from Apr 20 finding), but still present.
