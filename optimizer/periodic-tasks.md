# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-26T23:33
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-26T23:33): **CRITICAL: Bob completely down for ~4h.** Model `gemini-3-pro-preview` no longer supported (Github Copilot backend). 4 consecutive sessions failed (s_498/501/510/514). Sent P0 bug to May (req:26b8505b). Bob's last work: strategy-workflows-pivot.md — Hao directed STOP on guards, pivot to workflows+scenarios. All guard work CANCELLED. Finding at `workspace/finding-analysis-review-0326-2333.md`.
  Latest (2026-03-26T20:33): analysis.md unchanged since 09:13 (timestamp 1774516411). Bob active on strategy docs but no new analysis output. No optimization action needed.
  Latest (2026-03-26T06:33): Bob published `synthesis/strategy-hard-constraints.md` — articulates Auto-Evolve failure (0/5) and pivot to runtime guards. Confirms optimizer's direction: tool guards > prompt engineering. Coach ran growth-cycle (session 369, 13 ops) for verify-before-finish scenario. System stable. Previous optimizer heartbeat (session 371) used 46 ops, but that was before 35-op budget was added. No new optimization action needed.
  Latest (2026-03-26T03:12): Bob session 351 initialized Scout archetype files and delegated migration to tech-lead (req:30f9ea94). Coach session 347/348 diagnosed coder materialization failure (6/9 baseline) and created workflow-enforcement fork (coder-materialize-workflow in .lab/). Evaluator session 350 scored coach good (0.72 eff / 0.74 qual) with issues: premature finish() and evidence gap. System running 4 active agent requests (coach heartbeat, bob→coach verify, bob→tech-lead migrate, optimizer heartbeat). Process still on stale binary b9ef77e.

