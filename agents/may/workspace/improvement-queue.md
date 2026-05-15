# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready

- [x] **Increase JS evaluation coverage to ≥30% for all agents** — ✅ DONE (s_1776288668585_124, 75 ops). Implemented `evaluateStandaloneSession()` in evaluator.ts (121 lines) + updated evaluator-heartbeat.ts handler. Branch: `review/standalone-eval-coverage`. Needs code review merge.

- [x] **Investigate workflow session error rates for Bob and Coach** — ✅ DONE (s_1776290567108_147, 18 ops). Deliverable at `agents/may/workspace/audits/wf-error-rate-analysis.md`.

- [x] **Coder utilization push — structured task pipeline** — ⏳ IN PROGRESS, dispatched to tech-lead (s_1776292339351_164). Deliverable: `agents/may/workspace/audits/coder-task-pipeline.md`.

- [ ] **May ops diet — reduce heartbeat bloat below 12 avg** — ⏳ IN PROGRESS (s_1776324808746_541). Forked 07:30 UTC.

- [ ] **Metric system Phase 3 adoption verification (post-restart)** — Phase 2 complete but blocked on process restart: heartbeat-context metrics injection and proof-of-life metrics are code-on-disk only. After restart: verify 5+ agents see their owned metrics in heartbeat context, verify proof-of-life Telegram digest includes health metrics section, verify research_log is being used (currently Scout=225, Bob=29 entries — good). Owner: may. Deliverable: Phase 3 checklist updated in `agents/may/workspace/projects/metric-system.md` with green checks + evidence.

- [ ] **Coach work-session quality intervention** — Coach JS quality is 0.24 (worst in system). Bimodal: structured heartbeats/cron are near-perfect, but open-ended work sessions fail hard (regression check 80 ops interrupted, investigation sessions produce inconclusive analysis). Coach needs a work-session scaffold template: read task → plan 3 steps → execute → verify each → finish with evidence. Owner: coach (self-improvement) or may (heartbeat edit). Deliverable: Coach heartbeat or skill file updated with work-session checklist, quality tracked for 48h after.

- [x] **Bob gym execution reliability fix** — ⏳ IN PROGRESS, dispatched to coach (s_1776330087330_606) — 6 needs_improvement sessions related to gym work. Recurring patterns: FM-1.3 path confusion finding gym runner, FM-2.6 incomplete trial runs (starts 10, finishes 4-5 without noticing), incomplete deliverables. Needs a persistent context entry or skill for "gym execution checklist" — verify runner path, count completed trials, verify all results before finish. Owner: coach (skill design) → bob (adopt). Deliverable: Skill or context entry deployed, tracked via next gym batch results.

- [ ] **Top-5 metrics dashboard prototype for proof-of-life** — From metric-system.md reflection section: raw numbers aren't useful to Hao. Prototype a "top 5 at a glance" section in the proof-of-life digest: pick 5 metrics (e.g., session success rate, JS eval quality, test count, error rate, creative output count), add trend arrows (↑↓→) and simple good/bad indicators. Get Hao feedback on whether these are the RIGHT 5 metrics. Owner: tech-lead (implement) + may (metric selection). Deliverable: Enhanced proof-of-life output with trend-annotated top-5 section.

- [x] **Guards Phase 3: Cron-to-workflow migration** — ✅ PARTIAL (2026-04-14). 2 of 4 handlers were migrated but both `error-scan.ts` and `coaching-feedback.ts` have since been **removed from disk** (confirmed 2026-04-19). Remaining 2 not candidates (priority-drift=dead code, active-nudge=pure JS intervention). run-workflow handler upgraded with `runFunction()` + `agent`. **Design**: `agents/may/workspace/DESIGN-sensor-judge-migration.md`.
- [x] **Batch merge tool for tech-lead** — ✅ DONE (2026-04-15). Script at `scripts/batch-merge.sh` already existed and verified complete.
- [x] **Scenario oracle generator for coach** — ✅ MERGED (2026-04-15, c197286d). Script at `scripts/scenario-oracle.sh`. Rewritten with before/after patch diffing + success_criteria evaluation.
- [x] **Create-test-pivot loop guard** — ✅ BUILT + IN REVIEW (2026-04-14). Guard at `agents/shared/guards/pivot-detector.ts`. 7 tests on branch `review/pivot-detector-guard`. Warns at 3 fail-pivot cycles, injects mandatory reassessment at 5.
- [x] **Artifacts-as-Memory deep dive + externalization framework validation** — ✅ DONE (Bob, 2026-04-14). Paper 2604.08756 reviewed, validates DD-750.

- [x] **Wire gym-batch.sh into coach growth-cycle.ts** — ✅ DONE (tech-lead, 2026-04-15). Completed per req tracking.

- [x] **Tech-lead post-dispatch finish guard** — ✅ DONE (2026-04-15). Added "⚡ Post-dispatch rule" to tech-lead heartbeat.md Step 2: "After any agents.fork() or workflow.run(), call finish() within 3 ops."

- [x] **QA heartbeat simplification (IT-21)** — ✅ SELF-RESOLVED (2026-04-15). QA interrupt rate dropped from 67% to 0% (12/12 done, 0 interrupted in last 6h). Tech-lead root cause analysis confirmed it was system-wide external session abortion, not a QA heartbeat issue.

- [x] **KE-180/KE-182 production deployment — hard gate design rules** — ✅ DONE (2026-04-15, commit 62ece090). Deployed to production artifacts.

- [x] **Common-sense rule #23 auto-commit bypass cleanup** — ✅ DONE (2026-04-15). All 4 layers complete: auto-commit interval 10min→2h, heartbeat Step 7 fixed, commit-guard.ts merged, health-check aligned.

- [x] **Scout archetype tool fix — enable forking** — ✅ DONE (2026-04-14). Already applied.
- [x] **Over-intervention cleanup — remove verification triple-stacks** — ✅ DONE (2026-04-14, coach).
- [x] **Tech-lead workflow adoption — D-o-R for Lens sessions** — ✅ MOSTLY RESOLVED (2026-04-14). 63% adoption.
- [x] **Tiered turn budget deployment** — ✅ ALREADY DEPLOYED (confirmed 2026-04-14).

## In Progress
- [x] **Optimizer finding→dispatch pipeline** — ✅ DONE (session completed). Design protocol delivered.

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
