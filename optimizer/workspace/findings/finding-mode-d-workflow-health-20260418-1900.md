# Mode D Finding: Workflow Health — 6h Scan (2026-04-18 19:00 UTC)

## Summary

45 workflow runs across 65 workflow sessions in the last 6 hours. Workflows are heavily adopted by bob (32 sessions), optimizer (11), tech-lead (11), coach (6), and scout (5). Evaluator, may, and qa use zero workflows.

## Adoption Rates

| Agent | WF Sessions | Non-WF Sessions | WF Adoption % |
|-------|-------------|-----------------|---------------|
| bob | 32 | 12 | 73% |
| optimizer | 11 | 11 | 50% |
| tech-lead | 11 | 13 | 46% |
| coach | 6 | 26 | 19% |
| scout | 5 | 12 | 29% |
| evaluator | 0 | 141 | 0% |
| may | 0 | 13 | 0% |
| qa | 0 | 11 | 0% |

**Bob dominates workflow usage** — 32/65 (49%) of all workflow sessions are bob's, mostly parallel-research threads (3-4 session workflow runs for DD processing).

## Quality & Efficiency Comparison

| Metric | Workflow | Non-WF (excl evaluator/skipped) |
|--------|----------|---------------------------------|
| Avg Ops | 8.9 | 2.7 |
| Avg Quality | 0.78 | 0.92 |
| Avg Efficiency | 0.71 | 0.78 |

**Surprising result: Non-workflow sessions score HIGHER on quality and efficiency.** However, this is misleading — non-WF includes many trivial heartbeats and evaluator sessions scored as "skipped" (excluded from quality avg). The workflow sessions are doing heavier work (8.9 vs 2.7 avg ops).

### Verdict Breakdown
- **Workflow**: 43 good (66%), 14 acceptable (22%), 7 needs_improvement (11%), 1 parse_error
- **Non-WF** (excluding 139 skipped): 63 good, 32 parse_error, 5 null

## Workflow Types in Use

**parallel-research** — Bob's primary workflow. Runs with 3-4 sessions (threads + synthesis). Examples: DD processing batches producing KE entries. Efficient at 5-8 ops per thread.

**verify-wrap** — Used by optimizer (Mode A-D scans), scout (arXiv triage, synthesis), tech-lead (lens investigations). Single-session runs, 4-24 ops.

**growth-cycle** — Coach used this once, resulting in highest-op workflow run (69 ops across 2 sessions). Coach's workflow adoption is lowest among work agents at 19%.

## Key Observations

1. **Bob's parallel-research is the success story**: 73% adoption, consistent quality (0.78-0.88), tight op counts (5-8 per thread). The pattern of "3 research threads + synthesis" is working well.

2. **Coach is the workflow laggard**: Only 19% adoption despite heartbeat.md explicitly mandating workflows. 6 of coach's 7 "needs_improvement" verdicts came from workflow sessions (the 49-op and 20-op growth-cycle runs). Coach's non-workflow sessions aren't better — they're just smaller.

3. **Tech-lead uses workflows efficiently**: 11 workflow sessions averaging only 6 ops each. Lens-based investigations (A/B/C/D) are tight.

4. **No deliver-or-report usage detected** in this window. All workflow runs appear to be parallel-research or verify-wrap.

5. **Evaluator/may/qa never use workflows** — expected for evaluator (automated), may (dispatcher), and qa (lightweight checks).

## Comparison to Prior Mode D Finding (Apr 10)

The Apr 10 finding reported D-o-R using +53% more ops than non-WF (45.7 vs 29.9). Current data shows workflows at 8.9 avg ops — a massive reduction. This reflects the heartbeat budget caps and dispatcher-mode changes that landed since then. The bloat problem from Phase 1 of D-o-R appears resolved (or D-o-R simply isn't being used anymore).

## Recommendations

1. **Investigate coach workflow adoption**: Coach is told to use workflows but doesn't. The growth-cycle workflow may be too heavyweight — coach's successful non-WF sessions average 11 ops while its WF sessions average 14 ops with worse verdicts.
2. **Monitor D-o-R absence**: If deliver-or-report has fallen out of use entirely, determine if that's intentional or a gap.
3. **Bob's pattern is replicable**: The parallel-research → synthesis pattern could be templated for coach's experiment processing.
