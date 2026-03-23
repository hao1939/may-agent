# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-23T02:39
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-23T02:39): **138 sessions/13h = 10.6/hr = $97.62/day.** Down 31% from $141/day. Optimizer = #1 cost ($34.34/day, 35.2%) due to high-op heartbeats (49 ops, 1M tokens). Bob = #2 ($27.98/day) despite Gemini + 83% cache (8M cached tokens). Coder = 49 gym sessions at $0.13/run. Claude caching STILL 0%. Savings potential: $36/day from prompt caching, $9/day from self-budgeting, $5/day from growth-cycle reduction. Finding at `workspace/finding-analysis-review-0323-0239.md`.
  Previous (2026-03-22T13:40): 83 sessions/6h = 332/day. Cost $35.46/6h = $141/day. Claude prompt caching STILL broken. Bash-as-cat TRIPLED.

- [x] **Cost outlier scan** — Last done: 2026-03-23T05:39
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-23T05:39): **61 sessions/5.5h = 11.1/hr, $97.35/day.** Optimizer = 50.6% of cost ($49.31/day projected, UP from $34.34). Root cause: skill-lifecycle Phase 1 DISCOVER reads 747K-869K input tokens ($2.41-$2.78/session). Two Phase 1 runs = $5.19 = 46% of optimizer cost. Bash-as-cat: 14.9/hr (coach 30 gym-cat calls). Claude caching still 0%. Finding at `workspace/finding-cost-scan-0323-0539.md`.
  Previous (2026-03-23T00:09): **80 sessions/8h = 10.0/hr.** Optimizer #1 by transcript (1,936KB, 26.4%). ALL 30 coder sessions are gym runs (21 from coach growth cycle, 9 from skill-lifecycle). Bash-as-cat **DOWN 65%: 11.1/hr** (was 31.8/hr at 13:40 scan). Coder still #1 offender (45 calls, 13.8%). Bob context bloat: 236KB avg per session for 13 ops — reads ~77KB boilerplate every time. May 55% idle (6/11 sessions). Finding at `workspace/finding-cost-scan-0323-0009.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-23T10:09
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-23T10:09): **~80 sessions scanned.** Bash-as-cat DOWN to 7.1% (75/1052) — 80% reduction from peak (31.8/hr → 6.25/hr). Coder = 52 cat calls (all real task work, not gym). Evals: 98% heuristic-stamped (50/51), quality=5 for 86% — low cost (1 evaluator session, 3 ops). Short sessions 26% of total — all already efficient (May 1-2 ops, QA 0-2 ops). Bob boilerplate reads down (focus-tasks 3x, common-sense 2x, vs 5x each last scan). No NEW LLM-to-JS opportunity. Remaining waste: bash interceptor, QA commit preflight, Amy read-dedup guard (all previously identified). Finding at `workspace/finding-llm-to-js-scan-0323-1009.md`.
  Previous (2026-03-22T21:15): 190 sessions scanned. Bash-as-cat 12%. QA commit preflight NOT BUILT. Bob reads 19KB focus-tasks.md 100% of sessions.
  Previous (2026-03-22T04:40): QA: 3 compound wastes = $2-3/day. npx fix deployed ✓. Commit preflight and dedup findings NOT deployed.

