# Mode D Finding: Workflow Health — 6h Scan (2026-04-19 01:00 UTC)

## Summary

47 workflow sessions across ~35 workflow runs in the last 6 hours. Bob remains dominant (34 WF sessions), followed by tech-lead (13) and optimizer (12). Coach workflow adoption collapsed from 19% → 4%. Scout dropped from 29% → 0%.

## Adoption Rates

| Agent | WF Sessions | Total Sessions | WF Adoption % | Prior (19:00) |
|-------|-------------|----------------|---------------|---------------|
| bob | 34 | 46 | 74% | 73% |
| optimizer | 12 | 24 | 50% | 50% |
| tech-lead | 13 | 25 | 52% | 46% ↑ |
| coach | 1 | 24 | 4% | 19% ↓↓ |
| scout | 0 | 12 | 0% | 29% ↓↓ |
| evaluator | 0 | 99 | 0% | 0% |
| may | 0 | 4 | 0% | 0% |
| qa | 0 | 12 | 0% | 0% |

**Total work-agent adoption** (excl evaluator/may): 60/131 = **46%** (prior: 65/100 = 65%).

## Notable Changes from Prior (18:00 baseline)

1. **Coach adoption cratered** (19% → 4%): Only 1 workflow session out of 24. Coach is running many non-WF sessions (24 total). The single WF session was the order-compliance scenario build (13 ops, done status).

2. **Scout dropped to 0%**: No workflow sessions at all this window. Scout had 5 WF sessions (29%) in prior window.

3. **Tech-lead slightly up** (46% → 52%): Consistent verify-wrap usage for lens investigations. Average 3-10 ops per WF session — efficient.

4. **Bob stable at 74%**: parallel-research remains primary pattern. Multiple 3-thread + synthesis runs (DD analysis batches). Largest: 48-op dreaming/consolidation experiment, 26-op fragility tracking experiment.

## High-Op Workflow Sessions

| Agent | Ops | Task Summary |
|-------|-----|-------------|
| bob | 48 | EXP-183 dreaming/consolidation experiment |
| bob | 26 | EXP-182 fragility tracking experiment |
| optimizer | 19 | Mode B tool gap analysis |
| bob | 16 | DD#769 agent systems survey thread |
| bob | 15 | DD#773 SafeHarness thread |
| coach | 13 | order-compliance scenario build |

Bob's 48-op session is the highest — it ran a full experiment (gym-run.sh with timeout 600). This is legitimate experiment work, not waste.

## Workflow Types Observed

- **parallel-research**: Bob's primary (3 threads + synthesis). Used for DD analysis batches. 4+ runs this window. Tight at 7-15 ops per thread.
- **verify-wrap**: Used by optimizer (Mode A-D scans) and tech-lead (lens investigations). Single-session, 3-11 ops. Consistent and efficient.
- **growth-cycle**: 1 coach session. Down from 6 sessions prior window.
- **deliver-or-report**: Still absent — no usage detected in either window.

## Key Observations

1. **Bob's parallel-research is scaling well**: Multiple 3-thread batches processing DD inbox items. Each thread averages 7-12 ops. Synthesis sessions are tight (3-5 ops). Total run efficiency is good.

2. **Coach workflow problem is worsening**: 19% → 4% adoption. Coach ran 24 sessions this window with only 1 using a workflow. Prior finding recommended investigating this — no action taken yet.

3. **Scout regression**: 29% → 0%. This may be a sample size issue (12 sessions) or scout may have shifted to lighter tasks not requiring workflows.

4. **deliver-or-report still unused**: Two consecutive 6h windows with zero D-o-R usage. This workflow may be effectively dead.

## Comparison to Prior Mode D (19:00)

| Metric | Prior (19:00) | Current (01:00) |
|--------|---------------|-----------------|
| Total WF sessions | 65 | 60 |
| WF adoption (work agents) | 65% | 46% |
| Bob WF adoption | 73% | 74% |
| Coach WF adoption | 19% | 4% |
| Highest-op WF session | 69 (coach growth-cycle) | 48 (bob experiment) |
| D-o-R usage | 0 | 0 |

Overall adoption **dropped 19pp** driven primarily by coach and scout declines.

## Recommendations

1. **Coach workflow adoption needs intervention** — two consecutive windows showing decline. Either growth-cycle doesn't fit coach's current work, or coach is avoiding workflows. Investigate whether coach's heartbeat dispatches workflow-wrapped tasks.
2. **Deprecate or revive D-o-R** — two 6h windows of zero usage. Either formally deprecate it or identify why tech-lead stopped using it (tech-lead's verify-wrap sessions still have D-o-R phase boundary text in tasks but run via verify-wrap).
3. **Scout workflow regression** — check if scout's arXiv triage shifted to non-workflow patterns.
