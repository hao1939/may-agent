# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready

- [ ] **Batch review-merge script (`--batch` + `--auto-resolve=ours`)** — Extend `scripts/review-merge.sh` with batch mode to process all `review/*` branches in one call, plus `--auto-resolve=ours` for workspace files (todo.md, PRIORITY-TRACKER.md). Optimizer finding-tech-lead-tool-gap-0414 shows 35 ops wasted per batch merge (7 ops/branch × 5-8 branches). 65 review sessions/week → saves 100-200 ops/week. **Scope**: Small. **Owner**: tech-lead/coder.

- [ ] **Coach workflow adoption structural fix (fork-with-workflow-instruction)** — Coach has 0% real workflow adoption (finding-coach-workflow-adoption-intervention-0414). Root cause: `workflow.run()` from heartbeat blows op budget. Fix: change coach heartbeat fork template to prepend `⚡ WORKFLOW REQUIRED: Call workflow.run('<name>', '<task>') as your FIRST action.` to forked task text. This moves workflow execution into the work session where budget allows it. **Scope**: Small. **Owner**: may (heartbeat edit) or coach (self-edit).

- [ ] **Workflow adoption metric rebaseline** — Current metric counts task-text workflow mentions (reports 75%), but actual `workflowRunId` adoption is 6.7% system-wide (finding-coach-workflow-adoption-intervention-0414). Update `agents/may/workspace/tools/` with a correct adoption script using `workflowRunId IS NOT NULL`. Re-measure all agents. Without accurate measurement, we can't track improvement. **Scope**: Small. **Owner**: may or optimizer.

- [ ] **Compaction-resistant summary scripts for Bob** — Bob wastes ~30% of ops re-reading files post-compaction (finding-tool-gap-bob84-scout43-0414). Build two scripts: (1) `scripts/hypothesis-summary.sh` — dumps all H-*.md files with P(H) values in one call; (2) `scripts/experiment-status.sh` — scans all EXP-* dirs, reports status/results/key metrics. Each replaces 10+ manual ops per session. **Scope**: Medium. **Owner**: tech-lead/coder.

- [ ] **Trace-symbol code exploration tool** — Tech-lead spends 11-24 ops per audit doing grep→sed→grep chains for code exploration (finding-tech-lead-tool-gap-0414 Pattern 3). Build `scripts/trace-symbol.sh <symbol>` that shows definition + all import/usage sites + 3 lines context in one call. 14 Lens sessions/day × 3-5 ops saved = 42-70 ops/day. **Scope**: Small. **Owner**: tech-lead/coder.

- [ ] **Artifacts-as-Memory deep dive + externalization framework validation** — Dispatched to Bob (P1, 2026-04-14). Scout found paper 2604.08756 "Artifacts as Memory Beyond the Agent Boundary" — validates DD-750. **Scope**: Small.

## In Progress
- [ ] **Scenario oracle generator for coach** — Tech-lead building. Script at `scripts/scenario-oracle.sh` (exists).
- [ ] **Optimizer finding→dispatch pipeline** — Forked to optimizer (2026-04-13 07:22, s_1776064947441_50). Design protocol + heartbeat edit. DISPATCH-READY.md template active but scout item already resolved.

