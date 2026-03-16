# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-16
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-16, cron run): Bob's analysis.md "Over-Refusal" finding: agents told to manually read ERROR_LOG, but `active-recall.ts` already auto-injects it. **Fix**: removed redundant ERROR_LOG instruction from own SOUL.md; wrote brief for 5 remaining files across 4 agents (coder, coach, tech-lead, master); handed off to May. This eliminates ~1 wasted turn/session + over-refusal risk. See `workspace/p114-error-log-dedup-brief.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-16
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-16): Analyzed 200 sessions (1.8hr window). Avg cost **$0.85/session** (↓24% from $1.12 last scan). Outlier rate **8.0%** (↓ from 14.9%). **BUT error rate spiked to 29.5%** — 429 rate limits account for 73% of errors (41/58). Error sessions waste 32.5% of total cost ($56.25). 429 errors are accelerating (5→17→19 per hour). Differential backoff fix deployed today (15:34 UTC) — should reduce 429 impact when process reloads. All Opus agents still 0% prompt cache (biggest remaining lever). See `workspace/cost-outlier-scan-2026-03-16.md`.

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

- [x] **Refine-Skill loop (EvoSkill)** — Last done: 2026-03-16
  Run the `agents/shared/tasks/refine-skill.md` protocol: scan recent evals for failure patterns,
  attribute to a skill, make one atomic evidence-based improvement to the skill library.
  Latest (2026-03-16): Scanned 30 most recent `needs_improvement` evals (684 total needs_improvement out of 3034 evals). Top FM codes: FM-3.3 (4), FM-2.6 (4), FM-2.5 (4), FM-3.2 (3), FM-3.1 (3), FM-2.2 (3). May dominates failures (22/41 issues, 54%) — almost all heartbeat step-order violations. VERIFICATION_FAILURE dropped from 11→4 (skill v1.1.0 may be helping). No skill evolution this cycle — May's failures are structural (context pressure from 50KB todo.md), not skill gaps. Recommendation: truncate/archive completed todo items to reduce context pressure. See `workspace/evoskill-refinement-2026-03-16.md`.

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
