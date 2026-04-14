# System Health Snapshot — Apr 14, 02:00 UTC

**Period**: 6h window (Apr 13 19:52 – Apr 14 01:52 UTC)
**Baseline**: Apr 13 05:22 UTC finding (5,894 daily ops, ~$302/day)

## Summary

| Metric | Baseline (Apr 13) | Current (6h → 24h) | Δ |
|---|---|---|---|
| Daily ops (projected) | 5,894 | **8,696** | **+47%** |
| Daily cost (est) | $302 | **$443** | **+47%** |
| Sessions/day | ~480 | **592** | +23% |
| Error rate | unknown | **3.4%** | — |
| Workflow adoption | ~74% | **72.9%** | ~flat |

**Key finding**: Op volume is up significantly (+47%) vs. the Apr 13 baseline. This appears driven by several high-op investigation sessions (182, 140, 133, 84, 60 ops) that inflated the 6h window. Cost is tracking ~$443/day projected.

## Agent Breakdown (6h actuals)

| Agent | Ops | Sessions | Avg Ops | Max Ops |
|---|---|---|---|---|
| coach | 419 | 23 | 18.2 | 133 |
| scout | 386 | 17 | 22.7 | 140 |
| bob | 359 | 22 | 16.3 | 84 |
| tech-lead | 358 | 21 | 17.0 | 182 |
| optimizer | 323 | 24 | 13.5 | 36 |
| qa | 119 | 12 | 9.9 | 14 |
| may | 105 | 14 | 7.5 | 29 |
| evaluator | 87 | 13 | 6.7 | 10 |
| coder | 18 | 2 | 9.0 | 13 |
| **TOTAL** | **2,174** | **148** | — | — |

## High-Op Outliers (>50 ops)

5 sessions consumed 599 ops (27.5% of all ops in 6h):

1. **tech-lead 182ops** [done] — URGENT: Evaluator LLM fix. Justified large session for critical infra repair.
2. **scout 140ops** [done] — workflow.run() agent resolution bug deep-dive. Investigation work.
3. **coach 133ops** [interrupted] — EXP-154 design session. Interrupted (request aborted), wasted ~30-50 ops.
4. **bob 84ops** [done] — Bayesian Scorecard Pass 4. Recurring analytical task.
5. **bob 60ops** [done] — Paper deep-dive (2604.08756). Research session.

**Assessment**: Sessions #1-2 were justified (infra fix + bug investigation). #3 was partially wasted due to interruption. #4-5 are normal analytical work but on the heavier side.

## Error Analysis

5 error/interrupted sessions out of 148 (3.4% failure rate):

| Agent | Status | Ops | Error |
|---|---|---|---|
| coach | interrupted | 133 | Request aborted |
| optimizer | interrupted | 18 | Request aborted |
| coach | interrupted | 11 | Request aborted |
| tech-lead | interrupted | 11 | Request aborted |
| evaluator | error | 9 | 401 AuthenticationError (GitHub Copilot) |

- 4 interruptions = request aborted (likely timeout or system restart)
- 1 authentication error on evaluator (known issue being addressed by tech-lead 182-op session)
- **No new error patterns** — all are known failure modes

## Workflow Adoption

- 86 of 118 work sessions used workflows → **72.9%**
- Stable vs. baseline (~74%), within normal variance
- No regression in adoption

## Cost Trajectory

| Metric | Value |
|---|---|
| 6h ops | 2,174 |
| Projected daily ops | 8,696 |
| Cost per op (est) | $0.051 |
| **Projected daily cost** | **$443** |

The +47% cost increase is concerning but likely inflated by the 5 outlier sessions (599 ops). Excluding outliers: 1,575 ops/6h → 6,300 daily → $321/day — much closer to baseline.

## Verdict

🟡 **CAUTION** — System is healthy operationally (low error rate, stable workflow adoption) but running hotter than baseline due to high-op investigation sessions. If outlier sessions normalize, costs should settle back to ~$300-320/day range. Worth monitoring in next 12-24h.

---
*Generated: 2026-04-14 ~02:00 UTC | optimizer Mode A session*
