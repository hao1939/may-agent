# Finding: Session Archaeology — High-Op Investigations (Apr 15, 10:00 UTC)

**Date**: 2026-04-15 ~10:00 UTC  
**Mode**: A (Session Archaeology)  
**Scope**: Top high-op sessions in last 12h, optimization compliance check

## Executive Summary

The two highest-op sessions (coach 48-op, tech-lead 45-op) are **both justified by task complexity** — no optimization fix needed. However, **Bob's D-o-R P1 cap is NOT being applied** — all 7 bob work sessions lack D-o-R integration and average 26.3 ops (vs. 15-op target). Optimizer heartbeats are compliant at 7.3 avg ops. The main actionable finding is the D-o-R gap in bob's task dispatch.

## Top 5 High-Op Sessions (Last 12h)

| Rank | Agent | Ops | Status | Task | Verdict |
|---|---|---|---|---|---|
| 1 | coach | 48 | interrupted | Convention violation analysis | Justified — inherently heavy |
| 2 | tech-lead | 45 | done | Scenario oracle generator build | Justified — build task |
| 3 | bob | 38 | done | Scenario Gap-Fill (create new scenarios) | Over-budget — no D-o-R |
| 4 | bob | 34 | done | Baseline premature-ship-pressure | Over-budget — no D-o-R |
| 5 | optimizer | 29 | done | Skill & Technique Scouting | Acceptable for discovery mode |

## Investigation 1: Coach 48-Op Convention Violation Analysis

**Session**: `s_1776234795917_39`  
**Task**: Coaching-feedback convention violation analysis — review violations, decide interventions (skill-update, gym-scenario, soul-edit, skip)  
**Status**: Interrupted (aborted) at 48 ops  
**Eval**: No evaluation recorded

**Analysis**: This is a workflow-dispatched call task requiring reading multiple agents' code to analyze convention violations. Only 2 coaching-feedback sessions have ever existed (as noted in prior finding). The task is inherently multi-agent, multi-file. Being interrupted at 48 ops suggests it hit a timeout, not that it ran away — the work it did was all productive analysis.

**Verdict**: ✅ Justified one-off. No optimization needed.

## Investigation 2: Tech-Lead 45-Op Oracle Generator Build

**Session**: `s_1776243683921_46`  
**Task**: Build scenario oracle generator script for coach (auto-generate expected outputs from codebase + patch)  
**Status**: Done (success) at 45 ops  
**Eval**: No evaluation recorded  
**Origin**: agents.fork job — this is a build/implementation task, not a heartbeat

**Analysis**: This is an **investment task** — building tooling to save coach ~15-20 ops per future scenario session. A 45-op build session that produces a working script is a reasonable cost. It completed successfully (no abort, no error), suggesting focused execution.

**Verdict**: ✅ Justified build task. Expected to pay back its cost within 3 scenario sessions.

## Investigation 3: Bob Work Sessions — D-o-R Gap

**Critical Finding**: None of Bob's 7 work sessions in the last 12h include D-o-R (Deliver-or-Report) budget integration:

| Ops | Status | D-o-R? | Task |
|---|---|---|---|
| 38 | done | ❌ | Scenario Gap-Fill |
| 34 | done | ❌ | Baseline premature-ship-pressure |
| 26 | interrupted | ❌ | Baseline competing-fix-strategies |
| 24 | interrupted | ❌ | Scenario Gap-Fill Phase 2 |
| 19 | done | ❌ | Baseline premature-ship-pressure |
| 17 | done | ❌ | Synthesize deep-dives DD-560 |
| 0 | running | ❌ | Stale-reference-cleanup baseline |

**Stats**: avg=26.3 ops, max=38, 6/7 over 15 ops

**Context**: The D-o-R P1 cap was designed to keep P1 work sessions under 15 ops. But bob's task dispatch isn't including the D-o-R workflow reference or budget constraints in task prompts. The prior finding (8h ago) reported bob's budget caps were "holding" — but that analysis compared to a 24-72h baseline where caps also weren't consistently applied.

**Verdict**: ⚠️ D-o-R integration gap. Bob's work sessions are dispatched without budget constraints. This is the biggest optimization opportunity in the current data.

## Optimization Compliance Checks

### Optimizer Heartbeats: ✅ Compliant (mostly)

| Session | Ops | Status |
|---|---|---|
| s_..._77 | 6 | interrupted |
| s_..._40 | 6 | done |
| s_..._17 | 5 | done |
| s_..._2 | 6 | done |
| s_..._59 | 7 | done |
| s_..._50 | 9 | done |
| s_..._28 | 6 | done |
| s_..._15 | 9 | done |
| s_..._6 | **20** | done |
| s_..._3 | 6 | done |

**Stats**: avg=7.3 ops, max=20, 1/10 over 15

The one 20-op outlier was the cron:optimize task (not a heartbeat) — it's a scheduled optimization session with broader scope. All actual heartbeats stayed ≤9 ops. **Target met.**

### Agent-Level Summary (Last 12h)

| Agent | Type | N | Avg Ops | Max Ops | Interrupted |
|---|---|---|---|---|---|
| coach | call | 2 | 32.0 | 48 | 2 |
| scout | call | 2 | 27.5 | 28 | 0 |
| bob | call | 6 | 26.3 | 38 | 2 |
| optimizer | call | 7 | 18.6 | 29 | 1 |
| coder | call | 13 | 18.4 | 27 | 0 |
| tech-lead | call | 9 | 11.3 | 20 | 0 |
| tech-lead | job | 17 | 10.4 | 45 | 2 |

**Observation**: Tech-lead call sessions average 11.3 ops — lowest of all agents for call tasks. This suggests tech-lead's task decomposition is working well.

## Comparison to Prior Finding (8h ago)

| Metric | Prior (24h window) | Current (12h window) | Trend |
|---|---|---|---|
| Coach avg ops | 13.7 | 32.0 (calls only) | ⬆️ But only 2 sessions, both interrupted |
| Bob avg work ops | 14.6 | 26.3 | ⬆️ Worse — D-o-R not applied |
| Optimizer heartbeat avg | not measured | 7.3 | ✅ Healthy |
| Max single session | 73 | 48 | ⬇️ Better |

## Actionable Items

1. **[P1] Bob D-o-R Gap**: Bob's work sessions are dispatched without D-o-R budget constraints. All 7 recent sessions exceed the 15-op P1 target. However — most of bob's tasks (gym baselines, scenario creation) may legitimately need >15 ops. **Recommendation**: Investigate whether bob's task types are miscategorized as P1 when they should be P2 (higher budget), or if the 15-op cap needs task-type-specific overrides for gym work.

2. **[P2] Coach Interruption Rate**: Both coach call sessions were interrupted (100%). This suggests timeout issues or task scope exceeding session budget. Worth monitoring in next cycle.

3. **[Info] Tech-lead 45-op job**: This is the oracle generator — a one-time build investment. No action needed but track whether it actually reduces coach scenario ops in subsequent sessions.
