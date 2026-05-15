# L3 Delegation Metrics Report

Generated: 2026-05-11 02:35Z
Source: `.state/delegations.jsonl` (last 200 entries of 1289 total)

## System Health (P80)

- TSR (Task Success Rate): 86.5% (173/200 calls succeeded)
- ISR (Integration Success Rate): 76.5% (153/200 parent sessions succeeded after call)
- Hallucination Gap (TSR - ISR): 10.0%

Interpretation: system-wide delegation reliability remains above the 80% critical threshold for most high-volume pairs, but the overall ISR sits below 80%, so delegation outcomes still degrade materially between callee success and caller success. The highest-signal high-volume gaps in this sample were `may->bob` (25.0% gap) and `may->tech-lead` (18.0% gap), suggesting follow-up calibration should focus on message-based delegation acceptance rather than raw tool-call failure.

## Pair Breakdown

| Pair | Total | Calls/Sends | TSR | ISR | Gap | P50 | P90 |
|---|---:|---:|---:|---:|---:|---:|---:|
| may->tech-lead | 50 | 0/50 | 100.0% | 82.0% | 18.0% | 0.0s | 0.0s |
| coach->coach | 27 | 27/0 | 88.9% | 88.9% | 0.0% | 90.2s | 285.6s |
| may->bob | 20 | 0/20 | 100.0% | 75.0% | 25.0% | 0.0s | 0.0s |
| may->coach | 11 | 0/11 | 100.0% | 90.9% | 9.1% | 0.0s | 0.0s |
| unknown->optimizer-c40 | 6 | 6/0 | 66.7% | 66.7% | 0.0% | 624.0s | 775.4s |
| unknown->amy-kimi-c40 | 5 | 5/0 | 40.0% | 40.0% | 0.0% | 280.7s | 280.7s |
| unknown->amy-c40 | 5 | 5/0 | 40.0% | 40.0% | 0.0% | 71.1s | 71.1s |
| coach->may | 4 | 0/4 | 100.0% | 100.0% (n=4) | 0.0% | 0.0s | 0.0s |
| unknown->coach | 4 | 4/0 | 100.0% | 100.0% (n=4) | 0.0% | 106.9s | 125.9s |
| unknown->tech-lead-c40 | 4 | 4/0 | 75.0% | 75.0% (n=4) | 0.0% | 159.3s | 223.4s |
| unknown->optimizer-c38 | 4 | 4/0 | 100.0% | 100.0% (n=4) | 0.0% | 26.4s | 78.5s |
| unknown->may-c40 | 4 | 4/0 | 75.0% | 75.0% (n=4) | 0.0% | 67.7s | 100.0s |
| bob->tech-lead | 2 | 0/2 | 100.0% | 0.0% (n=2) | 100.0% | 0.0s | 0.0s |
| tech-lead->coder | 2 | 2/0 | 50.0% | 50.0% (n=2) | 0.0% | 105.8s | 105.8s |
| unknown->tl-c40-hb | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 66.6s | 66.6s |
| unknown->scout-c42 | 2 | 2/0 | 50.0% | 50.0% (n=2) | 0.0% | 166.2s | 166.2s |
| may-c42->tech-lead | 2 | 0/2 | 100.0% | 50.0% (n=2) | 50.0% | 0.0s | 0.0s |
| unknown->evaluator-c40 | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 154.7s | 154.7s |
| unknown->bob-c40 | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 395.1s | 395.1s |
| unknown->amy-signals-path | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 25.4s | 25.4s |
| may->scout | 2 | 0/2 | 100.0% | 100.0% (n=2) | 0.0% | 0.0s | 0.0s |
| unknown->tech-lead-c35 | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 106.4s | 106.4s |

## Notes

- ISR in this report is computed from parent-session outcomes for both `call` and `send` delegations.
- Pairs with `(n=N)` have low resolved-session sample sizes and are weak evidence on their own.
- This report is intended for evaluator calibration, not as a conclusive incident report.
