# FM-3.3 Trend Analysis: Is the Finish Guard Training Behavior?

**Date**: 2026-04-09
**Author**: Coach (automated analysis)
**Status**: Complete

## Executive Summary

**The finish guard has NO training effect on underlying agent behavior.** Agents do not learn to verify before finishing — they simply get caught at a constant or increasing rate. The guard is a safety net, not a teacher.

However, the guard has gotten dramatically **more effective at catching** FM-3.3 violations over time (from ~9% catch rate to ~73%), which means it's preventing more unverified completions from reaching users. This is a win for reliability but not for behavioral improvement.

## Key Finding: Guard Catches More, But Agents Don't Learn

| Week | Guard? | FM-3.3 Sessions | Evaluated Sessions | Rate | Guard-Caught | Guard-Catch % |
|------|--------|----------------:|-------------------:|-----:|-------------:|--------------:|
| Mar 8 | No | 23 | 49 | 46.9% | 2 | 8.7% |
| Mar 15 | No | 20 | 74 | 27.0% | 0 | 0.0% |
| Mar 22 | Partial¹ | 115 | 198 | 58.1% | 13 | 11.3% |
| Mar 29 | Yes | 26 | 40 | 65.0% | 2 | 7.7% |
| Apr 5 | Yes | 51 | 73 | 69.9% | 37 | 72.5% |

¹ FM-3.3 guard deployed Mar 24 (mid-week)

**Critical observation**: The FM-3.3 rate per evaluated session is **increasing** (27% → 58% → 65% → 70%), not decreasing. This directly contradicts a "training effect" hypothesis.

### What Changed in Week of Apr 5

The guard-catch rate jumped from ~8% to 73%. This coincides with:
- `79a76e5` (Mar 24): FM-3.3 specific verification guard
- `8a07792` (Apr 9): Guard fix for false positives in orchestration sessions
- The guard got more sophisticated at detecting write-without-verification patterns

## Per-Agent Analysis

### Bob (most data in April)
| Week | FM-3.3 / Evaluated | Rate | Guard-Blocked |
|------|-------------------:|-----:|--------------:|
| Mar 15 | 6/12 | 50% | 0 |
| Apr 5 | 39/58 | 67% | 27 |

