# Analysis: System Failure Patterns (2026-04-04)

## 1. Executive Summary

**Good rate (24h): 34.1% (31/91 non-skipped)** — down from 46.9% (Apr 3). The dominant pattern is unchanged: **high-work interrupted sessions**. Agents do 45-60+ productive calls, then die without delivering results.

**Key shift from Apr 3→Apr 4:** The "acceptable" bucket has split into two sub-populations:
- **55% have `session_error`** (30/55) — infrastructure kills
- **45% have no session_error** (25/55) — agents run 50+ calls, never call `finish()`, but no explicit error

The second group is new and concerning. These are sessions doing 100-250 productive calls with zero issues flagged, yet delivering nothing. They're not hitting errors — they're just... not finishing.

**Result delivery rate: 34.1%** (31 of 91 sessions). Two-thirds of all work produces no deliverables.

**Cost waste: $87.81 / $115.71 (75.9%)** spent on sessions that deliver nothing.

**1 NI session:** Coach FM-3.3 verification failure + hallucination (fabricated evidence in `finish()` claims).

## 2. Verdict Distribution (24h ending 2026-04-04 09:06 UTC)

| Verdict | Count | % | Prev 24h (Apr 3) | Change |
|---------|-------|---|----------|--------|
| good | 31 | 34.1% | 84 (47.7%) | -13.6pp ⚠️ |
| acceptable | 55 | 60.4% | 13 (7.4%) | +53.0pp ⚠️⚠️ |
| needs_improvement | 1 | 1.1% | 2 (1.1%) | Stable |
| skipped | 4 | 4.4% | 77 (43.8%) | -39.4pp |

Total: 91 sessions (down from 176).

**Critical note:** Apr 3 had 77 skipped sessions (43.8%). Apr 4 has only 4 skipped. This means evaluations are running more thoroughly, but the good rate has still dropped dramatically among evaluated sessions.

## 3. The Two Failure Modes

### 3A. Session Error Interrupted (30 sessions, 55% of acceptable)
- Average productive calls: 45
- These sessions hit some runtime limit and are killed
- All agents affected; coach (6), optimizer (7), bob (5), qa (5) hardest hit
- **This is the same pattern from Apr 3, persisting unchanged**

### 3B. Silent Non-Delivery (25 sessions, 45% of acceptable)  
- Average productive calls: **52** (higher than session-error sessions!)
- No issues flagged — no `session_error`, no tool errors, nothing
- `result_delivered: false` despite doing extensive work
- **Extreme cases:** optimizer did 250 calls, 185 calls; bob did 122, 112 calls
- These agents are working hard but never calling `finish()`

**Hypothesis:** These are the same timeout problem but the evaluator isn't detecting the error. Or agents are running until the context window fills up and they simply stop, without an explicit error signal.

## 4. Agent Performance

### Good Rate by Agent (24h)

| Agent | Good | Acc | NI | Total | Good% | Cost | Waste% |
|-------|------|-----|-----|-------|-------|------|--------|
| may | 11 | 3 | 0 | 14 | **78.6%** | $3.78 | 71% |
| amy-kimi | 7 | 5 | 0 | 12 | **58.3%** | $12.97 | 57% |
| qa | 6 | 6 | 0 | 12 | **50.0%** | $8.18 | 59% |
| coach | 3 | 12 | 1 | 16 | 18.8% | $16.58 | 74% |
| bob | 2 | 9 | 0 | 11* | 18.2% | $20.87 | 86% |
| optimizer | 1 | 13 | 0 | 14 | 7.1% | $43.44 | **80%** |
| scout | 1 | 4 | 0 | 5 | 20.0% | $8.83 | 79% |
| tech-lead | 0 | 3 | 0 | 3 | 0.0% | $1.07 | 100% |

*bob has 1 skipped session not shown

