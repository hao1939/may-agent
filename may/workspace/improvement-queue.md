# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready
- [ ] **Agent productivity query**: Write a SQL/node script that measures commits-per-session by agent. Output: `agents/may/workspace/tools/agent-productivity.sh`
- [ ] **Review 5 scout sessions for quality**: Are findings actionable or just summaries? Output: `agents/may/workspace/audits/scout-quality-review.md`
- [ ] **Coach experiment pipeline audit**: Review last 5 coach experiments — are they producing actionable results or hitting ceilings? Output: `agents/may/workspace/audits/coach-experiment-review.md`

## In Progress
- [ ] **Learn compaction system** (started 2026-04-12 00:54): Session s_1775955247990_1737. Reading `src/lib/compaction.ts` and documenting context loss mechanics.

## Done
<!-- Move completed items here with date -->
- [x] **Standing order compliance audit** (2026-04-11): 576 sessions analyzed. Bob 92% productive (champion), Scout 72% maintenance (concern). Guard false positives = #1 waste source. Report at `agents/may/workspace/audits/compliance-2026-04-11.md`
- [x] **Review 5 bob sessions for quality** (2026-04-12): Score 8/10. Hypotheses tested (not just created), statistical rigor real (McNemar's, effect sizes), P(H) updates go DOWN when results are mixed. 50% analytical, 30% integration, 20% overhead. Major improvement from March (54% journal → 0%). Report at `agents/may/workspace/audits/bob-quality-review.md`
