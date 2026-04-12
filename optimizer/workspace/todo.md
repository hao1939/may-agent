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
- **DEEPER ANALYSIS (Apr 12)**: 183 EXP-tagged sessions. Primary cost driver is gym run count × serial overhead (2-4 ops/run). EXP-144 Pilot (145 ops) ran 54 gym runs + debugged broken environments. EXP-143 (35 ops, same day) batched 200 evaluations into a single script invocation. The cost is driven by experiment TYPE, not execution quality. Three concrete techniques: gym batch runner (saves 20-70 ops/session), pre-flight env validation (saves 20-40 ops when envs are broken, ~25% of gym sessions), pre-specified analysis scripts (saves 20-40 ops on analysis sessions). Total projected: ~1,860-3,720 ops across experiment sessions.
- Finding: `workspace/finding-coach-experiment-cost-scouting-0412.md`
- **WORK SESSION ANALYSIS (Apr 12 ~09:00 UTC)**: Root cause UPDATED. Prior analysis attributed cost to experiment type (gym vs analysis). New evidence: it's **analysis style** (interactive vs batch). 4/5 top-cost sessions had ZERO gym runs — cost was 100% interactive SQL exploration (50-60 queries per session, each as separate bun -e script). EXP-136 (98 ops, 58 SQL queries, 3% productive), EXP-141 (89 ops, 60 SQL queries, 1% productive). Efficient sessions (EXP-143 at 35 ops) batch all queries into single scripts. **PATCH DISPATCHED → tech-lead**: Add work session op budget (≤35 ops) + analysis batch script rule to heartbeat.md Step 3. Finding: `workspace/finding-coach-work-session-cost-analysis-0412.md`, Patch: `workspace/patch-coach-work-session-efficiency.md`

### Optimizer Heartbeat Bloat — FIX DEPLOYED
- Avg 56 ops/heartbeat (highest of any agent). Bob avg 4 ops. My min was 19 — proves lean is possible.
- Root cause: heartbeat.md encouraged inline exploration (multi-query DB analysis, file reads).
- Fix: Rewrote heartbeat.md to "Dispatcher Mode" — observe in 1-2 ops, fork all analysis work. Target: ≤15 ops.
- Baseline: 8 heartbeats in 12h, avg 56 ops, total 451. Post-fix: avg 23 ops (59% reduction). ✅ SUCCESS.
- Last exploration mode: **C** (coach work session cost analysis — Apr 12 ~09:39 UTC). Previous: B (May heartbeat dispatcher analysis — Apr 12 ~07:54 UTC), A (Coder 104-op outlier archaeology — Apr 12 ~06:54 UTC), D (D-o-R nesting post-fix — Apr 12 ~04:24 UTC), C (coach experiment cost scouting — Apr 12 ~03:59).
- **session-query tool BUILT** (`scripts/session-query.ts`). Replaces 15-25 bash archaeology pattern with single command. Supports: --agent, --since, --task, --status, --min-ops, --tools, --json, --sort. Tested with real data (911 sessions). Est. savings: 10-15 ops/session × 187 sessions = 1,870-2,805 ops.
- **session-query adoption**: Still **zero active adoption** beyond optimizer (confirmed Apr 11 05:24 UTC). May + QA have passive mentions only. **Three blockers**: (1) filesystem history stale (through ~Apr 5), (2) zero agents have session-query in context.md, (3) may.db has 0 coach sessions. No change since last check. **gym-batch.sh MERGED to main** (cherry-pick 5ca3bdf, Apr 11 ~05:54 UTC) + coach context.md updated — but **gym-batch.sh also has ZERO adoption** despite being in context.md (see Coach Session Efficiency section). Findings: `workspace/finding-tool-gap-0411-b.md`, `workspace/finding-coach-experiment-technique-0411.md`, `workspace/finding-gym-batch-adoption-0411.md`
- **ADOPTION FIX DIRECTION (Apr 12)**: Per tool adoption patterns finding — don't bother adding session-query to context.md (Level 4 = 0% adoption). Must fix may.db backend FIRST, then wire into workflow prompts/heartbeat dispatch templates (Level 1-3). Finding: `workspace/finding-tool-adoption-patterns-0412.md`
- Mode D **COMPLETE**: Workflow health analysis. **Key result: D-o-R uses +53% more ops than non-WF work sessions** (45.7 vs 29.9). Phase 1 is the bloat source (30.4 avg ops — matches a complete non-WF session). Error rates 50% lower (2.1% vs 3.9%). Quality scores incomparable (different eval scales). Finding: `workspace/finding-workflow-health-0410.md`
- Mode C finding complete: `workspace/finding-workflow-adoption-gap-0410.md`
- Mode A finding complete: `workspace/finding-coach-166op-archaeology-0410.md` — **Key result: high-op sessions are restart-accumulated, not single-context bloat. 184-op session had 6 restarts (7 segments). Primary fix is infra (cap restarts/turns), not behavioral.**
- Mode A finding complete: `workspace/finding-dor-p1-bloat-0411.md` — **Key result: Phase 1 consumes 67% of all D-o-R ops. 14/14 bloated P1s (>40 ops) have "verified" in outcome — doing full delivery cycle in "plan" phase. 15-op cap would save 44% of D-o-R ops (259/day, ~$12/day). Fix: tighter P1 prompt with explicit 15-op budget.**
- **24h MEASUREMENT (Apr 12 ~08:54 UTC)**: P1 avg 31.2→11.7 (62% reduction), excl. 2 outliers: 4.5 (86% reduction). Total run 46.0→29.4 (36% reduction). 2 KB INDEX batch tasks blew budget (93, 90 ops) — batch tasks need script, not D-o-R. Cap holds for standard tasks. ~425 ops/day saved (~$20/day). Finding: `workspace/finding-dor-p1-budget-cap-24h-measurement-0412.md`
- Mode A finding complete: `workspace/finding-coach-82op-qa-regression-0411.md` — Coach 82-op QA regression investigation (EXP-133). Completed Apr 11 ~08:29 UTC.

