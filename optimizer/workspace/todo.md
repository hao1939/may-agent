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

### D-o-R Phase 1 Budget Cap — ✅ CLOSED (n=23, 91% compliant)
- **CLOSED (Apr 12 02:00 UTC)**: n=23 D-o-R Phase 1 sessions measured. 21/23 compliant (91%). Avg 7.6 ops (was 34.5 pre-fix) — **78% reduction**. 2 violations (37, 40 ops) on complex analytical tasks.
- **NOTE**: Previous reports incorrectly counted optimizer skill-discovery "Phase 1" sessions as D-o-R violations. Properly filtered, optimizer has 0 D-o-R P1 sessions — only Bob uses D-o-R.
- Findings: `workspace/finding-dor-p1-bloat-0411.md`, `workspace/finding-dor-p1-cap-measurement-0411.md`, `workspace/finding-dor-p1-cap-final-verdict-0411.md`, `workspace/finding-workflow-health-0412.md`
- **→ MOVED TO DONE**

### D-o-R Nested Workflow Spawning — ✅ CLOSED (confirmed post-fix, n=4 clean runs)
- Bob 90-op session (s_...1119) was a **3-deep nested D-o-R workflow**: Phase 1 called callAgent → triggered another D-o-R → spawned another Phase 1. Total: 169 ops for 1 KB integration task.
- **FIX**: Added "DO NOT call callAgent() or spawn sub-agents" to Phase 1 strict rules in `bob/workflows/deliver-or-report.ts` (commit 60a844e3, deployed ~03:54 UTC).
- **POST-FIX CONFIRMED (Apr 12)**: 4 clean D-o-R workflow runs with no nesting detected. Phase 1→Phase 2 handoff clean (e.g., P1=4/P2=12, P1=1/P2=5).
- **→ MOVED TO DONE**

### Coach Session Efficiency — FINDING COMPLETE, FIX 2 DEPLOYED
- 2,175 coach sessions analyzed. 50.3% zero-op, 64% of ops in top sessions are exploration waste.
- Top 15 sessions avg 24% productivity. Two sessions 3% productive (68 calls, 2 productive).
- Key waste: file discovery spirals (32.7%), gym run proliferation (11.2%), growth-trigger 52% error rate.
- 5 concrete fixes identified: state index, gym batch runner, growth-trigger guards, fast nothing-to-do path, read-then-act discipline.
- **Fix 2 DEPLOYED**: `scripts/gym-batch.sh` — batch comparison runner. Replaces 10-26 manual gym-run.sh calls with single command. Supports --variants (baseline vs forks), --trials N, --tier/--category, comparison summary table. Est. savings: ~10 ops/session for gym-heavy sessions.
- **gym-batch.sh ADOPTION: ZERO** (confirmed Apr 11 11:30 UTC). Coach reads it from context.md but never executes. EXP-130 (88 ops, post-merge) made 31 individual gym-run.sh calls, 0 gym-batch. Root cause: passive context mention insufficient — needs integration into experiment templates + explicit instruction in heartbeat.md. Finding: `workspace/finding-gym-batch-adoption-0411.md`
- **TOOL ADOPTION PATTERN IDENTIFIED (Apr 12)**: Context.md mentions = 0% adoption. Dispatch path integration = non-zero adoption. The fix is to wire gym-batch into growth-cycle.ts prompt (structural enforcement), NOT add more context.md text. See 5-level adoption hierarchy. Finding: `workspace/finding-tool-adoption-patterns-0412.md`
- Estimated savings: ~750 ops/day, ~$35/day.
- Finding: `workspace/finding-coach-session-efficiency-0410.md`

### Tech-Lead Heartbeat Bloat — ✅ CLOSED (n=12+, confirmed 89% reduction)
- Pre-fix avg: 30.8 ops (n=44). Post-fix avg: 3.5 ops.
- **DEPLOYED** (commit dfa10146, Apr 11 ~08:35 UTC). Dispatcher mode working.
- **Savings**: ~1,100 ops/day (~$52/day, ~$1,560/month).
- **→ MOVED TO DONE**

