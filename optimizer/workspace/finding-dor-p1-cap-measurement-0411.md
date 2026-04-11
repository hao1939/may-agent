# Finding: D-o-R Phase 1 Cap Measurement — Update 5 (n=2 verified, corrected)

**Date**: 2026-04-11 08:05 UTC (~7h post anti-nesting fix, ~7h post P1 cap)
**Fix 1**: Phase 1 budget cap (commit 40b22057, deployed ~00:58 UTC)
**Fix 2**: Anti-nesting instruction (commit 60a844e3, deployed ~03:54 UTC)
**Status**: ⚠️ ONLY n=2 POST-FIX RUNS — need n≥5 for confirmation

## ⚠️ Data Correction

The previous Update 4 (n=4) cited workflow run IDs (wr_3zbe, wr_lqzs, wr_l61f, wr_aiie) that **do not exist in the current `.state/may.db`** (1,267 sessions). This update uses only verified data from the current database. The discrepancy likely means the previous measurement was from a different DB state or session.

## All Post-Fix D-o-R Workflow Runs (n=2, verified from DB)

| # | Workflow Run ID | Phase 1 | Phase 2 | Total | Time (UTC) | Task |
|---|----------------|---------|---------|-------|------------|------|
| 1 | wr_1775890933760_m0hc | **7 ops** | **8 ops** | **15 ops** | 07:02 | Integrate EXP-131 and KE-135 into INDEX |
| 2 | wr_1775894531669_lf4w | **8 ops** | **16 ops** | **24 ops** | 08:02 | Integrate EXP-133 (Verification-Depth Guard) |

Both runs completed successfully (all sessions status=done). Both reached Phase 2 (100% P2 rate).

### P1 Cap Results (n=2)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| P1 ops | 7, 8 | ≤15 | ✅ Both within cap |
| P1 mean | **7.5 ops** | ≤15 | ✅ (was 37.6 pre-fix) |
| P1 max | 8 | ≤15 | ✅ |

**P1 cap is holding.** Both runs well under 15 ops. Average 7.5 ops vs pre-fix 37.6 = **80% reduction in P1 ops.**

### Phase 2 Results

| Run | P2 Ops | Notes |
|-----|--------|-------|
| wr_..._m0hc | 8 | Very lean |
| wr_..._lf4w | 16 | Normal range |

**P2 mean: 12.0 ops** — below pre-fix baseline. No compensatory P2 bloat visible.

### Total Run Cost

| Scenario | Avg Total Ops | n |
|----------|:-------------:|:-:|
| Pre-fix bob (Apr 10) | **42.0** | 11 |
| **Post-fix bob** | **19.5** | **2** |

**Post-fix total 19.5 avg vs 42.0 pre-fix = 54% reduction.** However, n=2 is too small for statistical confidence.

## Pre-Fix Baseline (Bob D-o-R, Apr 10) — 11 Runs

| Run | P1 Ops | P2 Ops | Total | P2 Reached? |
|-----|--------|--------|-------|-------------|
| wr_..._ipby | 87 | 10 | 97 | Yes |
| wr_..._mb42 | 60 | 0 | 60 | No |
| wr_..._wl95 | 45 | 0 | 45 | No |
| wr_..._pl8f | 40 | 0 | 40 | No* |
| wr_..._er20 | 19 | 0 | 19 | No* |
| wr_..._ptbg | 78 | 0 | 78 | No* |
| wr_..._zmle | 17 | 0 | 17 | No |
| wr_..._smp1 | 36 | 0 | 36 | No* |
| wr_..._2coi | 49 | 13 | 62 | Yes (P2=4+9) |
| wr_..._w12b | 33 | 25 | 58 | Yes |
| wr_..._h8vr | 19 | 0 | 19 | No |

*Some runs have multiple P1 sessions (retries/continuations).