Bob shows **zero learning effect**. On Apr 8-9 alone, 27 unique sessions hit the guard. Sequential timeline shows:
- Session 20 @ 11:47: GUARD-BLOCKED
- Session 22 @ 11:48: evaluator-flagged (didn't even trigger guard)
- Session 35 @ 15:03: evaluator-flagged
- Session 68 @ 16:02: GUARD-BLOCKED
- Sessions 95-100 @ 17:02: ALL GUARD-BLOCKED
- Next day (Apr 9): 27 more FM-3.3 sessions

Each session starts fresh with no memory of the previous guard-block. **The guard blocks, the agent recovers, but the next session repeats the exact same pattern.**

### Coder
| Week | FM-3.3 / Evaluated | Rate | Guard-Blocked |
|------|-------------------:|-----:|--------------:|
| Mar 15 | 2/2 | 100% | 0 |
| Mar 22 | 43/59 | 73% | 2 |
| Mar 29 | 4/4 | 100% | 0 |
| Apr 5 | 1/1 | 100% | 1 |

Coder has a consistently high rate (~73-100%) but very few sessions in April (only 1 evaluated). Not enough data to determine trend.

### Optimizer
| Week | FM-3.3 / Evaluated | Rate | Guard-Blocked |
|------|-------------------:|-----:|--------------:|
| Mar 8 | 14/30 | 47% | 1 |
| Mar 22 | 44/61 | 72% | 4 |
| Apr 5 | 1/1 | 100% | 1 |

Rate increasing over time (47% → 72% → 100%). No training effect. Low volume in April.

### Coach
| Week | FM-3.3 / Evaluated | Rate | Guard-Blocked |
|------|-------------------:|-----:|--------------:|
| Mar 8 | 3/4 | 75% | 1 |
| Mar 15 | 8/50 | 16% | 0 |
| Mar 22 | 27/75 | 36% | 7 |
| Mar 29 | 7/21 | 33% | 1 |
| Apr 5 | 5/8 | 63% | 5 |

Coach has the **most varied** pattern. The 16% rate in Mar 15 week is the best any agent achieved. But the most recent week (63%) is near the worst. The Apr 5 week shows 5/5 FM-3.3 entries were guard-blocked — meaning 100% of FM-3.3 attempts were caught. But the fact that coach is still attempting to skip verification in 5/8 sessions (63%) shows no behavioral learning.

**Notable**: Coach has 0 errors logged on Apr 8-9, suggesting fewer evaluated sessions rather than fewer failures. This makes the Apr 5 data harder to interpret for coach specifically.

### Tech-Lead
| Week | FM-3.3 / Evaluated | Rate | Guard-Blocked |
|------|-------------------:|-----:|--------------:|
| Mar 8 | 6/11 | 55% | 0 |
| Mar 29 | 15/15 | 100% | 1 |
| Apr 5 | 5/5 | 100% | 3 |

Consistently high rate, increasing over time. No training effect.

## FM-3.3 Recovery Analysis

Of 270 total FM-3.3 entries across all agents:
- **62 (23%)** were guard-blocked at runtime (agent had to retry with verification)
- **208 (77%)** were evaluator-flagged post-hoc (agent finished without verification, never caught at runtime)

The guard has shifted this ratio dramatically in the most recent week:
- Week of Apr 5: **45 guard-blocked (76%)** vs 14 evaluator-flagged (24%)
- All previous weeks combined: **17 guard-blocked (8%)** vs 194 evaluator-flagged (92%)

## Co-occurring Error Types

FM-3.3 rarely appears with other coded errors (the critique field rarely mentions other FM codes). This suggests FM-3.3 is a **standalone behavioral pattern** — agents skip verification regardless of whether they have other issues.

## Answers to Key Questions

### Q1: Is FM-3.3 incidence per session declining over the past week?

**No. It is increasing.** The FM-3.3 rate per evaluated session went from 27% (Mar 15 week) to 70% (Apr 5 week). The guard catches more of them, but agents attempt to skip verification at the same or higher rate.

### Q2: Do any agents show improvement while others don't?

**No agent shows sustained improvement.** Coach had a low-water mark of 16% in Mar 15 week but regressed to 63% by Apr 5. Coder and tech-lead are consistently near 100%. Bob remains at 50-67%.

### Q3: Is there a correlation between FM-3.3 rate and task complexity or session type?

**FM-3.3 is concentrated in work sessions, not heartbeats.** All 270 FM-3.3 entries come from non-heartbeat sessions. This makes sense: heartbeat sessions often don't produce file deliverables, so there's nothing to verify. Work sessions that create/modify files are where the verification step is needed and where agents skip it.

## Implications for KE-007 (Structural Enforcement)

### The Guard Works — As a Guard, Not a Teacher

KE-007 states that structural enforcement is the only reliable intervention. This analysis provides nuanced support:

1. **The guard prevents unverified completions** — in the most recent week, 73% of FM-3.3 attempts were caught at runtime, forcing the agent to verify before completing. This is a real reliability improvement.

2. **The guard does not change underlying behavior** — agents continue to attempt finish-without-verification at the same or higher rate. They don't "learn" from being blocked. Each session is stateless — the agent has no memory of previous guard-blocks.

3. **Active recall doesn't help either** — the FM-3.3 active recall warnings are injected into session context (visible at the top of this very task), yet the behavior persists. This is consistent with KE-002 (text instructions don't change behavioral habits, 0/20 experiments).

### Why There's No Training Effect

The fundamental reason is **session isolation**. Each agent session:
- Starts with a fresh context window
- Has no memory of previous sessions' guard-blocks
- Active recall mentions FM-3.3 but as a generic warning, not a specific correction
- The model's default behavior (skip to completion) reasserts every session

The guard is analogous to **guardrails on a highway** — they prevent cars from going off the road but don't teach drivers to steer better. The car hits the guardrail, gets redirected, and the next car hits it again.

## Recommendations

### 1. Keep the Guard (Essential)
The finish guard is working exactly as designed — catching FM-3.3 at runtime and forcing recovery. The 73% catch rate in the latest week means most unverified completions are prevented. This is a critical safety mechanism.

### 2. Don't Invest in a Skill-Based Intervention
Given KE-002 (text rules: 0/20 effective) and this analysis showing no training effect from structural enforcement, a skill file for "verify before finishing" would almost certainly fail. The problem is not knowledge — agents know they should verify. The problem is that the model's default completion behavior skips it.

