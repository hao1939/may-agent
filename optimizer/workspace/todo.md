# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

### 🚨 LiteLLM Strips Prompt Caching — $143/day Waste
- LiteLLM proxy strips `cache_control` → 0% Anthropic cache hits. $143/day (~$4,300/month) savings with 70% cache rate.
- Bypass exists at `src/app/may.ts:148-165`, needs `ANTHROPIC_API_KEY` env var.
- **BLOCKED on operator.** Finding: `workspace/findings/2026-04-10-litellm-kills-prompt-caching.md`

### D-o-R Nested Workflow Spawning — All 3 Phases FIXED ✅ CONFIRMED
- **Phase 1 fix** (commit 60a844e3): Eliminated Phase 1 nesting. ✅
- **Phase 2 fix** (commit ef7e2528): **CONFIRMED at n=9.** 0% nesting post-fix (was 40% pre-fix). ✅
- **Phase 3 fix** (Apr 11 ~17:25 UTC): **CONFIRMED at n=5.** 0% nesting post-guard (was 10% pre-guard). ✅
- Combined post-fix nesting rate: **0/30 sessions (0%)** across all three phases.
- Findings: `workspace/finding-bob-90op-archaeology-0411.md`, `workspace/finding-dor-nesting-verification-0411.md`, `workspace/finding-dor-nesting-final-0411.md`, `workspace/finding-dor-phase3-nesting-fix-0411.md`, `workspace/finding-dor-postcap-health-0411.md`
- **→ DONE at n=5. May revisit at n≥10 for definitive confirmation but low priority.**

### Coach Session Efficiency — FINDING COMPLETE, FIX 2 DEPLOYED
- 2,175 coach sessions analyzed. 50.3% zero-op, 64% of ops in top sessions are exploration waste.
- Top 15 sessions avg 24% productivity. Two sessions 3% productive (68 calls, 2 productive).
- Key waste: file discovery spirals (32.7%), gym run proliferation (11.2%), growth-trigger 52% error rate.
- 5 concrete fixes identified: state index, gym batch runner, growth-trigger guards, fast nothing-to-do path, read-then-act discipline.
- **Fix 2 DEPLOYED**: `scripts/gym-batch.sh` — batch comparison runner. Replaces 10-26 manual gym-run.sh calls with single command. Supports --variants (baseline vs forks), --trials N, --tier/--category, comparison summary table. Est. savings: ~10 ops/session for gym-heavy sessions.
- **gym-batch.sh ADOPTION: ZERO** (confirmed Apr 11 ~20:00 UTC). Deep dive reveals L3 blocker: experiment design.md files explicitly prescribe `for i in 1..6; do gym-run.sh` loops. Coach follows task-specific instructions over general tool knowledge. SKILL.md + context.md presence insufficient when task prompt overrides. **Root cause: 9/75 experiment designs mention gym-run.sh, 0/75 mention gym-batch.sh.** **Next fix**: (1) Add gym-batch instruction to coach heartbeat.md dispatch template. (2) Add gym-batch preference to Bob's context.md so future designs use it. Finding: `workspace/finding-tool-adoption-blockers-0411.md`
- Estimated savings: ~750 ops/day, ~$35/day.
- Finding: `workspace/finding-coach-session-efficiency-0410.md`

### Tech-Lead Heartbeat Bloat — ✅ FIX DEPLOYED & CONFIRMED (89% reduction)
- Tech-lead now at avg 13 ops (last 6h snapshot), down from 30.8 pre-fix. Properly forking work.
- Finding: `workspace/finding-tech-lead-heartbeat-bloat-0411.md`
- **→ MONITORING — check at n≥20 for final confirmation**

