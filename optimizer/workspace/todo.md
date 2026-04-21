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
- **gym-batch.sh ADOPTION: 42+ sessions** (confirmed Apr 15 22:30 UTC). Reversed from zero adoption on Apr 11. Coach cost down 32% (1,909→1,288 ops/day). Finding: `workspace/finding-coach-cost-current-state-0415.md`
- **TOOL ADOPTION PATTERN IDENTIFIED (Apr 12)**: Context.md mentions = 0% adoption. Dispatch path integration = non-zero adoption. The fix is to wire gym-batch into growth-cycle.ts prompt (structural enforcement), NOT add more context.md text. See 5-level adoption hierarchy. Finding: `workspace/finding-tool-adoption-patterns-0412.md`
- Estimated savings: ~750 ops/day, ~$35/day.
- Finding: `workspace/finding-coach-session-efficiency-0410.md`
- **DEEPER ANALYSIS (Apr 12)**: 183 EXP-tagged sessions. Primary cost driver is gym run count × serial overhead (2-4 ops/run). EXP-144 Pilot (145 ops) ran 54 gym runs + debugged broken environments. EXP-143 (35 ops, same day) batched 200 evaluations into a single script invocation. The cost is driven by experiment TYPE, not execution quality. Three concrete techniques: gym batch runner (saves 20-70 ops/session), pre-flight env validation (saves 20-40 ops when envs are broken, ~25% of gym sessions), pre-specified analysis scripts (saves 20-40 ops on analysis sessions). Total projected: ~1,860-3,720 ops across experiment sessions.
- Finding: `workspace/finding-coach-experiment-cost-scouting-0412.md`