- [x] **Handler health check** — Last done: 2026-03-23T10:09
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-23T10:09): **Same 3 handlers still dead** (convention-check: 0 rows, tool-quality-scan: artifact 24h old, heartbeat-context: never loaded). convention_maturity also 0 rows. Root cause unchanged: compiled ELF binary caches handlers at startup, TS files added post-compilation aren't loaded. 19 handler .ts files exist on disk. No status change since last check — binary rebuild remains only fix.
  Previous (2026-03-22T03:09): 3 handlers STILL dead (convention-check, tool-quality-scan, heartbeat-context). Binary last rebuilt 2026-03-21T08:40.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-23T11:45
  This is your MOST IMPORTANT periodic task — focus area #1.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-23T11:45): **SKILL EFFECTIVENESS AUDIT — 87% unused.** Only 4/31 skills referenced in any agent SOUL.md (tool-discipline, grep-first-reading, coder-edit-discipline, sanitize-content). 27 skills exist as files but are never surfaced. 10/50 sessions read a SKILL.md (only coach/coder/optimizer). Root cause: skill-lifecycle Phase 4 deploys to INDEX.md (never read) not SOUL.md (always in context). Sent May req:ed0cf7d5 to add 3 high-impact skill one-liners to all agent SOUL.md files. **RECOMMENDATION: Pause new skill creation until deployment mechanism is fixed.** Finding at `workspace/finding-skill-effectiveness-audit-0323.md`.
  Latest (2026-03-23T04:30): **incremental-context-loading skill DEPLOYED.** Full 4-phase lifecycle via workflow: (1) Discovered context-reload waste pattern — 20+ sessions across 6 agents where agents re-read unchanged files every session. Bob 19KB focus-tasks.md 5/5 sessions (0 changes), QA re-scans unchanged repos 3/4 sessions, all heartbeat agents read full heartbeat.md every 30-60 min. ~2MB/day, ~$2/day waste. (2) Drafted SKILL.md (267 lines) with 5-step CHECK→DECIDE→LOAD→STORE→SPECIAL CASE protocol, 5 testable assertions, 3 anti-patterns. (3) Gym tested 2/3 runs pass. (4) Deployed to 6 agent INDEX.md files (bob, may, tech-lead, optimizer, qa, coach).
  Latest (2026-03-23T01:50): **evidence-over-narrative skill DEPLOYED.** Full 4-phase lifecycle via workflow: (1) Discovered evidence-vs-narrative conflict pattern — 20+ sessions across 4 agents where agents trust comments/checklists over runtime evidence. Coder phantom fixes (2/5 baseline), QA re-scans (39 wasted ops), Bob 77KB boilerplate reads. (2) Drafted SKILL.md (185 lines) with 4-step Gather Evidence → Catalog Narrative → Reconcile → Act protocol, 5 testable assertions, 3 anti-patterns. (3) Gym tested via phantom-fix-config scenario. (4) Deployed to 4 agent INDEX.md files (coach, coder, bob, qa) with agent-specific descriptions.
  Latest (2026-03-22T22:54): **search-strategy-escalation skill DEPLOYED.** Full 4-phase lifecycle via workflow: (1) Discovered grep/find spiral pattern — 6 sessions across 4 agents (tech-lead, optimizer, qa, coder) with avg 30 search commands where 7 suffice. (2) Drafted SKILL.md (269 lines) with 4-step BROAD SCAN → STOP AND THINK → TARGETED READ → ESCALATE STRATEGY protocol. (3) Gym tested 2/3 runs pass (search-count-under-10 convention check calibration issue — counts grep in file content not just commands). (4) Deployed to 4 agent INDEX.md files (tech-lead, optimizer, qa, coder). Gym scenario at `agents/gym/scenarios/search-strategy-escalation/`.
  Previous (2026-03-22T19:42): **idempotent-work-detection skill GYM-TESTED and DEPLOYING.** Created `idempotent-already-fixed` gym scenario. 3/3 runs, 7/8 checks pass. Deployed to optimizer INDEX.md. Test results at `workspace/skill-test-results-idempotent.md`.
  Previous (2026-03-22T15:20): **delegation-verification skill DEPLOYED.** Full 4-phase lifecycle: (1) Discovered delegation-without-verification anti-pattern — 73% of agents skip verifying delegated tasks, 11 sessions analyzed. (2) Drafted SKILL.md (225 lines) with 4-step SEND→RECORD→VERIFY→DOCUMENT protocol. (3) Gym tested 3/3 runs, 3/3 core behavioral checks pass (B1-B3: send, verify, document). (4) Deployed to 4 agent INDEX.md files (coach, optimizer, bob, tech-lead). idempotent-work-detection still pending gym scenario.
  Previous (2026-03-22T12:15): **coder-edit-discipline skill GYM-TESTED and DEPLOYING.** Created `read-before-edit` gym scenario (3 source file edits, C1 read-before-edit + C2.3 verify-after-edit checks, catches bash-based mods too). 3/3 runs, 11/11 checks pass. Sent deployment requests to May (SKILL.md update + INDEX.md references for coder/tech-lead/bob/optimizer). idempotent-work-detection still pending gym scenario.
  Previous (2026-03-22T09:09): coder-edit-discipline skill DRAFTED but NOT deployed (gym scenario mismatch — convention-verify-edit checks for edit() tool presence, but coder uses bash-based modifications). Also created idempotent-work-detection/SKILL.md (not tested). budget-before-act confirmed 2/3 pass (already deployed).
  Previous (2026-03-22T06:09): **stale-approach-fixation skill DEPLOYED.** Full 4-phase lifecycle: (1) Discovered cross-session stale approach pattern — agents ignore workspace notes and retry known-dead tools (npx/npm/yarn/tsc), wasting 3-5 turns/session. (2) Drafted SKILL.md (230 lines) with 4-step READ→BUILD→CHOOSE→DOCUMENT protocol. (3) Gym tested 3/3 runs, 6/7 behavioral checks passed (failing check was task-completeness, not skill behavior). (4) Deployed to agent INDEX.md files.
  Previous (2026-03-22T03:09): budget-before-act skill DEPLOYED. FM-3.1 (31x).
  Previous (2026-03-22T00:09): state-check-before-action (SCBA) skill DEPLOYED. FM-2.6 (12x).
  Previous (2026-03-21T19:39): obstacle-pivot skill DEPLOYED. FM-2.2 (8x recurrence).
  Previous (2026-03-21T12:09): grep-first-reading skill DEPLOYED. 7/8 checks in gym test.

- [x] **Tool quality review** — Last done: 2026-03-22T16:39
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-22T16:39): **Bash-as-cat DOWN 51%: 93 calls/6h (15.5/hr)** vs 191/6h (31.8/hr) at 13:40. coach 27, tech-lead 26, optimizer 24, qa 6, coder 3, bob 3, may 2, scout 2. SOUL.md-based skill deployment showing delayed effect. Session volume also halved (41/6h vs 83/6h). Read-dedup guard confirmed non-existent — must be implemented from scratch if needed.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-21T16:39
  **14 deployed improvements** verified working ($107-150/day savings realized). **8 more committed but blocked on handler cache/restart** ($94-148/day blocked). **9 proposed but not yet implemented** ($14-21/day). Grand total potential: $215-319/day ($6.4-9.6K/month). Key themes: handler cache = #1 blocker, growth-trigger cascade = #1 new cost driver (mitigated by cooldown fill), evaluator rubber-stamps fixed but blocked on restart, gym infra operational with first successful skill test. Sent coach cron cost fixes to May ($10-16/day). Full review at `workspace/improvement-proposals-review-0321.md`.

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
