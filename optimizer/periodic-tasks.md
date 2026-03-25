# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-25T05:33
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-25T05:33): Bob analysis.md still 09:07 UTC (20h old). Reviewed 6 fresh evaluations + convention-check summary.json (05:33 UTC). Key findings: (1) 2 optimizer evals — 1 acceptable, 1 needs_improvement; recurring PATH_ASSUMPTION (workspace/ vs agents/optimizer/workspace/) and GHOST_DELIVERABLE. (2) Coach evals — 1 good, 1 acceptable; finish-guard correctly blocking ghost deliverables. (3) Convention check C12.1 near-zero system-wide — benign (tests first-tool-call=heartbeat, fails for all sub-agent sessions). (4) Bob 2 new briefs: gym-recorder bridge + fix-gym-and-oneshot — both for tech-lead, no optimizer action. (5) Bob error rate still ~40% (4/10), API infrastructure. (6) Cron errors RESOLVED. No new optimization tasks from this review.

- [x] **Cost outlier scan** — Last done: 2026-03-25T04:33
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-25T04:33): 6h window (22:36-04:33 UTC): 54 sessions, 788 ops. optimizer=285 ops (36%, 9 sessions, 31.7 avg), tech-lead=176 (6 sessions), coach=149 (7 sessions, 21.3 avg), bob=73 (7 sessions, 3 errors). Evaluator recovered with 7 sessions (5 ops — mostly handler-driven). Bob still has ~43% error rate (3/7). All patterns known — optimizer self-cost escalated (req:93d7d0ea), binary rebuild blocks remaining fixes. No new cost intervention needed.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-25T02:03
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-25T02:03): 17 JS handlers + 14 LLM cron jobs. All high-frequency deterministic work already handler-driven. common-sense-verify (4h, ~27 ops/run) requires behavioral judgment — not automatable. consolidate-memory (weekly, ~76 ops total) requires summarization — not automatable. Evaluator JSON retry spawns 16 retry sessions/week (15% rate) via manager.run() in evaluator.ts:446 — modest cost (0-1 ops each), already capped at 1 retry. Bob has 33 error sessions/week (26 ServiceUnavailable + 6 empty response) — API infrastructure issue, not code. No new proposal needed.

- [x] **Handler health check** — Last done: 2026-03-25T04:33
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-25T05:38): **BINARY REBUILT!** Found bun at `/home/hao/.npm/_npx/.../bun` (v1.3.11). Built `may-agent-37b8fbb` from HEAD (22 commits ahead of old b9ef77e). Updated symlink. New binary includes: empty-args guard, FM-3.3 verification guard, finish-guard (ghost deliverable), session-read-guard (bash-grep), request limit fix, skill-lifecycle early-exit. Running process still uses old binary (PID 52) — new sessions will use new binary once process restarts. Handlers all functional.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-25T03:03
  This is your MOST IMPORTANT periodic task — focus area #1.
  **⛔ COOLDOWN: 6h minimum between runs.** With 14 skills deployed, discovery phases increasingly
  find "no new skill needed." Each lifecycle costs ~90 ops (4 phases). Running 3x/6h = 270 ops =
  33% of total system cost. Cap to 1 run per 6h. If last run was <6h ago, skip to cost-efficiency work.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-25T03:03): prerequisite-gap-protocol drafted and tested — 0/3 gym pass (agents claim success even with missing prerequisites). NOT deployed. Skill identifies real pattern but needs prompt injection to change behavior.
  Latest (2026-03-24T21:03): No new skill needed — discovery found deliverable-integrity pattern already deployed. 17 skills achieving good coverage.
  Latest (2026-03-24T14:03): deliverable-integrity (17th skill) deployed to agents. Full lifecycle. 3/3 gym pass.
  Latest (2026-03-24T06:06): progressive-work-persistence (16th skill) deployed to 6 agents. Full lifecycle.
  Latest (2026-03-23T21:36): verification-consistency (15th skill) deployed to 6 agents. Full lifecycle.
  _13 earlier skill deployments documented in finding files. See `workspace/finding-pattern-scan-*.md`._

- [x] **Tool quality review** — Last done: 2026-03-25T04:33
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-25T04:33): Report from 01:07 UTC. Waste rate 5.4% (194/3606). bash:other=126 (65% of waste, unchanged). bash:empty-args=16 (+33% regression, guard deployed but binary behind). coder still doing `cd /home/coder` (16 bash:nonexistent-path). coach=10 read:empty-args. All top issues covered by existing guards/skills — all blocked on binary rebuild to activate. No new intervention needed.

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-03-24T18:15
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-03-24T18:15): First shadow baseline (partial, 5/13 due to timeout). Full batch from 16:33 shows 85% (11/13). Two red scenarios: behavior-escalation-stubborn (escalation judgment), conflicting-evidence (correct diagnosis, wrong fix). Trend tracker created at `workspace/gym-trend-tracker.md`.
  **⚠️ NEW BINARY AVAILABLE (37b8fbb, built 2026-03-25T05:38)** — cooldown lifted, run new baseline after process restart.

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
