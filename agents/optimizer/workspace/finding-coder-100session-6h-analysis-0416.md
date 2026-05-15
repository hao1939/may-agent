# Finding: Coder 393-Session 6h Analysis (Apr 16, 2026)

**Query window**: Last 6h from 04:00 UTC  
**Total sessions**: 393 (not 100 — actual count much higher)

## Summary

Coder's 6h workload is dominated by lean sessions (57% ≤5 ops), but **the 0-5 ops bucket has the lowest quality (0.62)** while 6-15 ops sessions score highest (0.82 quality, 0.74 efficiency). This suggests many short sessions are too shallow to produce good work.

## Ops Distribution

| Bucket | Count | % | Avg Quality | Avg Efficiency | Verdict (top 3) |
|--------|-------|---|-------------|----------------|-----------------|
| 0-5 ops | 225 | 57% | 0.62 | 0.64 | good:95, needs_improvement:65, acceptable:62 |
| 6-15 ops | 90 | 23% | **0.82** | **0.74** | good:66, acceptable:15, needs_improvement:9 |
| 16-30 ops | 60 | 15% | 0.80 | 0.70 | good:39, acceptable:14, needs_improvement:7 |
| 31+ ops | 18 | 5% | 0.72 | 0.60 | good:8, acceptable:6, needs_improvement:4 |

## Key Patterns

1. **Sweet spot is 6-15 ops**: Best quality (0.82) AND best efficiency (0.74). Enough depth to do real work, not so many ops to waste.

2. **0-5 ops sessions are underperforming**: 29% get "needs_improvement" verdict. Many seem to be QA fix sessions that don't accomplish much — top waste sessions are all QA-triggered with 29-42 wasted calls.

3. **31+ ops sessions show diminishing returns**: Quality drops to 0.72 and efficiency to 0.60. These long sessions don't produce proportionally better outcomes.

4. **Status breakdown**: 352 done (90%), 37 interrupted (9%), 4 error (1%). Interrupt rate is manageable.

5. **Source mix**: 44 from workflows, 11 from callAgent, 338 direct. Workflow sessions are only 11% of volume.

## Top Waste Sessions

All 5 highest-waste sessions (29-42 wasted calls) are QA fix tasks with opCount=0. These appear to be sessions that spun without producing commits. Pattern: "Fix these issues from QA" tasks that couldn't resolve the feedback loop.

## Actionable Insight

- **Delegation quality matters more than volume**: The 0-5 ops bucket suggests many tasks are too trivial or too vaguely specified. Better task batching (combining 2-3 tiny fixes into one 6-15 op session) could improve overall quality.
- **QA fix loop is the primary waste source**: QA-triggered fix sessions are the worst performers. Consider reducing QA re-fix cycles or improving first-pass quality.
