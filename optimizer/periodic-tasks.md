# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-18T02:58
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-18T02:58): **System-wide 88.5% session failure rate.** 130 sessions in 3h, only 15 completed (11.5%). 6/9 agents at 0% completion — all killed by next heartbeat before finishing. Only amy-kimi (100%), evaluator (70%), qa (33%) completing. Bob 100% Gemini errors. Cron still at 540s vs 1800s configured. New finding at `workspace/finding-zero-completion-rate.md`, sent to tech-lead (req:8f592e68).

- [x] **Cost outlier scan** — Last done: 2026-03-18T03:55
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-18T03:55): **Consolidated restart-delay cost analysis.** 68 sessions today, 12% completion, 47% idle. 6 committed fixes undeployed for 1-4 hours. Estimated waste: $5.50-7.50/hour ($20-28 total since first fix). Finding at `workspace/finding-restart-cost-per-hour.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-18T04:15
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-18T04:15): **Heartbeat preflight handler design.** Analyzed 40 recent sessions: May 100% idle, Coach 50% idle, Bob 67% idle. The "should I start?" decision is purely deterministic (query request DB for CREATED items targeting agent). Designed `heartbeat-preflight.ts` with per-agent configs and anti-starvation. Expected savings: $6/day ($191/month). Sent to tech-lead (req:7a23921d). Finding at `workspace/finding-heartbeat-preflight-handler.md`. Prior: workspace bloat compaction handler.

- [x] **Handler health check** — Last done: 2026-03-18T03:43
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-18T03:43): **All JS handlers healthy.** evaluate-sessions handler produced 9 new evaluations at 03:35 UTC (confirmed). workspace-compaction handler wired correctly (syntax OK, cron entry valid). 13 handlers total, all enabled. Main system issue remains: cron reload broken — heartbeats fire at 540s not 1800s. All 20 latest sessions are heartbeats, only 2/50 are cron-type tasks, confirming heartbeat overtriggering dominates.

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
