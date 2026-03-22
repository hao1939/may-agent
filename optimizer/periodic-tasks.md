# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-22T13:40
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-22T13:40): **83 sessions/6h = 332/day.** Bob analysis.md unchanged (Mar 18). Bob synthesis has control-plane architecture proposal (AgentCgroup + MCP Tasks + Wink nudges). Session rate UP 56% vs prior scan. Cost $35.46/6h = $141/day. Claude prompt caching STILL broken — $43/day savings blocked on ANTHROPIC_API_KEY env var. Bash-as-cat TRIPLED (191/6h vs 104/9h prior). May double-fire pattern (3 instances/6h).

- [x] **Cost outlier scan** — Last done: 2026-03-22T16:39
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-22T16:39): **Session rate halved: 6.8/hr (was 13.8/hr).** 41 sessions/6h. Optimizer now #1 cost agent (23.9% of bytes, 7 sessions, 207 ops). Bash-as-cat down 51% to 93/6h. **CRITICAL: read-dedup-guard NEVER EXISTED** — commit 94fbc27 doesn't exist in git history, guard file not on disk. All prior references to it were fictional. Bob multi-read waste: 5× common-sense.md in one session (42KB repeated). Finding at `workspace/finding-cost-scan-0322-1639.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-22T21:15
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-22T21:15): **190 sessions scanned.** Bash-as-cat still 12% (162/1389 bash calls). Categorized: 81 simple-cat-read, 51 redirect-write, 13 heredoc-append, 12 cat-pipe. QA commit preflight STILL NOT BUILT — req:530b7be9 was "auto-completed" but only the npx fix was deployed (verified in heartbeat.md). QA re-scans same `de62c5a` commit across 3/4 sessions = ~$1.50/day waste. Bob reads 19KB focus-tasks.md in 100% of sessions (7/7). Tech-lead still calls `npx tsc` in 5 sessions (8 calls). Finding at `workspace/finding-llm-to-js-scan-0322-2115.md`.
  Previous (2026-03-22T04:40): QA: 3 compound wastes = $2-3/day. npx fix deployed ✓. Commit preflight and dedup findings NOT deployed.

- [x] **Handler health check** — Last done: 2026-03-22T03:09 (quick re-check)
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-22T03:09): **3 handlers STILL dead** (convention-check, tool-quality-scan, heartbeat-context) — lastRun=never for all three. Root cause unchanged: compiled ELF binary (`may-agent-bin`) has handlers baked in at compile time. TS files added post-compilation aren't loaded. No hot-loading path exists. Binary last rebuilt 2026-03-21T08:40. Handler report artifacts (graduation-report, compaction-report) last ran at that restart time. **Binary rebuild remains the only fix.** Finding at workspace/finding-handler-health-0321-0839.md.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-22T19:42
  This is your MOST IMPORTANT periodic task — focus area #1.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-22T19:42): **idempotent-work-detection skill GYM-TESTED and DEPLOYING.** Created `idempotent-already-fixed` gym scenario (3 source files with pre-fixed bugs, tests state-check-first + detects-already-done + no-unnecessary-edits + low-ops). 3/3 runs, 7/8 checks pass (B3 finishes-success fails due to oneshot adapter, not skill issue). Marked SKILL.md `tested: true`. Deployed to optimizer INDEX.md. Sent May deployment for coder/bob/coach/tech-lead (req:b67c9669). Test results at `workspace/skill-test-results-idempotent.md`. All active TODO gym scenarios now complete.
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
