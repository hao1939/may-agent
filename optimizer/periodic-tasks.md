# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-19T21:19
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-19T21:19): **48 sessions/4h, 2.1% error rate (1 error) — stable low.** Coach cost share dropped 33%→12.8% (avg 121KB vs 345KB). QA rose to #2 at 19.4% but all legitimate review work. Binary still not activated — `66aace2` built but `96dcb60` running. Guard deployment still blocked. Scout quiet (1 session). Finding at `workspace/finding-analysis-review-0319-2119.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-19T19:49
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-19T19:49): **64 sessions/8h, 10.6MB total, 1.6% error rate (all-time low).** Coach still #1 cost at 33% (3.4MB, 345KB avg) — 1.2MB wasted on duplicate reads (method-catalog.md 6x, todo.md 6x per session). Tech-lead #2 at 18%. Read-dedup guard committed (94fbc27) but NOT deployed — binary 11 commits behind HEAD. Previous rebuild request (req:01bcdc57) marked completed without execution. Re-escalated to May (req:8752bd02). Guards blocking $30-43/day savings. Finding at `workspace/finding-cost-scan-0319-1949.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-19T19:49
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-19T19:49): **No new conversion opportunities.** 3 coach cron tasks still use LLM: training-sprint (511KB), common-sense-verify (308KB), research-intake (112KB). All require genuine LLM judgment (planning experiments, verifying behavior, synthesizing research). Waste is from duplicate reads not task type — guard deployment would cut 40-60% of these sessions' size. JS handler sessions (watchdog, convention-check, evaluate-sessions) don't appear as session files at all — handler graduation working correctly. skipIfIdle saving ~27% of heartbeats.

- [x] **Handler health check** — Last done: 2026-03-19T17:49
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-19T17:49): **2.3% error rate (1/43), handlers running but 9 commits not deployed.** Running binary is `may-agent-96dcb60` but HEAD is `8d7a8a1`. Most critical: guard wiring (94fbc27) not active — coach reads method-catalog.md (71KB) 6x per session. Convention-check broken: reads from `.state/evaluations/` JSON dir which is empty since SQLite migration (96dcb60). Sent rebuild request to May, convention-check fix to tech-lead. Finding at `workspace/finding-handler-health-check-0319-1749.md`.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-19T18:55
  This is your MOST IMPORTANT periodic task — focus area #1.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-19T21:44): **verification skill (v1.3.0) — Phase 4 BLOCKED, not deployed.** Gym pass rate 1/6 (17%) below 2/3 threshold. Root cause: criteria gap — `hasVerificationAfterWrite` only recognizes read()/cat/head, not python3 json.load() which agent prefers. LLM judge passed 6/6. Product correctness 6/6. Evaluation showed 7.5/10 effectiveness across 15 sessions. Skill is sound; success_criteria needs updating. Next: fix gym-score-utils.cjs to accept python/node file reads, then re-test and deploy. Journal entry at workspace/journal.md.

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
