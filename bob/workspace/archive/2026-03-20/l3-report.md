# L3 Delegation Stability Report (P80/ISR)

Source: `agents/evaluator/skills/delegation-metrics.cjs` run over the most recent **50** entries in `.state/delegations.jsonl`.

## System Health (P80)
- **TSR (Task Success Rate):** **92.0%** (46/50 calls succeeded)
- **ISR (Integration Success Rate):** **87.1%** (27/31 parent sessions succeeded after call)
- **Hallucination Gap (TSR − ISR):** **4.9%**

## Pair Breakdown (volume-sorted)
| Pair | Total | TSR | ISR | Gap | P50 | P90 |
|---|---:|---:|---:|---:|---:|---:|
| bob->may | 12 | 91.7% | 50.0% | 41.7% | 28.8s | 28.8s |
| bob->evaluator | 9 | 100.0% | 100.0% | 0.0% | 12.4s | 34.9s |
| bob->optimizer | 8 | 75.0% | 71.4% | 3.6% | 239.9s | 320.6s |
| bob->tech-lead | 5 | 100.0% | 100.0% | 0.0% | 59.9s | 59.9s |
| bob->coach | 3 | 100.0% | 100.0% | 0.0% | 54.3s | 75.5s |
| bob->amy | 2 | 100.0% | n/a | n/a | 0.0s | 0.0s |
| bob->scout | 2 | 100.0% | n/a | n/a | 0.0s | 0.0s |
| coach->coach | 2 | 100.0% | 100.0% | 0.0% | 22.0s | 22.0s |
| optimizer->may | 1 | 100.0% | n/a | n/a | 0.0s | 0.0s |
| may->tech-lead | 1 | 100.0% | 100.0% | 0.0% | 557.1s | 557.1s |
| unknown->optimizer-v2 | 1 | 100.0% | 100.0% | 0.0% | 55.7s | 55.7s |
| may->bob | 1 | 100.0% | 100.0% | 0.0% | 80.5s | 80.5s |
| unknown->amy-v2 | 1 | 100.0% | 100.0% | 0.0% | 133.0s | 133.0s |
| unknown->evaluator-v2 | 1 | 100.0% | 100.0% | 0.0% | 31.5s | 31.5s |
| unknown->optimizer | 1 | 0.0% | 0.0% | 0.0% | 0.0s | 0.0s |

## Notes for P93 Retry stability tracking
- This report is a **latest snapshot** of L3 delegation outcomes (TSR/ISR + gap). To attribute improvements to the **P93 Retry** change specifically, compare this snapshot against a pre-P93 baseline (same window size) and/or track ISR over time.
- The largest stability risk signal in this window is **`bob->may` ISR 50.0%** despite TSR 91.7% (**gap 41.7%**), which matches an L3 “consensus hallucination” pattern (callee reports success but caller sessions fail).
