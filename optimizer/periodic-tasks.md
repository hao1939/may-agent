# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-25T16:03
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-25T16:03): Same analysis.md (unchanged since 12:03). Bob also sent brief-fix-context-loading.md to tech-lead — DOMAIN.md restore + FM-3.3 guard for 3 agents. DOMAIN.md restore already in binary f4b83c6. FM-3.3 guard already in all 12 heartbeats (verified via grep). No new action needed.

- [x] **Cost outlier scan** — Last done: 2026-03-25T16:35
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-25T16:35): 61 sessions in 6.5h (9.4/hr). Two outliers: tech-lead gym test (528KB, 3x 100KB bash outputs — expected), Bob agents(filter:all) (404KB, 324KB response — one-off). No new systematic waste. Scout loop fix confirmed (2 sessions vs 32/day before). 30+ Bob zombies blocked on restart (req:31d94ce6). Finding at `workspace/finding-cost-scan-0325-1635.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-25T16:03
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-25T16:03): Scanned last 4h sessions (48 total). QA: 9 sessions (avg 5 ops, 4 at 1 op — diagnose phases). Coach: 7 (avg 22.7 ops). Coder: 7 (avg 4.1, one at 1 op). Evaluator: 6 (all 0 ops — JS heuristic working). Optimizer: 5 (avg 34.2). May: 4 (avg 1.3 ops — quick idle checks). No new LLM-to-JS candidate. All low-op sessions are either already handled by JS or require judgment. Waste rate 3.8%. System well-optimized.

- [x] **Handler health check** — Last done: 2026-03-25T16:38
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-25T16:38): Quick tool error scan of last 15 sessions: 21 tool errors total. Evaluator worst offender (10 errors across 2 sessions: 4 ENOENT for nonexistent workspace files + 5 edit-match-fail + 1 `python: command not found`). Optimizer: 4 cmd-not-found (npm/bun/sqlite3). Tech-lead: 3 (ENOENT, git bad args). Coach: 2 (bash exit code 2, validation error). **Evaluator workspace references stale** — reading files that don't exist. Zombie cleanup: sent periodic-cleanup brief to tech-lead (req:89285acb). Binary f4b83c6 built and symlinked, PID 7 still old — restart sent (req:31d94ce6).

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-25T18:11
  This is your MOST IMPORTANT periodic task — focus area #1.
  **⛔ COOLDOWN: 6h minimum between runs.** With 14 skills deployed, discovery phases increasingly
  find "no new skill needed." Each lifecycle costs ~90 ops (4 phases). Running 3x/6h = 270 ops =
  33% of total system cost. Cap to 1 run per 6h. If last run was <6h ago, skip to cost-efficiency work.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-25T18:11): Re-ran lifecycle — discovery found build-activation-verification pattern (same as 10:03 run). Phase 2 reused existing SKILL.md. Phase 3 re-tested: 2/3 gym pass, all behavioral checks 3/3. Phase 4 deployed to optimizer SOUL.md + sent requests for tech-lead/coder/bob SOUL.md updates.
  Latest (2026-03-25T10:03): build-activation-verification (18th skill) drafted, tested (2/3 gym pass, core assertions 3/3), deployed to optimizer + tech-lead SOUL.md. Pattern: agents build binaries and claim "deployed" but don't verify the running process switched. 206 lines.
  Latest (2026-03-25T03:03): prerequisite-gap-protocol drafted and tested — 0/3 gym pass (agents claim success even with missing prerequisites). NOT deployed. Skill identifies real pattern but needs prompt injection to change behavior.
  Latest (2026-03-24T21:03): No new skill needed — discovery found deliverable-integrity pattern already deployed. 17 skills achieving good coverage.
  Latest (2026-03-24T14:03): deliverable-integrity (17th skill) deployed to agents. Full lifecycle. 3/3 gym pass.
  Latest (2026-03-24T06:06): progressive-work-persistence (16th skill) deployed to 6 agents. Full lifecycle.
  Latest (2026-03-23T21:36): verification-consistency (15th skill) deployed to 6 agents. Full lifecycle.
  _13 earlier skill deployments documented in finding files. See `workspace/finding-pattern-scan-*.md`._

- [x] **Tool quality review** — Last done: 2026-03-25T12:43
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-25T12:43): Deep-dived bash:other (148 calls, 69% of waste). Sub-classified: CMD_NOT_FOUND=56% (npx/bun/sqlite3), FILE_NOT_FOUND=26%, CD_BAD_PATH=19%. **ROOT CAUSE FOUND**: QA SOUL.md instructs `npx tsc`/`npx vitest` but npx isn't in PATH — causes ~70/148 waste calls alone (47%). Sent P0 fix to tech-lead: replace with `./node_modules/.bin/tsc`/`./node_modules/.bin/vitest`. Also sent P1 patch to improve classifyFailure() with 3 new sub-categories. Findings at `workspace/finding-qa-npx-not-available-0325-1243.md` and `workspace/finding-bash-other-subclassify-0325-1240.md`.

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-03-25T07:27
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-03-25T07:27): Full smoke baseline on binary 37b8fbb. 11/13 pass (85%) — same as previous baseline (335546d). Zero regressions. 2 red: behavior-escalation-stubborn (0/4, needs escalation skill), conflicting-evidence (0/4, correct diagnosis but wrong fix). 1 yellow: optimize-deploy-config (67%, flaky). Batch: 1774422494_11c91301. Results in may.db + gym-trend-tracker.md updated.
  **NOTE**: New binary f4b83c6 built (2026-03-25T16:04) — includes DOMAIN.md restore, verification gym scenarios, 30 test fixes, all bbbe4fe features. Gym baseline needed after process restart activates it.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-24T16:03
  Latest (2026-03-24T16:03): Cycle 14. 23 code improvements (+5), 17 skills deployed (+6), 38 SKILL.md files, 7 guards (804 lines). Binary rebuilt (b9ef77e) but 10 commits behind. Prompt simplification landed (SOUL.md+common-sense.md only). Top priorities: binary rebuild (again), ANTHROPIC_API_KEY, FM-2.2 structural fix, measure prompt size savings. Full review at `workspace/improvement-proposals-review-0324.md`.

---

## Bi-Weekly
- [x] **Heartbeat graduation review** — Last done: 2026-03-17
  Latest (2026-03-17): Graduated error-log-scanner.ts to cron.json. 2 orphaned handlers remain. Full log at `workspace/graduation-log.md`.
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
