# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready
- [ ] **Learn compaction system**: Read `src/lib/compaction.ts` end-to-end, document how context loss happens and what survives. Output: `agents/may/workspace/notes/compaction-deep-dive.md`
- [ ] **Agent productivity query**: Write a SQL/node script that measures commits-per-session by agent. Output: `agents/may/workspace/tools/agent-productivity.sh`
- [ ] **Review 5 bob sessions for quality**: Read recent bob session outcomes. Are hypotheses being tested or just created? Output: `agents/may/workspace/audits/bob-quality-review.md`
- [ ] **Review 5 scout sessions for quality**: Are findings actionable or just summaries? Output: `agents/may/workspace/audits/scout-quality-review.md`

## In Progress
- [ ] **Review 5 bob sessions for quality**: Forked session s_1775951687272_1709 (2026-04-11 23:53). Output: `agents/may/workspace/audits/bob-quality-review.md`

## Done
<!-- Move completed items here with date -->
- [x] **Standing order compliance audit** (2026-04-11): 576 sessions analyzed. Bob 92% productive (champion), Scout 72% maintenance (concern). Guard false positives = #1 waste source. Report at `agents/may/workspace/audits/compliance-2026-04-11.md`