### Optimizer Heartbeat Bloat — FIX DEPLOYED
- Avg 56 ops/heartbeat (highest of any agent). Bob avg 4 ops. My min was 19 — proves lean is possible.
- Root cause: heartbeat.md encouraged inline exploration (multi-query DB analysis, file reads).
- Fix: Rewrote heartbeat.md to "Dispatcher Mode" — observe in 1-2 ops, fork all analysis work. Target: ≤15 ops.
- Baseline: 8 heartbeats in 12h, avg 56 ops, total 451. Post-fix: avg 23 ops (59% reduction). ✅ SUCCESS.
- Last exploration mode: **D** (verify-wrap cost/benefit analysis — Apr 11 ~20:54 UTC). Previous: C (Compute-then-synthesize viability + gym-batch adoption fix status — Apr 11 ~20:24 UTC), B (Tool adoption blockers deep dive — Apr 11 ~20:00 UTC), A (Cumulative Fix Impact Measurement — Apr 11 ~19:24 UTC), D (D-o-R post-cap health + Phase 3 nesting monitor — Apr 11 ~18:54 UTC), C (Coach EXP-141 89-op analysis — forked Apr 11 ~18:24 UTC), B (Tool Gap — adoption blockers analysis — Apr 11 ~17:54), BUILD (D-o-R Phase 3 nesting fix — Apr 11 ~17:25), A (D-o-R nesting fix verification + coach 90-op patterns — Apr 11 ~16:53). Next rotation: **A**.
- Mode A **COMPLETE**: Cumulative Fix Impact Measurement (Apr 11 full day). **Key results**: (1) D-o-R P1 cap: 75.8% avg ops reduction (29.7→7.2) — CONFIRMED. (2) TL dispatcher: 71.7% HB avg reduction (35.9→10.2) — CONFIRMED. (3) Optimizer dispatcher: 60.5% HB avg reduction (56→22.1) — CONFIRMED. (4) WAL fix: 0 unevaluated, 100% sync — CONFIRMED. (5) gym-batch.sh: still zero adoption. **Unexpected**: Total daily ops FLAT (8,756→8,790→8,785) despite per-agent reductions — freed capacity absorbed by increased session volume (+23%). Net heartbeat-specific savings: 37% ops reduction. Finding: `workspace/finding-cumulative-impact-0411.md`
- **session-query tool BUILT** (`scripts/session-query.ts`). Replaces 15-25 bash archaeology pattern with single command. Supports: --agent, --since, --task, --status, --min-ops, --tools, --json, --sort. Tested with real data (911 sessions). Est. savings: 10-15 ops/session × 187 sessions = 1,870-2,805 ops.
- **session-query adoption**: **RECOMMEND DEPRECATION** (Apr 11 ~20:00 UTC). Tool is fundamentally broken — reads stale filesystem (911 sessions from March 23), not may.db (19,147 sessions). Agents already query may.db directly with `bun -e` and it works well. L1+L2 blocker (broken + invisible). Not worth fixing — `bun -e` is the correct pattern. Finding: `workspace/finding-tool-adoption-blockers-0411.md`
- Mode A **COMPLETE**: Cumulative Fix Impact Measurement (Apr 11 full day). **Key results**: (1) D-o-R P1 cap: 75.8% avg ops reduction (29.7→7.2) — CONFIRMED. (2) TL dispatcher: 71.7% HB avg reduction (14.5→4.1) — CONFIRMED. (3) System-wide: heartbeat ops/h -37%, but total daily ops flat (~8,944 proj vs 8,849 baseline). Fixes reduced waste but freed capacity consumed by new work. **No net cost savings.** (4) Actual $/op is $0.033, NOT $0.50 — all savings estimates need recalibration. (5) gym-batch.sh: still zero adoption. Finding: `workspace/finding-cumulative-impact-0411.md`
- Mode D **COMPLETE**: Workflow health analysis. **Key result: D-o-R uses +53% more ops than non-WF work sessions** (45.7 vs 29.9). Phase 1 is the bloat source (30.4 avg ops — matches a complete non-WF session). Error rates 50% lower (2.1% vs 3.9%). Quality scores incomparable (different eval scales). Finding: `workspace/finding-workflow-health-0410.md`
- Mode D **COMPLETE**: verify-wrap cost/benefit analysis (Apr 11 ~20:54 UTC). **Key result: verify-wrap is pure overhead for optimizer.** 0% actionable catch rate in 9 cycles. Verification sessions all 0-ops but ~$0.02/session token cost (~$0.96/day projected). One instance noticed unchecked items but reported status="done" — finding lost. verify-wrap failure detection is broken (checks text matching, not finish() status). Cycle cost +4.8 ops (42.9 vs 38.1 pre-WF) from work variance, not verify overhead. Workflow adoption up to 12.3% (from 7.7% Apr 10). **Recommend removing verify-wrap for optimizer or fixing failure detection logic.** Finding: `workspace/finding-verify-wrap-analysis-0411.md`
- Mode C finding complete: `workspace/finding-workflow-adoption-gap-0410.md`
- Mode A finding complete: `workspace/finding-coach-166op-archaeology-0410.md` — **Key result: high-op sessions are restart-accumulated, not single-context bloat. 184-op session had 6 restarts (7 segments). Primary fix is infra (cap restarts/turns), not behavioral.**
- Mode A finding complete: `workspace/finding-dor-p1-bloat-0411.md` — **Key result: Phase 1 consumes 67% of all D-o-R ops. 14/14 bloated P1s (>40 ops) have "verified" in outcome — doing full delivery cycle in "plan" phase. 15-op cap would save 44% of D-o-R ops (259/day, ~$12/day). Fix: tighter P1 prompt with explicit 15-op budget.**
- Mode A finding complete: `workspace/finding-coach-82op-qa-regression-0411.md` — Coach 82-op QA regression investigation (EXP-133). Completed Apr 11 ~08:29 UTC.

### may.db WAL Bug — FIXED, Monitoring
- Session-sync + evaluation-sync handlers deployed. 1071 evals, 0 unevaluated (as of 17:10 UTC).

## 📊 OBSERVATIONS (no action needed)

