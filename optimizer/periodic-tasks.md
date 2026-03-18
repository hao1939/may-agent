# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-18T05:04
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-18T05:04): **76.7% session interruption rate.** Only 2/30 sessions completed normally (6.7%). 23 interrupted, 5 errors. Productive work being lost — tech-lead avg 21.8 ops, optimizer 27.3 ops, amy 23 ops, all interrupted before finish(). Root cause: cron hot-reload broken, intervals stuck at old values. 42+ commits undeployed. Finding at `workspace/finding-interrupted-epidemic.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-18T05:31
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-18T05:31): **common-sense.md injection bloat.** 11,504-byte file injected into every heartbeat task = 72-92% of each task prompt. Cost: $31/day (2,876 tokens × $15/MTok × 30 sessions/hr × 24h). Because it goes into user message (not system prompt), even working prompt caching wouldn't help. Proposed: move to system prompt or compress to 500-byte summary. Finding at `workspace/finding-common-sense-injection-bloat.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-18T05:22
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-18T05:22): **run-agent-task pre-flight checks.** Surveyed all 10 `run-agent-task` cron entries. 4 can skip LLM sessions when nothing to process: reflect (no new human inputs), consolidate-memory-* (empty journals), analyze-failures (no new evals). Disabled `lesson-consolidation` cron (redundant with lessons-graduation.ts JS handler). Sent pre-flight hook design to tech-lead (req:dbb14f27). Savings: $3-5/day ($90-150/month). Finding at `workspace/finding-run-agent-task-preflight.md`.

- [x] **Handler health check** — Last done: 2026-03-18T04:28
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-18T05:42): **Same 3 handlers still unfired** (daily-brief, lessons-graduation, workspace-compaction). Jitter cap fix committed (2b972c0) but undeployed. New observation: 34 cron entries total, 10 heartbeats at 30min = 18+ sessions/hr. Bob 100% idle (6/6 error/idle), Coach 57% idle (4/7 ≤3 ops), May 57% idle (4/7 ≤1 op). Combined with skipIfIdle DB bug (queries empty requests.db instead of may.db), zero idle skips occurring. Finding at `workspace/finding-handler-health-check-0318.md`.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-18T05:42
  **7 proposals now implemented** (up from 5). New additions: common-sense.md system prompt move (9bc3742, $31/day), evaluator false-positive fix (cb95fff). 44 total undeployed commits. Estimated savings once deployed: **$66-94/day ($1,980-2,820/month)**. Finding at `workspace/finding-proposal-implementation-tracking.md`.

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
