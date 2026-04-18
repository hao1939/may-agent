# Finding: Workflow Health Check — Apr 17

## System-Wide Adoption
- **19.7%** (186/946 sessions) — down from 27.1% on Apr 12
- Decline driven by high-volume non-workflow agents (evaluator: 317 sessions, 0% wf)

## Adoption by Agent (24h)

| Agent | Total | WF | Adoption |
|-------|------:|---:|----------|
| coder | 7 | 7 | 100% |
| optimizer | 114 | 55 | 48.2% |
| tech-lead | 136 | 59 | 43.4% |
| bob | 85 | 30 | 35.3% |
| may | 70 | 17 | 24.3% |
| coach | 112 | 14 | 12.5% |
| scout | 56 | 3 | 5.4% |
| qa | 49 | 1 | 2.0% |
| evaluator | 317 | 0 | 0% |

## Ops: Workflow vs Non-Workflow (done sessions)

| Agent | WF Avg Ops (n) | Non-WF Avg Ops (n) | Delta |
|-------|---------------|--------------------:|------:|
| tech-lead | 8.2 (57) | 8.0 (74) | +0.2 |
| optimizer | 11.4 (53) | 4.9 (56) | +6.5 |
| bob | 10.5 (30) | 4.0 (55) | +6.5 |
| coach | 11.6 (14) | 13.7 (93) | -2.1 |
| may | 1.6 (16) | 4.1 (51) | -2.5 |
| scout | 19.0 (3) | 2.0 (52) | +17.0 |

**Interpretation**: Workflow sessions use more ops for optimizer/bob/scout — expected since workflows coordinate multi-step work that non-wf sessions wouldn't attempt. Coach workflows are slightly more efficient (-2.1 ops). Tech-lead is neutral. May's wf sessions are lightweight dispatchers (1.6 ops avg).

## Error Patterns
Only 3 workflow errors in 24h (all interrupts, no crashes):
- may: 1 interrupted (clean start)
- optimizer: 1 interrupted (request aborted)
- tech-lead: 1 interrupted (request aborted)

**Error rate**: 3/186 = 1.6% — healthy.

## Key Takeaways
1. **Adoption dropped** 27.1% → 19.7%, largely because evaluator volume (317 zero-wf sessions) dilutes the rate. Excluding evaluator, adoption is 186/629 = **29.6%**.
2. **Coach and QA are under-utilizing workflows** (12.5% and 2%) — potential targets for workflow design.
3. **No workflow reliability issues** — 1.6% error rate, all interrupts (not failures).
4. **Ops overhead is acceptable** — workflow sessions do more work per session, which is the point.
