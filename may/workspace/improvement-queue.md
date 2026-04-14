# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready

- [x] **Guards Phase 3: Cron-to-workflow migration** — ✅ COMPLETE (2026-04-14). 2 of 4 handlers migrated: error-log-scanner → `error-scan.ts`, coaching-feedback → `coaching-feedback.ts`. Remaining 2 not candidates (priority-drift=dead code, active-nudge=pure JS intervention). run-workflow handler upgraded with `runFunction()` + `agent`. **Design**: `agents/may/workspace/DESIGN-sensor-judge-migration.md`.
- [x] **Batch merge tool for tech-lead** — ✅ DONE (2026-04-14). `scripts/batch-merge.sh` + `scripts/review-merge.sh` produced.
- [ ] **Scenario oracle generator for coach** — Optimizer finding: coach spent 118 ops (3.4× budget) designing gym scenarios, with 32 node executions for manual expected-output computation. A script to auto-generate expected outputs from clean codebase + patch would save ~15-20 ops per scenario session. **Deliverable**: Script at `scripts/scenario-oracle.sh`. **Scope**: Medium. **Owner**: coach + coder.
- [x] **Create-test-pivot loop guard** — ✅ BUILT + IN REVIEW (2026-04-14). Guard at `agents/shared/guards/pivot-detector.ts`. 7 tests on branch `review/pivot-detector-guard`. Warns at 3 fail-pivot cycles, injects mandatory reassessment at 5.
- [ ] **Artifacts-as-Memory deep dive + externalization framework validation** — Dispatched to Bob (P1, 2026-04-14). Scout found paper 2604.08756 "Artifacts as Memory Beyond the Agent Boundary" — validates DD-750. **Scope**: Small.

- [x] **Scout archetype tool fix — enable forking** — ✅ DONE (2026-04-14). Already applied.
- [x] **Over-intervention cleanup — remove verification triple-stacks** — ✅ DONE (2026-04-14, coach).
- [x] **Tech-lead workflow adoption — D-o-R for Lens sessions** — ✅ MOSTLY RESOLVED (2026-04-14). 63% adoption.
- [x] **Tiered turn budget deployment** — ✅ ALREADY DEPLOYED (confirmed 2026-04-14).

- [ ] **PATH export boilerplate elimination** — 🟢 IN PROGRESS (dispatched to tech-lead 2026-04-14 18:52, req c712667e). Optimizer finding (2026-04-14): 8% of ALL bash calls (18,980 of 239,657) are `export PATH=".state/.bun/bin:$PATH"` boilerplate. Framework-level 1-line fix: add PATH to the environment that spawns agent sessions (likely `src/lib/workflow-tool.ts` or bash tool env). **Estimated savings: ~700 wasted ops/day**. **Deliverable**: PR adding PATH to bash tool environment config. **Scope**: Small. **Owner**: tech-lead/coder. **Source**: `agents/optimizer/workspace/finding-tool-gap-analysis-0414b.md`.

- [ ] **QA heartbeat simplification (IT-21)** — QA interrupt rate is 60% (12/20 sessions in 24h), the worst of any agent. QA heartbeats use 5-8 ops but get killed by next heartbeat tick. Root cause: heartbeat does too much per cycle (read heartbeat + read queue + check branches + check reviews). **Deliverable**: Rewrite QA heartbeat to single-focus: check ONE review branch per tick, ≤4 ops target. **Scope**: Small. **Owner**: may (heartbeat edit) or tech-lead. **Source**: IT-21 on dispatch board, QA session data.

- [ ] **Coach cron job ROI audit** — Coach runs `cron:reflect` and `cron:common-sense-verify` sessions consuming 248 ops across 10 sessions (24h). Average 24.8 ops per cron session — higher than many work sessions. Are these producing actionable output or just burning budget? **Deliverable**: Audit report with recommendation to keep/modify/remove each cron. **Scope**: Small. **Owner**: optimizer or may.

- [ ] **Optimizer finding archive cleanup + action pipeline** — Optimizer workspace has 100+ finding files (3.8MB). Most are unactioned. The finding→dispatch pipeline (dispatched 2026-04-13) hasn't materialized into working infrastructure. **Deliverable**: (1) Archive findings older than 3 days to `archive/` subfolder, (2) Create a top-10 unactioned findings summary with dispatch recommendations. **Scope**: Medium. **Owner**: optimizer + may.

- [ ] **Workspace bloat: bob at 7.7MB** — Bob's workspace grew to 7.7MB despite `scripts/workspace-cleanup.sh` being built. Coach at 4.9MB, optimizer at 3.8MB. The cleanup script exists but hasn't been run (or isn't effective enough). **Deliverable**: Run workspace-cleanup.sh, verify size reduction, add to a cron or heartbeat check if needed. **Scope**: Small. **Owner**: may or tech-lead.

- [ ] **Scenario oracle branch merge** — Branch `review/scenario-oracle` exists on remote but hasn't been merged to main. Scripts `scripts/scenario-oracle.sh` and `scripts/scenario-oracle-analyze.mjs` built (2026-04-14). **Deliverable**: Merge the branch after QA check. **Scope**: Tiny. **Owner**: tech-lead/coder.

- [ ] **Workflow adoption structural fix** — Optimizer debunked workflow adoption: coach is 0% (not 53%). System-wide only 6.7% of sessions use `workflowRunId`. Root cause: structural contradiction — heartbeat instructs `workflow.run()` but it blocks and would blow heartbeat's ≤10 op budget. **Deliverable**: Either (a) make workflow.run non-blocking (fork-style) in the framework, or (b) accept fork-based dispatch and remove misleading heartbeat instructions. Design doc required. **Scope**: Medium. **Owner**: tech-lead + optimizer. **Source**: `agents/optimizer/workspace/finding-coach-workflow-adoption-intervention-0414.md`.

- [ ] **May C1.3 convention regression investigation** — May's C1.3 (verify-before-finish) dropped from 98.5% → 91.3% over 48h. 12 failures in 138 checks. Coach dispatched investigation (2026-04-14 18:21). **Deliverable**: Root cause + fix (likely heartbeat/context.md update). **Scope**: Small. **Owner**: coach (already investigating).

## In Progress
- [ ] **Optimizer finding→dispatch pipeline** — Forked to optimizer (2026-04-13 07:22, s_1776064947441_50). Design protocol + heartbeat edit.

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