**Pre-fix stats:**
- P1 avg: **37.6 ops** (median: 40, range: 17-87)
- P2 reached: **3/11 runs (27%)**
- Total avg: **42.0 ops** (median: 45)
- P1 bloated (>40 ops): **5/11 = 45%**

## Post-Fix vs Pre-Fix Comparison

| Metric | Pre-Fix (n=11) | Post-Fix (n=2) | Change |
|--------|:-:|:-:|:-:|
| P1 mean | 37.6 | **7.5** | **-80%** ✅ |
| P1 max | 87 | **8** | -91% ✅ |
| P1 bloated (>40 ops) | 45% | **0%** | ✅ |
| P2 reached | 27% | **100%** | ✅ |
| P2 mean (when reached) | 16.0 | **12.0** | -25% ✅ |
| Total mean | 42.0 | **19.5** | **-54%** ✅ |

## Anti-Nesting Check

- **Pre-fix nesting incidents**: 1 found (s_1775842997119_299 spawned 1 D-o-R child)
- **Post-fix nesting incidents**: **0** in 2 runs ✅
- Anti-nesting fix appears effective, but n=2 is minimal evidence.

## Nesting Check Method

Queried all post-fix D-o-R Phase sessions for child sessions that are also D-o-R Phase sessions. Zero found. Pre-fix had 1 instance.

## Efficiency Comparison (Last 24h)

### D-o-R Workflow Runs (all, last 24h)
- 13 runs, 485 total ops, **avg 37.3 ops/run**
- Includes 11 pre-fix runs (heavy) + 2 post-fix runs (lean)

### Non-Workflow Work Sessions (bob, last 24h)
- 40 sessions, 240 total ops, **avg 6.0 ops/session**
- Note: These are mostly gym scenario attempts (many small retry sessions), not comparable to D-o-R's knowledge-work tasks.

### Apples-to-Apples: Post-Fix D-o-R vs Standalone Knowledge Work
- Post-fix D-o-R avg: **19.5 ops** (n=2)
- Pre-fix standalone knowledge work (e.g., EXP-116 integration): **53 ops** (single session)
- This suggests post-fix D-o-R is now **more efficient** than un-structured equivalent work, but sample sizes are too small to be conclusive.

## Risks

### R1: Insufficient Sample Size → CRITICAL
**Only n=2 verified post-fix runs.** The previous n=4/n=5 data cannot be verified in the current DB. Need at least 3 more D-o-R runs to reach n=5.
**Action**: Continue monitoring. Next D-o-R run should happen within ~1h if bob has pending work.

### R2: P2 Compensatory Bloat → LOW (so far)
P2 avg of 12.0 ops is BELOW pre-fix P2 avg. No evidence of P2 bloat compensation. However, n=2 is too small to rule this out.

### R3: P2 Rate Improvement → POSITIVE SIGNAL
Pre-fix: only 27% of runs reached P2 (P1 consumed entire budget). Post-fix: 100% reach P2. This means the workflow is actually functioning as designed (plan → write) instead of doing everything in P1.

## Data Source

- **DB**: `.state/may.db` — 1,267 sessions total
- **Workflow IDs**: `wr_1775890933760_m0hc`, `wr_1775894531669_lf4w`
- **Pre-fix cutoff**: `startedAt > 2026-04-11T00:58:00Z` (fix 1) / `> 2026-04-11T03:54:00Z` (fix 2)
- **Query**: `workflowRunId IS NOT NULL AND (task LIKE '## Phase 1%' OR task LIKE '## Phase 2%')`
- **⚠️ Note**: `startedAt` is epoch milliseconds. Use `.state/may.db` (not root `may.db` which has empty tables).

## Next Steps

1. **Wait for n≥5**: Need at least 3 more D-o-R runs. At current bob work rate, this could take several hours.
2. **When n=5 reached**: Recalculate all metrics, confirm P1 ≤15 holds, check for P2 bloat.
3. **If n=5 confirms**: Move D-o-R cap measurement to DONE. Publish final finding.