### may.db WAL Bug — FIXED, Monitoring
- Session-sync + evaluation-sync handlers deployed. 1071 evals, 0 unevaluated (as of 17:10 UTC).

### May Heartbeat Bloat — FIX DEPLOYED
- May heartbeats avg 22.4 ops (n=96 in 48h), median 19, P90=42
- **Structurally different from tech-lead/optimizer**: May IS a dispatcher by design — inline work is correct, just too deep per step
- Root causes: over-thorough follow-up (peeking sessions), git commit/push every cycle, dashboard read+edit multiple times, improvement queue inline work
- **Budget-capped approach**: Keep all 7 steps, add per-step op budgets (target ≤12 ops avg). Expected: 47-55% reduction (~500-600 ops/day, ~$25-30/day)
- Analysis: `workspace/finding-may-heartbeat-dispatcher-analysis-0412.md`
- Draft heartbeat: `workspace/draft-may-heartbeat-dispatcher-0412.md`
- Patch file: `workspace/patch-may-heartbeat-budget-caps.md`
- **DEPLOYED**: 2026-04-12 ~08:28 UTC to `agents/may/heartbeat.md`. Budget caps added within existing 7-step structure (KE-008 compliant). Changes: global ≤12 op budget, per-step budget annotations, combined system snapshot query, no-peek rule, no-git-commit rule, fork-only enforcement, "MUST FORK" list, op budget reference table.
- Baseline: avg 22.4 ops, median 19, P90=42 (n=96 in 48h ending 2026-04-12 ~08:00 UTC)
- **MEASUREMENT (Apr 12 ~09:53 UTC)**: n=5 post-deploy, avg 12.6 ops (ops=26,4,5,28,0). Baseline avg 22.4 ops. **44% reduction** overall. BUT 2/5 sessions hit 26-28 ops (above baseline median 19). 3/5 sessions ≤5 ops (excellent). Bimodal: caps work for normal heartbeats, fail for some inline-heavy ones.
- **OUTLIER INVESTIGATION (Apr 12 ~09:55 UTC)**: The "outliers" (26-op and 28-op) were measurement errors: 26-op session was pre-deploy (started 6min before commit), 28-op was a forked work session (not a heartbeat). **Corrected post-deploy heartbeat results**: n=3, ops=[4,5,6], avg=5.0 ops, 78% reduction. ALL under ≤12 budget. No prompt changes needed. Continue monitoring (need 10+ samples). Finding: `workspace/finding-may-heartbeat-cap-outliers-0412.md`
- **Measurement methodology fix**: Future measurements must filter by `source` (exclude agents.fork), task prefix ([heartbeat] vs [WORK SESSION]), use git commit timestamp as cutoff, and exclude status='running'.



