# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready
- [ ] **DB sync accuracy audit**: The session-sync handler shows 0 ops for active sessions (e.g. coach s_1775957061724_1754 shows 0 ops in DB but 113 in meta.json). Investigate sync reliability. Output: `agents/may/workspace/audits/db-sync-audit.md`
- [ ] **Tech-lead session quality review**: Review 5 recent tech-lead sessions for quality — are PRs thorough? Tests meaningful? Output: `agents/may/workspace/audits/tech-lead-quality-review.md`
- [ ] **Scout todo.md pruning**: Scout's todo.md is 653 lines (append-only). Split active tasks vs archive. Expected efficiency gain.
- [ ] **Optimizer quality review**: Review 5 recent optimizer sessions for quality. Are findings actionable? Output: `agents/may/workspace/audits/optimizer-quality-review.md`
- [ ] **Evaluator quality review**: Review 5 recent evaluator sessions. Are evaluations meaningful or rubber-stamping? Output: `agents/may/workspace/audits/evaluator-quality-review.md`

## In Progress

## Done
<!-- Move completed items here with date -->
- [x] **Dispatch board pruning** (2026-04-12): Archived 140+ completed items to `dispatch-board-archive-apr12.md`. Board reduced from 257 to 60 active lines.
- [x] **Review 5 scout sessions for quality** (2026-04-12): Grade A-. Strong research quality (DD#747/751/706, CR#339 all excellent). Cumulative theory-building, testable predictions, good pipeline integration (DD→KE→EXP flow). Minor issues: todo.md 653-line bloat, counter drift, 77% lean session rate (structural, not behavioral). Report at `agents/may/workspace/scout-review.md`
- [x] **Agent productivity query** (2026-04-12): Script at `agents/may/workspace/tools/agent-productivity.sh`, snapshot at `agents/may/workspace/audits/agent-productivity-snapshot.md`.
- [x] **Standing order compliance audit** (2026-04-11): 576 sessions analyzed. Bob 92% productive (champion), Scout 72% maintenance (concern). Guard false positives = #1 waste source. Report at `agents/may/workspace/audits/compliance-2026-04-11.md`
- [x] **Review 5 bob sessions for quality** (2026-04-12): Score 8/10. Hypotheses tested (not just created), statistical rigor real (McNemar's, effect sizes), P(H) updates go DOWN when results are mixed. 50% analytical, 30% integration, 20% overhead. Major improvement from March (54% journal → 0%). Report at `agents/may/workspace/audits/bob-quality-review.md`
- [x] **Coach experiment pipeline audit** (2026-04-12): Reviewed EXP-128→144 (17 experiments in 36h). Grade: B+. P1: EXP-141 missing, EXP-139/142 deployed without results. Strengths: research coherence, null result honesty. Report at `agents/may/workspace/coach-experiment-audit-apr12.md`
- [x] **Learn compaction system** (2026-04-12): 329-line deep-dive at `agents/may/workspace/notes/compaction-deep-dive.md`. Covers triggers, KeyFacts extraction, conversation-state.md mechanism, what survives vs what's lost.
