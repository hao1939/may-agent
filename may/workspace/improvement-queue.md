# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready

- [x] **Guards Phase 3: Cron-to-workflow migration** — ✅ COMPLETE (2026-04-14). 2 of 4 handlers migrated: error-log-scanner → `error-scan.ts`, coaching-feedback → `coaching-feedback.ts`. Remaining 2 not candidates (priority-drift=dead code, active-nudge=pure JS intervention). run-workflow handler upgraded with `runFunction()` + `agent`. **Design**: `agents/may/workspace/DESIGN-sensor-judge-migration.md`.
- [ ] **Batch merge tool for tech-lead** — 🟢 IN PROGRESS (forked to tech-lead 2026-04-15 08:32, s_1776241927088_24). Optimizer finding: tech-lead spent 77 git ops (74% of session) on mechanical branch merges in a 94-op session. A `batch-merge.sh` script could save ~40 ops per merge session. **Deliverable**: Script at `scripts/batch-merge.sh` that takes a branch list/pattern, merges all with --ours conflict resolution. **Scope**: Small. **Owner**: tech-lead/coder.
- [x] **Scenario oracle generator for coach** — ✅ MERGED (2026-04-15, c197286d). Script at `scripts/scenario-oracle.sh`. Rewritten with before/after patch diffing + success_criteria evaluation.
- [x] **Create-test-pivot loop guard** — ✅ BUILT + IN REVIEW (2026-04-14). Guard at `agents/shared/guards/pivot-detector.ts`. 7 tests on branch `review/pivot-detector-guard`. Warns at 3 fail-pivot cycles, injects mandatory reassessment at 5.
- [ ] **Artifacts-as-Memory deep dive + externalization framework validation** — Dispatched to Bob (P1, 2026-04-14). Scout found paper 2604.08756 "Artifacts as Memory Beyond the Agent Boundary" — validates DD-750. **Scope**: Small.

- [x] **Scout archetype tool fix — enable forking** — ✅ DONE (2026-04-14). Already applied.
- [x] **Over-intervention cleanup — remove verification triple-stacks** — ✅ DONE (2026-04-14, coach).
- [x] **Tech-lead workflow adoption — D-o-R for Lens sessions** — ✅ MOSTLY RESOLVED (2026-04-14). 63% adoption.
- [x] **Tiered turn budget deployment** — ✅ ALREADY DEPLOYED (confirmed 2026-04-14).

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