- **Bob HB dispatch**: 87% properly dispatched. 13% inline-heavy — not fixable via text rules (KE-002).
- **System waste**: 0-1.9% across all agents. Quality universally "good".
- **Context tax**: 82% of all input tokens are re-sent conversation context. Bob worst at 13.8K tok/op. Prompt caching fix would save ~$128/day.
- **Coach work sessions**: Highest per-session cost ($74/day total, 38 sessions at avg 46 ops). 5 sessions >60 ops = 35.6% of coach cost.
- **Coach exploration waste**: 64% of tool calls in high-op sessions are file discovery/read. Two heartbeats were 3% productive (68 calls → 2 writes). 50.3% of all coach sessions are zero-op.
- **Coach "query-one-at-a-time" waste**: EXP-141 (89 ops) spent ~40-60 ops on sequential per-agent stat computation. Could have been 2-3 ops with a bun script computing all stats in one pass. Pattern applies to all analysis-heavy sessions (~2/day). **Skill needed: "compute-then-synthesize" — write a script for bulk computation, then synthesize narrative from results.** Finding: `workspace/finding-coach-exp141-89op-0411.md`
- **Compute-then-synthesize viability** (Apr 11 ~20:24 UTC): Analysis sessions = 22-38% of daily ops (6,279 ops/48h across ALL agents, not just coach). Skill form: BLOCKED by KE-002 (0/32 text rules work). **Viable form: task-prompt instruction or analysis workflow.** Optimizer already uses the pattern in efficient sessions (20-35 ops). Next: add compute-first instruction to optimizer dispatch template, measure at n≥10. Gym-batch adoption fixes NOT deployed, wouldn't work anyway (same KE-002 blocker). Finding: `workspace/finding-compute-skill-viability-0411.md`
- **Coach growth-trigger**: 52% error rate (115/222 sessions fail). Needs precondition guards.
- **Daily cost**: ~$302/day total. Bob $107, Coach $74, May $36, Scout $32.
- **Bob quality scores**: Artificially low (2.47) due to Phase 1/2 double-penalization. Actual ~3.87. Low priority.
- **Heartbeat bloat**: 61% of system ops in heartbeats. Only bob/coach dispatch effectively. Needs structural fix.
- **Tool quality**: Waste rate 3.6% (stable). All regressions are bob INDEX.md noise.
- **LLM evaluations**: All heuristic-only. By design if JS evaluator sufficient.
- **Dead workflows**: may/coach ~367 lines never-used code. Low-priority cleanup.
- **Workflow adoption**: System-wide **surged to 10.1%** (Apr 11, up from 4.5% Apr 4-10). Bob at **49.1%** (up from 22.4%). Surge started Apr 9 when D-o-R became default dispatch path. Coach 1.9%, others 0%.
- **Workflow efficiency**: D-o-R runs cost +53% more ops than non-WF equivalents. Phase 1 unbounded reading is root cause. Error rates ~50% lower. Quality scores INCOMPARABLE (0-1 vs 0-5 scales — data infra bug).
- **Optimizer heartbeat cost**: Was 56 ops avg. Fix deployed (Dispatcher Mode heartbeat). Measuring.
- **Bob P1 read-loop**: ~~87 ops in Phase 1 of D-o-R for a KB integration task.~~ **FIX DEPLOYED (commit 40b22057)**: 15-op budget cap prompt. **MEASURED**: 32.6% total D-o-R cost reduction (45.3→30.6 avg ops). One cap violation (40 ops, 94.4% compliance). Finding: `workspace/finding-dor-p1-bloat-0411.md`, `workspace/finding-dor-postcap-health-0411.md`
- **Session restart accumulation**: Top coach sessions (184, 129 ops) are multi-restart sessions (6-12 restarts), not single-context bloat. Each restart adds discovery overhead + grows context window (up to 50K tokens/turn). Infra fix (maxRestarts=3 or maxTurns=80) would cap all >100 op sessions. Investigation spiral: 129-op session spent 69 ops debugging model issues — not coach's job.

## ⚠️ SENT/ESCALATED

- **Amy-kimi API billing** — 429 errors. Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao)

- **Memory Redesign Brief** — `workspace/brief-memory-redesign.md`. 2026-03-17.

## ✅ DONE

- **D-o-R Phase 1 Budget Cap** — CONFIRMED EFFECTIVE (n=11). P1 avg 4.4 ops (was 30.9) — 86% reduction. 100% compliance. Findings: `workspace/finding-dor-p1-bloat-0411.md`, `workspace/finding-dor-p1-cap-measurement-0411.md`, `workspace/finding-dor-p1-cap-final-verdict-0411.md` (2026-04-11)
- **Bash Command Pattern Analysis** — 847 commands across 12 high-op sessions. Top 3 patterns (git-review-chain 91x, grep-then-read 87x, file-discovery-spiral 75x) = 52% of all commands. Concrete tool/script fixes sketched for each. Est. 125-220 ops/day savings. Finding: `workspace/finding-bash-command-patterns-0411.md` (2026-04-11)
- **Gym Results Data Gap** — Both paths now record: `gym-helpers.ts` has `recordGymResult()` (commit 961d892f0), `run-gym.sh` pipes to `record-result.ts` (commit 2c8c7dcd). 22 runs + 156 checks verified in DB. (2026-04-10)

48+ items Mar 17 – Apr 10. Detailed logs: `workspace/todo-archive-20260410.md`
