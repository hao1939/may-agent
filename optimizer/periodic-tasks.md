# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-19T06:49
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-19T06:49): **118 sessions/6h, 17% error rate (20 errors).** Error categories: truncated toolUse (8), "cannot continue from assistant" (4), JSON parse (4), ENOENT (2), LiteLLM (2). Worst session: s_1773899695055_13 (coach) cost $6.49 for mechanical Step 4 "Record & Decide" — 63 bash calls wandering, 2.1M input tokens. Pure-JS Step 4 now deployed in growth-cycle.ts and training-sprint.ts — no more Step 4 LLM sessions observed after fix. Coach: 34 sessions (7.6MB), tech-lead: 20 sessions (4.3MB). Finding at `workspace/finding-analysis-review-0319-0649.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-19T11:25
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-19T11:25): **Tech-lead is #1 cost driver: $33.26 (33%) over 7 sessions, avg $4.75.** Optimizer #2 at $23.97 (24%). Root cause: long heartbeats with 50-63 turns, context grows to 54K tokens. Later turns cost 1.5x more. Fix deployed: evaluator transcript cap 15→10KB + 20KB total budget (bdc997a). Sent opBudget reductions to May: tech-lead 70→35, optimizer 200→60 (req:db066426). Expected savings: $25-50/day. Finding at `workspace/finding-session-cost-analysis-0319.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-19T12:52
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-19T12:52): **No new conversion opportunities found.** Scanned 30+ sessions from last 6h across all agents. Remaining LLM sessions are genuinely LLM-dependent: reflect (synthesis), common-sense-verify (nuanced judgment), evaluations (reading+scoring), design (architecture), signal scans (research synthesis). Key insight: opBudget counts only state-changing ops — Amy had 57 tool calls but only 4 edits (within 25 op budget). Real cost driver is input token growth, not tool count. Coach opBudget still at 200 (not reduced per req:db066426 — only TL+optimizer were changed). Filed follow-up below.

- [x] **Handler health check** — Last done: 2026-03-19T02:49
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-19T02:49): **Handlers healthy post-restart (01:55 UTC).** 38 cron entries, 95% session success rate. Memory-trimmer handler deployed but awaiting first 24h trigger (84MB memory, 62MB orphans). **Opus caching still broken** — 94% of cost ($21.67/10 sessions) from Opus agents with 0% cache. Savings potential $156/day ($4,700/mo) blocked on ANTHROPIC_API_KEY env var. Finding at `workspace/finding-handler-health-check-0319.md`.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-19T14:25
  This is your MOST IMPORTANT periodic task — focus area #1.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-19T14:25): **Created investigate-and-fix skill + gym scenario.** Scanned 30+ sessions across tech-lead, bob, optimizer, coach, amy-kimi. Found "Investigate → Diagnose → Fix → Verify" as the most universal single-agent pattern (70%+ of sessions). Created `agents/shared/skills/investigate-and-fix/SKILL.md` with 5-step pattern, evidence from 3 real sessions, and 5 behavioral assertions. Created gym scenario `investigate-fix-pattern` with multi-bug environment, success_criteria testing both product (tests pass) and process (followed investigation pattern). Not yet gym-tested (needs May to run). Next: run scenario 3x, deploy if 2/3 pass.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-18T07:15
  **10 proposals now implemented** (up from 7). New additions since last review: finish-status fix (82ced56), read-dedup guard (9eefa72), finish evidence guard (2233509). **51 total undeployed commits, all 1,457 tests pass.** Estimated savings once deployed: **$80-104/day ($2,400-3,120/month)** from cron+caching fixes alone. Full deployment readiness brief at `workspace/finding-deployment-readiness-51-commits.md`.

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
