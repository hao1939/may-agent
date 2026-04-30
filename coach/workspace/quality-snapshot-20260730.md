# Agent Quality Snapshot — 2026-07-30

## Source
Recent evaluations from `.state/evaluations/` (session-level LLM quality scores).

## Latest Eval Scores (from .state/evaluations/)

| Session ID | Agent | Quality | Efficiency | Verdict |
|---|---|---|---|---|
| s_1777471451597_3 | optimizer | 0.20 | 0.10 | needs_improvement |
| s_1777483248236_446 | optimizer | 0.10 | 0.05 | needs_improvement |
| s_1777483248263_447 | optimizer | 0.20 | 0.10 | needs_improvement |
| s_1777483248275_448 | coach | 0.00 | 0.00 | needs_improvement |

## From todo.md (6h window, LLM-only scores)

| Agent | Avg Quality | N |
|---|---|---|
| optimizer | 0.384 | 17 |
| tech-lead | 0.510 | 2 |
| coach | 0.516 | 40 |
| scout | 0.560 | 7 |
| may | 0.572 | 25 |
| qa | 0.581 | 8 |
| amy | 0.721 | 28 |
| bob | 0.731 | 8 |

## Key Findings

1. **Optimizer is worst agent** (0.384 avg, confirmed by 3 recent evals at 0.10-0.20). Primary issues: UNVERIFIED_CLAIMS, VERIFICATION_FAILURE, NON_DELIVERY.
2. **Coach had one 0.0 eval** (s_448) — this was a worker iteration on the already-completed coach-quality project where safety cap caused empty output. Not a real quality issue.
3. **Bob and Amy are top performers** (0.73 and 0.72 respectively).

## Actions Taken This Session

1. **EXP-275 deployment requested**: Notified may to add OUTPUT FORMAT + EXECUTION RULES + ANTI-SHALLOW to optimizer/heartbeat.md. This treatment raised coach from 0.24→0.70.
2. **Project status update requested**: Notified may to mark coach-quality as completed (avg 0.70 vs 0.50 target).

## Next Measurement
- After EXP-275 deployment: measure optimizer quality in 48h window
- Target: optimizer ≥ 0.50
- Baseline: 0.384 (6h, n=17)