## Done
<!-- Move completed items here with date -->
- [x] **KE deployment sprint — top 5 high-priority KEs** (2026-04-13): 5 KEs deployed (KE-122, KE-123, KE-091, KE-133, KE-020). Evidence-over-narrative warnings added.
- [x] **Research project triage and dispatch** (2026-04-13): 7 projects triaged. 3 archived (gstack, metaclaw-poc, superpowers). 2 promoted to experimenting. Statuses updated.
- [x] **H-104 falsification cascade cleanup** (2026-04-13): Completed by Bob (57 ops). Updated downstream artifacts.
- [x] **Dead skill library cleanup** (2026-04-13): Completed by coach (22 ops). Removed disproven/dead skills.
- [x] **Optimizer C1.1 compliance fix** (2026-04-13): Completed by coach (34 ops). Root-cause + intervention deployed.
- [x] **QA C1.4/C8.2 regression investigation** (2026-04-13): Completed by coach (8 ops).
- [x] **Convention investigation script** (2026-04-13): Completed by tech-lead (11 ops).
- [x] **Coder utilization opportunity scan** (2026-04-12): 6 concrete tasks identified, prioritized. Top 3 now queued/dispatched. Report at `agents/may/workspace/audits/coder-opportunity-scan.md`
- [x] **Agent op-budget compliance dashboard** (2026-04-12): Script at `agents/may/workspace/tools/op-budget-check.sh`. Produces compliance table with per-agent averages vs budgets and violation summary.
- [x] **Coach fork-without-check pattern fix** (2026-04-12): Guard added to coach heartbeat — checks for running sessions before forking new work.
- [x] **Optimizer analysis→action conversion rate audit** (2026-04-12): 36% action rate confirmed. Top unactioned findings identified. Report at `agents/may/workspace/audits/optimizer-conversion-audit.md`
- [x] **Evaluation-sync handler restart investigation** (2026-04-12): Backlog cleared. Fix plan at `agents/may/workspace/audits/eval-sync-fix-plan.md`.
- [x] **Evaluator backlog assessment** (2026-04-12): 353 unevaluated (77% backlog). Evaluator runs ~2/hr, processes ~5 per session. Backlog growing. Skips heartbeats (correct). Bottleneck is evaluator throughput. Report at `agents/may/workspace/audits/evaluator-backlog.md`
- [x] **Tech-lead session quality review** (2026-04-12): Grade A-. PRs thorough with tests. Delegates to coder well. Design-first approach solid. 75% productive work ratio. Report at `agents/may/workspace/audits/tech-lead-quality-review.md`
- [x] **DB sync accuracy audit** (2026-04-12): Sync handler confirmed unreliable — 33% of completed sessions have 0 ops. Root cause: sync fires during session, not after completion. Workaround documented. Report at `agents/may/workspace/audits/db-sync-audit.md`
- [x] **Review 5 scout sessions for quality** (2026-04-12): Grade A-. Strong research quality (DD#747/751/706, CR#339 all excellent). Cumulative theory-building, testable predictions, good pipeline integration (DD→KE→EXP flow). Minor issues: todo.md 653-line bloat, counter drift, 77% lean session rate (structural, not behavioral). Report at `agents/may/workspace/scout-review.md`
- [x] **Agent productivity query** (2026-04-12): Script at `agents/may/workspace/tools/agent-productivity.sh`, snapshot at `agents/may/workspace/audits/agent-productivity-snapshot.md`.
- [x] **Standing order compliance audit** (2026-04-11): 576 sessions analyzed. Bob 92% productive (champion), Scout 72% maintenance (concern). Guard false positives = #1 waste source. Report at `agents/may/workspace/audits/compliance-2026-04-11.md`
- [x] **Review 5 bob sessions for quality** (2026-04-12): Score 8/10. Hypotheses tested (not just created), statistical rigor real (McNemar's, effect sizes), P(H) updates go DOWN when results are mixed. 50% analytical, 30% integration, 20% overhead. Major improvement from March (54% journal → 0%). Report at `agents/may/workspace/audits/bob-quality-review.md`
- [x] **Coach experiment pipeline audit** (2026-04-12): Reviewed EXP-128→144 (17 experiments in 36h). Grade: B+. P1: EXP-141 missing, EXP-139/142 deployed without results. Strengths: research coherence, null result honesty. Report at `agents/may/workspace/coach-experiment-audit-apr12.md`
- [x] **Learn compaction system** (2026-04-12): 329-line deep-dive at `agents/may/workspace/notes/compaction-deep-dive.md`. Covers triggers, KeyFacts extraction, conversation-state.md mechanism, what survives vs what's lost.
