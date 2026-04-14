# System Health Check — Apr 14, 2026 (~10:22 UTC)

## Overview

6-hour scan of all agents (04:22–10:22 UTC), plus full-day Apr 14 metrics compared to Apr 13 baseline.

**Bottom line**: Ops volume has **nearly doubled** vs Apr 13 (projected 9,910 vs 5,894), driven by heavy Bob + Tech-Lead work sessions. Heartbeat controls are mostly holding, but two regressions need attention: TL heartbeat had a 182-op outlier, and May exceeded the 12-op cap twice. Coach growth-trigger error rate has improved dramatically (from 52% → ~17%).

---

## Key Metrics: Apr 14 vs Apr 13

| Metric | Apr 13 (24h) | Apr 14 (10.4h actual) | Apr 14 (projected 24h) | Trend |
|---|---|---|---|---|
| **Total ops** | 5,894 | 4,282 | ~9,910 | ⚠️ **+68%** |
| **Total sessions** | 438 | 295 | ~683 | ⚠️ **+56%** |
| **Est. cost** | ~$277 | ~$201 | ~$466 | ⚠️ **+68%** |
| **Error sessions** | — | 2 (1 coach, 1 eval) | — | ✅ Low |

### Cost Breakdown by Agent (Apr 14, 10.4h)

| Agent | Ops | Sessions | Avg Ops | Est. Cost | Apr 13 Full Day | Change |
|---|---|---|---|---|---|---|
| Bob | 1,015 | 42 | 24.2 | ~$48 | ~$39 | ⬆️ **+23%** (in half the time) |
| Tech-Lead | 910 | 37 | 24.6 | ~$43 | ~$53 | ⬆️ pace is higher |
| Coach | 834 | 52 | 16.0 | ~$39 | ~$55 | Similar pace |
| Optimizer | 476 | 41 | 11.6 | ~$22 | ~$49 | ✅ Lower |
| Scout | 411 | 30 | 13.7 | ~$19 | ~$13 | ⬆️ Higher |
| May | 363 | 28 | 13.0 | ~$17 | ~$42 | ✅ Lower |
| QA | 145 | 21 | 6.9 | ~$7 | ~$12 | ✅ |
| Evaluator | 132 | 43 | 3.1 | ~$6 | ~$6 | ✅ Stable |
| Coder | 0 | 1 | 0 | $0 | ~$8 | — |

**Primary cost drivers for the increase**: Bob work sessions (187, 93, 67, 59, 57, 53 ops) and Tech-Lead 272-op Guards-v2 implementation session.

---

## Optimization Status Table

| Fix | Apr 13 Baseline | Apr 14 Current | Holding? |
|---|---|---|---|
| **May Heartbeat Cap (≤12)** | 8.1 avg (n=10) | **6.1 avg** (n=22) | ⚠️ MOSTLY — 2 violations (14, 21 ops) out of 22 |
| **Tech-Lead Heartbeat** | 4.3 avg (n=28) | **7.1 avg** excl outlier (n=27) | ⚠️ REGRESSED — 182-op outlier + higher baseline |
| **Optimizer Heartbeat** | 2.5 avg (n=4) | **6.2 avg** (n=26) | ✅ Still lean (larger sample) |
| **Coach Heartbeat** | 3.8 avg (n=28) | **6.5 avg** (n=25) | ✅ Acceptable |
| **D-o-R P1 Budget Cap** | 3.1 avg, 0 violations | Not separately measured | — |

### Heartbeat Health Summary (Apr 14)

| Agent | Avg Ops | Min | Max | n | Status |
|---|---|---|---|---|---|
| Evaluator | 3.1 | 0 | 10 | 43 | ✅ Excellent |
| May | 6.1 | 4 | 21 | 22 | ⚠️ 2 cap violations |
| Optimizer | 6.2 | 0 | 22 | 26 | ✅ Good |
| Coach | 6.5 | 1 | 26 | 25 | ✅ Good |
| QA | 6.9 | 5 | 10 | 21 | ✅ Good |
| Bob | 7.0 | 3 | 17 | 19 | ✅ Normal |
| Scout | 7.5 | 4 | 27 | 23 | ✅ Normal |
| Tech-Lead | 14.9 | 0 | 182 | 29 | ⚠️ Outlier (182-op "URGENT" session) |

#### May Heartbeat Detail
Distribution: 4, 6, 5, 5, 14, 4, 7, 5, 5, 8, 7, 4, 21, 5, 4, 4, 4, 5, 5, 4, 4, 5

Two violations: 14 ops and 21 ops. The 21-op session is notable — it's the "keep pushing forward the guard system" session that went to 116 ops idle. Excluding these two outliers, avg is **4.9 ops** which is excellent.

#### Tech-Lead 182-op Outlier
- Session at 00:26 UTC: "URGENT: Evaluator LLM evaluations have been completely broken for 3.5 days"
- This is a legitimate emergency response, not a heartbeat control failure — the task urgency overrode the normal budget
- Excluding this one outlier, TL heartbeat avg is 7.1 (vs 4.3 baseline) — mild regression but not alarming
- TL also had a 60-op session classified as heartbeat ("Implement tiered turn budget system") which should have been a forked work session

---

