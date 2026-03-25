# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-25T12:03
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-25T12:03): Bob analysis.md updated 2026-03-25 — now focuses on FM-3.3 Verification Gap and FM-1.1 Goal Drift. Bob sent req to tech-lead for "Verify Before Finish" gym scenario. Bob's 3 recommendations: (1) finish() require verification_evidence field, (2) env hardening in common-sense.md, (3) gym scenario for verification integrity. Rec #1 already partially addressed by finish-guard.ts. Rec #2 already has path-assumption-guard in binary 786c884. Rec #3 is new and valuable. No new optimizer action needed — Bob already sent the req.

- [x] **Cost outlier scan** — Last done: 2026-03-25T10:33
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-25T10:33): 48 stale requests (mostly bob echo-hello). Binary gap: PID 52 running b9ef77e, 15 commits behind (now 786c884). Rebuilt binary may-agent-786c884 with path-assumption-guard + all pending fixes. Top cost sessions: coach sprint planning (675KB/56ops), optimizer heartbeats (150-180KB). bash:other = 148 wasted calls (69% of waste), qa=70 worst offender. Finding at `workspace/finding-cost-scan-0325-1033.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-25T12:03
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-25T12:03): Scanned last 6h sessions. 57 sessions total. Bob: 49 echo sessions (34 "echo hello" + 15 testing variants) — already handler-intercepted at 0-1 ops. Evaluator: 5 sessions, 4 at 0 ops (JS heuristic). May: 6 sessions, 1-5 ops. All heartbeats are judgment work. No new LLM-to-JS opportunity found. System well-optimized. Main waste: 67 stale CREATED requests (60 bob echo) — known issue, needs request TTL feature (already proposed in finding-cost-scan-0325-1033.md).

- [x] **Handler health check** — Last done: 2026-03-25T12:03
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-25T12:03): 21 handlers (up from 20). Last 4h: 57 sessions, 4 errors (all "Request was aborted" — timeout interruptions, not handler bugs). Zombie count: bob=33 (up from 26), optimizer=4, tech-lead=1. Binary b9ef77e still running (PID 7+52), zombie cleanup in 786c884 not active. 4 interrupted sessions (optimizer phase3 timeout, bob heartbeat, coach cron, optimizer cron). All handlers functional, no persistent errors. Cron jobs executing normally.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-25T10:03
  This is your MOST IMPORTANT periodic task — focus area #1.
  **⛔ COOLDOWN: 6h minimum between runs.** With 14 skills deployed, discovery phases increasingly
  find "no new skill needed." Each lifecycle costs ~90 ops (4 phases). Running 3x/6h = 270 ops =
  33% of total system cost. Cap to 1 run per 6h. If last run was <6h ago, skip to cost-efficiency work.
  **Run it via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  The workflow mechanically enforces all 4 phases (discover → draft → test → deploy) in separate
  sessions, preventing you from skipping testing or doing meta-work instead.
  If you have a specific pattern in mind, pass it: `workflow.run("skill-lifecycle", "Pattern: agents read file → check convention → edit → verify")`
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-25T10:03): build-activation-verification (18th skill) drafted, tested (2/3 gym pass, core assertions 3/3), deployed to optimizer + tech-lead SOUL.md. Pattern: agents build binaries and claim "deployed" but don't verify the running process switched. 206 lines.
  Latest (2026-03-25T03:03): prerequisite-gap-protocol drafted and tested — 0/3 gym pass (agents claim success even with missing prerequisites). NOT deployed. Skill identifies real pattern but needs prompt injection to change behavior.
  Latest (2026-03-24T21:03): No new skill needed — discovery found deliverable-integrity pattern already deployed. 17 skills achieving good coverage.
  Latest (2026-03-24T14:03): deliverable-integrity (17th skill) deployed to agents. Full lifecycle. 3/3 gym pass.
  Latest (2026-03-24T06:06): progressive-work-persistence (16th skill) deployed to 6 agents. Full lifecycle.
  Latest (2026-03-23T21:36): verification-consistency (15th skill) deployed to 6 agents. Full lifecycle.
  _13 earlier skill deployments documented in finding files. See `workspace/finding-pattern-scan-*.md`._

- [x] **Tool quality review** — Last done: 2026-03-25T10:33
  Read the tool-quality-report.md (generated by tool-quality-scan handler every 4h).
  Look for regression trends, persistent failure patterns, and agent-specific issues.
  If a specific failure category accounts for >30% of waste, create a targeted intervention:
  - For wrong-tool: add/improve tool descriptions or add a gym scenario
  - For empty-args: check if schema validation is catching it early enough
  - For edit-match-fail: check if agents are reading files before editing
  If tool-quality-report.md doesn't exist yet, skip — handler hasn't fired.
  Latest (2026-03-25T10:33): Report from 09:07 UTC. 4500 calls, 216 wasted (4.8% — down from 5.4%). bash:other=148 (69% of waste, qa=70 leading). bash:nonexistent-path=28 (coder=16, optimizer=12 — path-assumption-guard now in binary 786c884 but not active). empty-args=28 stable. read:nonexistent-path grew 8→10 (coach=6). All guards need process restart to activate.

- [x] **Gym shadow baseline & trend tracking** — Last done: 2026-03-25T07:27
  ⚠️ COOLDOWN: After each binary rebuild only. No point re-running on same binary.
  Run `scripts/gym-baseline.sh --tier smoke --agent coder --tag "<descriptive-tag>"` (takes ~10 min).
  Then update `workspace/gym-trend-tracker.md` with new batch results.
  Compare with previous batches via `bun scripts/gym-stats.ts --batches`.
  Flag regressions via `bun scripts/gym-stats.ts --regressions`.
  NOTE: Runs take ~600s for 13 smoke scenarios. Consider running in background or splitting.
  Latest (2026-03-25T07:27): Full smoke baseline on binary 37b8fbb. 11/13 pass (85%) — same as previous baseline (335546d). Zero regressions. 2 red: behavior-escalation-stubborn (0/4, needs escalation skill), conflicting-evidence (0/4, correct diagnosis but wrong fix). 1 yellow: optimize-deploy-config (67%, flaky). Batch: 1774422494_11c91301. Results in may.db + gym-trend-tracker.md updated.
  **NOTE**: New binary 1d58bd5 built (2026-03-25T08:36) — includes zombie session cleanup fix. Gym baseline needed after process restart activates it.

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
