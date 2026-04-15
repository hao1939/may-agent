# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready

- [ ] **Tiered turn budget deployment** — Experiment design is complete (`agents/optimizer/workspace/experiment-tiered-budget.md`) but code was NOT deployed to source files. Tiers: heartbeat=8, research=15, implementation=25 with soft limit + 2-turn grace. Safety: BenVanik data says never reduce thinking depth, only bound tool-call loops. Source: adaptive-reasoning-efficiency research project. **Deliverable**: tech-lead dispatched to implement turn budget in `src/lib/manager.ts` + `src/app/cron.ts` per the design doc. **Scope**: Medium.
- [ ] **Artifacts-as-Memory deep dive + externalization framework validation** — Scout found paper 2604.08756 "Artifacts as Memory Beyond the Agent Boundary" — mathematical proof that artifacts reduce information needed to represent history (Artifact Reduction Theorem). Directly validates our externalization framework (DD-750). Combined with ZPD convergence cluster (5+ papers validating H-107 difficulty threshold). Source: scout triage sessions 711-712. **Deliverable**: bob dispatched to write deep-dive + cross-reference with DD-750 and H-107 evidence. **Scope**: Small.

## In Progress
- [ ] **Optimizer finding→dispatch pipeline** — Forked to optimizer (2026-04-13 07:22, s_1776064947441_50). Design protocol + heartbeat edit.
- [ ] **Tech-lead workflow adoption — D-o-R for Lens sessions** — Forked to optimizer (2026-04-15 06:01, s_1776232873559_15). Proposal for D-o-R phase boundaries on Lens sessions.

## Done
<!-- Move completed items here with date -->
- [x] **Over-intervention cleanup** (2026-04-14): Removed KE-093 from 5 agents' context.md, deleted bob's verify-context-claims.md + dead backup. Each agent now has exactly 1 verification intervention (evidence-over-narrative.md). Commits: 16201f85, c9d38911.
- [x] **Scout archetype tool fix** (2026-04-14): Already done — scout/agent.json already has `agents` and `workflow` tools. 0 child sessions is behavioral (scout doesn't fork), not a tool issue.
- [x] **Guard-redirect prototype** (2026-04-14): Phase 1 design complete. Design docs at workspace/DESIGN-event-driven-guards.md, PROTOTYPE-guard-redirect.md. Test at test/guard-redirect.test.ts.
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
