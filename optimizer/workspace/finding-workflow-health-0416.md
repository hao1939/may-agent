# Finding: Workflow Health Check — Apr 16 22:00

## Summary
System-wide workflow adoption is **38.8%** (120/317 sessions with ops, last 12h), up from 27.1% on Apr 12. Strong upward trend.

## Adoption by Agent (last 12h, done sessions)

| Agent     | Total | WF | WF% | Notes |
|-----------|------:|---:|----:|-------|
| coder     |     7 |  7 | 100 | Full adoption |
| optimizer |    59 | 30 | 50.8| Strong |
| bob       |    52 | 24 | 46.2| Strong |
| tech-lead |    80 | 36 | 45.0| Strong |
| may       |    39 | 16 | 41.0| Good |
| coach     |    47 |  6 | 12.8| Low — mostly heartbeats |
| scout     |    27 |  1 |  3.7| Minimal |
| qa        |    22 |  0 |  0  | No workflows |
| evaluator |   183 |  0 |  0  | Expected (eval is call-based) |

## Efficiency: Avg Ops (WF vs Direct)

| Agent     | Direct ops | WF ops | Delta |
|-----------|----------:|-------:|------:|
| bob       |       5.8 |   11.0 | +5.2  |
| coach     |      11.4 |   16.7 | +5.3  |
| optimizer |       5.0 |   11.8 | +6.8  |
| tech-lead |       9.3 |    9.7 | +0.4  |
| may       |       3.3 |    2.9 | -0.4  |

WF sessions use more ops on average — expected since workflows are used for substantive tasks while direct sessions include lightweight heartbeats.

## Key Observations

1. **+11.7pp adoption gain** since Apr 12 (27.1% → 38.8%). Steady organic growth.
2. **Top adopters**: coder (100%), optimizer (51%), bob (46%), tech-lead (45%).
3. **Laggards**: coach (13%), scout (4%), qa (0%). Coach and scout do mostly heartbeat/lightweight work that doesn't need workflows. QA is review-focused.
4. **evaluator at 0%** is expected — it's invoked as calls, not independent tasks.
5. **No new agents** adopted workflows since last check — the same set (coder, optimizer, bob, tech-lead, may) are the users.
6. **may at 41%** is a notable improvement — was lower previously.

## Comparison to Apr 12

| Metric | Apr 12 | Apr 16 | Change |
|--------|--------|--------|--------|
| System-wide WF% | 27.1% | 38.8% | +11.7pp |
| Top agent (coder) | 100% | 100% | stable |
| bob | ~40% | 46.2% | +6pp |
| tech-lead | ~35% | 45.0% | +10pp |

## Assessment
Workflow adoption is healthy and growing. The agents that benefit most from workflows (substantive multi-step tasks) have adopted them well. Low adoption in coach/scout/qa is acceptable — their work patterns are lighter. No intervention needed.