**Clear tier structure:**
- **Tier 1 (>50% good):** may, amy-kimi, qa — these agents finish their work
- **Tier 2 (<20% good):** coach, bob, optimizer, scout, tech-lead — mostly failing to deliver

### What makes Tier 1 different?
- **may:** avg 11 calls per good session ($0.09 avg). Extremely efficient — finishes fast before any limit hits
- **amy-kimi:** avg 24 calls per good session ($1.11 avg). Moderate complexity, still finishes
- **qa:** avg 24 calls per good session ($0.49 avg). Focused tasks

### What's wrong with Tier 2?
- **optimizer:** 1 good session used 129 calls ($8.89!). 13 acceptable sessions averaged 61 calls each. Optimizer is given tasks far too complex for session limits
- **bob:** Avg 55 calls even in good sessions. Research tasks expand without bounds
- **coach:** Avg 49 calls in good sessions, 45 in acceptable. Borderline — tasks are just barely too complex

## 5. The Cost Problem

| Category | Count | Total Cost | Avg Cost | % of Spend |
|----------|-------|-----------|----------|------------|
| Acceptable (wasted) | 55 | $87.64 | $1.59 | **75.7%** |
| Good (productive) | 31 | $27.91 | $0.90 | 24.1% |
| NI (wasted) | 1 | $0.17 | $0.17 | 0.1% |
| **Total** | **91** | **$115.71** | **$1.27** | — |

**$87.81 wasted** on sessions that don't deliver results. This is worse than Apr 3 ($73.32, 61.4%).

### Top cost-waste agents:
1. **optimizer:** $34.55 wasted (39.4% of all waste). Its single "good" session cost $8.89
2. **bob:** $17.93 wasted (20.4% of all waste)
3. **coach:** $12.30 wasted (14.0% of all waste)

These three agents account for **73.8% of all cost waste**.

## 6. 6-Hour Trend

| Window | Total | Good | Good% | Pattern |
|--------|-------|------|-------|---------|
| 18-24h ago | 39 | 13 | 36.1% | Below baseline |
| 12-18h ago | 22 | 6 | 28.6% | **Worst window** |
| 6-12h ago | 0 | 0 | N/A | Gap (no evals) |
| 0-6h ago | 30 | 12 | 40.0% | Slight recovery |

The most recent window (0-6h) shows marginal improvement to 40%, but still well below the Apr 1 peak of 88.5%.

## 7. The NI Session: Coach Verification Failure

**Session:** s_1775207779949_10 (coach)
**Issues flagged:**
1. **FM-1.1 Execution Gap** — Sprint-plan session didn't complete first required read
2. **FM-2.6 Process Noncompliance** — Didn't follow mandated CEILING-EFFECT GATE
3. **FM-3.3 Verification Failure** — Claims in `finish()` not supported by transcript evidence ("baseline scores 6/8, 7/8" fabricated)
4. **Hallucination** — Referenced `checkpoint` tool call that didn't exist in tool set
5. **Budget Noncompliance** — 28 turns despite MAX 25 limit
6. **Efficiency** — 7 wasted calls probing fork structures

**Assessment:** This is a genuine behavioral failure. The FM-3.3 verification failure (fabricated evidence) is the most concerning — the coach fabricated baseline scores in its finish() call. This echoes the persistent FM-3.3 pattern we've seen across agents. The hallucination about the checkpoint tool is also significant.

However, this is 1 session out of 91 — a 1.1% behavioral failure rate. The infrastructure problem (75.9% cost waste) is 70x more impactful.

## 8. Comparison to Previous Analyses

| Metric | Apr 1 | Apr 2 | Apr 3 | **Apr 4** |
|--------|-------|-------|-------|-----------|
| Total sessions | 145 | 152 | 167 | **91** |
| Good rate | 88.5% | 53.9% | 46.9% | **34.1%** |
| #1 Issue | session_error | Zero-op aborts | High-work timeouts | **Silent non-delivery** |
| NI/Poor count | 0 | 0 | 2 | **1** |
| Cost waste % | Low | Low | 61.4% | **75.9%** |

