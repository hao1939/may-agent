# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-17
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-17, 11:37 update): Reviewed Bob's 5 new briefs: (1) **DPIR Pattern** — philosophy, not optimization-relevant, (2) **Pressure-Safety Inversion** — validates infra approach, no action, (3) **OpBudget Visibility** — `turnBudgetWarningAt` configured but not wired to inject per-turn counter into context, (4) **Tool Name Injection** — not yet implemented, (5) **Stuck Detection** — already in `src/lib/stuck-detector.ts` ✅. **Overtrigger fix verified**: both cron.ts fixes deployed (proportional cooldown interval/2 + pending trigger no-op). Rates: May 1.56x (was 2.79x), tech-lead 1.75x (was 3.26x), coach 1.27x (was 2.36x). **~55% reduction**, waste down from ~$435/day to ~$126/day. Remaining opportunity: increase cooldown from interval/2 to interval×0.75 could save another ~$60/day. Briefs 3-4 are in tech-lead's queue. No new optimizer-owned action items.

- [x] **Cost outlier scan** — Last done: 2026-03-17T19:56
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-17T19:56): **TWO findings from evaluator code analysis + live cost extraction:**
  (1) **Heuristic evaluator usage data always zero** (NEW, HIGH) — `writeHeuristicEvaluations()` hardcodes `cost: 0, turns: 0`. `extractUsage()` exists but is never called for the heuristic path. Fix: parse JSONL → call `extractUsage()`. Sent to tech-lead (req:03be9c20). Full analysis: `workspace/finding-heuristic-evaluator-missing-usage.md`.
  (2) **Error regex too broad** (prior finding, req:deab92c6) — `Error:` matches evidence data. Full analysis: `workspace/finding-heuristic-evaluator-false-positives.md`.
  **Live cost data** (from transcripts, bypassing broken evals): Top cost sessions: May $21.83 (184 turns!), May $15.59 (132 turns), May $3.85 (39 turns). Also found 22 "interrupted" sessions never archived — `archiveSession()` exists but wasn't called for interrupted sessions. History dir is empty.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-17
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-17): No new candidates. Also completed **Tool Efficiency Audit** (Focus Area #3): analyzed 9,790 sessions, found 5 unused tool bundles to remove (optimizer/workflow, tech-lead/workflow, amy/scrape, may/workflow, scout/agents). Brief at `workspace/brief-tool-efficiency-audit.md`, sent to May for execution. Est. ~$264 historical waste in input tokens.

- [x] **Handler health check** — Last done: 2026-05-09
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-17): 10 handler `.ts` files present. 8 referenced by cron entries (coaching-report, daily-brief, error-log-scanner, evaluate-sessions, lessons-graduation, run-agent-task, system-status, watchdog) — all wired correctly ✅. **2 orphan handlers** on disk with NO cron reference: `audit-requests.ts` (106 LOC), `focus-task-tracker.ts` (159 LOC) — 265 lines dead code. 32 cron entries total. **error-log-scanner wired today** (was orphaned). Job history healthy. Full test suite passes.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-05-09 (Finding 18, Cycle 12). **2 new commits since last review**: agent-growth refactor committed (3a6d51e — 16 files, +1725/-168), orphaned test cleanup (85de6e7). Git now clean (0 uncommitted changes — resolved 7+ week risk). 1049/1049 tests pass (87 files), tsc clean. New cross-edit guard (P53) prevents cross-agent identity file modification. Finish tool wired but unadopted. System idle — 0 sessions, evals, job history. Compaction 8/12, prompt caching still 0% for Opus (LiteLLM proxy blocker). **No new optimization work items identified.**

- [x] **Refine-Skill loop (EvoSkill)** — Last done: 2026-03-17
  Follow `agents/shared/skills/skill-lifecycle/SKILL.md` — the full workflow:
  discover skill gaps from evals, draft or refine skills, test via gym, deploy,
  measure effectiveness. One atomic improvement per cycle.
  Latest (2026-03-17, 14:09 update): **Anthropic skill-creator methodology fully integrated.** Updated `skill-lifecycle/SKILL.md` v2.0.0 → v2.1.0. New additions: (1) **Assertions guidance** — expanded with 2-purpose explanation, 3-7 per skill, process-over-output principle, (2) **Multi-run in Step 3** — explained stochastic reasoning and journal tracking format, (3) **Transcript review in Step 6** — 4-point checklist before editing skills (skipped steps, dead ends, improvised solutions, dead weight), (4) **Iteration workspace structure** — `skill-refine/<name>/iteration-N/` with findings/changes/gym-results. Assessment doc at `workspace/anthropic-skill-creator-assessment.md`. Prior: v1.0→v2.0 added Step 3.5 (grading), Step 7 (blind A/B), multi-run table in Step 4.

---

## Bi-Weekly
- [x] **Heartbeat graduation review** — Last done: 2026-03-17
  Latest (2026-03-17): Follow-up on 3 proposals from Review #1. **Proposal 1 GRADUATED**: `error-log-scanner.ts` was already built (258 LOC) but orphaned — wired it to cron.json (4h interval, 7d cooldown). Coach's ERROR_LOG scanning is now automated. Proposals 2-3 still pending (low priority). No new graduation candidates — remaining heartbeat steps all require LLM judgment. 2 orphaned handlers remain (audit-requests, focus-task-tracker). Full log at `workspace/graduation-log.md`.
  Review all agents' heartbeat.md files. For each step, ask:
  1. Has this step been running for 1+ weeks?
  2. Is the pattern stable (same structure, same inputs/outputs)?
  3. Could it be expressed as a focused cron message?
  If yes to all three → propose a cron entry to May. The heartbeat step
  gets replaced with creative/directional work. Track graduated steps in
  workspace/graduation-log.md. See `agents/shared/tasks/work-maturity-ladder.md`.

---

- [x] **LESSONS.md graduation audit** — Last done: 2026-03-17
  Scan all agents' LESSONS.md files. For each entry, check:
  1. Is it a duplicate of a shared convention? → Remove (should be in shared/LESSONS.md)
  2. Has it been active for 2+ weeks? → Graduate to structural home or delete
  3. Is the agent-specific example still needed? → Keep if yes, trim if bloated
  Target: each agent's LESSONS.md under 2,000 bytes.
  Latest (2026-03-17, 15:25 update): **Phase 2 automated.** Built `agents/may/handlers/lessons-graduation.ts` (259 lines, pure JS handler). Added daily cron entry. Scans: size budget (2K), stale entries (>14d), strikethrough, GRADUATED/OBSOLETE markers, shared duplicates. Reports to `workspace/graduation-report.md`, triggers May heartbeat on issues. Sent dedup gate to Coach (req:e0040e2c). All 1375 tests pass, tsc clean. Stats: total ~19.7KB (was 67.6KB), all agent files under 2K. **This periodic task is now automated via daily JS handler.**

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
