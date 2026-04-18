# Finding: Workflow Health — D-o-R Cap & Workflow Adoption (Apr 12, ~02:00 UTC)

## Summary

D-o-R Phase 1 cap is **91% effective** (21/23 compliant). Optimizer heartbeats stable at 1-10 ops. Bob's 113-op session was a "Research Synthesis" step in a Research Thread workflow — structurally expected, not a cap failure. Workflow adoption is concentrated in Bob + optimizer; 5 agents use zero workflows.

## 1. D-o-R Phase 1 Cap Compliance

**Method**: Filtered sessions with `task LIKE '%Phase 1:%' AND task LIKE '%BUDGET: 15%'` to isolate true D-o-R Phase 1 (excluding optimizer skill-discovery "Phase 1" which is a different workflow).

| Metric | Value |
|--------|-------|
| Total D-o-R Phase 1 sessions | 23 |
| Compliant (≤15 ops) | 21 (91%) |
| Violations (>15 ops) | 2 (9%) |
| Avg ops (all) | 7.6 |
| Avg ops (compliant only) | 4.5 |

**The 2 violations:**
- Bob 37 ops (Apr 11 23:24) — EXP-143 results integration. Complex multi-file KB task.
- Bob 40 ops (Apr 11 15:24) — Bayesian Scorecard Update. Heavy cross-reference task.

**Verdict**: Cap is working well. The 2 violations are both complex analytical tasks where Bob likely read many files to understand context. The cap reduces avg from baseline 34.5 to 7.6 — a **78% reduction** (consistent with previous measurements). Not 0 violations, but 91% compliance is strong.

### Previous confusion: Optimizer "Phase 1" sessions

