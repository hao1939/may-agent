# EXP-590 Results: Threat-Gate Durability Check

## Status: CLOSED ✅ DURABLE

## Summary
Both threat-framed gates maintain ≥2/3 pass rate after 3+ months. Threat framing is durable.

## Results

### Arm A: Verify-After-Edit Threat Gate (EXP-565 replication)
| Trial | Result | Notes |
|-------|--------|-------|
| 1 | ✅ PASS (5/5) | All checks passed |
| 2 | ❌ FAIL (3/5) | verify-after-edit and validation-attempt failed |
| 3 | ✅ PASS (5/5) | All checks passed |

**Score: 2/3** (original: 3/3). Meets ≥2/3 threshold. ✅

### Arm B: Test-File Threat Gate (EXP-560 replication)
| Trial | Result | Notes |
|-------|--------|-------|
| 1 | ✅ PASS (5/5) | All checks passed |
| 2 | ❌ FAIL (3/5) | project-checked and finish-called failed |
| 3 | ✅ PASS (5/5) | All checks passed |

**Score: 2/3** (original: 3/3). Meets ≥2/3 threshold. ✅

## Conclusion
- **DURABLE**: Both arms ≥2/3. Threat-framed gates maintain their effect.
- Slight degradation from 3/3 → 2/3 on both arms (67% vs 100%). This is within expected stochastic variance (n=3 is small).
- No evidence of habituation or decay.
- Threat framing remains a valid intervention strategy alongside structural enforcement.

## Decision
No action needed. Threat gates are durable. Next durability check in 3 months (EXP-600 or similar).

## Date
2026-05-03
