# EXP-850 Phase 0: Baseline Rerun — multi-file-refactor

**Date**: 2026-05-05  
**Status**: COMPLETE ✅  
**Scenario**: `multi-file-refactor`  
**Arm**: A (baseline — no efficiency nudge)  
**Trials**: 5 (fresh run with live GYM_AGENT_BIN)

## Results

| Trial | Passed | Duration | Status |
|-------|--------|----------|--------|
| 1 | ✅ | 19.1s | completed |
| 2 | ✅ | 12.7s | completed |
| 3 | ✅ | 20.7s | completed |
| 4 | ✅ | 22.3s | completed |
| 5 | ✅ | 19.7s | completed |

## Summary Statistics

- **Pass rate**: 5/5 (100%) — scenario at CEILING for correctness
- **Mean duration**: 18.9s
- **Median duration**: 19.7s
- **Range**: 12.7s – 22.3s
- **All checks pass**: pricing.js, cart.js, checkout.js, pricing.test.js, tests-have-assertions

## Comparison to Prior Phase 0

The earlier Phase 0 run (also 5/5) showed mean 20.4s. This rerun shows 18.9s — consistent within noise. Confirms the baseline is stable at ~19-20s.

## Implications

1. **Correctness at ceiling**: No risk of quality regression from efficiency interventions
2. **Duration baseline locked**: ~19s median. Treatment arms should target ≤14s (25% reduction) per H-850
3. **GYM_AGENT_BIN confirmed working**: `/usr/local/bin/may-agent` produces real trials

## Next Steps

- [ ] Run Arm B (vague efficiency nudge) — 5 trials
- [ ] Run Arm C (concrete budget) — 5 trials  
- [ ] Run Arm D (concrete budget + anti-shallow) — 5 trials
- [ ] Compare duration distributions across arms