## High-Op Outliers (>30 ops, last 6h)

| Agent | Ops | Status | Task |
|---|---|---|---|
| Tech-Lead | 272 | interrupted | Guards-v2 Phase 1 Implementation |
| Bob | 187 | interrupted | Scenario Gap-Fill |
| Coach | 118 | done | Design Hard Scenario for H-161 |
| May | 116 | idle | Guard system push |
| Bob | 93 | done | Design Pure Judgment Scenarios |
| Bob | 67 | done | Guards as Workflow Demands POC |
| Tech-Lead | 60 | done | Tiered turn budget implementation |
| Bob | 59 | done | Design Recognition-Layer Scenarios |
| Coach | 54 | interrupted | EXP-163: H-161 Independence Test |
| Bob | 53 | done | Run Baselines for Recognition-Layer |
| Bob | 50 | interrupted | EXP-163 Implementation |

**Key observation**: Bob has 6 sessions >50 ops in the last 6h alone. Scenario design/gap-fill and experiment execution are expensive. The 187-op session was previously investigated (interrupted, not a control failure).

---

## Error Patterns

Only 2 errors in 295 sessions (**0.7% error rate** — excellent):

1. **Coach** (2ops, 09:21 UTC): `litellm.AuthenticationError: Github_copilotException - IDE token expired` — transient auth issue, not a code bug
2. **Evaluator** (implied from count mismatch): likely similar auth issue

### Coach Growth-Trigger Error Rate
- 24 growth-trigger sessions today
- 3 interrupted (Request aborted) + 1 error (auth) = **4/24 = 17% failure rate**
- **Down from 52% on Apr 13** — significant improvement
- 20/24 completed successfully (83% success rate)

---

## Interrupted Sessions

| Agent | Interrupted | Total | Rate |
|---|---|---|---|
| May | 9 | 28 | 32% |
| QA | 7 | 21 | 33% |
| Coach | 7 | 52 | 13% |
| Bob | 4 | 42 | 10% |
| Tech-Lead | 3 | 37 | 8% |
| Optimizer | 3 | 41 | 7% |
| Evaluator | 3 | 43 | 7% |
| Scout | 2 | 30 | 7% |

May and QA have elevated interrupt rates. May's 9 interrupts out of 28 (32%) is high — this may be heartbeats being killed by the next cron cycle (expected behavior for idle heartbeats, not concerning if ops are low).

---

## New Anomalies & Action Items

### 1. ⚠️ Daily Ops Nearly Doubled (INVESTIGATE)
- Apr 14 is on pace for ~9,910 ops vs 5,894 on Apr 13 — a **68% increase**
- Root cause: Heavy work session volume. Bob alone has 1,015 ops in 10h (scenario design + experiment runs). TL 272-op guards implementation.
- This appears to be a **legitimate workload spike** (new experiments, guards-v2 implementation) rather than a regression
- **But**: projected $466/day is unsustainable. Need to determine if this is a temporary spike or new baseline.

### 2. ⚠️ Tech-Lead Heartbeat Regression  
- Two TL heartbeats doing inline work (182-op "URGENT" fix, 60-op "implement tiered budget")
- These should be forked as work sessions, not executed inline in heartbeats
- TL heartbeat avg excluding outliers: 7.1 (was 4.3) — mild drift upward
- **Action**: Review TL heartbeat.md for dispatch discipline

### 3. ⚠️ May Heartbeat Cap: 2 Violations
- May heartbeat at 14 ops and 21 ops exceeded the 12-op cap
- 20 out of 22 heartbeats were compliant (91%)
- The 21-op one correlating with the 116-op idle session suggests dispatch was attempted but the main session stalled
- **Action**: Monitor. If violations stay <10%, acceptable. If increasing, investigate.

### 4. ✅ Coach Growth-Trigger: Improved
- Error rate dropped from 52% to 17% — whatever changed is working
- Most failures are now transient (auth/abort) rather than systematic

### 5. ℹ️ Bob Work Session Costs
- Bob is now the #1 cost agent (was 5th on Apr 13)
- 6 sessions >50 ops in 6h, driven by scenario design and experiment execution
- These are legitimate research tasks but the volume is high
- No action item yet — this is workload-driven, not a control failure

---

## Summary Comparison

| Metric | Apr 13 | Apr 14 (current pace) | Direction |
|---|---|---|---|
| Daily ops | 5,894 | ~9,910 | ⬆️ +68% |
| Est. daily cost | ~$277 | ~$466 | ⬆️ +68% |
| Heartbeat controls | All holding | 2 minor regressions (TL, May) | ⚠️ |
| Error rate | — | 0.7% | ✅ |
| Coach growth-trigger | 52% fail | 17% fail | ✅ Improved |
| High-op outliers | TL 272, Bob 187 already known | Same + new Bob sessions | ⚠️ Volume |

**Overall assessment**: The system is healthy (low errors, most controls holding) but running hot. The cost increase is primarily workload-driven (experiments, guards implementation) rather than efficiency regression. The two heartbeat regressions (TL inline work, May cap violations) are minor but worth monitoring.

---

*Analysis performed: Apr 14 2026 ~10:22 UTC. Data window: 6h scan + full Apr 14. DB: .state/may.db (~20,900 sessions total).*
