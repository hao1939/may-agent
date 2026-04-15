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

### Exploration Mode Rotation Tracker
- Last mode: **D** (Workflow Health — Apr 15 ~07:30 UTC). **Next: A**.
- Previous: D→A→C→A→D→C→B→A→D. See finding files for details.

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
- **Scout 78-op Tool Gap Analysis** — Scout heartbeat blew up 7.8× (78 ops vs median 8.5) due to inline arXiv research (39 scrape_webpage calls) + git commit struggle (30 ops). 3 new patterns identified: web scraping cascades, finish retry loops, path hallucination. Est. ~60 ops saved per scout research session with purpose-built tools. Dispatched P1 to tech-lead. **Tech-lead response (Apr 13)**: Hard op limit rejected (design decision — opBudget was deliberately removed). Root cause is behavioral — scout's heartbeat.md already says don't search inline, LLM ignored it. No infra fix needed; behavioral compliance is the path. Finding: `workspace/finding-tool-gap-analysis-0413.md` (2026-04-13)
- **D-o-R Phase 1 Budget Cap** — 86% reduction (29.7→4.9 avg ops). ~343 ops/day saved (~$16/day). (2026-04-11)
- **D-o-R Nested Workflow Spawning** — 0/4 nesting incidents post-fix. (2026-04-12)
- **Bob Research Thread Bloat** — 62% reduction via parallel-research budget caps. ~397 ops/day saved (~$19/day). (2026-04-12)
- **Tech-Lead Heartbeat Bloat** — 89% reduction (30.8→3.5 avg ops). ~1,100 ops/day saved (~$52/day). (2026-04-11)
- **Bash Command Pattern Analysis** — 847 commands across 12 high-op sessions. Top 3 patterns (git-review-chain 91x, grep-then-read 87x, file-discovery-spiral 75x) = 52% of all commands. Concrete tool/script fixes sketched for each. Est. 125-220 ops/day savings. Finding: `workspace/finding-bash-command-patterns-0411.md` (2026-04-11)
- **Gym Results Data Gap** — Both paths now record: `gym-helpers.ts` has `recordGymResult()` (commit 961d892f0), `run-gym.sh` pipes to `record-result.ts` (commit 2c8c7dcd). 22 runs + 156 checks verified in DB. (2026-04-10)
- **codeSearch Tool** — BUILT `scripts/code-search.ts`. Collapses 3-16 grep chains into single call. Tested with 7 real query patterns. Supports regex/fixed, context lines, stats, JSON output, glob/type filters, auto-excludes. Est. 120-180 ops/day savings across 93% of sessions. Finding: `workspace/finding-codesearch-tool-scoping-0412.md` (2026-04-12)

48+ items Mar 17 – Apr 10. Detailed logs: `workspace/todo-archive-20260410.md`
