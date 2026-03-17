# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-17
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-17, 11:37 update): Reviewed Bob's 5 new briefs: (1) **DPIR Pattern** — philosophy, not optimization-relevant, (2) **Pressure-Safety Inversion** — validates infra approach, no action, (3) **OpBudget Visibility** — `turnBudgetWarningAt` configured but not wired to inject per-turn counter into context, (4) **Tool Name Injection** — not yet implemented, (5) **Stuck Detection** — already in `src/lib/stuck-detector.ts` ✅. **Overtrigger fix verified**: both cron.ts fixes deployed (proportional cooldown interval/2 + pending trigger no-op). Rates: May 1.56x (was 2.79x), tech-lead 1.75x (was 3.26x), coach 1.27x (was 2.36x). **~55% reduction**, waste down from ~$435/day to ~$126/day. Remaining opportunity: increase cooldown from interval/2 to interval×0.75 could save another ~$60/day. Briefs 3-4 are in tech-lead's queue. No new optimizer-owned action items.

- [x] **Cost outlier scan** — Last done: 2026-03-17
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-17): Over 7.5h window (500 sessions): 4.0% error rate (down from 29.5% yesterday). **Biggest finding: Heartbeat overtriggering wastes $435/day.** May=2.79x, tech-lead=3.26x, coach=2.36x expected rate. 160 extra sessions + 19 skipped. Root cause: 60s cooldown in cron.ts `triggerNow()` + `checkPendingTrigger` latch bypass. Design brief at `workspace/brief-overtrigger-fix.md`, handed off to tech-lead.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-16
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-16): Scanned 30 most recent sessions plus cron.json (26 entries). All `run-agent-task` cron entries do genuinely cognitive work (pattern analysis, semantic dedup, memory consolidation, coaching). 7 JS handlers present, all wired. **Cost scan insight**: Coach $5.20/session (50t, 1.68M input), Optimizer $3.46 (46t, 1.1M), May $3.65 (41t, 1.19M) — highest-cost sessions are long heartbeats, not cron jobs. All Opus agents still 0% cache; evaluator/bob/amy-kimi get 275-2047% cache read. **No new LLM-to-JS candidates.** The remaining cost lever is still prompt caching (LiteLLM proxy config change needed from Hao).

- [x] **Handler health check** — Last done: 2026-05-09
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-05-09): 7 handler `.ts` files present (coaching-report, daily-brief, evaluate-sessions, focus-task-tracker, run-agent-task, system-status, watchdog). All 17 cron `handler` references resolve to existing `.ts` files — ✅ no broken wiring. 26 total cron entries (24 enabled, 2 disabled: focus-task-tracker, iraq-conflict-monitor — intentional). 6 handler test files (44 tests), all pass. Missing test coverage: `run-agent-task` and `focus-task-tracker` still have no dedicated test files (unchanged). Full suite: 1049/1049 tests pass (87 files), tsc clean. Job history: 0 entries (data cleared). Git clean, 0 uncommitted changes. **No issues found. System healthy.**

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-05-09 (Finding 18, Cycle 12). **2 new commits since last review**: agent-growth refactor committed (3a6d51e — 16 files, +1725/-168), orphaned test cleanup (85de6e7). Git now clean (0 uncommitted changes — resolved 7+ week risk). 1049/1049 tests pass (87 files), tsc clean. New cross-edit guard (P53) prevents cross-agent identity file modification. Finish tool wired but unadopted. System idle — 0 sessions, evals, job history. Compaction 8/12, prompt caching still 0% for Opus (LiteLLM proxy blocker). **No new optimization work items identified.**

- [x] **Refine-Skill loop (EvoSkill)** — Last done: 2026-03-17
  Run the `agents/shared/tasks/refine-skill.md` protocol: scan recent evals for failure patterns,
  attribute to a skill, make one atomic evidence-based improvement to the skill library.
  Also look for NEW skill opportunities: agents repeating multi-step processes that could be
  codified. Test new/updated skills via gym (`scripts/gym-run.sh`) before deploying.
  Latest (2026-03-17): Scanned 300 most recent evals (22 `needs_improvement`). Top FM codes: FM-2.6 (13), FM-5.3 (8), FM-3.3 (8), FM-2.1 (8), FM-3.1 (7), FM-3.2 (5), FM-2.5 (5), FM-1.3 (3). Coach dominates (12/22 NI evals, 55%). **Key finding**: FM-2.6 (REASONING_ACTION_MISMATCH) is #1 failure mode with NO skill coverage. Three sub-variants identified: fabrication (claiming work from prior sessions), substitution (replacing failed actions with easier ones), requirement drift (doing different steps than prescribed). **Action taken**: Added FM-2.6 anti-pattern section to `agents/shared/skills/error-handling/SKILL.md` (v1.1.0 → v1.2.0) with 3 sub-variants, evidence from 8 specific sessions, 4 corrective actions, and 1 new inviolable constraint.

---

## Bi-Weekly
- [x] **Heartbeat graduation review** — Last done: 2026-03-16
  Latest (2026-03-16): First full review. Reviewed 12 heartbeat.md files, identified 3 graduation candidates: (1) Coach ERROR_LOG scanning → JS pre-check handler (highest value), (2) May Step 3 health checks → remove (redundant with watchdog+system-status handlers), (3) Tech-Lead health-check.sh → JS pre-flight (deferred — embedded in broader step). 11 existing graduated items catalogued. Full report at `workspace/graduation-log.md`. Proposals handed off to May.
  Review all agents' heartbeat.md files. For each step, ask:
  1. Has this step been running for 1+ weeks?
  2. Is the pattern stable (same structure, same inputs/outputs)?
  3. Could it be expressed as a focused cron message?
  If yes to all three → propose a cron entry to May. The heartbeat step
  gets replaced with creative/directional work. Track graduated steps in
  workspace/graduation-log.md. See `agents/shared/tasks/work-maturity-ladder.md`.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
