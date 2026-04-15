# May Improvement Queue
<!-- Idle-time work. Each item has a concrete deliverable. Pick top Ready item, fork a session. -->

## Ready

- [x] **Batch merge tool for tech-lead** — ✅ DISPATCHED to tech-lead (2026-04-15, req 55b782c9). **Scope**: Small.
- [x] **Evaluator JS handler replacement** — ✅ DISPATCHED to tech-lead (2026-04-15, req 2942feeb). **Scope**: Small (2h). **Saves**: ~250 ops/day.
- [ ] **Fix PATH env for bash tool** — Optimizer finding (0414b): 8% of all bash calls are PATH export boilerplate. 1-line framework fix: add `.state/.bun/bin` to bash subprocess env. **Deliverable**: PATH addition in `src/lib/workflow-tool.ts` or bash env config. **Scope**: Tiny (30 min). **Owner**: tech-lead. **Saves**: ~700 ops/day. **Source**: `agents/optimizer/workspace/finding-tool-gap-analysis-0414b.md`.
- [ ] **DB query helper script** — Optimizer finding (0415): every agent writes 3-line boilerplate for DB queries. Helper script saves 1-2 ops per query × ~100 queries/week. **Deliverable**: `scripts/db-query.ts` accepting SQL as argument. **Scope**: Tiny (1h). **Owner**: tech-lead/coder. **Saves**: ~150 ops/week. **Source**: `agents/optimizer/workspace/finding-tool-gap-analysis-0415.md`.
- [ ] **Dead skills sunset (round 2)** — Optimizer scouting (0415): 50% of shared skills are dead weight. 6 unreferenced: constructive-friction, critical-pause, experiment-before-apply, extract-directives, synthesis-dpir, verify-before-finish-micro. **Deliverable**: Updated LIBRARY.md + `shared/skills/archive/`. **Scope**: Small (1h). **Owner**: coach. **Source**: `agents/optimizer/workspace/finding-skill-scouting-0415.md`.
- [ ] **Push data into dispatch calls** — Optimizer finding (0414): sessions with data inline avg 9.6 ops vs 26.3 without (−63%). Extend bob's research-thread pattern to coach/tech-lead/optimizer dispatch. **Deliverable**: Updated dispatch templates in heartbeat.md files with data-inline enforcement. **Scope**: Medium. **Owner**: may + optimizer. **Saves**: ~285 ops/day. **Source**: `agents/optimizer/workspace/finding-fast-vs-slow-session-techniques-0414.md`.
- [ ] **Session-query adoption push** — Optimizer finding (0414b): `scripts/session-query.ts` has zero adoption (0 uses in 24h). Fix: verify DB backend, add to agent context.md, wire into optimizer templates. **Deliverable**: Updated session-query.ts + context.md for optimizer/may/QA. **Scope**: Small (1-2h). **Owner**: optimizer + tech-lead. **Source**: `agents/optimizer/workspace/finding-tool-gap-analysis-0414b.md`.
- [ ] **Gym scenario scaffold tool** — Optimizer finding (0414): coach spent 12-15 ops per scenario on directory scaffolding. One-command scaffold with templates. **Deliverable**: `scripts/gym-scenario-scaffold.sh <name>`. **Scope**: Tiny (1h). **Owner**: coder. **Saves**: ~10 ops/scenario session. **Source**: `agents/optimizer/workspace/finding-tool-gap-analysis-0414.md`.
- [ ] **Guard redirect extension health check** — QA finding (0414): fix deployed for 53% interrupt rate (guard redirect extends hard limit). Need 24h health check to confirm ≤10%. **Deliverable**: Report at `agents/may/workspace/audits/guard-redirect-health.md`. **Scope**: Tiny (30 min). **Owner**: may/optimizer. **Source**: `agents/qa/workspace/findings/2026-04-14-qa-interrupt-rate-root-cause.md`.
- [ ] **Scenario oracle generator for coach** — Optimizer finding: coach spent 118 ops (3.4× budget) designing gym scenarios, with 32 node executions for manual expected-output computation. A script to auto-generate expected outputs from clean codebase + patch would save ~15-20 ops per scenario session. **Deliverable**: Script at `scripts/scenario-oracle.sh`. **Scope**: Medium. **Owner**: coach + coder.
- [ ] **Artifacts-as-Memory deep dive + externalization framework validation** — Dispatched to Bob (P1, 2026-04-14). Scout found paper 2604.08756 "Artifacts as Memory Beyond the Agent Boundary" — validates DD-750. **Scope**: Small.

## In Progress
- [ ] **Tiered turn budget deployment** — Forked to tech-lead (2026-04-15 06:31, s_1776234674261_37). Implementing tier limits in manager.ts + cron.ts per optimizer design doc.
- [ ] **Optimizer finding→dispatch pipeline** — Forked to optimizer (2026-04-13 07:22, s_1776064947441_50). Design protocol + heartbeat edit.
- [ ] **Tech-lead workflow adoption — D-o-R for Lens sessions** — Forked to optimizer (2026-04-15 06:01, s_1776232873559_15). Proposal for D-o-R phase boundaries on Lens sessions.

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
