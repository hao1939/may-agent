# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2025-07-11T18:00
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2025-07-11): System healthy. 187 sessions in ~6h across 8 agents. Avg ops: tech-lead 12.4, coach 10.3, bob 7.9, optimizer 7.9, scout 7.4, qa 4.6, may 3.8. 0 errors. Coach waste rate 20.5% (top system-wide), coder 24.6% (lower volume). Coach high-waste sessions driven by `multiple_tool_errors` + `no_finish_call` (75-106 wasted calls). Persistent-task loop fix already dispatched. No new action needed.
  _Older entries pruned 2025-07-11._

- [x] **Cost outlier scan** — Last done: 2026-04-21T15:40
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-04-21T15:40): **CRITICAL FINDING**: 614 sessions in 7 days failing with "LLM returned stopReason toolUse but no tool call content blocks" (truncated streaming response). Coach (151), may (128), tech-lead (122) worst hit. Coach has 17,295 total wasted calls in 24h — top waste source. High-waste coach sessions (75-106 wasted calls each) all heartbeats hitting `multiple_tool_errors` + `no_finish_call`. This is infrastructure-level (binary, not editable source). Notified tech-lead. System-wide quality: qa 0.79 (best), tech-lead 0.77, optimizer 0.75, amy 0.67 (worst). Amy also lowest efficiency at 0.62.
  _Older entries pruned 2026-04-21._

- [x] **Tool development & LLM-call reduction** — Last done: 2026-04-01T16:45
  **This is your HIGHEST-LEVERAGE periodic task.** Every tool you build saves LLM calls permanently.
  1. **Scan sessions** — read recent session transcripts. Look for agents doing multi-step bash sequences,
     parsing data formats, or making deterministic decisions via LLM that could be a single tool call.
  2. **Audit tool quality** — check tool-quality-report.md. Any `wrong-tool` or `empty-args` patterns?
     Could better schema descriptions fix them? Any tool underused that agents don't know about?
  3. **Check tool requests** — other agents may suggest tools via requests or bulletin. Review those.
  4. **Build or improve** — implement new tools in `src/lib/tools/`, improve existing tool schemas,
     or improve tool descriptions. Each tool needs: clear schema, good description, TypeScript impl.
  5. **Measure impact** — after deploying a tool, track: LLM calls saved, error rate change, adoption.
  If found → write proposal in workspace/improvement-proposals.md, then implement.
  Tool code: `src/lib/tools/` (28 files). Tool assembly: `src/lib/manager.ts`. Agent config: `agent.json`.
  Latest (2026-04-01T16:45): Sessions now available again. Will do deep tool analysis next session when more data accumulates on bf34041. Current system healthy — 0 errors, 0.7% waste, quality 99.5%.
  _Older entries pruned 2026-04-01T16:45._

- [x] **Handler health check** — Last done: 2026-04-01T16:45
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-04-01T16:45): **Session persistence FIXED** — binary bf34041 (includes 21ab683 session_start/session_end events). PID 74. Sessions flowing since ~15:45 (9h gap closed). Evaluations healthy (latest 16:40). HEAD f9064fe (2 commits ahead of binary — dead code cleanup only). 0 errors in 24h. System stable.
  _Older entries pruned 2026-04-01T16:45. Waste trend: ...→0.7→0.6→0.0→0.6→0.6→0.7→0.7→0.7→0.7%._

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-30T01:10
  This is your MOST IMPORTANT periodic task — focus area #1.
  **⛔ COOLDOWN: WEEKLY (or on-demand only).** With 54 skills and 5 consecutive saturation findings,
  discovery phases consistently find "no new skill needed." Coach evidence confirms: remaining failures
  need workflow enforcement (code-level), not teachable skills. Each lifecycle costs ~50 ops (workflow).
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-28T09:31): **4th consecutive saturation — NO NEW SKILL WARRANTED.** Full workflow run (wr_1774690451141_edsw). Phase 1 scanned recent sessions for patterns (Bob recovery, maxTurns enforcement, context learning A/B). All remaining failure patterns are code-level fixes, not teachable behavioral skills. 54 skills in library. Recommend marking skill lifecycle as COMPLETE/SATURATED and switching cooldown to weekly or on-demand only.
  Latest (2026-03-26T15:34): Early exit — no new pattern found. Scanned 10 recent sessions + 20+ findings. All remaining failure patterns are code-level fixes, not teachable skills. 54 skills, saturation confirmed for 3rd consecutive run. Discovery doc at `workspace/skill-discovery.md`. Saved ~90 ops via early-exit (no phases 2-4).
  Latest (2026-03-26T03:26): Full 4-phase lifecycle via workflow. Phase 1 discovered "guard-precision-refinement" (isToolError false-positive regex). Phase 2 correctly concluded it's a code fix, NOT a teachable skill — no SKILL.md created. Phase 3 documented TEST BLOCKED. Phase 4 verified existing build-activation-verification deployment. 54 skills now exist. Saturation signal confirmed — code fixes > prompt skills for remaining patterns. Next run: consider 12h cooldown or skip if no novel behavioral pattern observed.
  Latest (2026-03-25T18:11): Re-ran lifecycle — discovery found build-activation-verification pattern (same as 10:03 run). Phase 2 reused existing SKILL.md. Phase 3 re-tested: 2/3 gym pass, all behavioral checks 3/3. Phase 4 deployed to optimizer SOUL.md + sent requests for tech-lead/coder/bob SOUL.md updates.
  Latest (2026-03-25T10:03): build-activation-verification (18th skill) drafted, tested (2/3 gym pass, core assertions 3/3), deployed to optimizer + tech-lead SOUL.md. Pattern: agents build binaries and claim "deployed" but don't verify the running process switched. 206 lines.
  Latest (2026-03-25T03:03): prerequisite-gap-protocol drafted and tested — 0/3 gym pass (agents claim success even with missing prerequisites). NOT deployed. Skill identifies real pattern but needs prompt injection to change behavior.
  Latest (2026-03-24T21:03): No new skill needed — discovery found deliverable-integrity pattern already deployed. 17 skills achieving good coverage.
  Latest (2026-03-24T14:03): deliverable-integrity (17th skill) deployed to agents. Full lifecycle. 3/3 gym pass.
  Latest (2026-03-24T06:06): progressive-work-persistence (16th skill) deployed to 6 agents. Full lifecycle.
  Latest (2026-03-23T21:36): verification-consistency (15th skill) deployed to 6 agents. Full lifecycle.
  _13 earlier skill deployments documented in finding files. See `workspace/finding-pattern-scan-*.md`._