- [x] **Cost outlier scan** — Last done: 2026-03-26T22:33
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-26T22:33): 200 sessions/24h, 2,141 ops. Optimizer 35% (742 ops, 33s). Coach 29% (626 ops). Tech-lead 13% (279 ops). Evening lull: 32 sessions/6h, 229 ops (7.2 ops/session). No sessions >35 ops in 6h. Top wasters in 6h: optimizer 6/10 (s_502), optimizer 5/20 (s_493). Trend: total ops slightly down vs last scan (2,283→2,141). No new cost outliers.
  Latest (2026-03-26T14:03): 32 sessions in ~4h (8/hr, healthy). Distribution: may(5), bob(5), tech-lead(4), qa(4), optimizer(4), coach(3), coder(3), scout(2), evaluator(2). Outlier: tech-lead 46 ops (s_464) — 24% wasted on git-add-agents loop (11 ops trying to git add gitignored files). Finding + patch sent to May (req:09133b31). Finding at `workspace/finding-git-add-agents-waste-0326-1403.md`.
  Latest (2026-03-26T05:03): 60 sessions in 5h (12/hr), 768 ops total (153 ops/hr). Optimizer is #1 cost consumer (369 ops, 48%) — heartbeats avg 38.6 ops, no turn budget existed. Coach #2 (227 ops, 30%). Combined = 78%. **ACTIONS TAKEN**: (1) Added 35-op turn budget to optimizer heartbeat.md, (2) Increased skill lifecycle cooldown from 6h to 12h. Expected savings: ~25% reduction in optimizer heartbeat ops + ~160 ops/day from fewer lifecycle runs. Finding at `workspace/finding-cost-scan-0326-0503.md`.
  Latest (2026-03-25T20:40): 52 sessions in 4h (13/hr). Top ops: optimizer 57ops (common-sense experiment, expected), coach 26ops/2825s (interrupted). Coach+optimizer each 10 sessions, ~150 ops. No new waste patterns. System stable.
  Latest (2026-03-25T16:35): 61 sessions in 6.5h (9.4/hr). Two outliers: tech-lead gym test (528KB, 3x 100KB bash outputs — expected), Bob agents(filter:all) (404KB, 324KB response — one-off). No new systematic waste. Scout loop fix confirmed (2 sessions vs 32/day before). 30+ Bob zombies blocked on restart (req:31d94ce6). Finding at `workspace/finding-cost-scan-0325-1635.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-26T20:33
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-26T20:33): Activity lull — only 9 sessions in 6h (optimizer 4, bob 4, scout 1). All doing genuine LLM work (strategy docs, research CRs, optimization). No new JS handler candidates. Previous candidates (periodic-task-router, tool-quality-trend) still blocked on restart. System in low-traffic evening mode.
  Latest (2026-03-26T14:03): Scanned 30 recent sessions for LLM-doing-deterministic-work patterns. Main finding: git-add-agents debugging loop (tech-lead, 11+ ops) — not LLM-to-JS candidate but common-sense fix (sent to May). No new JS handler candidates this scan. Previous candidates (trend-history, cost-scan-extension) still blocked on restart.
  Latest (2026-03-26T09:06): **IMPLEMENTED**: Extended tool-quality-scan.ts with rolling trend history. Changes: (1) New `TrendEntry` type + `tool-quality-history.json` stores last 5 baselines before overwrite, (2) Report now includes waste rate trend line with ↑↓→ arrows, (3) New `tool-quality-trend.md` auto-generated summary for LLM consumption — includes snapshot, trend history, top 3 issues, regressions, and action recommendation. Expected savings: 3-5 ops per tool quality review (from 5-10 to 1-2 ops). File: agents/may/handlers/tool-quality-scan.ts. Blocked on process restart to activate.
  Latest (2026-03-26T07:33): Found tool-quality-review de-duplication opportunity. Optimizer spends 5-10 ops/scan re-analyzing what `tool-quality-scan.ts` already does. Proposal: extend handler with rolling trend history + pre-analyzed trend summary → reduce LLM scan from 5-10 ops to 1-2 ops. Saves 9-20 ops/day. Finding at `workspace/finding-llm-to-js-scan-0326-0733.md`. Other candidates (coach growth-cycle, bob briefs, scout papers) all require genuine LLM judgment.
  Latest (2026-03-26T03:11): No new LLM-to-JS candidates. Short sessions already use JS heuristics (evaluator 0-op, QA early exit). NEW FINDING: 50+ stale test requests (echo hello/testing) clogging requests.db — not LLM waste but DB scan waste. Wrote finding at `workspace/finding-stale-requests-0326-0311.md`. Proposed: request-cleanup JS handler to auto-cancel stale CREATED test requests >24h old.
  Latest (2026-03-25T22:07): Scanned 49 sessions in 4h (12.25/hr). 15 low-op sessions (0-2 ops): evaluator 0-ops (JS heuristic ✅), May 1-op idle checks, QA 1-2 op early exits, Scout 1-2 ops idle. All low-op sessions already optimized or require LLM judgment. No new LLM-to-JS candidate.

- [x] **Handler health check** — Last done: 2026-03-26T20:33
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-26T20:33): 22 handlers (unchanged). Error log empty (no recent entries). Tool quality report last at 17:07. All handlers stable. Improvements blocked on process restart.
  Latest (2026-03-26T07:33): 22 handlers present (unchanged). No errors in .state/logs/. Job history stale (last entry Mar 20 — PID 52 still running). Tool quality report (05:07 UTC): waste rate 4.7%, bash:other=158, bash:empty-args=14 (+75%), read:empty-args=7 (+600%). Optimizer is #1 offender for empty-args (12/21). All fixes blocked on process restart. No new handler issues — the handlers themselves are functioning correctly; the waste comes from LLM agents.
  Latest (2026-03-26T03:20): 22 handlers present. Tool quality report (01:07 UTC): waste rate 4.1% (173/4193), bash:other=152 (88% of waste, optimizer=72, qa=48, coach=28). read:nonexistent-path=8 (skill-discovery.md pattern — optimizer looking for workspace-relative path). bash:empty-args=8. coach:finish-empty-args=2 (new). All known patterns — QA npx fix and sub-classifier blocked on process restart. No new handler issues.
  Latest (2026-03-25T22:08): Only 3 sessions with tool errors in last 4h (1 error each: optimizer, coach, may). Down from 21 errors in 15 sessions at last check. Tool error rate very low. No handler issues detected.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-26T15:34
  This is your MOST IMPORTANT periodic task — focus area #1.
  **⛔ COOLDOWN: 12h minimum between runs.** With 54 skills and confirmed saturation, discovery phases
  almost always find "no new skill needed." Each lifecycle costs ~160 ops (4 phases). Running at 6h
  burned ~320 ops/day for zero new skills. Cap to 1 run per 12h. If last run was <12h ago, skip to cost-efficiency work.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
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

- [x] **Tool quality review** — Last done: 2026-03-26T22:33
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-26T22:33): Report from 21:07. Waste rate 4.1% (115/2823) — down from 4.7% earlier today. Top: bash:other=71 (optimizer 33, qa 16, coder 13), bash:nonexistent-path=17 (coder 16 — all `/home/user`), empty-args=15 (read:9 + bash:6). **ACTION**: Sent patch to May (req:e228ee50) to add `/app` working directory lesson to coder LESSONS.md — should eliminate 16 wasted calls/day. Trend: improving (4.7%→4.1%).
  Latest (2026-03-26T06:33): Waste rate 4.7% (trending up: 4.1→4.4→4.7). Regressions: bash:empty-args +75% (14, was 8), read:empty-args +600% (7, was 1). Optimizer worst offender (12/21 empty-args). Coach developing new failure modes: finish:empty-args(2), finish:schema-violation(2), bash:convention-block(2). All fixes blocked on process restart. No new interventions possible. Finding at `workspace/finding-tool-quality-0326-0633.md`.
  Latest (2026-03-26T02:40): **BUG FIX**: Found and fixed false positive in `isToolError()` (manager-utils.ts). Old regex `/exit\s*(code\s*)?\d*[1-9]\d*/i` matched "exit code 1" anywhere in output — false-triggers when grep/read output contains exit code mentions in content (e.g., grepping error logs). Fixed to anchor to bash.ts format: `/Command exited with code \d*[1-9]\d*/`. Coder ERROR_LOG showed FM-1.2 PIVOT_SIGNAL_IGNORED caused by this. Updated test/tool-pivot.test.ts with false-positive test cases. All 87 related tests pass.
  Latest (2026-03-25T22:34): Report from 21:07 UTC. Waste rate 4.4% (slightly up from 3.8%). bash:other=162 (85.7% of waste), optimizer=78 wasted calls (worst offender, 49% of all waste). bash:empty-args=11 (optimizer=7, coach=4). read:nonexistent-path=8 (skill-discovery.md pattern). bash:nonexistent-path=3 (all /home/user errors). All interventions already in binary f10cfde — blocked on restart. No new interventions needed.
  Latest (2026-03-25T18:33): Report from 17:07 UTC. Waste rate 3.8% (stable). bash:other=136 (83% of waste), optimizer=60 wasted calls (worst offender). bash:empty-args regressed: 12 (was 8, +50%). QA npx fix deployed but blocked on restart. Sub-classifier deployed but blocked on restart. All improvements blocked on PID restart (req:e535d4d8). No new interventions needed — existing fixes just need activation.
  Latest (2026-03-25T12:43): Deep-dived bash:other (148 calls, 69% of waste). Sub-classified: CMD_NOT_FOUND=56% (npx/bun/sqlite3), FILE_NOT_FOUND=26%, CD_BAD_PATH=19%. **ROOT CAUSE FOUND**: QA SOUL.md instructs `npx tsc`/`npx vitest` but npx isn't in PATH — causes ~70/148 waste calls alone (47%). Sent P0 fix to tech-lead: replace with `./node_modules/.bin/tsc`/`./node_modules/.bin/vitest`. Also sent P1 patch to improve classifyFailure() with 3 new sub-categories. Findings at `workspace/finding-qa-npx-not-available-0325-1243.md` and `workspace/finding-bash-other-subclassify-0325-1240.md`.

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-03-25T07:27
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-03-25T07:27): Full smoke baseline on binary 37b8fbb. 11/13 pass (85%) — same as previous baseline (335546d). Zero regressions. 2 red: behavior-escalation-stubborn (0/4, needs escalation skill), conflicting-evidence (0/4, correct diagnosis but wrong fix). 1 yellow: optimize-deploy-config (67%, flaky). Batch: 1774422494_11c91301. Results in may.db + gym-trend-tracker.md updated.
  **NOTE**: New binary f10cfde built (2026-03-25T22:10) — includes LESSONS.md loading restore, agent archetype inheritance, DOMAIN.md restore, verification gym scenarios, 30 test fixes, all bbbe4fe features. Gym baseline needed after process restart activates it.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-26T04:38
  Latest (2026-03-26T04:38): Cycle 15. 8 guards (991 lines, only 4 active in running binary). 40 SKILL.md files (+2), 18 deployed (+1). 22 handlers. PID 52 now 32 commits behind HEAD (was 10 at Cycle 14). 12 improvements blocked on restart (LESSONS.md/DOMAIN.md restore, 4 guards, isToolError fix, archetype inheritance, zombie cleanup, request limits, web UI, gym DB). 22 real test failures. Guards > Skills > Prompts hierarchy confirmed by auto-evolve results. Skill lifecycle cooldown recommended increase to 12h. Process restart is CRITICAL. Full review at `workspace/improvement-proposals-review-0326.md`.
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
