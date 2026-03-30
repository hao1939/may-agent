# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-30T17:40
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-30T17:40): 15 sessions in 2h since 15:40. **NEW BINARY 80b52a9** deployed at ~17:09 (7 commits since 84e05c6: call/fork/message agent design, chat-mode tracking, SSH fix, test repairs, vitest .state exclusion). Process uptime 32min. Amy-kimi 14ops (good). Tech-lead 1op (acceptable). May 1op timeout + 1op done. Coach 12ops interrupted. Evaluator 20ops (skipped). Bob/QA/Optimizer running. 24h: 192s, 2766 ops (14.4 avg), 26 errors. **Quality**: 76.6% good, 90.1% good+acc (24h). Quality held steady from 16:10 window. System healthy.
  Latest (2026-03-30T16:10): 16 sessions in 2h. Zero errors. Tech-lead productive (46ops, good). Quality: raw 72% good+acc (14 tech-lead crash evals in window), adjusted 98% good+acc. System very healthy.
  Latest (2026-03-30T14:10): 43 sessions. TECH-LEAD JSONSCHEMA BUG FIXED. Quality: 92% good+acc. Tech-lead productive after 26h outage.
  _Older entries pruned 2026-03-30T17:40. Key events: quality drop to 69% (Mar 30 06:10, coach sprint burst), recovered to 93% by 07:10. Tech-lead jsonSchema 26h outage fixed at 13:59._

- [x] **Cost outlier scan** — Last done: 2026-03-30T17:40
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-30T17:40): 15 sessions in 2h. Max: amy-kimi 14ops (good), coach 12ops (interrupted), evaluator 20ops (skipped). All normal. 24h: 192s, 2766 ops (14.4 avg). Zero cost outliers. System running lean.
  Latest (2026-03-30T16:10): 16 sessions. Max: tech-lead 46ops (justified test fixes, good eval). Zero cost outliers.
  Latest (2026-03-30T14:10): 43 sessions. May 164ops INTERRUPTED (justified — fixed tech-lead outage). Zero normal-operation outliers.
  _Older entries pruned 2026-03-30T17:40. Historical peaks: May 164ops (justified infra fix), Coach 52ops heartbeat (good eval). No persistent cost issues._

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-30T17:40
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-30T17:40): 15 sessions in 2h. QA 0ops (running, JS). May 1op timeout + 1op done (JS). Evaluator 20ops (skipped). Amy-kimi 14ops (genuine LLM). Tech-lead 1op (genuine LLM). Coach 12ops interrupted (genuine LLM). Bob/Optimizer running. No new LLM-to-JS candidates.
  Latest (2026-03-30T16:10): 16 sessions. QA 2ops (JS). May 1+1ops (JS). Evaluator 0ops (JS). All high-op sessions genuine LLM. No new candidates.
  _Older entries pruned 2026-03-30T17:40. All scans consistently show no new LLM-to-JS candidates — QA/May/Evaluator already JS-optimized._

- [x] **Handler health check** — Last done: 2026-03-30T17:40
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-30T17:40): 22 handlers (unchanged). **NEW BINARY 80b52a9** (PID 7) running since 17:09 (32min uptime). 7 commits: call/fork/message agent design, chat-mode tracking, SSH fix, test repairs, vitest .state exclusion. May 1op timeout (17:19) — transient, not handler issue. Coach 12ops interrupted (request aborted) — transient. Tool quality baseline at 17:07 — waste **4.34%** (170/3921, **REGRESSION** from 0.90%). Cause: tech-lead bash:empty-args=23, bash:other=54 (coach+tech-lead), agents:schema-violation=5 (tech-lead). Tech-lead waste is new issue since becoming active again post-jsonSchema fix. System running on latest binary.
  Latest (2026-03-30T16:10): 22 handlers. Process 84e05c6 running since 10:49 (5.3h). Zero errors. Waste 0.90% (all-time low).
  Latest (2026-03-30T14:10): 22 handlers. TECH-LEAD JSONSCHEMA BUG FIXED at ~13:59. Waste 0.9% (all-time low).
  _Older entries pruned 2026-03-30T17:40. Key events: tool-quality handler fixed Mar 29 (first fire on f83555f). maxTurns bug Mar 27. 22 handlers consistently present._

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

- [x] **Tool quality review** — Last done: 2026-03-30T17:40
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-30T17:40): Waste rate **4.34%** (170/3921) — **REGRESSION** from 0.90% (4.8x increase). Baseline at 17:07. Breakdown: bash:other=54 (coach+tech-lead), bash:empty-args=23 (tech-lead), agents:schema-violation=5 (tech-lead), read:nonexistent-path=2 (coach), read:empty-args=1 (coach), bash:timeout-killed=1 (coach). **ROOT CAUSE**: Tech-lead became active after 26h jsonSchema outage fix — now generating waste (bash:empty-args=23, agents:schema-violation=5, bash:other contributing). bash:other is 32% of waste (>30% threshold). Trend: 2.67%→2.65%→2.80%→2.36%→0.90%→**4.34%**.
  Latest (2026-03-30T16:10): Waste 0.90% (27/3001) — ALL-TIME LOW. Coach sole remaining source.
  Latest (2026-03-30T14:10): Waste 0.90% (27/3001) — ALL-TIME LOW. Down from 2.36%.
  _Older entries pruned 2026-03-30T17:40. History: 4.7%→4.1%→2.8%→2.65%→2.36%→0.90%→4.34%. Tech-lead and coach primary waste sources. Coder no longer active. Key past interventions: QA npx fix, isToolError false-positive fix, bash:other sub-classifier. See finding files._

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-03-30T17:40
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-03-30T17:40): **NEW BINARY 80b52a9** deployed at ~17:09 (7 commits since 84e05c6). GYM BASELINE NEEDED. No gym run on 80b52a9 yet. Previous: 84e05c6 had no completed gym run either. Last successful baseline: 11/13 pass (85%) on 37b8fbb. Prioritizing waste regression investigation over gym run this heartbeat.
  Latest (2026-03-30T16:10): Binary 84e05c6 (5.3h). No gym runs on it. Gym baseline still needed.
  Latest (2026-03-29T18:10): Gym started on f83555f (batch 1774807991_bca04137). Results never collected.
  _Older entries pruned 2026-03-30T17:40. Last successful: 11/13 pass (85%) on 37b8fbb. Binary f10cfde (Mar 25) never baselined._

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-30T09:10
  Latest (2026-03-30T09:10): Cycle 19. 3 commits since Cycle 18. Tool waste all-time low 2.36%. Quality 97.4%. Process restart wall CLEARED. No new interventions needed. Full review at `workspace/improvement-proposals-review-0330.md`.
  Latest (2026-03-28T09:06): Cycle 17. 26 new commits. Context learning pipeline (8 commits). Guards reverted per Hao. maxTurns enforcement. Full review at `workspace/improvement-proposals-review-0328.md`.
  _Older cycles (14-16) pruned 2026-03-30T17:40. See workspace/improvement-proposals-review-*.md for full history._

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