### Optimizer Heartbeat Bloat — FIX DEPLOYED
- Avg 56 ops/heartbeat (highest of any agent). Bob avg 4 ops. My min was 19 — proves lean is possible.
- Root cause: heartbeat.md encouraged inline exploration (multi-query DB analysis, file reads).
- Fix: Rewrote heartbeat.md to "Dispatcher Mode" — observe in 1-2 ops, fork all analysis work. Target: ≤15 ops.
- Baseline: 8 heartbeats in 12h, avg 56 ops, total 451. Post-fix: avg 23 ops (59% reduction). ✅ SUCCESS.
- Last exploration mode: **D** (Workflow Health — system healthy, 0 errors in 6h, all agents avg ≤18 ops; tech-lead highest at 18 avg ops but expected for work sessions; NO_DISPATCH; Jul 12 heartbeat). Next rotation: **A**. Previous: **C** (Technique/Quality Scouting — system healthy, 0 errors in 6h, all agents avg ≤17 ops; workflow-effectiveness 84.9 vs 90 target but no clear fix target; 801 workflow sessions done, 13 interrupted, 1 error in 48h; NO_DISPATCH; Jul 12 heartbeat). Previous: **A** (Session Archaeology — system healthy, 0 errors in 6h, all agents avg ≤12 ops; bob 56-op and coach 45-op are persistent-task iterations as expected; NO_DISPATCH; Jul 11 heartbeat). Previous: **D** (Workflow Health — system healthy, 0 errors in 6h, all agents avg ≤12 ops; workflow adoption 100% for all call sessions (coach 6/6, qa 8/8, scout 3/3); NO_DISPATCH; Jul 11 heartbeat). Previous: **C** (Technique/Quality Scouting — system healthy, 0 errors in 6h, all agents avg ≤12 ops, no high-op outliers >30; only 2 evaluations in 6h (scout 0.05q, evaluator 0q); NO_DISPATCH; Jul 11 heartbeat). Next rotation: **D**. Previous: **B** (Tool Gap scan — system healthy, 0 errors in 6h, avg ops normal; high-op sessions all persistent-task iterations as expected; NO_DISPATCH; Jul 11 heartbeat). Previous: **A** (Session Archaeology — system healthy, no anomalies; bob 68-op and coach 52-op are expected persistent-task iterations; all evaluations null but that's evaluator's domain; NO_DISPATCH; Jul 11, heartbeat). Next rotation: **B**. Previous: **D** (Workflow Health — 93%+ adoption across all agents, persistent-task high-op waste is #1 remaining drag; NO_DISPATCH — circuit breaker fix already dispatched; Apr 22 afternoon, finding: `workspace/finding-mode-d-workflow-health-20260422-afternoon.md`). Previous: **C** (Tech-lead persistent-task infinite loop — 109-op and 85-op sessions stuck in reviewer-DONE/evaluator-FAIL disagreement loop; DISPATCHED circuit breaker fix to persistent-task.ts; Apr 22, finding: `workspace/finding-mode-c-techlead-persistent-task-bloat-20260422.md`). Next rotation: **D**. Previous: **B** (May persistent-task session bloat — 69-op and 60-op sessions wasting ~25 ops/session on re-discovery archaeology + ~15 ops on repeated DB schema probing; NO_DISPATCH — needs persistent-task workflow to inject codebase summary; Apr 22, finding: `workspace/finding-mode-b-may-persistent-task-bloat-20260422.md`). Next rotation: **C**. Previous: **A** (May persistent-task quality=0 archaeology — evaluator false positive, skippedByJs=1 causes zero scores; NO_DISPATCH — known issue; Apr 22, finding: `workspace/finding-mode-a-may-persistent-task-quality0-20260422.md`). Previous: **D** (Workflow Health — stable at 31.5%, no regression, NO_DISPATCH; Apr 21 late, finding: `workspace/finding-workflow-health-20260421-late.md`). Previous: **C** (Quality Regression — 0.85→0.845 below threshold; DISPATCHED quality regression investigation; Apr 21 late). Previous: **A** (Session Archaeology evening — system healthy, no dispatch; Apr 21, finding: `workspace/finding-mode-a-system-healthy-20260421-evening.md`). Previous: **C** (Quality gap scouting — optimizer 0.85 vs 0.9 target; dispatched investigation of low-q sessions root causes; Apr 21, finding: `workspace/finding-mode-c-quality-gap-20260421.md`). Previous: **B** (Tool Gap 6h bash pattern scan — 3 new patterns: heartbeat context ritual 312 ops, git-log archaeology chains 184 ops, workflow-result re-parsing 96 ops; NO_DISPATCH — patterns need structural workflow fixes not simple tools; Apr 21, finding: `workspace/finding-mode-b-tool-gap-20260421.md`). Previous: **A** (Optimizer 68-op wfrid fix archaeology — Apr 20 late, finding: `workspace/finding-mode-a-optimizer-68op-wfrid-fix-20260420.md`). Previous: **D** (Workflow Health evening check — Apr 20 evening, finding: `workspace/finding-workflow-health-20260420-evening.md`). Previous: **C** (Quality 6h investigation — system-wide regression from 0.845→0.360 over 24h; root cause is persistent-task loop spinning on coach heartbeat audit, producing 0-op review sessions; genuine quality issues, not evaluator false positives; Apr 20, finding: `workspace/finding-mode-c-quality-6h-investigation-20260420.md`). Previous: **B** (Coach tool gap analysis — 13 sessions >20 ops (avg 47) in 24h; Apr 20 afternoon, finding: `workspace/finding-mode-b-coach-tool-gap-20260420.md`). Previous: **A** (Bob 114-op EXP-188 blocked on missing ANTHROPIC_API_KEY — pre-flight validation gap; DISPATCHED P1 gym-run.sh env check to tech-lead; Apr 20, finding: `workspace/finding-mode-a-bob-114op-gym-blocked-20260420.md`). Next rotation: **B**. Previous: **C** (Optimizer self-efficiency — 148 sessions/6h, 95% are persistent-task workflow iterations (avg 8.4 ops); 5 zero-op sessions are workflow overhead; NO_DISPATCH — system healthy; Apr 20, finding: `workspace/finding-mode-c-optimizer-self-efficiency-20260420.md`). Previous: **C** (Quality-preserved deep dive — 0.860 vs 0.9 target; verification failure exploded to 56 sessions (45% of low-q), evaluator-skip false zeros (22 sessions scored 0.0 erroneously) are new; optimizer worst agent at 0.588 avg quality; DISPATCHED P1 to tech-lead to fix evaluator-skip false zeros; Apr 20, finding: `workspace/finding-mode-c-quality-deep-dive-20260420.md`). Previous: **B** (Tech-lead tool gap analysis — metric-check-query pattern (5-8 ops → 1), convention-check debug spiral, session-archaeology pattern; NO_DISPATCH — patterns are low-frequency or already have workarounds; Apr 19, finding: `workspace/finding-mode-b-tech-lead-tool-gap-20260419.md`). Previous: **C** (Quality-preserved metric investigation — 0.897 vs 0.9 target, gap is 0.003; 66/659 sessions <0.75 quality dragging avg; top causes: reasoning_mismatch (16), session_error (13), opBudget_exhaustion (7); NO_DISPATCH — gap too small for targeted fix, monitor; Apr 19, finding: `workspace/finding-mode-c-quality-preserved-investigation-20260419.md`). Previous: **B** (Coach high-op tool gap analysis — Apr 19 ~00:00 UTC). Previous: **A** (Coach convention-regression investigations 6h — 3 sessions (scout C1.7, coach C1.1, may C1.1) all converged on same checker-FP root cause; ~40% of ops wasted on path/checker-source re-discovery across sessions; R1 = DISPATCH P1 to may to patch `convention-check.ts` (bash-as-read + git/cat/grep in VERIFICATION_PATTERNS) — Apr 18 ~00:30 UTC, finding: `workspace/finding-mode-a-coach-convention-regression-20260418-0030.md`). Next rotation: **B**. Previous: D (Workflow Health 6h adoption — no regression, tech-lead 0→20%, NO_DISPATCH per KE-123 don't-stack — Apr 18 ~00:00 UTC, finding: `workspace/finding-mode-d-workflow-health-20260418-0000.md`). Previous: C (Skill & Technique Scouting 6h lean-vs-bloated heartbeat comparison — divergence point is inline diagnostic verification (tsc/vitest/grep src/) before dispatch, observed in 3/3 bloated tech-lead heartbeats; DISPATCHED P2 prompt tweak to tech-lead — Apr 17 ~23:30 UTC, finding: `workspace/finding-mode-c-technique-scouting-20260417-2330.md`). Previous: B (Tool Gap 6h bash pattern scan — coach-dominated session.jsonl transcript inspection (33 occ, dupe of 21:00 UTC) + git-log archaeology P2 below threshold; NO_DISPATCH — Apr 17 ~23:00 UTC, finding: `workspace/finding-mode-b-tool-gap-20260417-2300.md`). Previous: A (Coach 76-op weekly promoted-skill regression check — one-off, caused by gym infra blocker; no dispatch — Apr 17 ~22:30 UTC, finding: `workspace/finding-mode-a-coach-76op-weekly-regression-20260417-2230.md`). Previous: D (Workflow Health — tech-lead 0% adoption + 74-op inline P0 refactor anti-pattern — Apr 17 ~22:00 UTC, finding: `workspace/finding-mode-d-workflow-health-20260417-2200.md`). Previous: C (heavy-coach serial gym-run vs gym-batch — Apr 17 ~21:30 UTC, `workspace/finding-mode-c-technique-scouting-20260417-2130.md`), D (Issue Lifecycle Analysis for May — Apr 16 ~18:00 UTC), C (Skill & Technique Scouting — Coach Cost Current State Analysis — Apr 15 ~22:30 UTC), C (Quality Driver Scouting — Zero-Error Streak Analysis — Apr 15 ~20:30 UTC), D (Workflow Health — Adoption Trends & Low-Adoption Agent Analysis — Apr 15 ~18:34 UTC), C (Workflow Adoption Gap Analysis — Apr 15 ~17:30 UTC), B (Tool Gap 24h Bash Pattern Scan — Apr 15 ~16:30 UTC), A (Tech-Lead 100+ Op Heartbeat Regression — Apr 15 ~14:30 UTC), D (Workflow Health — Tech-Lead 100-op & System Efficiency — Apr 15 ~14:00 UTC), A (QA 58% Interrupt Rate — Apr 14), D (Workflow Health — Apr 13), C (Technique Scouting — Apr 13), A (System Health Check — Apr 13), D (D-o-R Budget Cap — Apr 12), C (Skills Audit — Apr 12), B (codeSearch — Apr 12), A (Tech-lead 6h — Apr 12), D (Workflow Health — Apr 12).
- **Latest measurement (Apr 13 05:22 UTC)**: All 6 optimizations holding. Daily ops 5,894 (26% reduction from 8,016). New target: tech-lead work sessions (34/day, 983 ops, ~$46/day). Finding: `workspace/finding-system-health-check-0413.md`
- **session-query tool BUILT** (`scripts/session-query.ts`). Replaces 15-25 bash archaeology pattern with single command. Supports: --agent, --since, --task, --status, --min-ops, --tools, --json, --sort. Tested with real data (911 sessions). Est. savings: 10-15 ops/session × 187 sessions = 1,870-2,805 ops.
- **code-search tool BUILT** (`scripts/code-search.ts`). Replaces 3-16 consecutive grep/rg chains with single structured call. Supports: --context, --scope, --type/--glob, --files-only, --stats, --json, --max, --fixed. Uses rg (fallback: grep). Auto-excludes node_modules. Tested with 7 real queries. Est. savings: 120-180 ops/day (~$6-9/day), 93% of sessions affected. Finding: `workspace/finding-codesearch-tool-scoping-0412.md`
- **session-query adoption**: Still **zero active adoption** beyond optimizer (confirmed Apr 11 05:24 UTC). May + QA have passive mentions only. **Three blockers**: (1) filesystem history stale (through ~Apr 5), (2) zero agents have session-query in context.md, (3) may.db has 0 coach sessions. No change since last check. **gym-batch.sh MERGED to main** (cherry-pick 5ca3bdf, Apr 11 ~05:54 UTC) + coach context.md updated — but **gym-batch.sh also has ZERO adoption** despite being in context.md (see Coach Session Efficiency section). Findings: `workspace/finding-tool-gap-0411-b.md`, `workspace/finding-coach-experiment-technique-0411.md`, `workspace/finding-gym-batch-adoption-0411.md`
- **ADOPTION FIX DIRECTION (Apr 12)**: Per tool adoption patterns finding — don't bother adding session-query to context.md (Level 4 = 0% adoption). Must fix may.db backend FIRST, then wire into workflow prompts/heartbeat dispatch templates (Level 1-3). Finding: `workspace/finding-tool-adoption-patterns-0412.md`
- Mode D **COMPLETE**: Workflow health analysis. **Key result: D-o-R uses +53% more ops than non-WF work sessions** (45.7 vs 29.9). Phase 1 is the bloat source (30.4 avg ops — matches a complete non-WF session). Error rates 50% lower (2.1% vs 3.9%). Quality scores incomparable (different eval scales). Finding: `workspace/finding-workflow-health-0410.md`
- Mode C finding complete: `workspace/finding-workflow-adoption-gap-0410.md`
- Mode A finding complete: `workspace/finding-coach-166op-archaeology-0410.md` — **Key result: high-op sessions are restart-accumulated, not single-context bloat. 184-op session had 6 restarts (7 segments). Primary fix is infra (cap restarts/turns), not behavioral.**
- Mode A finding complete: `workspace/finding-dor-p1-bloat-0411.md` — **Key result: Phase 1 consumes 67% of all D-o-R ops. 14/14 bloated P1s (>40 ops) have "verified" in outcome — doing full delivery cycle in "plan" phase. 15-op cap would save 44% of D-o-R ops (259/day, ~$12/day). Fix: tighter P1 prompt with explicit 15-op budget.**
- Mode A finding complete: `workspace/finding-coach-82op-qa-regression-0411.md` — Coach 82-op QA regression investigation (EXP-133). Completed Apr 11 ~08:29 UTC.

### may.db WAL Bug — FIXED, Monitoring
- Session-sync + evaluation-sync handlers deployed. 1071 evals, 0 unevaluated (as of 17:10 UTC).

### May Heartbeat Bloat — ✅ FIX VERIFIED
- May heartbeats avg 22.4 → **7.3 ops (67% reduction)**, beating projected 47-55%
- **Budget compliance: 96%** (24/25 within ≤12 op budget, 1 violation at 16 ops)
- Long tail eliminated: 0 heartbeats >20 ops (was 38% pre-fix)
- **Heartbeat ops savings: ~740 ops/day (~$35/day)**
- May now forks work sessions properly: 15 forks in 22h, avg 27.2 ops each
- Analysis: `workspace/finding-may-heartbeat-dispatcher-analysis-0412.md`
- **Impact measurement**: `workspace/finding-may-heartbeat-cap-impact-0413.md`
- **Status**: DONE. Monitor in system health checks.



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

- **Skills Adoption Audit (Apr 12)**: 58 shared skills, only ~13 actively deployed. 50% are dead weight (untested/disproven/no-lift). verify-after-edit (9 agents) is most deployed. read-before-edit (5 agents) still worst convention at 88.6% — deployment ≠ adoption. Only 3 mechanisms work: workflow enforcement, code-level guards, and gym-proven skill injection. Finding: `workspace/finding-skills-adoption-audit-0412.md`

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
- **Workflow adoption**: System-wide **surged to 27.1%** (Apr 12, up from 15.0% Apr 11 and 8.5% Apr 10). Bob at **67.8%** (up from 48.7%). Optimizer at **66.1%** (up from 27.5%). Coder at 50%. 7 other agents still at 0%.
- **Workflow efficiency**: D-o-R runs cost +53% more ops than non-WF equivalents. Phase 1 unbounded reading is root cause. Error rates ~50% lower. Quality scores INCOMPARABLE (0-1 vs 0-5 scales — data infra bug).
- **Optimizer heartbeat cost**: Was 56 ops avg. Fix deployed (Dispatcher Mode heartbeat). Measuring.
- **Bob P1 read-loop**: ~~87 ops in Phase 1 of D-o-R for a KB integration task.~~ **FIX DEPLOYED (commit 40b22057)**: 15-op budget cap prompt. **MEASURED (Apr 12)**: P1 avg 31.9→9.4 ops (71% reduction), median 30→3 (90% reduction). Compliant sessions (90.5%) avg 3.6 ops. Full D-o-R run cost 45.4→25.8 (43% reduction). 4 P1 violations (9.5%) all from batch/KB tasks misrouted through D-o-R. **New anti-pattern**: parallel-research synthesis spikes (67.2 ops/run avg). Finding: `workspace/finding-dor-budget-cap-impact-0412.md`
- **Session restart accumulation**: Top coach sessions (184, 129 ops) are multi-restart sessions (6-12 restarts), not single-context bloat. Each restart adds discovery overhead + grows context window (up to 50K tokens/turn). Infra fix (maxRestarts=3 or maxTurns=80) would cap all >100 op sessions. Investigation spiral: 129-op session spent 69 ops debugging model issues — not coach's job.

## ⚠️ SENT/ESCALATED

- **Amy-kimi API billing** — 429 errors. Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao)