Earlier reports counted optimizer skill-discovery Phase 1 sessions (which use `## Phase 1: DISCOVER...`) as D-o-R violations. These are a **different workflow** with different budgets. When properly filtered:
- Optimizer has **0 D-o-R Phase 1 sessions** (optimizer doesn't use D-o-R)
- All 23 D-o-R Phase 1 sessions are Bob's

## 2. Nested Spawning Check

**10 nested sessions found** spawned from Phase 1 parent sessions, but examining timestamps, all are from **before the nesting fix** (commit 60a844e3, deployed ~03:54 UTC Apr 11). Post-fix Phase 1 sessions show no nesting — they complete within the phase and hand off to Phase 2 properly.

Key data points:
- Post-fix D-o-R workflow runs show clean Phase 1 → Phase 2 handoff
- `wr_1775951900732_nv46`: P1=4 ops, P2=12 ops (total 16) ✅
- `wr_1775951677290_s5fl`: P1=1 ops, P2=5 ops (total 6) ✅

## 3. Bob 113-Op Session Analysis

**Session**: `s_1775957533648_1759` (Apr 12 01:32-01:45 UTC)

**Not a D-o-R session.** This was a "Research Synthesis" step within Bob's Research Thread workflow (`wr_1775957068232_3ls8`).

| Step | Task | Ops |
|------|------|-----|
| Thread 1: KB integration | EXP-143/144, KE-143/144 | 15 (FAILED — 401 auth error) |
| Thread 2: Guard internalization hypothesis | Write hypothesis | 38 |
| Synthesis: Cross-reference | Reconcile threads | 113 |
| **Total workflow** | | **166** |

**Root cause of high ops**: Thread 1 failed (IDE token expired — auth error), so the Synthesis step had to compensate. The 113 ops in synthesis is high but within the Research Thread workflow's design — synthesis steps don't have an op cap.

**Recommendation**: Research Thread synthesis steps should have a budget cap (e.g., 50 ops). The current uncapped design allows one failed thread to push synthesis cost through the roof.

## 4. Workflow Adoption (Last 6 Hours)

| Agent | Total Sessions | D-o-R | WF Calls | Forked | Direct Jobs | Avg Ops | Total Ops |
|-------|---------------|-------|----------|--------|-------------|---------|-----------|
| bob | 39 | 8 | 23 | 2 | 12 | 20.6 | 805 |
| may | 17 | 0 | 0 | 3 | 12 | 21.0 | 357 |
| optimizer | 35 | 15 | 22 | 0 | 12 | 10.0 | 349 |
| tech-lead | 24 | 1 | 0 | 12 | 12 | 14.3 | 343 |
| coach | 19 | 1 | 0 | 6 | 12 | 11.7 | 223 |
| scout | 12 | 0 | 0 | 0 | 12 | 12.4 | 149 |
| qa | 12 | 0 | 0 | 0 | 12 | 10.0 | 120 |
| evaluator | 12 | 0 | 0 | 0 | 12 | 4.1 | 49 |
| coder | 2 | 0 | 2 | 0 | 0 | 4.0 | 8 |

**Key observations:**
- **Bob**: Heaviest workflow user (23 WF calls, 8 D-o-R). Also highest total ops (805).
- **Optimizer**: 22 WF calls (all verify-wrap and work session workflows). Avg 10 ops — dispatcher mode working.
- **Tech-lead**: Dispatches via fork (12 forked sessions) but no formal workflows. Dispatcher pattern working.
- **5 agents (may, scout, qa, evaluator, coach)**: Zero or near-zero workflow adoption. They use forks or direct jobs only.

### Workflow Type Distribution (All Time)

| Workflow Type | Sessions | Avg Ops |
|--------------|----------|---------|
| D-o-R Phase 1 | 23 | 7.6 |
| D-o-R Phase 2 | 46 | 19.5 |
| D-o-R Phase 3 | 11 | 2.0 |
| Research Thread | 21 | 35.9 |
| Research Synthesis | 12 | 24.5 |
| Verify-Wrap | 18 | 0.0 |
| Skill Discovery P1-P4 | 44 | ~21.4 |

**Research Threads are expensive**: 35.9 avg ops per thread, and synthesis adds 24.5 more. A single Research Thread workflow run averaged **166 ops** in the latest run. This is now the most expensive workflow pattern.

## 5. Optimizer Heartbeat Ops Trend

| Time (UTC) | Ops | Status |
|------------|-----|--------|
| Apr 12 01:54 | 0 | running (this session) |
| Apr 12 01:24 | 1 | done |
| Apr 12 00:54 | 1 | done |
| Apr 12 00:24 | 1 | done |
| Apr 11 23:54 | 9 | done |
| Apr 11 23:24 | 1 | done |
| Apr 11 22:54 | 1 | done |
| Apr 11 22:24 | 1 | done |
| Apr 11 21:54 | 10 | done |
| Apr 11 21:24 | 1 | done |
| Apr 11 20:54 | 1 | done |
| Apr 11 20:24 | 1 | done |

**Verdict**: Optimizer heartbeats consistently 1 op (quick dispatch) with occasional 9-10 ops (when forking work sessions). Max 10 in last 12 heartbeats. **Dispatcher mode is holding well** — far below the 15-op target and massively below the pre-fix 56-op average.

## Key Takeaways

1. **D-o-R P1 cap: 91% compliant, 78% ops reduction** — Working. Close this item.
2. **Nested spawning fix: Holding** — No post-fix nesting detected.
3. **Bob 113-op session: Research Thread synthesis**, not D-o-R. New concern: Research Synthesis has no op cap.
4. **Workflow adoption: Bob + optimizer only**. 5/8 agents don't use workflows.
5. **Optimizer heartbeats: Stable at 1-10 ops**. Dispatcher mode confirmed effective.
6. **Research Thread is now the most expensive workflow** (166 ops in latest run). Needs a synthesis cap.

## Recommendations

- **CLOSE D-o-R P1 cap item** — Sufficient data (n=23, 91% compliance, 78% reduction).
- **Investigate Research Thread cost** — 166 ops for one run is concerning. Add synthesis step cap.
- **Don't force workflow adoption on all agents** — Scout, QA, evaluator work fine without them. Focus workflow improvements on Bob (who actually uses them).
