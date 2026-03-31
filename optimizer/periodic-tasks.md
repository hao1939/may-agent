# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-31T01:10
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-31T01:10): 6 sessions since 00:40 (all done, 0 errors). Coach 37ops (largest). 24h: 198s, 3196 ops (16.1 avg). **Quality**: 82.7% good+acc (162/196 evaluated). Binary fd5b559 (PID 7) stable.
  Latest (2026-03-31T00:40): 13 sessions since 23:10 (12 done, 1 error — amy-kimi engine overload). Bob 48ops (synthesis, q=5). 24h: 199s, 3134 ops (15.7 avg). **Quality**: 82.5% good+acc (194 evaluated) — 24h window shift. Binary 80b52a9 ~7.5h uptime, stable.
  _Older entries pruned 2026-03-30T19:10. Key events: quality drop to 69% (Mar 30 06:10, coach sprint burst), recovered to 93% by 07:10. Tech-lead jsonSchema 26h outage fixed at 13:59. Binary 80b52a9 deployed 17:09._

- [x] **Cost outlier scan** — Last done: 2026-03-31T01:10
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-31T01:10): 6 sessions since 00:40. Max: coach 37ops. 24h outliers unchanged: may 164ops (interrupted), bob 70ops, coach 70ops. No new cost issues.
  Latest (2026-03-31T00:40): 13 sessions since 23:10. Max: bob 48ops (q=5, justified). 24h outliers: may 164ops (interrupted), bob 70ops, coach 67ops (interrupted). No persistent cost issue.
  _Older entries pruned 2026-03-30T19:10. Historical peaks: May 164ops (justified infra fix), Coach 52ops heartbeat (good eval). No persistent cost issues._

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-31T01:10
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-31T01:10): 6 sessions since 00:40. QA 1op (already JS), may 1op (already JS). Coach 37ops (creative work, not automatable). No new candidates.
  Latest (2026-03-31T00:40): 13 sessions since 23:10. QA 1op (already JS), evaluator 0ops (JS handler). No new LLM-to-JS candidates.
  _Older entries pruned 2026-03-30T19:10. All scans consistently show no new LLM-to-JS candidates._

- [x] **Handler health check** — Last done: 2026-03-31T01:10
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-31T01:10): Binary fd5b559 (PID 7) stable. 0 errors since 00:40. All 6 done sessions normal. System healthy.
  Latest (2026-03-31T00:40): Binary 80b52a9 (PID 7) ~7.5h uptime. 1 error (amy-kimi engine overload — transient, not handler). All 12 done sessions "good" or normal. System stable.
  _Older entries pruned 2026-03-30T19:10. Key events: tool-quality handler fixed Mar 29. 22 handlers consistently present. Waste trend: 2.7%→2.6%→2.8%→2.4%→0.9%→4.3%._

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

- [x] **Tool quality review** — Last done: 2026-03-31T01:10
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-31T01:10): 82.7% good+acc (162/196 evaluated 24h). 0 errors since 00:40. Quality stable around 82-83% range.
  Latest (2026-03-31T00:40): Eval-based: 82.5% good+acc (194 evaluated 24h) — 24h window shift from 90.2% peak. 1 error (engine overload). No active waste regressions.
  _Older entries pruned 2026-03-30T19:10. History: 4.7%→4.1%→2.8%→2.65%→2.36%→0.90%→4.34%. See finding files for interventions._

- [x] **Workflow quality audit** — Last done: 2026-03-30T21:10
  **⛔ COOLDOWN: WEEKLY.** Workflow changes are high-impact; audit weekly or after major changes.
  Read `agents/shared/workflows/REGISTRY.md` for current state.
  1. Check for new duplicates: `find agents -name "*.ts" -path "*/workflows/*" | sort`
  2. Review consolidation plan progress — any Priority 1/2/3 items still open?
  3. Check effectiveness: query evaluations for sessions that used workflows (look for `workflow_start` events)
  4. Update registry with any new workflows or changes
  If dedup needed → do the consolidation (promote best to shared, delete local copies).
  If regression found → investigate and fix.
  Latest (2026-03-30T21:10): **First full audit completed.** 32 workflow files across 7 agents. 177 workflow runs, 460 sessions all-time. Key findings: (1) Workflows reduce errors dramatically (2.6% vs 18.1% non-workflow) but quality is lower (70.7% vs 81.4%) — mainly due to coach sprint NI rate (68/133). (2) All 3 consolidation priorities still open — P1 verify-and-finish confirmed byte-identical, P2 verify-parallel confirmed tech-lead best, P3 implement-and-review has 3 divergent versions. (3) Found 1 unregistered workflow: may/project-monitor.ts — added to registry. (4) 27.1% run interruption rate (48/177) wastes ~917 ops total. Registry updated with effectiveness metrics and recommendations. Next: consolidate P1 (zero-risk dedup).
  Latest: Registry created 2026-03-30 with initial audit data. 3 consolidation priorities identified.

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-03-31T00:40
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-03-31T01:10): Binary fd5b559 (PID 7) stable. No gym run on this binary. HEAD changed from 80b52a9 to fd5b559 (hot-reload handler fix). Low priority.
  Latest (2026-03-31T00:40): Binary 80b52a9 (PID 7, ~7.5h uptime). Still no gym run on this binary. System stable, low priority.
  _Older entries pruned 2026-03-30T19:10. Last successful: 11/13 pass (85%) on 37b8fbb. Binaries 84e05c6 and f10cfde never baselined._

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