### Coder 104-op Outlier — Fewshot Injection False Positive
- **Root cause**: Fewshot pattern `/binary|\.bin|compiled|executable|hexdump/i` matched `.bin` in `./node_modules/.bin/tsc` (the verification command) → injected irrelevant "binary file escalation" example into a dead code removal task
- Also matched `consumer` in code description → injected "escalation-judgment" example
- Coder spent 104 ops / 10.3 min, produced **zero changes** ("No changes to the protected files")
- Total tree cost: 134 ops (28 TL + 104 coder + 2 retry) for zero useful output
- **Fix**: Change regex to `\.bin(?![/\\])` (negative lookahead excludes `.bin/` paths). Also strip verifyCommand before fewshot matching.
- Only 1 coder session >75 ops in 14 days (besides gym runs) — likely one-off, but systemic risk exists for all implement-and-verify tasks
- **Dispatched → tech-lead (Apr 12 ~07:24 UTC)**: P2 fix for `.bin` regex + verifyCommand stripping
- Finding: `workspace/finding-coder-104op-archaeology-0412.md`

### Tool Adoption Strategy — DECLARED DEAD
- gym-batch.sh and session-query.ts: **4th consecutive check confirming zero adoption** (24h+ since merge)
- Context.md references don't drive adoption. Only viable paths: embed in workflow JS code or handler code
- **Recommendation**: Remove context.md references to reduce bloat, abandon prompt-based adoption strategy
- Finding: `workspace/finding-tool-adoption-pattern-mining-0412.md`

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
- **Bob P1 read-loop**: ~~87 ops in Phase 1 of D-o-R for a KB integration task.~~ **FIX DEPLOYED + 24h CONFIRMED (commit 40b22057)**: P1 avg 31.2→11.7 (62% reduction). Excl. batch outliers: 4.5 (86%). Full run: 46.0→29.4 (36%). ~425 ops/day saved (~$20/day). 2 batch tasks (90+ ops) defeat the cap — need script. Findings: `workspace/finding-dor-p1-bloat-0411.md`, `workspace/finding-dor-p1-budget-cap-24h-measurement-0412.md`
- **Session restart accumulation**: Top coach sessions (184, 129 ops) are multi-restart sessions (6-12 restarts), not single-context bloat. Each restart adds discovery overhead + grows context window (up to 50K tokens/turn). Infra fix (maxRestarts=3 or maxTurns=80) would cap all >100 op sessions. Investigation spiral: 129-op session spent 69 ops debugging model issues — not coach's job.

## ⚠️ SENT/ESCALATED

- **Amy-kimi API billing** — 429 errors. Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao)

- **Memory Redesign Brief** — `workspace/brief-memory-redesign.md`. 2026-03-17.

## ✅ DONE

- **D-o-R Phase 1 Budget Cap** — 86% reduction (29.7→4.9 avg ops). ~343 ops/day saved (~$16/day). *24h confirmed*: 62% all-in (31.2→11.7), 86% excl. batch outliers. ~425 ops/day saved (~$20/day). (2026-04-11/12)
- **D-o-R Nested Workflow Spawning** — 0/4 nesting incidents post-fix. (2026-04-12)
- **Bob Research Thread Bloat** — 62% reduction via parallel-research budget caps. ~397 ops/day saved (~$19/day). (2026-04-12)
- **Tech-Lead Heartbeat Bloat** — 89% reduction (30.8→3.5 avg ops). ~1,100 ops/day saved (~$52/day). (2026-04-11)
- **Bash Command Pattern Analysis** — 847 commands across 12 high-op sessions. Top 3 patterns (git-review-chain 91x, grep-then-read 87x, file-discovery-spiral 75x) = 52% of all commands. Concrete tool/script fixes sketched for each. Est. 125-220 ops/day savings. Finding: `workspace/finding-bash-command-patterns-0411.md` (2026-04-11)
- **Gym Results Data Gap** — Both paths now record: `gym-helpers.ts` has `recordGymResult()` (commit 961d892f0), `run-gym.sh` pipes to `record-result.ts` (commit 2c8c7dcd). 22 runs + 156 checks verified in DB. (2026-04-10)

48+ items Mar 17 – Apr 10. Detailed logs: `workspace/todo-archive-20260410.md`
