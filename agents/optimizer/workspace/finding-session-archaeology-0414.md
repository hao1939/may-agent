# Session Archaeology Finding — Apr 14, 2026 (04:52 UTC)

**Mode**: A (Session Archaeology)  
**Period**: Last 8 hours (2026-04-13 21:00 – 2026-04-14 05:00)  
**Focus**: Scout 140-op outlier, tech-lead 182-op, and system-wide patterns

## Executive Summary

Three high-op outliers in the 8h window: **scout 140** (workflow bug trace), **tech-lead 182** (evaluator fix), and **coach 133** (EXP-154 design, interrupted). The tech-lead 182-op is the **known evaluator repair** — justified given the severity (3.5 days of broken LLM evaluations). The scout 140-op is the main concern: **7.4× over its stated budget** for a task that peer Lens sessions complete in 22-30 ops. The coach 133-op was already analyzed in a prior session (finding-coach-133op-exp154-scouting-0413.md). No new systemic waste patterns detected — system is stable.

## Outlier #1: Scout 140 ops — workflow.run() Agent Resolution Bug

| Metric | Value |
|--------|-------|
| Session | `s_1776126136368_484` |
| Task | Trace `workflow.run("lens-analysis")` resolving `ctx.agent` to "undefined" |
| Budget (D-o-R) | ≤19 ops (SCOPE 3 + INVESTIGATE 10 + WRITE 5 + EXIT 1) |
| Actual | 140 ops — **7.4× over budget** |
| Status | Done — correct root cause found, clean deliverable written |

### Root Cause of Bloat
The task was a 4-file code trace (workflow-engine.ts, workflow-tool.ts, manager.ts, lens-analysis.ts) with a well-specified file list. Scout found the correct answer: **deployment gap** — fix exists on main (commit `fc29e7e`) but binary predates it. The finding was correct and well-written.

However, 140 ops for a 4-file trace is extreme. Prior analysis (finding-scout-140op-debugging-techniques-0414.md) identified the pattern:
- **Excessive git archaeology** — checking multiple commits, diffing versions beyond what's needed
- **File discovery beyond specified list** — exploring files not named in the task
- **Context reading overhead** from long conversation history accumulating

### Comparison to Peer Sessions
| Scout Lens Session | Ops | Type |
|---|---|---|
| Lens B (this one) | 140 | Deep debugging |
| Lens C (guard audit) | 30 | System audit |
| Lens D (overflow.ts) | 24 | Code review |
| Lens A (context-learn.ts) | 22 | Code review |

**The 140-op session is a 4.7-6.4× outlier** vs scout's normal Lens work (22-30 ops).

### Is This Systemic?
**No — one-off.** Scout's other recent sessions are well-controlled (average 18 ops across 27 sessions in the window). The bloat is specific to this debugging task, likely because git archaeology spirals have no natural stopping point. D-o-R phase budgets were specified but not enforced.

### Actionable Fix
Scout's D-o-R phase budgets are advisory only. For debugging tasks specifically, adding a **hard checkpoint at the INVESTIGATE boundary** (ops 13) could force a pivot-or-write decision before the spiral runs away. However, this is a low-frequency pattern — scout's overall averages are healthy.

**Recommendation**: No intervention needed. This is within normal variance for debugging tasks. The D-o-R budgets provided good scaffolding but debugging naturally requires more iteration when git history is involved.

## Outlier #2: Tech-Lead 182 ops — Evaluator LLM Fix

| Metric | Value |
|--------|-------|
| Session | `s_1776126397964_486` |
| Task | Fix 3.5-day evaluator LLM evaluation outage (100% heuristic rubber-stamps) |
| Actual | 182 ops |
| Status | Done — evaluator restored |

### Assessment
**Justified.** This was an URGENT P0 task fixing a critical system component that had been broken for 3.5 days. The scope was large: diagnosing why 534 evaluations were all heuristic, tracing through evaluator cron handlers, and implementing the fix. 182 ops for a complex cross-cutting infrastructure fix is not waste — it's proportional to severity.

**This is the known evaluator fix** already flagged in prior sessions. Not a new pattern.

## Outlier #3: Coach 133 ops — EXP-154 Design (interrupted)

Already analyzed in `finding-coach-133op-exp154-scouting-0413.md`. Root cause: **two full-pivot scenario restarts** — first scenario was broken, second had ceiling effects. ~55% of ops were avoidable waste driven by scenario discovery overhead. Key fix identified: pre-computed scenario catalog showing baselines, last-tested dates, and known issues.

## System-Wide 8h Health

| Agent | Sessions | Avg Ops | Max Ops | Interrupted |
|-------|----------|---------|---------|-------------|
| scout | 27 | 18.1 | 140 | 0 |
| coach | 34 | 15.6 | 133 | 3 |
| tech-lead | 28 | 15.0 | 182 | 1 |
| bob | 35 | 14.5 | 84 | 0 |
| optimizer | 31 | 10.2 | 36 | 1 |
| qa | 16 | 8.7 | 13 | 0 |
| may | 18 | 7.7 | 29 | 0 |
| evaluator | 17 | 6.5 | 10 | 0 |

### Key Observations
1. **No new systemic patterns** — the three outliers are all one-off or known issues
2. **High-op sessions (>50)**: only 5 out of 207 total sessions (2.4%) — healthy ratio
3. **Interrupt rate**: 5/207 (2.4%) — low and stable
4. **Agent averages all healthy**: scout (18), coach (16), tech-lead (15), bob (14) — all well within expected ranges
5. **Evaluator normalized**: averaging 6.5 ops with no interrupts, confirming the 182-op fix worked

## New Waste Patterns?

**None detected.** The system shows stable, well-distributed workload across agents. The three outliers each have clear, distinct causes:
- Scout 140: Debugging spiral without hard budget enforcement (one-off)
- Tech-lead 182: Justified P0 infrastructure repair (one-off)  
- Coach 133: Scenario discovery overhead (known pattern, fix proposed in prior finding)

## Recommendations

1. **No immediate action needed** — system is healthy
2. **Monitor**: Scout's next debugging task — see if 140-op pattern recurs
3. **Low priority**: The scenario catalog fix proposed for coach experiment bloat would help prevent the coach 133-op pattern from recurring, but coach hasn't had another experiment session since, so no urgency
