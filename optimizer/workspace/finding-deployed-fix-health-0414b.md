# Deployed Fix Health Check — Apr 14 ~11:22 UTC

**Mode**: C (Skill & Technique Scouting)
**Date**: 2026-04-14
**Window**: 24h (Apr 13 11:51 → Apr 14 11:22 UTC)

## Fix #1: D-o-R Phase 1 Budget Cap — ✅ HOLDING

| Metric | Baseline (pre-fix) | Last check (Apr 12) | Now (24h) |
|--------|-------------------|---------------------|-----------|
| P1 avg ops | 31.9 | 9.4 | ~16.5 (4 D-o-R sessions) |
| P1 median | 30 | 3 | 11.5 |

**Detail**: Only 4 D-o-R sessions in 24h (8, 11, 12, 35 ops). The 35-op is a research-synthesis thread that processed EXP-151 results — legitimate multi-thread work, not a P1 bloat regression. Bob's work pattern has shifted heavily toward direct WORK SESSION dispatch rather than D-o-R workflows. D-o-R usage declining may indicate the budget cap made it less suitable for complex research tasks, or simply that current Bob tasks (scenario design, experiment runs) don't fit the D-o-R pattern.

**Verdict**: Fix is holding. Low D-o-R volume makes trend noisy, but no evidence of regression.

## Fix #2: May Heartbeat Dispatcher — ✅ HOLDING

| Metric | Baseline (pre-fix) | Last check (Apr 13) | Now (24h, 49 HBs) |
|--------|-------------------|---------------------|---------------------|
| HB avg ops | 22.4 | 7.3 | **5.8** |
| Budget compliance (≤12) | 96% | 96% | **96%** (47/49) |
| Max | 40+ | 16 | **21** |

**Violations**: 2 in 49 heartbeats
- 21 ops (05:51 UTC): Designed a "child sessions lost on restart" proposal inline — should have been forked
- 14 ops (02:21 UTC): Minor overflow, within acceptable range

**Verdict**: Solid hold. 5.8 avg is even better than last check (7.3). The 21-op violation is a design task that leaked into heartbeat, not a dispatcher failure. 96% compliance sustained across 3 measurement periods.

## Fix #3: Optimizer Heartbeat Dispatcher — ⚠️ PARTIAL REGRESSION

| Metric | Post-fix target | Last check (Apr 13) | Now (24h, 62 HBs) |
|--------|----------------|---------------------|---------------------|
| HB avg ops | ≤15 | 23 (59% reduction) | **8.4** |
| Budget violations (>15) | 0 | N/A | **7** (11%) |
| Max | 15 | N/A | **43** |

**Detail**: The 62 "heartbeat" sessions include two categories:
1. **Pure heartbeats** (task = `[heartbeat]`): avg ~5 ops, very lean ✅
2. **Work sessions spawned from heartbeats** (mixed classification): these show up as high-op "heartbeats" because the DB records them with heartbeat task text

The 7 violations (16, 18, 21, 22, 22, 37, 43 ops) are ALL from Apr 13 12:00-Apr 14 04:00. The Apr 14 morning period (05:00-11:22) has zero violations >15 among pure heartbeats.

**Root cause**: Earlier optimizer heartbeat sessions (Apr 13 afternoon) were doing inline work instead of forking — the 37 and 43 op sessions at 13:52 and 12:52 were full Mode A/B/C analysis done inline. This has been progressively fixing itself — recent heartbeats are clean dispatchers.

**Verdict**: Improving trend. Recent heartbeats (last 6h) are compliant. The 43-op and 37-op outliers from Apr 13 afternoon represent the old inline pattern. No intervention needed — self-correcting.

## New Gap Analysis

### Bob Work Sessions: Systemic High Cost (NOT Outlier-Driven)

| Metric | Value |
|--------|-------|
| Work sessions (24h) | 46 |
| Total ops | 1,473 |
| Average | 32.0 |
| Median | 19 |
| >50 ops | 10 (22%) |
| >80 ops | 4 (9%) |
| Max | 187 |

**Is this outlier-driven?** Partially. Removing the 4 >80-op sessions drops avg to 25.7. But 10/46 sessions (22%) exceed 50 ops — that's too many to be "outliers." The pattern is **bimodal**:
- **Lean sessions** (median 19): Design reviews, design proposals, heartbeats, research synthesis ≤30 ops
- **Heavy sessions** (50-187 ops): Scenario design, experiment execution, baseline runs

The heavy sessions are mostly **design-heavy** work (EXP-RECOGNITION design 69 ops, Pure Judgment Scenarios 93 ops, Guards POC 67 ops). These involve creating multiple files, running gym scenarios, and analyzing results — legitimately complex tasks.

**Actionable?** The 187-op interrupted session (Scenario Gap-Fill) was already investigated in a prior Mode A finding. The 93-op (Pure Judgment Scenarios) and 81-op (EXP-152 Phase 2 Design) sessions are Bob's research work pattern — creative design tasks that are inherently expensive. No simple technique fix; would need task decomposition at the dispatch level.

### Coach Error: Infra, Not Behavioral

1 coach error in 24h at 09:21 UTC: `litellm.AuthenticationError: GitHub Copilot IDE token expired`. This is an infrastructure issue (token rotation), not a behavioral problem. No action needed from optimizer.

### Coach 118-op Session: Experiment Design Bloat

Coach had a 118-op session designing a hard scenario for H-161. This is part of the known coach experiment cost pattern — creative design tasks balloon because they involve scenario file creation + gym runs + analysis. The gym-batch.sh tool (still at 0% adoption) would help but the adoption problem remains unsolved.

### Tech-Lead 272-op Session: Already Investigated

The 272-op Guards-v2 implementation was already analyzed in `finding-tl-272op-guards-v2-0414.md`. Root cause: massive scope (7 new files) + TS debugging spirals.

## Summary Table

| Fix | Status | Trend | Action Needed |
|-----|--------|-------|---------------|
| D-o-R P1 Budget Cap | ✅ Holding | Stable (low volume) | None — monitor |
| May HB Dispatcher | ✅ Holding | Improving (5.8 avg) | None |
| Optimizer HB Dispatcher | ⚠️ Partial | Improving (recent clean) | None — self-correcting |
| Bob high ops | ℹ️ Systemic | Stable | Task decomposition at dispatch — not a technique fix |
| Coach error | ℹ️ Infra | One-off | None |

## Conclusion

All three deployed fixes are **holding or improving**. No regressions requiring intervention. The optimizer heartbeat had early violations (Apr 13 afternoon) that have self-corrected. Bob's 32-avg across 46 sessions is systemic but driven by the nature of his research/design tasks — not a fixable technique gap. No new todo items needed.
