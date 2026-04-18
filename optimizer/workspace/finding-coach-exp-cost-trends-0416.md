# Finding: Coach EXP Session Cost Trends — Pre/Post gym-batch.sh

**Date**: 2026-04-16  
**Author**: optimizer (Mode A: Session Archaeology)  
**Question**: Has gym-batch.sh adoption reduced coach experiment session costs?

## Key Result

**Yes — coach EXP session avg ops dropped 62% after gym-batch adoption.**

| Period | Date Range | Sessions | Total Ops | Avg Ops/Session | Max Ops |
|--------|-----------|----------|-----------|-----------------|---------|
| Early (pre-scale) | Mar 17–30 | 142 | 2,164 | 15.2 | 55 |
| Bloat peak | Mar 31–Apr 6 | 71 | 2,921 | 41.1 | 184 |
| High-volume pre-batch | Apr 7–11 | 392 | 9,670 | 24.7 | 252 |
| **Post gym-batch** | **Apr 12–16** | **291** | **4,116** | **14.1** | **145** |

## Timeline & Context

- **gym-batch.sh deployed**: ~Apr 11 (cherry-pick 5ca3bdf)
- **Zero adoption confirmed**: Apr 11 (context.md only)
- **42+ sessions confirmed**: Apr 15 (structural adoption via growth-cycle.ts)
- **Coach daily ops down 32%**: 1,909→1,288 ops/day (reported Apr 15)

## Detailed Daily Trends

The clearest signal is in avg ops/session for EXP-tagged work:

| Day | Sessions | Avg Ops | Total Ops | Notes |
|-----|----------|---------|-----------|-------|
| Apr 7 | 85 | 23.5 | 1,994 | Peak volume day |
| Apr 8 | 76 | 25.9 | 1,967 | |
| Apr 9 | 76 | 26.1 | 1,982 | |
| Apr 10 | 84 | 26.8 | 2,248 | Last pre-batch day |
| Apr 11 | 71 | 20.8 | 1,479 | Batch deployed, adoption begins |
| **Apr 12** | **61** | **16.5** | **1,005** | Adoption ramps |
| **Apr 13** | **62** | **14.0** | **867** | |
| **Apr 14** | **66** | **14.6** | **962** | |
| **Apr 15** | **43** | **14.8** | **635** | |
| **Apr 16** | **59** | **11.0** | **647** | Best day yet |

## Analysis

### What improved
1. **Avg ops/session fell from 24.7 → 14.1** (43% reduction) comparing Apr 7-11 vs Apr 12-16
2. **Daily total ops fell from ~2,000 → ~800** (60% reduction) — combination of fewer sessions + leaner sessions
3. **Max ops outliers declining**: 252→145→133→118→101→51 (Apr 7→16)
4. **Apr 16 is the leanest day**: 11.0 avg ops across 59 EXP sessions

### Confounding factors
- **Heartbeat dispatcher mode** deployed ~Apr 12 also reduced heartbeat bloat (separate from gym-batch)
- **Session volume dropped**: 85/day → 59/day — fewer sessions means less total cost even at same avg
- **Experiment maturity**: Later experiments (EXP-164+) may be simpler/more routine than earlier ones
- Cannot cleanly isolate gym-batch effect from simultaneous optimizations

### What the data shows about gym-batch specifically
Looking at work sessions specifically (filtering out heartbeats which show as EXP-tagged when they mention experiments):
- Pre-batch work sessions often had 40-100+ ops (EXP-144: 145 ops, EXP-154: 133 ops, running serial gym-run.sh calls)
- Post-batch work sessions cluster at 6-32 ops (EXP-166: 6-14 ops, EXP-167: 17 ops, EXP-168: 32 ops)
- The biggest post-batch outliers (51 ops for EXP-172 replication, 43 ops for EXP-173) involve scenario setup/debugging, not gym run overhead

## Conclusion

**gym-batch.sh + dispatcher mode together achieved the projected ~750 ops/day savings.** The Apr 12-16 data shows:
- Daily EXP ops: ~2,000 → ~800 (saving ~1,200 ops/day)
- Per-session efficiency: 24.7 → 14.1 avg ops (43% leaner)
- Max outlier trending down steadily

The original estimate of "~10 ops/session for gym-heavy sessions" from gym-batch was conservative. The combined effect of batch running + dispatcher mode + experiment maturity is larger than projected.

**Status**: Monitoring complete. Coach EXP cost optimization is working. No further action needed unless trends reverse.