### Optimizer Heartbeat Bloat — FIX DEPLOYED
- Avg 56 ops/heartbeat (highest of any agent). Bob avg 4 ops. My min was 19 — proves lean is possible.
- Root cause: heartbeat.md encouraged inline exploration (multi-query DB analysis, file reads).
- Fix: Rewrote heartbeat.md to "Dispatcher Mode" — observe in 1-2 ops, fork all analysis work. Target: ≤15 ops.
- Baseline: 8 heartbeats in 12h, avg 56 ops, total 451. Post-fix: avg 23 ops (59% reduction). ✅ SUCCESS.
- Last exploration mode: **C** (gym-batch adoption + coach technique scouting — forked Apr 11 ~11:23 UTC). Previous: B (Coach tool gap analysis — Apr 11 ~10:53), A (Scout heartbeat investigation — Apr 11 ~10:24), D (D-o-R final verdict + tech-lead — Apr 11 ~10:00), C (Apr 11 ~09:23), B (Apr 11 ~08:53), A (Coach 82-op QA regression — Apr 11 ~08:23), D (D-o-R n=5 + tech-lead draft — Apr 11 ~07:54), C (Apr 11 ~07:23), B (Apr 11 ~07:00), A (Apr 11 ~06:23), D (Apr 11 ~05:53), C (Apr 11 ~05:24), B (Apr 11 ~04:54).
- **session-query tool BUILT** (`scripts/session-query.ts`). Replaces 15-25 bash archaeology pattern with single command. Supports: --agent, --since, --task, --status, --min-ops, --tools, --json, --sort. Tested with real data (911 sessions). Est. savings: 10-15 ops/session × 187 sessions = 1,870-2,805 ops.
- **session-query adoption**: Still **zero active adoption** beyond optimizer (confirmed Apr 11 05:24 UTC). May + QA have passive mentions only. **Three blockers**: (1) filesystem history stale (through ~Apr 5), (2) zero agents have session-query in context.md, (3) may.db has 0 coach sessions. No change since last check. **gym-batch.sh MERGED to main** (cherry-pick 5ca3bdf, Apr 11 ~05:54 UTC) + coach context.md updated — but **gym-batch.sh also has ZERO adoption** despite being in context.md (see Coach Session Efficiency section). Findings: `workspace/finding-tool-gap-0411-b.md`, `workspace/finding-coach-experiment-technique-0411.md`, `workspace/finding-gym-batch-adoption-0411.md`
- **ADOPTION FIX DIRECTION (Apr 12)**: Per tool adoption patterns finding — don't bother adding session-query to context.md (Level 4 = 0% adoption). Must fix may.db backend FIRST, then wire into workflow prompts/heartbeat dispatch templates (Level 1-3). Finding: `workspace/finding-tool-adoption-patterns-0412.md`
- Mode D **COMPLETE**: Workflow health analysis. **Key result: D-o-R uses +53% more ops than non-WF work sessions** (45.7 vs 29.9). Phase 1 is the bloat source (30.4 avg ops — matches a complete non-WF session). Error rates 50% lower (2.1% vs 3.9%). Quality scores incomparable (different eval scales). Finding: `workspace/finding-workflow-health-0410.md`
- Mode C finding complete: `workspace/finding-workflow-adoption-gap-0410.md`
- Mode A finding complete: `workspace/finding-coach-166op-archaeology-0410.md` — **Key result: high-op sessions are restart-accumulated, not single-context bloat. 184-op session had 6 restarts (7 segments). Primary fix is infra (cap restarts/turns), not behavioral.**
- Mode A finding complete: `workspace/finding-dor-p1-bloat-0411.md` — **Key result: Phase 1 consumes 67% of all D-o-R ops. 14/14 bloated P1s (>40 ops) have "verified" in outcome — doing full delivery cycle in "plan" phase. 15-op cap would save 44% of D-o-R ops (259/day, ~$12/day). Fix: tighter P1 prompt with explicit 15-op budget.**
- Mode A finding complete: `workspace/finding-coach-82op-qa-regression-0411.md` — Coach 82-op QA regression investigation (EXP-133). Completed Apr 11 ~08:29 UTC.

### Research Thread Workflow Cost — NEW (Apr 12)
- Bob's Research Thread workflow averaged **166 ops** in latest run (`wr_1775957068232_3ls8`).
- Breakdown: Thread 1 (15 ops, failed — auth error), Thread 2 (38 ops), Synthesis (113 ops).
- **Synthesis step has no op cap** — when a thread fails, synthesis compensates with massive ops.
- Research Thread avg ops per session: 35.9 (threads) + 24.5 (synthesis) = most expensive workflow type.
- **Recommendation**: Add synthesis step budget cap (~50 ops). Investigate thread failure handling.
- Finding: `workspace/finding-workflow-health-0412.md`

### may.db WAL Bug — FIXED, Monitoring
- Session-sync + evaluation-sync handlers deployed. 1071 evals, 0 unevaluated (as of 17:10 UTC).