### 3. Improve Guard Coverage (Reduce the 27% Evaluator-Flagged Gap)
In the Apr 5 week, 14 FM-3.3 entries were still evaluator-flagged (not caught by the guard). These represent cases where:
- The guard didn't detect the write-without-verify pattern (false negative)
- The session had bash-based writes the guard's heuristic missed
- The agent claimed success for work done in a different session

Closing this gap would bring FM-3.3 to near-zero from the user's perspective, even though agents still attempt it.

### 4. Track "Guard Hit Rate" as a Health Metric
Instead of tracking FM-3.3 as a failure, track:
- **Guard hit rate** (how often the guard catches an attempt) — target: >90%
- **Guard escape rate** (FM-3.3 evaluator-flagged / total sessions) — target: <5%
- **Raw FM-3.3 attempt rate** (expect flat or increasing — not actionable)

## Caveat: Denominator Bias

The "evaluated sessions" denominator only includes sessions that had ANY error logged in ERROR_LOG.jsonl. Sessions with zero errors are invisible. This means:
- The FM-3.3 "rate" is actually "% of problematic sessions that also had FM-3.3"
- True FM-3.3 rate across ALL sessions would be lower
- But the trend direction (increasing within this denominator) is still valid

## Raw Data

### Total FM-3.3 by Agent (All Time)
| Agent | FM-3.3 Sessions | Total Evaluated Sessions | Rate |
|-------|----------------:|-------------------------:|-----:|
| bob | 46 | 71 | 64.8% |
| coder | 50 | 70 | 71.4% |
| optimizer | 60 | 94 | 63.8% |
| coach | 50 | 158 | 31.6% |
| tech-lead | 29 | 41 | 70.7% |
| scout | 7 | 18 | 38.9% |
| may | 1 | 11 | 9.1% |
| qa | 12 | 36 | 33.3% |
| amy-kimi | 1 | 3 | 33.3% |

### Daily FM-3.3 Counts (All Agents)
| Date | FM-3.3 | Evaluated | Rate |
|------|-------:|----------:|-----:|
| 2026-03-14 | 30 | 68 | 44.1% |
| 2026-03-15 | 5 | 21 | 23.8% |
| 2026-03-17 | 10 | 38 | 26.3% |
| 2026-03-18 | 3 | 20 | 15.0% |
| 2026-03-19 | 4 | 8 | 50.0% |
| 2026-03-24 | 79 | 110 | 71.8% |
| 2026-03-25 | 24 | 52 | 46.2% |
| 2026-03-26 | 8 | 42 | 19.0% |
| 2026-03-27 | 8 | 21 | 38.1% |
| 2026-03-28 | 5 | 6 | 83.3% |
| 2026-03-29 | 7 | 12 | 58.3% |
| 2026-03-30 | 16 | 21 | 76.2% |
| 2026-03-31 | 2 | 2 | 100.0% |
| 2026-04-01 | 1 | 1 | 100.0% |
| 2026-04-03 | 2 | 2 | 100.0% |
| 2026-04-05 | 2 | 2 | 100.0% |
| 2026-04-07 | 3 | 6 | 50.0% |
| 2026-04-08 | 17 | 18 | 94.4% |
| 2026-04-09 | 30 | 48 | 62.5% |

### Guard Deployment Timeline
| Date | Commit | Change |
|------|--------|--------|
| 2026-03-18 | `2233509` | First finish guard (evidence validation) |
| 2026-03-24 | `79a76e5` | FM-3.3 specific verification guard |
| 2026-03-24 | `d4ca28a` | Ghost Deliverable Guard (FM-3.1) |
| 2026-03-29 | `45812bc` | Gate 3: contradictory finish status |
| 2026-03-29 | `ca53a87` | Gate 3b: transcript contradiction detection |
| 2026-03-29 | `b12c138` | Reverted 3 harness guards → context.md facts |
| 2026-03-31 | `01e382b` | Fix for CLI agent writes |
| 2026-04-08 | `f7cf01b` | Refactor and consolidation |
| 2026-04-09 | `8a07792` | Fix false positives for orchestration sessions |

## Conclusion

**The finish guard is a permanently necessary safety mechanism, not a temporary training tool.** Agents will continue attempting to finish without verification at a rate of ~50-70% of sessions. The guard's job is to catch these attempts and force recovery. Investing in making the guard more comprehensive (closing the 27% evaluator-flagged gap) is more valuable than any text-based behavioral intervention.

This finding extends KE-007 with a new sub-finding: **structural enforcement prevents failures but does not reduce their root cause**. Guards are brakes, not driving lessons.
