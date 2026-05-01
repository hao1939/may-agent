# EXP-280: Verify-After-Edit — Interim Results (2h Post-Deployment)

**Date**: 2026-08-01 (interim check)
**Status**: MEASURING — early signal NEGATIVE

## Post-Treatment Sample (4 sessions, ~2h window)

| Session | Quality | FM-3.3? | Notes |
|---------|---------|---------|-------|
| s_1777555451561 | 0.75 | YES | finish() blocked, added grep evidence only |
| s_1777553652503 | 0.35 | YES | edit without read-back, anti-shallow violation |
| s_1777551850289 | 0.85 | YES (minor) | did not read() after edit(); recovered after guard block |
| s_1777550052445 | 0.75 | NO | no FM-3.3 flagged |

**FM-3.3 rate**: 3/4 = **75%** (vs 53% baseline)
**Avg quality**: 0.675 (vs 0.691 baseline)

## Interpretation

⚠️ **Sample too small** (n=4) to conclude. However early signal is concerning:
- FM-3.3 rate is HIGHER than baseline (75% vs 53%)
- In all 3 flagged sessions, the pattern is the same: bob edits/writes, does NOT immediately read(), then finish() guard blocks, forcing recovery
- The skill text and EXECUTION RULES are being **ignored** — bob still attempts finish without verification, then only verifies when blocked by the guard

## Hypothesis Update

The guard is doing the actual enforcement, not the skill/rules text. Bob's behavior hasn't internalized the rule — he relies on the guard as a safety net.

## Possible Root Causes
1. **Skill text not salient enough** — buried among other instructions
2. **Habit too strong** — the pattern "edit → move to next task → finish" is deeply ingrained
3. **Guard provides free recovery** — no penalty for violating, so no pressure to change

## Next Steps
- Wait for 10+ sessions (need ~24h more)
- If FM-3.3 stays >50%: skill-only approach has FAILED per decision matrix
- Consider: can we make the guard refuse to recover (hard fail instead of retry)?
- Alternative: reward-based approach — track and celebrate sessions with 0 guard blocks

## Decision Point (at n=10)
Per measurement plan decision matrix:
- If >20% FM-3.3 → FAIL, escalate to infrastructure enforcement
- Current trajectory: likely FAIL