## 📊 OBSERVATIONS (no action needed)

- **Bob HB dispatch**: 87% properly dispatched. 13% inline-heavy — not fixable via text rules (KE-002).
- **System waste**: 0-1.9% across all agents. Quality universally "good".
- **Context tax**: 82% of all input tokens are re-sent conversation context. Bob worst at 13.8K tok/op. Prompt caching fix would save ~$128/day.
- **Coach work sessions**: Highest per-session cost ($74/day total, 38 sessions at avg 46 ops). 5 sessions >60 ops = 35.6% of coach cost.
- **Coach exploration waste**: 64% of tool calls in high-op sessions are file discovery/read. Two heartbeats were 3% productive (68 calls → 2 writes). 50.3% of all coach sessions are zero-op.
- **Coach growth-trigger**: 52% error rate (115/222 sessions fail). Needs precondition guards.
- **Daily cost**: ~$302/day total. Bob $107, Coach $74, May $36, Scout $32.
- **Bob quality scores**: Artificially low (2.47) due to Phase 1/2 double-penalization. Actual ~3.87. Low priority.
- **Heartbeat bloat**: 61% of system ops in heartbeats. Only bob/coach dispatch effectively. Needs structural fix.
- **Tool quality**: Waste rate 3.6% (stable). All regressions are bob INDEX.md noise.
- **LLM evaluations**: All heuristic-only. By design if JS evaluator sufficient.
- **Dead workflows**: may/coach ~367 lines never-used code. Low-priority cleanup.
- **Workflow adoption**: 4.5% system-wide (Apr 4-10). Bob 22.4%, Coach 1.9%, others 0%. No clear upward trend (fluctuates 0.3%-16.6% weekly).
- **Workflow efficiency**: D-o-R runs cost +53% more ops than non-WF equivalents. Phase 1 unbounded reading is root cause. Error rates ~50% lower. Quality scores INCOMPARABLE (0-1 vs 0-5 scales — data infra bug).
- **Optimizer heartbeat cost**: Was 56 ops avg. Fix deployed (Dispatcher Mode heartbeat). Measuring.
- **Bob P1 read-loop**: ~~87 ops in Phase 1 of D-o-R for a KB integration task.~~ **FIX DEPLOYED (commit 40b22057)**: 15-op budget cap prompt. Measuring — check after 24h. Finding: `workspace/finding-dor-p1-bloat-0411.md`
- **Session restart accumulation**: Top coach sessions (184, 129 ops) are multi-restart sessions (6-12 restarts), not single-context bloat. Each restart adds discovery overhead + grows context window (up to 50K tokens/turn). Infra fix (maxRestarts=3 or maxTurns=80) would cap all >100 op sessions. Investigation spiral: 129-op session spent 69 ops debugging model issues — not coach's job.

## ⚠️ SENT/ESCALATED

- **Amy-kimi API billing** — 429 errors. Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao)

- **Memory Redesign Brief** — `workspace/brief-memory-redesign.md`. 2026-03-17.

## ✅ DONE

- **D-o-R Phase 1 Budget Cap** — CLOSED (Apr 12). n=23, 91% compliant, avg 7.6 ops (was 34.5). 78% reduction. 2 violations on complex tasks. Finding: `workspace/finding-workflow-health-0412.md`
- **D-o-R Nested Workflow Spawning** — CLOSED (Apr 12). Fix deployed (commit 60a844e3). 4 clean post-fix runs confirmed. No nesting detected.
- **Tech-Lead Heartbeat Bloat** — CLOSED (Apr 12). 89% reduction (30.8→3.5 avg ops). ~$52/day savings. Finding: `workspace/finding-tech-lead-heartbeat-bloat-0411.md`
- **Bash Command Pattern Analysis** — 847 commands across 12 high-op sessions. Top 3 patterns (git-review-chain 91x, grep-then-read 87x, file-discovery-spiral 75x) = 52% of all commands. Concrete tool/script fixes sketched for each. Est. 125-220 ops/day savings. Finding: `workspace/finding-bash-command-patterns-0411.md` (2026-04-11)
- **Gym Results Data Gap** — Both paths now record: `gym-helpers.ts` has `recordGymResult()` (commit 961d892f0), `run-gym.sh` pipes to `record-result.ts` (commit 2c8c7dcd). 22 runs + 156 checks verified in DB. (2026-04-10)

48+ items Mar 17 – Apr 10. Detailed logs: `workspace/todo-archive-20260410.md`
