### Delegation Metrics (Last 100 entries)

**System Health (P80)**
- **TSR (Task Success Rate)**: 85.0% (85/100 calls succeeded)
- **ISR (Integration Success Rate)**: 73.0% (73/100 parent sessions succeeded after call)
- **Hallucination Gap (TSR - ISR)**: 12.0% ⚡ WARNING — significant disconnect between callee success and caller acceptance

| Pair | Total | Calls/Sends | TSR | ISR | Gap | P50 | P90 |
|---|---:|---:|---:|---:|---:|---:|---:|
| may->tech-lead | 18 | 0/18 | 100.0% | 66.7% | 33.3% | 0.0s | 0.0s |
| may->bob | 18 | 0/18 | 100.0% | 77.8% | 22.2% | 0.0s | 0.0s |
| unknown->optimizer-c40 | 6 | 6/0 | 66.7% | 66.7% | 0.0% | 624.0s | 775.4s |
| unknown->amy-kimi-c40 | 5 | 5/0 | 40.0% | 40.0% | 0.0% | 280.7s | 280.7s |
| unknown->amy-c40 | 5 | 5/0 | 40.0% | 40.0% | 0.0% | 71.1s | 71.1s |
| may->coach | 5 | 0/5 | 100.0% | 80.0% | 20.0% | 0.0s | 0.0s |
| unknown->tech-lead-c40 | 4 | 4/0 | 75.0% | 75.0% (n=4) | 0.0% | 159.3s | 223.4s |
| unknown->optimizer-c38 | 4 | 4/0 | 100.0% | 100.0% (n=4) | 0.0% | 26.4s | 78.5s |
| unknown->may-c40 | 4 | 4/0 | 75.0% | 75.0% (n=4) | 0.0% | 67.7s | 100.0s |
| unknown->tech-lead-c35 | 3 | 3/0 | 100.0% | 100.0% (n=3) | 0.0% | 106.4s | 111.0s |
| unknown->scout-c42 | 2 | 2/0 | 50.0% | 50.0% (n=2) | 0.0% | 166.2s | 166.2s |
| may-c42->tech-lead | 2 | 0/2 | 100.0% | 50.0% (n=2) | 50.0% | 0.0s | 0.0s |
| unknown->evaluator-c40 | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 154.7s | 154.7s |
| unknown->bob-c40 | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 395.1s | 395.1s |
| unknown->amy-signals-path | 2 | 2/0 | 100.0% | 100.0% (n=2) | 0.0% | 25.4s | 25.4s |
| may->scout | 2 | 0/2 | 100.0% | 100.0% (n=2) | 0.0% | 0.0s | 0.0s |
| unknown->tl-c44 | 1 | 1/0 | 0.0% | 0.0% (n=1) | 0.0% | 0.0s | 0.0s |
| unknown->bob-c44 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 47.0s | 47.0s |
| unknown->evaluator-c43 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 61.8s | 61.8s |
| unknown->may-c42 | 1 | 1/0 | 0.0% | 0.0% (n=1) | 0.0% | 0.0s | 0.0s |
| unknown->scout-save-early | 1 | 1/0 | 0.0% | 0.0% (n=1) | 0.0% | 0.0s | 0.0s |
| unknown->scout-c40 | 1 | 1/0 | 0.0% | 0.0% (n=1) | 0.0% | 0.0s | 0.0s |
| unknown->coder-c40 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 168.8s | 168.8s |
| tech-lead->may | 1 | 0/1 | 100.0% | 100.0% (n=1) | 0.0% | 0.0s | 0.0s |
| unknown->optimizer-c39 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 15.7s | 15.7s |
| unknown->evaluator-c38 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 35.3s | 35.3s |
| may->amy-kimi | 1 | 0/1 | 100.0% | 100.0% (n=1) | 0.0% | 0.0s | 0.0s |
| may->optimizer | 1 | 0/1 | 100.0% | 100.0% (n=1) | 0.0% | 0.0s | 0.0s |
| may->qa | 1 | 0/1 | 100.0% | 100.0% (n=1) | 0.0% | 0.0s | 0.0s |
| unknown->tech-lead-c36 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 90.6s | 90.6s |
| unknown->may-c36 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 23.6s | 23.6s |
| unknown->tech-lead-c34 | 1 | 1/0 | 100.0% | 100.0% (n=1) | 0.0% | 47.0s | 47.0s |

_ISR is computed for both `call` and `send` delegations by checking whether the **caller's parent session** ultimately succeeded. The "Calls/Sends" column shows the method breakdown. ISR values with (n=N) have low sample size (N<5) and should be treated as unreliable. A high TSR but low ISR indicates consensus hallucination (L3 Collective Drift)._ 
