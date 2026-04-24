# EXP-178: Difficulty-Adaptive Content-First Guard Pilot — Results

## Status: IN PROGRESS (49/120 real runs completed)

## Design
- **Arms:** G1 (no-guard baseline), G2 (production-mode uniform), G3 (passive-injection uniform), G4 (adaptive: G2 on medium, G3 on hard)
- **Scenarios:** sql-injection (medium), cascading-fix-trap (hard)
- **Trials:** 15 per cell, 120 total
- **Data source:** `runs-real.jsonl` (49 runs with real agent invocations)

> ⚠️ **Note:** `runs.jsonl` contains 120 synthetic/stub runs (agent_status: "error", ~200ms duration) from before gym was properly wired. Those results are INVALID — all analysis below uses `runs-real.jsonl` only.

## Results So Far (2026-04-24)

| Arm | sql-injection (medium) | cascading (hard) |
|-----|----------------------|-----------------|
| **G1** (baseline) | 4/10 (40%) | 0/8 (0%) |
| **G2** (production-mode) | 3/5 (60%) | 0/5 (0%) |
| **G3** (passive-injection) | 5/5 (100%) | 2/8 (25%) |
| **G4** (adaptive) | 3/3 (100%) | 1/5 (20%) |

### Remaining runs needed per cell

| Arm | sql-injection | cascading |
|-----|-------------|-----------|
| G1 | 5 | 7 |
| G2 | 10 | 10 |
| G3 | 10 | 7 |
| G4 | 12 | 10 |

**Total remaining: 71 runs (~$5-7)**

## Preliminary Analysis

### 1. Content injection delivers massive lift on medium tasks
G3/G4 on sql-injection: **100%** vs G1 baseline **40%** = **+60pp** lift. This exceeds the pre-registered +15pp threshold by 4×. The passive-injection content (expert analysis identifying the SQL injection vulnerability) transforms a 40% recognition task into a trivially-solved one.

### 2. Production-mode shows modest benefit on medium tasks
G2 on sql-injection: **60%** vs G1 **40%** = **+20pp**. The production-mode guard (requiring ANALYSIS.md) focuses the agent's attention, catching some injections that the unguided agent misses. But far less effective than direct content injection.

### 3. Hard task remains mostly unsolved even with content
G3 cascading: **25%**, G4 cascading: **20%** — much lower than predicted 85-100%. The cascading-fix-trap-v2 scenario appears harder than EXP-166 suggested, or the expert content is insufficient for this version. G1/G2 at 0% confirms no-content approaches can't solve it.

### 4. Adaptive ≈ best-of-both (early signal)
G4 matches G3 on sql-injection (100%) and is within noise of G3 on cascading (20% vs 25%). The adaptive routing rule appears to correctly select the right strategy per difficulty level.

## Pre-registered Decision Rules Check (PRELIMINARY)

| Rule | Criterion | Status |
|------|-----------|--------|
| **R1** | G4 cascading ≥ 70% AND G4−G2 cascading ≥ 60pp | ❌ FAILING (20% < 70%) |
| **R2** | G4 sql ≥ 50% AND G4−G1 sql ≥ 15pp | ✅ PASSING (100% ≥ 50%, +60pp ≥ 15pp) |
| **R3** | G4−G3 sql within ±10pp | ✅ PASSING (0pp difference) |

If R1 continues failing at N=15, the experiment **FALSIFIES** the "adaptive is strictly dominant" hypothesis — the content injection doesn't rescue hard tasks as reliably as predicted. However, the G3/G4 > G1/G2 signal on hard tasks (20-25% vs 0%) still shows directional value.

## Next Steps
1. Complete remaining 71 runs to reach N=15 per cell
2. If G3/G4 cascading stabilize at 20-25%, investigate which specific check fails
3. Consider whether cascading-fix-trap-v2 has drifted from v1 baseline used in EXP-166

## Data
- Real trial data: `runs-real.jsonl` (49 entries, ongoing)
- Synthetic/invalid data: `runs.jsonl` (120 entries, IGNORE)
- Arm configs: `arm-configs.json`
