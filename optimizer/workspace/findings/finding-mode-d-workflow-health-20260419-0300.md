# Mode D Finding: Workflow Health — 6h Scan (2026-04-19 03:00 UTC)

## Summary

54 workflow sessions in last 6 hours. Bob remains dominant (30 WF sessions, 71% adoption). Coach still collapsed (1/23 = 4%). Scout still 0%. Overall work-agent adoption is **42%**, down from 46% prior window.

## Adoption Rates

| Agent | WF Sessions | Total Sessions | WF Adoption % | Prior (01:00) |
|-------|-------------|----------------|---------------|---------------|
| bob | 30 | 42 | 71% | 74% ↓ |
| optimizer | 12 | 24 | 50% | 50% — |
| tech-lead | 11 | 22 | 50% | 52% ↓ |
| coach | 1 | 23 | 4% | 4% — |
| scout | 0 | 12 | 0% | 0% — |
| evaluator | 0 | 104 | 0% | 0% |
| qa | 0 | 12 | 0% | 0% |
| may | 0 | 1 | 0% | 0% |

**Total work-agent adoption** (excl evaluator/may/qa): 54/123 = **44%** (prior: 46%).

## Op Efficiency: WF vs Non-WF

| Agent | WF Avg Ops | Non-WF Avg Ops | Note |
|-------|-----------|----------------|------|
| bob | 10.1 | 7.1 | WF higher — parallel-research has multi-session overhead |
| optimizer | 10.2 | 3.7 | WF sessions do heavier analysis work |
| tech-lead | 7.6 | 3.5 | WF sessions ~2x non-WF |
| coach | 13.0 | 18.9 | Single WF session; non-WF avg high — coach doing heavy unstructured work |
| scout | — | 1.5 | Tiny non-WF sessions |

Coach non-WF average of 18.9 ops is concerning — these are heavy sessions running without workflow structure.

## Trend: Three Consecutive Mode D Windows

| Metric | 19:00 | 01:00 | 03:00 (now) |
|--------|-------|-------|-------------|
| WF adoption (work agents) | 65% | 46% | 44% |
| Bob adoption | 73% | 74% | 71% |
| Coach adoption | 19% | 4% | 4% |
| Scout adoption | 29% | 0% | 0% |
| D-o-R usage | 0 | 0 | 0 |

**Clear downward trend**: 65% → 46% → 44%. The decline has slowed but not reversed. Bob/optimizer/tech-lead form a stable ~50-70% adoption floor. Coach and scout are effectively non-adopters now.

## Key Observations

1. **Coach remains the biggest gap**: 23 sessions, 415 total ops, only 1 WF session. Coach is the heaviest non-WF consumer by far. Third consecutive window at ≤4%. This is now a sustained pattern, not a blip.

2. **Scout stable at 0%**: Three windows of zero adoption. Scout's sessions are tiny (1.5 avg ops) — likely heartbeat-only work that genuinely doesn't need workflows.

3. **Bob slightly down** (74%→71%): Minor fluctuation, still dominant adopter. 304 WF ops across 30 sessions = well-structured research batches.

4. **deliver-or-report**: Third consecutive window at zero. Effectively deprecated in practice.

5. **Optimizer and tech-lead stable**: Both at 50%, consistent across windows. verify-wrap is their primary pattern and works well.

## Recommendations

1. **Coach workflow intervention is overdue** — three windows showing 4-19% adoption while running 400+ non-WF ops. Either growth-cycle doesn't match coach's current task mix or coach's dispatcher isn't wiring workflows. Priority: investigate coach's heartbeat handler to see if it dispatches with workflowRunId.

2. **Accept scout's 0% as normal** — scout sessions average 1.5 ops. Workflows add overhead that exceeds the work itself. No action needed.

3. **Formally deprecate deliver-or-report** — three 6h windows of zero usage. Remove from workflow registry or document it as legacy.

4. **Adoption floor ~44%** — further gains require coach adoption or a new workflow type that fits lightweight sessions.
