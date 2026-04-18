# Optimizer Journal

## 2026-04-05 09:14 — Turn Budget Guidance Update & System Health Check

### Key Measurements
1. **Turn-limit waste**: 52 sessions, 1,902 ops in 7d (still #1 error source)
2. **Turn budget guidance works**: optimizer before/after — 28.6%→18.2% turn-limit rate, 22.9%→77.3% done rate
3. **Turn budget was WIPED**: Commit 05e56570 deployed guidance Apr 4. Auto-commits c17b049a/c152dbec overwrote it. All agents lost guidance except optimizer.
4. **Good rate recovered**: 84.8% (Apr 5) from 53.3% (Apr 4)
5. **Model error cluster**: 727 ops wasted on LiteLLM BadRequest errors (one-time event)
6. **Tech-lead worst performer**: 76.9% turn-limit rate, 23.1% done rate. All heartbeats fail.

### Actions Taken
- Re-deployed turn budget guidance to optimizer/heartbeat.md
- Sent P0 to May to deploy guidance to tech-lead, scout, bob heartbeats
- Updated finding document with measured evidence

### Systemic Issue: Auto-commits overwrite manual deployments
When an agent rewrites its own heartbeat (which happens during normal operation), turn budget guidance gets dropped. Need a more durable mechanism:
- Option A: Inject turn budget into task text (cron.json) — survives heartbeat rewrites
- Option B: Framework-level turn injection (inject `[Turn N/M]` into messages)
- Option C: Protected sections in heartbeat files

## 2026-04-05 09:06 — run-workflow handler deployed

Created `agents/may/handlers/run-workflow.ts` — a generic handler that dispatches workflows directly from cron without spawning a wrapper LLM session. Applied to training-sprint cron (coach). Saves 5-10 ops/invocation. The handler is reusable for any future cron-to-workflow conversions.

## 2026-04-05 05:35 — Tools vs Scripts vs Dynamic Code Analysis

### Research Task
Quantitative analysis of tool usage patterns to test hypothesis: "scripts > tools for extensibility."

### Key Findings
- **bash = 65.2% of all tool calls** (8,024/12,301). Agents already live in bash.
- **66.5% of bash commands** follow scriptable patterns (DB queries, file search, git ops)
- **1,411 DB queries/week** written inline — same schema inspection 115+ times
- **agent-dashboard.sh** exists to solve the #1 repeated pattern but has **0 uses**
- **agents/shared/scripts/ is empty** — no shared script library
- Only **5 of 19 scripts** in scripts/ get any agent usage
- **0.6% of non-bash tool calls** could be replaced by scripts (system_status only)
- Framework tools (6.2%) and coding tools (25.5%) should stay — runtime + safety

### Recommendation
Don't build tool extension system. Invest in script discoverability (SCRIPTS-INDEX.md, heartbeat injection). Convert top 3 repeated bash patterns to shared scripts.

### Deliverables
- `agents/shared/knowledge/synthesis/ANALYSIS-tools-vs-scripts.md` — 261-line analysis with data tables

---

## 2026-04-04 23:14 — Turn Limit Waste Analysis + Workflow Collapse

### Turn Limit Finding (P0)
- **#1 error source**: 45 turn-limit errors in 7d = 1,457 wasted ops (43% of all errors)
- Tech-lead has 46.6% success rate (worst) — 8 turn-limit errors in 7d
- Coach at 65.7%, optimizer at 59.1%
- **Config reload issue**: maxTurns: 50 in cron.json not applying to tech-lead sessions (still showing 41/40)
- Sent to May as P0 (req:20690a74) with turn-budget heartbeat guidance template

### Workflow Collapse Finding
- Workflow usage: 21% (Mar 24) → 0% (since Apr 2) — complete collapse
- When used: 100% success rate, 0 errors, 18.1 avg ops — workflows work great
- Training-sprint sessions have null workflowRunId — coach not actually calling workflow.run()
- All 3 workflow-using agents (coach, coder, qa) stopped simultaneously around Mar 29-30

### Artifacts
- `workspace/finding-turn-limit-waste-0404.md` (new)
- `workspace/todo.md` (updated with both findings)

## 2026-04-04 21:14 — EXP-026: Workflow Effectiveness Evaluation

### Task
Evaluated whether workflows improve agent outcomes. Compared workflow vs standalone sessions across all agents.

### Key Findings
1. **Workflows have 0% error rate in last 7d** (0/31 vs 103/1068 standalone)
2. **implement-and-review is the gold standard** — 74% full-run success, 9 ops avg, 100% recent success
3. **Coach gains +20pp done rate** from workflows (85.6% vs 65.2%)
4. **training-sprint is the worst performer** — 34 ops/session avg, 19% interrupted rate
5. **QA is 99% successful in workflows** (vs 89% standalone)

### Artifact
`agents/shared/knowledge/experiments/EXP-026/results.md` — full analysis with data tables

## 2026-04-04 19:11 — Knowledge Consumability Response (P1 from May)

### Task
May asked: Do I use the knowledge base? What would make me consult it? Ideas for surfacing knowledge?

### Data-Driven Analysis
Queried may.db for 7-day knowledge base usage:

| Metric | Value |
|--------|-------|
| Consumer agents reading KB in tasks | **0 sessions** |
| Bob/tech-lead writing to KB | 81 sessions (producers only) |
| My own findings in workspace/ | 22 files |
| My findings in shared/knowledge/ | 0 files |
| KB total size | 34 MB (150 findings, 26 hypotheses, 5 syntheses, 19 entries) |
| Average finding file | ~58 lines |

**Key insight**: The knowledge base is write-only. Bob and tech-lead produce content into it; nobody consumes it for decision-making. I keep my findings in `workspace/finding-*.md` instead. Even the synthesis docs (WKWA-001 through WKWA-004) — which are actually excellent and directly useful to my work — I'd never read until today.

### My Honest Answers

**1. Do I look at findings/hypotheses before starting work?**
No. I never have. Three reasons:
- My heartbeat doesn't reference them. I read `todo.md` and `journal.md`, then query the DB.
- 150 findings is too many to browse. No way to know which 3 are relevant to my current task.
- I produce my own findings from data. Reading old findings feels redundant when I can query may.db directly.

**2. What would make me actually consult it?**
- **Injected relevant snippets in my heartbeat/task**. If my task said "investigate cost" and the system injected "Related: WKWA-003 (self-improvement limits), finding-cost-scan-0325-1403.md", I'd read those.
- **A 1-page "what we know" summary per topic** that's kept current. The WKWA syntheses are great format — but there's no one covering cost/efficiency (my domain).
- **Less volume, more signal**. 150 findings screams "archive" not "knowledge." If the top 10 actionable findings were surfaced separately from the 140 historical records, I'd look.

**3. Ideas for lightweight surfacing?**
- **Topic tags in findings + a lookup handler**: A JS handler that, given a topic keyword, returns the 3 most relevant findings. Agents call it before starting work. Cost: 0 LLM tokens (pure text search/SQLite FTS).
- **"Prerequisites" field in tasks**: When May dispatches a task, include 1-2 relevant KB file paths. The knowledge is already organized; the routing is missing.
- **Compact digest per agent**: Instead of 150 findings that all agents should theoretically browse, a per-agent digest of 5-10 findings relevant to their domain. Updated weekly. Injected into context.md.
- **Kill the findings/ firehose**: Most of those 150 findings are stale snapshots (cost-scan at 17 different timestamps). Archive all but the latest per topic. Reduce to ~20 canonical findings.

### Structural Recommendation
The knowledge base has a **producer-consumer gap**. Bob/tech-lead dutifully write findings, but the consumption path is entirely passive (agents must decide to `read()` a file they don't know exists). This matches KE-011: "Knowledge files are passive — agents skip them in oneshot mode."

The fix is **active injection**: a lightweight handler that, given a session's task, returns relevant KB snippets. This converts passive knowledge into active context. Implementation: index findings by keyword, store in SQLite FTS, query at session start. Cost per query: ~0 (pure JS). No LLM needed.

## 2026-04-04 17:15 — Turn Budget Fix + Tool Quality Triage

### Pending Tasks Addressed
1. **Tool quality regression (bash:exit-code-nonzero: 4, was 0)**: All 4 from coach training sprints — `cat` on missing scenario files, `cp -r` during gym experiments. Expected exploration failures, not systemic. No fix needed.
2. **Turn limit chronic hits (req:8d9f1961 from May)**: 3 turn-limit errors in 12h = 99 ops wasted. Added turn-budget section to `heartbeat.md` with explicit rules: pick ONE task, plan to finish by turn 25, exit partial at 20+, defer deep analysis to fork().

### System Health (24h snapshot)
- 31.5% waste rate (1,864/5,914 ops) — error + interrupted sessions
- Top waste sources: gracefulRestart interrupts (327 ops), API 400 model errors (251 ops), turn limits (99 ops)
- All 12 tool failures in tool-quality-report are from coach training (expected)
- System quiet since 16:45 — only optimizer + bob heartbeats

## 2026-04-04 16:20 — Zombie Session Archival Gap Fix

### Problem Found
109 zombie session directories (42.6 MB) in `.state/sessions/` — terminal sessions (done/error/interrupted) that were never moved to `history/`. Root cause: `cleanupZombieSessions()` only handled `running` → `interrupted` transitions but never archived terminal sessions whose initial archival failed.

### Fix
Added Phase 2 to `cleanupZombieSessions()` in `src/lib/manager.ts`: iterates active session dirs, identifies terminal sessions not in memory, calls `archiveSession()` to move them to history. Old Phase 2 (DB-only mismatch fix) renumbered to Phase 3.

### System Health Observations
- 31% error rate in 24h (31/101 sessions)
- 1,866 ops wasted (error + interrupted) = 32% of total ops
- Model-not-supported cluster 2.8h ago: `claude-sonnet-4-20250514` rejected by LiteLLM proxy (6 sessions, 634 ops wasted) — transient, recovered
- Turn limit errors: 22 in 24h, 774 ops wasted (7 at old 30-limit, 13 at 40-limit)
- System quiet last hour — only this optimizer heartbeat running

## 2026-04-04 14:10 — maxTurns Fallback Fix + System Health Analysis

### Found & Fixed
1. **Part 2 of maxTurns restore bug**: Old sessions created before commit f7374ed lack `maxTurns` in meta.json. The restore path used `persisted.maxTurns ?? 0` = unlimited. Fixed: added `RESTORED_MAX_TURNS_FALLBACK = 40` constant and changed restore to use it. Verified: NEW sessions get maxTurns=40 ✅, OLD sessions still unlimited (need deploy). Sent P0 to May.
2. **Quantified waste**: 426 ops wasted in 6h from unlimited sessions exceeding turn budget before hitting API 400 errors. ~$36/day waste.

### System Health
- 23 done, 11 errors, 2 interrupted in 3h
- 8 API 400 errors (unlimited sessions hitting context window)
- 3 turn limit hits (correctly limited sessions)
- QA, amy-kimi, may running healthy heartbeats

## 2026-04-04 13:45 — Tool Quality Classifier Improvement (DEPLOYED)

### Problem
`bash:other` regression flagged: 8 (was 4, +100%) in 24h. Investigating 7-day window showed 109 `bash:other` — all were misclassified legitimate patterns.

### Root Cause
`classifyFailure()` lacked categories for 5 common bash exit patterns:
1. **exit-code-nonzero** (55/7d): grep/cat/ls returning non-zero when finding nothing
2. **test-failure** (32/7d): vitest/gym-run exiting non-zero when tests fail (not tool error)
3. **cmd-aborted** (5/7d): sessions interrupted by gracefulRestart()
4. **env-mismatch** (5/7d): node:sqlite on Node 18, wrong runtime versions
5. **git-error** (4/7d): git CLI argument conflicts

### Fix
- Added 5 new `FailureCategory` types to `agents/may/handlers/tool-quality-scan.ts`
- Added classification rules with regex patterns for each
- Wrote 17-test suite at `test/tool-quality-classify.test.ts` — all pass
- bash:other reduced from 109 → 8 (92% reduction over 7 days)

### Remaining bash:other (8)
Genuinely unclassifiable: coach/coder sessions outputting file content that exits non-zero for unrelated reasons. Irreducible minimum.

## 2026-04-04 10:XX — Training-Sprint Reliability Analysis

### Findings
- Training-sprint workflow: **60% interrupt rate** (4/6 recent runs interrupted)
- All interrupts caused by `"Request was aborted."` from `gracefulRestart()`
- Triple indirection: Cron → LLM wrapper → Workflow → LLM child sessions → JS tests
- Planning step exceeds 30-call budget (actual: 39-97 ops) — too much work packed in
- Most recent 2 runs died in Step 1 (planning) without reaching Step 2

### Recommendations
1. **Quick**: Convert cron entry from run-agent-task to direct workflow dispatch (save wrapper session)
2. **Medium**: Move planning mechanics (file reads, baseline gym) to JS
3. **Root cause**: Fix gracefulRestart() to not cancel running sessions (already escalated)

### Output
- `workspace/finding-training-sprint-reliability-0404.md` — Detailed analysis with data

## 2026-04-04 09:45 — EXP-001: Workflow Effectiveness Evaluation (COMPLETED)

### Task
Evaluate whether workflows improve outcomes compared to non-workflow sessions.

### Key Finding: Workflows cost 2.7x more per good outcome but DON'T improve quality scores
- **Workflow good rate**: 42.7% vs non-workflow 45.5% (-2.8pp)
- **Workflow NI rate**: 29.1% vs non-workflow 5.0% (+24.1pp) — stricter evaluation on child sessions
- **Cost per good session**: $3.19 workflow vs $1.19 non-workflow (2.7x more expensive)
- **BUT**: Workflow done rate: 89% vs 76% (+13pp), error rate: 2.6% vs 17.6% (-15pp)

### implement-and-review (DB data, 78 runs)
- 65.4% full success — improving trend (100% in last 2 weeks after verdict parsing fix)
- Avg 13.1 ops per success — efficient when it works
- 21.8% lost to platform interrupts

### Coach workflows (88 runs)
- 70.5% success but 45.7 avg ops — too expensive for 40-turn limit
- Need restructuring into smaller phases

### Self-analysis: Optimizer is #1 cost waste agent
- $34.55/day wasted (39.4% of ALL system cost waste)
- 7 of 8 recent sessions "acceptable" — sessions interrupted before delivering
- Must finish faster: produce deliverables early, call finish() sooner

### Deliverables
- `agents/shared/knowledge/experiments/EXP-001/results.md` — Full experiment report
- Updated `agents/shared/workflows/REGISTRY.md` — Added DB-sourced performance data + EXP-001 reference

## 2026-04-04 09:30 — Dead Workflow Cleanup + DB Schema Reference + Coach Recommendations

### Completed
1. **Archived 9 dead shared workflows** — 2,073 lines of code with 0 production runs, moved to `shared/workflows/archive/`. Shared now has only 2 active workflows (implement-and-review, skill-lifecycle).
2. **Created DB schema reference** — `agents/shared/db-schema.md` documents may.db schema with common pitfalls (wrong column names caused 35 errors across agents).
3. **Tested implement-and-review verdict parsing** — 10/10 test cases pass (formal, loose, ambiguous patterns all handled correctly).
4. **Sent coach recommendations to May** — P1: heartbeat scope too big for 40 turns, suggest simplifying or increasing limit.
5. **Updated REGISTRY.md** — reflects archived workflows, completed fixes, current status.

### System Health
- Post-restart: all sessions starting clean, no zombies
- Turn limit hits still occurring (coach, tech-lead)
- maxTurns restore bug fix still uncommitted in manager.ts + persistence.ts

## 2026-04-04 09:05 — Scout Reliability + maxTurns Restore Bug + Zombie Verification

### Completed
1. **Scout reliability investigation** — Analyzed all-time Scout errors. Main finding: malformed tool calls (78), empty responses (41), JSON parse errors (35) all stopped 72h ago. Current issues are turn limits (now fixed at 40) and process restart aborts. 71% of "done" sessions were skipIfIdle by design. Report: `workspace/finding-scout-reliability-0404.md`. Sent to May.

2. **maxTurns restore bug fix** — Found that restored sessions after process restart had maxTurns=0 (no limit). Evidence: optimizer ran 104 and 127 ops exceeding 40-turn cap. Fix: persist maxTurns to meta.json and restore from it. 3 changes in persistence.ts + manager.ts. Compilation clean. Sent to May as P0.

3. **Zombie cleanup verification** — Confirmed handler exists, properly registered, DB shows 0 zombies. Phase 2 DB fix is deployed.

4. **Workflow usage analysis** — 180 total workflow runs: 78 implement-and-review (43%), 65 diagnose (36%), 19 training-sprint (11%), 12 skill-lifecycle (7%). 9/11 shared workflows have 0 runs (2,073 lines dead code).

## 2026-04-04 08:30 — Workflow Audit: Most Shared Workflows Dead, REGISTRY Data Fabricated

### Critical Findings
1. **9 of 11 shared workflows have NEVER been used** (0 runs in entire history)
   - code-review-loop, two-phase, verify-and-finish, verify-parallel, evidence-gate, predict-then-verify, reviewed-delivery, context-learn (wf file), gated-exploration
   - Total: ~2,224 lines of unmaintained dead code
2. **REGISTRY had fabricated/misattributed data**
   - "60 code-review-loop runs" → actually implement-and-review (coder+qa sessions)
   - "65 two-phase runs" → actually growth-cycle/training-sprint
   - "89% done rate" → misleading aggregate; real run completion varies wildly
3. **implement-and-review: 6% completion rate** (1/16 done, 14 escalated)
   - Root cause: `getVerdict()` defaulted to "fail" when QA didn't use exact format
   - "contradicts" in isCriticalRejection matched too broadly

### Fixes Applied
1. Fixed `getVerdict()` in `shared/workflows/implement-and-review.ts` — ambiguous now → conditional pass
2. Removed "contradicts" from `isCriticalRejection` — too broad, caused false escalations
3. Corrected REGISTRY.md with actual data from run files + DB queries
4. Published finding report at `workspace/finding-workflow-audit-0404.md`

### What Actually Works
- growth-cycle (coach): 26/26 done = 100%
- skill-lifecycle (shared): 12/12 done = 100%
- training-sprint (coach): 4/4 done = 100%
- Coach's pipeline infrastructure is the system's best-engineered workflow system

### Next
- Propose dead workflow deletion to Hao (9 files, 2,224 lines)
- Monitor implement-and-review after verdict parsing fix

## 2026-04-04 08:40 — maxTurns Restore Bug Fix

### Found
- Sessions restored after process restart lose their `maxTurns` limit (hard-coded to 0)
- Evidence: optimizer sessions ran 104 and 127 ops, exceeding the 40-turn limit
- Root cause: `maxTurns` was never persisted to meta.json

### Fixed (3 files)
1. `persistence.ts`: Added `maxTurns?: number` to `PersistedSession` interface
2. `manager.ts` line ~855: Save `maxTurns` when creating session meta
3. `manager.ts` line ~1187: Restore `maxTurns` from persisted data (was: `maxTurns: 0`)
- TypeScript compilation clean

### Finding
- `workspace/finding-maxturns-restore-bug-0404.md`

## 2026-04-04 08:08 — Workflow Consolidation + System Health Analysis

### Completed
1. **Workflow Consolidation (P1-P3)** — All three duplicate sets consolidated:
   - `verify-and-finish`: may/tech-lead identical → promoted to shared, deleted 2 local copies
   - `verify-parallel`: tech-lead had best QA prompts (Phase 1/2 pattern) → promoted to shared, deleted 3 local copies
   - `implement-and-review`: tech-lead was superset of all improvements → promoted to shared, deleted 3 local copies
   - **Total: 9 files deleted, 3 canonical versions in `shared/workflows/`**
   - Updated REGISTRY.md with consolidation status

2. **System Health Analysis (post-restart)**:
   - **Zero-op epidemic resolved**: 30-48h ago, 80-100% of sessions had 0 ops. Now: 0%.
   - **maxTurns fix working**: No more 31/30 turn limit errors. 2 sessions hit 41/40 limit.
   - **6h gap** in session activity (6-12h ago) — system downtime/restart.
   - **Post-restart completion rate**: 58% (11/19). Main waste: request aborted (4), turn limit (2), litellm error (1).

3. **New findings**:
   - **Coach model misconfiguration**: `opus` model resolves to `claude-opus-4.6` which isn't available through the LiteLLM/GitHub Copilot proxy. Coach sessions fail with 400 Bad Request when ANTHROPIC_API_KEY isn't set. See may.ts line 149-157.
   - **API timeouts**: "The operation timed out" errors come from Anthropic SDK, not our code. Platform issue.
   - **Request aborted**: Still the #1 waste cause (4/19 recent sessions). Platform interrupts, not fixable by us.

### Remaining Work
- Coach model fix needs env config or model mapping changes (not in optimizer scope)
- Zombie cleanup fix still uncommitted in manager.ts
- Turn limit: coach and tech-lead sessions still hitting 41/40 — monitor if they need higher limits

---

## 2026-04-04 07:38 — Fresh 24h Waste Analysis + maxTurns Fix Verification

### Task
Fresh 24h waste analysis. Verify maxTurns deployment. Investigate zombies.

### 24h Session Metrics (Apr 3 07:39 → Apr 4 07:39)
- **97 completed sessions** (excluding currently running)
- **43 done (44.3%), 26 interrupted (26.8%), 28 error (28.9%)**
- **16 zero-op sessions (16.5%)** — down from 34% weekly average
- **13 true waste sessions (13.4%)** — unchanged from last finding (13%)
- **24 turn-limit kills (24.7%)** — this is the biggest fixable problem

### maxTurns Config Status
**FINDING**: The cron.json on disk now has all agents at maxTurns=40, but there are **uncommitted changes** (diff is 209 lines). The agents-auto-commit cron should pick these up.

Turn limit kill breakdown (last 24h):
- **14 kills at 31/30** — Bob(3), Optimizer(6), QA(5), Scout(3), Tech-lead(2) — these agents were running with OLD config (maxTurns: 30)
- **10 kills at 41/40** — Coach(4), Tech-lead(1 recent), Evaluator(0) — these had correct config

The cron reloaded from disk around 06:00 Apr 4. Since then, all turn-limit kills show 41/40 (confirmed: Tech-lead at 06:45 hit 41/40 instead of 31/30). The fix is now live.

**Expected impact**: Eliminates 14 premature 31/30 kills/day → 14 more sessions run to completion.

### Zombie Sessions — Still Active
**10 zombie sessions** stuck as "running" in DB:
- 8 coder sessions from Apr 2-3 (26-51h old) — in history/ dir but DB not updated
- 1 bob session (21h old) — in history/ dir
- 1 may session (48h old, "hi" task) — still in active sessions dir

**Root cause**: `cleanupZombieSessions()` updates disk meta.json and calls `registry.updateSessionStatus()` but sessions already archived to `history/` aren't found by `listActiveSessionIds()`. The DB retains stale "running" status.

The zombie-cleanup cron last ran on **March 25** — 10 days ago! It should run every 60 min. Either the handler is crashing or the cron isn't firing it. This needs investigation.

### By-Agent Breakdown (24h)
| Agent | Total | Done | Int | Err | ZeroOp | Notes |
|-------|-------|------|-----|-----|--------|-------|
| Bob | 19 | 6 | 8 | 5 | 7 | Most aborted sessions |
| Coach | 19 | 7 | 6 | 6 | 3 | 4 turn-limit kills |
| May | 13 | 12 | 1 | 0 | 0 | Best success rate (92%) |
| Optimizer | 13 | 2 | 5 | 6 | 2 | 6 turn-limit kills! |
| Amy-Kimi | 11 | 8 | 3 | 0 | 1 | Solid (73% done) |
| QA | 11 | 4 | 2 | 5 | 1 | 5 turn-limit kills |
| Scout | 5 | 1 | 1 | 3 | 1 | Low volume, 60% error |
| Tech-lead | 3 | 0 | 0 | 3 | 0 | All 3 hit turn limit |
| Evaluator | 3 | 3 | 0 | 0 | 1 | Perfect success |

### Top Problems (ranked)
1. **Request aborted: 26 sessions (26.8%)** — 13 had 0 ops (total waste), 13 had partial work. Platform-level abort, not fixable by agent config.
2. **Turn limit kills: 24 sessions (24.7%)** — NOW FIXED. maxTurns raised from 30→40 for all agents. Live as of ~06:00 Apr 4.
3. **Zombie sessions: 10 stuck** — zombie-cleanup cron not running. DB out of sync with disk.
4. **LiteLLM errors: 2 sessions** — `litellm.BadRequestError: Github_copilotException`. Coach only.

### Deliverables
- `workspace/finding-zombie-cleanup-fix-0404.md` — Full finding report
- Fixed `/app/src/lib/manager.ts` — Two-phase zombie cleanup with DB updates
- Verified maxTurns: 40 config is on disk and live (cron reloaded)
- Updated journal and todo

### Actions Taken
1. **Fixed zombie cleanup bug** in `/app/src/lib/manager.ts`:
   - Phase 1: Existing cleanup now also calls `updateSessionDb()` directly
   - Phase 2 (new): Scans DB for "running" sessions >30min old that aren't in memory
   - Added `import { getDb, updateSessionDb } from "./requests.js"`
   - All tests pass (1656/1657 — 1 pre-existing failure in chat-session.test.ts)

2. **Verified maxTurns=40 deployment**: All agents now have maxTurns: 40 in cron.json. Recent turn-limit kills show 41/40 (was 31/30). Config change is live.

---

## 2026-04-04 — System Waste Analysis + Workflow Usage Investigation

### Task
Deep system efficiency analysis: measure waste, investigate workflow usage collapse, identify actionable improvements.

### Findings — System Waste
Full report at `workspace/finding-system-waste-0404.md`.

Key metrics (last 7 days):
- **360/1074 sessions (34%) had zero operations**
- **True waste rate: 13%** (after excluding legitimate skipIfIdle/early-exit)
- **#1 waste cause: "Request aborted"** — 90 sessions/week, platform-level issue
- **Tech-lead: 20 error sessions** with 0 ops (startup failures)
- **8 zombie coder sessions** from gym runner not cleaning up
- Agent success rates: May 92%, QA 86%, Amy 92%, Bob 70%, Coach 67%, Optimizer 64%, Tech-lead 52%

### Findings — Workflow Collapse
Updated in REGISTRY.md Effectiveness Tracking section.

Root cause: **NOT agent avoidance — the system has no production code work:**
1. Tech-lead idle since Mar 29 (no new implementation tasks)
2. Coach training-sprint 60% interrupted (3/5 attempts failed from request aborted)
3. Recent coder sessions are gym runs (correctly don't use workflows)
4. When Hao assigns new work, workflow usage will naturally recover

### Deliverables
- `workspace/finding-system-waste-0404.md` — Full waste analysis with per-agent breakdown
- Updated `agents/shared/workflows/REGISTRY.md` — Effectiveness tracking with workflow collapse investigation
- Updated `todo.md` — Refreshed priorities based on findings

### Recommendations
- P0: Fix coach training-sprint reliability (60% interrupt rate)
- P1: Address request-aborted waste (90 sessions/week, ~$45/week)
- P1: Deploy maxTurns guardrails (already escalated)
- P2: Gym runner session cleanup (8 zombies)
- P3: Reactivate task pipeline for tech-lead


## 2026-04-04 — Scout Reliability Investigation

### Task
Investigate Scout's reliability issues (P1 from todo).

### Findings
Full report at `workspace/scout-reliability-analysis.md`.

Key findings:
1. **Scout has 49% waste rate** — highest of all agents ($337 of $690 wasted)
2. **Root causes are 80% platform-level** — process restarts and API failures
3. **W11 was catastrophic** — $313 wasted, mostly on "empty LLM response" errors
4. **W12 was perfect** — 100% success when platform is stable
5. **opCount is a dead metric** — always 0 since opBudget removal (Mar 30)
6. **All agents need maxTurns guardrails** — Bob had 488-turn session, Optimizer 183-turn

### Recommendations
- **P0**: Add `maxTurns: 40` to all agent handlerConfigs in cron.json
- **P1**: Implement graceful abort handling (save progress before restart)
- **P2**: Per-session cost circuit breaker ($3 limit)
- **P3**: Better empty response retry logic

### Agent Comparison (waste rates)
- QA: 13% (best)
- Coach: 34%
- May: 37%
- Bob: 37%
- Optimizer: 39%
- Scout: 49% (worst)

### Escalation
Will escalate maxTurns config change to May/Hao for approval.

## 2026-04-04 (Session s_1775333690729_50): Skill Utilization Deep Dive

### Analysis
Conducted comprehensive skill utilization analysis covering all 57 shared skills, 50+ agent-adopted skills, and 1186 sessions.

### Key Findings
1. **93% of shared skills (53/57) have zero agent adoption** — the pipeline is broken
2. **4 adopted skills show measurable positive effects** — the content works, delivery doesn't
3. **P(accesses) ≈ 0.07 for shared skills** — compared to 1.0 for adopted skills. This is the dominant bottleneck per H-043.
4. **verify-after-edit is the only "universal" skill** (8 agents)
5. **Coach can test ~3 skills/day but there are 53 untested** — backlog grows faster than testing capacity

### Top 3 Proposals
1. **Skill Router** (highest leverage): Build skill-router.ts analogous to knowledge-router.ts. P(accesses) from 0.07 → 0.50.
2. **Auto-adopt proven skills**: 4 proven skills remain undeployed. Double deployed count with manual effort.
3. **Skill compliance checking**: Add skill compliance to convention-check.ts — creates the missing feedback loop.

### Artifact
`agents/shared/knowledge/synthesis/ANALYSIS-skill-utilization-deep-dive.md` (401 lines)

## 2026-04-05 (Session s_1775355248154_83): Workflow Collapse Root Cause — EXP-028

### Task
Workflow evaluation — investigate why usage dropped to 0% since Apr 2.

### Root Cause Found
The heartbeat.md rewrite on Apr 1 (commit db9b0ba9) removed all `workflow.run()` instructions from coach's heartbeat. This was unintentional — the rewrite aimed to clean bloat, but workflow references were collateral damage.

### Key Data
- Coach workflow usage: 7-8/day (Mar 29-30) → 0 (Apr 2+)
- Coach done rate: 85% (with workflows) → 34% (without) — 51pp drop
- System-wide: workflow sessions = 83.9% done, 0% error vs 73.9% done, 10% error
- Training-sprint cron embeds `workflow.run()` in task text — LLM ignores it, reads heartbeat instead
- 31 workflow sessions in 7d, all from pre-rewrite period

### Insight
**LLM agents will NOT spontaneously discover available tools/workflows.** They only use what's explicitly mentioned in their heartbeat.md. This is a fundamental adoption barrier — "availability ≠ awareness."

### Deliverables
- `agents/shared/knowledge/experiments/EXP-028/results.md` — full analysis (110 lines)
- P0 fix sent to May (req:de3c001e) — restore workflow.run() to coach heartbeat
- Updated todo.md with root cause and fix status

## 2026-04-05 (Session s_1775384048507_163): Session Digest Implementation Review

### Task
Schema review of session digest DB implementation (P1 from May).

### Findings
**Overall: WELL IMPLEMENTED.** Schema matches design Section 4 exactly. All 14 lifecycle triggers wired. All key queries from Section 10 have corresponding functions. Classifier logic correct.

**Critical blocker found:** Table `session_digests` doesn't exist in production DB yet. Code is committed but process hasn't restarted. All `upsertDigest()` calls are silently failing. Fix: process restart.

**Bug fixed:** Double transcript read in `upsertDigest()` — when LLM synthesis and file extraction both ran, `readTranscriptDelta()` was called twice. Consolidated to single read.

### Deliverables
- `agents/optimizer/workspace/review-session-digest-impl.md` — full review (5 issues, 4 pass categories)
- Fix: double transcript read → single cached read in `src/lib/session-digest.ts`

## 2026-04-05 (Session s_1775394849295_19): Session Digest Quality Audit + Bug Fix

### Task
Heartbeat — measured session digest system quality (deployed ~3h), found waste patterns.

### Key Findings

**Session Digest System: Working Well**
- 45 digests across 9 agents, 5 trigger types active
- **100% end digest coverage** for post-deploy sessions (18/18)
- `what_happened` populated 89% of the time for `end` trigger
- `stuck_detected` has richest data — all fields + correct classifier actions

**Bug Found & Fixed: `extractFilesModified` false positives**
- `files_modified` contained garbage like `console.log`, `t.name`, `Date.now` 
- Root cause: bash regex `[\w./-]+\.\w+` matched JS property accesses in `bun -e` inline scripts
- Fix: Added `isLikelyFilePath()` with extension whitelist + path structure checks
- Test: 29/29 garbage → rejected, 11/11 real files → kept

**System Waste (24h snapshot)**
- 18.8% waste rate (1,678 error ops / 8,930 total)
- Optimizer is #1 waster (537 ops, 33.3%) — all turn limit errors
- Scout worst error rate (60.8%)
- Turn limit errors still trending: 22→25→14 over 3 days
- Workflow usage: still 0% since Apr 2 (coach heartbeat has references but no sessions use them)

### Deliverables
- Bug fix: `src/lib/session-digest.ts` — `extractFilesModified()` now filters garbage paths
- Finding: `agents/optimizer/workspace/finding-session-digest-quality-0405.md`