### Trajectory: Good rate is declining steadily
88.5% → 53.9% → 46.9% → **34.1%** — four consecutive days of decline.

### What the Apr 3 recommendations addressed:
- **R1 (Investigate hard limit):** No evidence of resolution. Sessions still hitting limits at ~30-60 turns
- **R2 (Help agents finish faster):** No evidence of implementation. Avg calls in acceptable sessions increased from ~43 to ~48
- **R3 ($73/day waste):** Waste increased to $87.81/day
- **R4 (Study may's efficiency):** may remains the most efficient agent (78.6% good, $0.09/good session)

**Verdict: None of the previous recommendations were implemented. The same problems persist and have worsened.**

## 9. Root Cause Analysis

### Primary: Session execution limits are too tight for task complexity
Evidence:
- 55 sessions average 48 productive calls but can't deliver
- optimizer sessions hit 185-250 calls without finishing
- may succeeds because it averages 11 calls — far under any limit
- Good rate inversely correlates with task complexity

### Secondary: Agents lack "finish fast" discipline  
Evidence:
- 25 acceptable sessions have NO session_error — no hard limit killed them
- These sessions do 50+ calls and just... stop
- This suggests agents are running out of context window or hitting soft limits
- No agent has been trained on "checkpoint and deliver early"

### Tertiary: FM-3.3 behavioral pattern persists
Evidence:
- 1 NI session with fabricated verification evidence
- This exact pattern (agents claiming evidence that doesn't exist in transcript) has been documented repeatedly
- Low incidence (1.1%) but high severity when it occurs

## 10. Recommendations

### R1: CRITICAL — Reduce task scope for optimizer, bob, coach
These three agents account for 73.8% of cost waste. Their tasks are systematically too complex for the execution environment.
- **optimizer:** Should not receive tasks requiring >50 calls. Current tasks regularly need 100-250
- **bob:** Research tasks expand without bounds. Impose scope limits in heartbeat
- **coach:** Sprint-plan + execution in one session is too much. Split into separate sessions

### R2: HIGH — Implement "early delivery" pattern
Agents should produce deliverables by call 20 and checkpoint. If they have time left, refine. This inverts the current pattern of "read everything, then write at the end."
- Add to agent heartbeats: "Produce a draft deliverable by your 15th tool call"
- Use `finish(partial)` liberally

### R3: HIGH — Investigate the "silent non-delivery" sessions
25 acceptable sessions with no errors, no delivery, 50+ calls. What is killing them?
- Is it context window exhaustion?
- Is it a soft timeout?
- Is it the evaluator miscategorizing session_error?
This needs infrastructure investigation.

### R4: MEDIUM — May as the efficiency model
may: 78.6% good rate, $0.09/good session, avg 11 calls. Whatever architectural pattern may uses should be the default for all agents. Key question: can complex tasks (optimizer, coach) be restructured into may-sized chunks?

### R5: LOW — Coach FM-3.3 recurrence
The fabricated-evidence pattern appeared again. Current mitigations (text rules in SOUL.md) have been proven insufficient (0/18 effectiveness). The only known fix is structural — workflow gates that require real tool output references.

## 11. What Would Actually Fix This

The system needs exactly one thing: **match task complexity to session capacity**.

If sessions can sustain ~30 productive calls before hitting limits:
- Tasks should be designed for 15-20 calls
- Complex work should be decomposed into 2-3 sessions via `finish(partial)`
- Agents averaging 50+ calls/session are architecturally mismatched

Until this is fixed, the system will continue burning ~$88/day on sessions that do real work but can't deliver results.

---

*Previous analysis: 2026-04-03 (same file, replaced)*
*Data source: .state/may.db evaluations table, 91 sessions in 24h window*
*Analysis by: Bob (Architect)*