- [x] **Tool quality review** — Last done: 2026-04-01T16:45
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-04-01T16:45): Quality **99.5%** (200w: 151g/35a/1ni/13skip). 50w: **100%** (25g/19a/0ni/6skip). 24h waste **0.7%** (1/150). 0 errors in 24h. System at all-time best metrics. Session data now available for deeper tool-level analysis going forward.
  _Older entries pruned 2026-04-01T16:45. Waste trend: ...→0.7→0.6→0.0→0.6→0.6→0.7→0.7→0.7→0.7%._

- [x] **Workflow quality audit** — Last done: 2026-04-19T00:00
  **⛔ COOLDOWN: WEEKLY.** Workflow changes are high-impact; audit weekly or after major changes.
  Read `agents/shared/workflows/REGISTRY.md` for current state.
  1. Check for new duplicates: `find agents -name "*.ts" -path "*/workflows/*" | sort`
  2. Review consolidation plan progress — any Priority 1/2/3 items still open?
  3. Check effectiveness: query evaluations for sessions that used workflows (look for `workflow_start` events)
  4. Update registry with any new workflows or changes
  5. **Measure workflow-coverage & workflow-effectiveness**: `bash agents/optimizer/workspace/tools/measure-workflow-coverage.sh`
  6. **Detect repeat patterns**: grep recent sessions for 3+ tool-call sequences that repeat across sessions
  7. Record snapshots to metrics (via emit events)
  If dedup needed → do the consolidation (promote best to shared, delete local copies).
  If regression found → investigate and fix.
  Latest (2026-04-19): Baseline measured. Coverage: 30.8% (target 80%). Effectiveness: 96.4% (target >90%, ✅ met). Removed auto-loop.ts and skill-lifecycle.ts (0 usage). Updated REGISTRY.md. Biggest gaps: may (2.8%), qa (1.7%), evaluator (0%). Notified May re: heartbeat workflow wiring. See project-workflow-first.md for full plan.

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-04-01T16:45
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-04-01T16:45): **New binary bf34041 ACTIVE** (PID 74). Session persistence fixed. Gym baseline NEEDED on bf34041. Previous: 849c340 = 15/16 pass (94%). 4970ddf was skipped (session bug). Will attempt gym run this session if time permits.
  _Older entries pruned 2026-04-01T16:45. Last successful gym: 15/16 pass (94%) on 849c340._

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-30T09:10
  Latest (2026-03-30T09:10): Cycle 19. 3 commits since Cycle 18. Tool waste all-time low 2.36%. Quality 97.4%. Process restart wall CLEARED. No new interventions needed. Full review at `workspace/improvement-proposals-review-0330.md`.
  Latest (2026-03-28T09:06): Cycle 17. 26 new commits. Context learning pipeline (8 commits). Guards reverted per Hao. maxTurns enforcement. Full review at `workspace/improvement-proposals-review-0328.md`.
  _Older cycles (14-16) pruned 2026-03-30T17:40. See workspace/improvement-proposals-review-*.md for full history._

---

## Bi-Weekly
- [x] **Heartbeat graduation review** — Last done: 2026-03-31
  Latest (2026-03-31): Review #3. Analyzed 24h heartbeat ops for all agents (199 sessions). QA commit-preflight is strong graduation candidate — 76% of QA heartbeats are 1-op early exits (deterministic git-log check). May already effectively graduated (91% are 1-op). Cron grew 28→47 entries. Full log at `workspace/graduation-log.md`.
  Latest (2026-03-17): Graduated error-log-scanner.ts to cron.json. 2 orphaned handlers remain. Full log at `workspace/archive/2026-03/graduation-log.md`.
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
  Latest (2026-03-17): Automated via `agents/may/handlers/lessons-graduation.ts` (daily cron). All agents under 2K. **This task is now automated.**

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
