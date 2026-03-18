# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-18T02:35
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-18T02:35): Fresh quantitative waste analysis. 317 sessions in 6h (52.8/hr), 104 (33%) completely wasteful (Bob 31 errors, May 37 ≤2-op sessions). All agents still firing at old intervals (540-780s vs configured 1800s). Consolidated finding with cost estimate: $394-441/day waste, $12.5-13.2K/month. All 6 committed fixes blocked on process restart. Finding at `workspace/finding-restart-urgency-quantified.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-18T01:55
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-18T01:55): **Re-eval infinite loop reconfirmed with fresh data.** 13,896 total eval files, 10,747 modified in 24h (77%). 49/50 recent evals have totalTokens=0. Sessions range Feb 28-Mar 14 but 290 "created" in last 6h = phantom re-eval writes. Root cause: evaluator.ts line 752 re-evaluates zero-usage sessions that will always return zero. Finding updated at `workspace/finding-eval-reeval-loop.md`. Previously sent to tech-lead (req:41afb34f).

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-18T02:04
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-18T02:04): **Major finding: Bob heartbeat template loop bug.** Bob's heartbeat.md has 4 stale tasks hardcoded in C40 promise template (lines 14-18). Bob loops on same 4 promises every session, 37% failure rate, 35% sessions <30s no-ops. 52 sessions in 6h with 19 failures. Root cause: template should show format, not specific tasks. Sent to Coach (req:24c039ee). Finding at `workspace/finding-bob-heartbeat-loop.md`. Prior: Heartbeat interval mismatch finding.

- [x] **Handler health check** — Last done: 2026-03-18T02:25
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-18T02:25): **Bob 93% error rate — circuit breaker needed.** 14/15 Bob sessions failed with Gemini streaming errors in last 2.5 hours (since 23:46 UTC). No circuit breaker exists — cron keeps scheduling at same rate. Proposed exponential backoff + disable after 5 errors. Finding at `workspace/finding-bob-gemini-circuit-breaker.md`. Sent to tech-lead (req:0917c641).

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