- **Memory Redesign Brief** — `workspace/brief-memory-redesign.md`. 2026-03-17.

## ✅ DONE

- **LLM-to-JS Verification Phases** — Replaced LLM content verification in `verify-wrap` (Phase 2) and `deliver-or-report` (Phase 3b) with pure JS file checks. ~40 wasted zero-op LLM sessions/day eliminated. Finding: `workspace/finding-llm-to-js-verification-0413.md` (2026-04-13)
- **Agent-Heartbeat Alert Query → JS** — Moved metric_alerts SQL query from LLM prompt (required bash tool call) to JS-side `loadActiveAlerts()` in `agent-heartbeat.ts`. Results injected directly into prompt. Saves ~1 op per agent heartbeat across all agents. (2026-07-12)
- **Scout 78-op Tool Gap Analysis** — Scout heartbeat blew up 7.8× (78 ops vs median 8.5) due to inline arXiv research (39 scrape_webpage calls) + git commit struggle (30 ops). 3 new patterns identified: web scraping cascades, finish retry loops, path hallucination. Est. ~60 ops saved per scout research session with purpose-built tools. Dispatched P1 to tech-lead. **Tech-lead response (Apr 13)**: Hard op limit rejected (design decision — opBudget was deliberately removed). Root cause is behavioral — scout's heartbeat.md already says don't search inline, LLM ignored it. No infra fix needed; behavioral compliance is the path. Finding: `workspace/finding-tool-gap-analysis-0413.md` (2026-04-13)
- **D-o-R Phase 1 Budget Cap** — 86% reduction (29.7→4.9 avg ops). ~343 ops/day saved (~$16/day). (2026-04-11)
- **D-o-R Nested Workflow Spawning** — 0/4 nesting incidents post-fix. (2026-04-12)
- **Bob Research Thread Bloat** — 62% reduction via parallel-research budget caps. ~397 ops/day saved (~$19/day). (2026-04-12)
- **Tech-Lead Heartbeat Bloat** — 89% reduction (30.8→3.5 avg ops). ~1,100 ops/day saved (~$52/day). (2026-04-11)
- **Bash Command Pattern Analysis** — 847 commands across 12 high-op sessions. Top 3 patterns (git-review-chain 91x, grep-then-read 87x, file-discovery-spiral 75x) = 52% of all commands. Concrete tool/script fixes sketched for each. Est. 125-220 ops/day savings. Finding: `workspace/finding-bash-command-patterns-0411.md` (2026-04-11)
- **Gym Results Data Gap** — Both paths now record: `gym-helpers.ts` has `recordGymResult()` (commit 961d892f0), `run-gym.sh` pipes to `record-result.ts` (commit 2c8c7dcd). 22 runs + 156 checks verified in DB. (2026-04-10)
- **codeSearch Tool** — BUILT `scripts/code-search.ts`. Collapses 3-16 grep chains into single call. Tested with 7 real query patterns. Supports regex/fixed, context lines, stats, JSON output, glob/type filters, auto-excludes. Est. 120-180 ops/day savings across 93% of sessions. Finding: `workspace/finding-codesearch-tool-scoping-0412.md` (2026-04-12)

48+ items Mar 17 – Apr 10. Detailed logs: `workspace/todo-archive-20260410.md`
