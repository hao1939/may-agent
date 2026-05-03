# EXP-590: Threat-Gate Durability Check

## Problem
EXP-560 and EXP-565 proved threat-framed gates work (+100pp in gym). EXP-565 was deployed to production (master-worker.ts:454) on 2028-08-13. We don't know if:
1. The gate still fires correctly after months of deployment
2. Agents have "habituated" and now ignore the threat framing
3. The +100pp gym result translates to production behavior

This is the first durability test of threat-framing interventions specifically.

## Builds On
- **EXP-565** (POSITIVE): Threat-framed verify-after-edit gate — 0/3 → 3/3 (+100pp)
- **EXP-560** (POSITIVE): Threat-framed test-file gate — 0/3 → 3/3 (+100pp)
- **EXP-370/375** (NO REGRESSION): Prior durability checks on structural interventions (all held)
- **KE-480**: Text coaching dead, but threat framing works for priority-gap behaviors

## Hypothesis
Threat-framed gates maintain ≥80% of their original effect (+80pp or better) when re-measured 3+ months after initial validation. Specifically:
- EXP-565 scenario (verify-after-edit threat gate): ≥2/3 trials pass
- EXP-560 scenario (test-file threat gate): ≥2/3 trials pass

## Method
Re-run the SAME treatment scenarios from EXP-560 and EXP-565 with fresh gym trials:

### Arm A: Verify-After-Edit Threat Gate (EXP-565 replication)
- Scenario: `convention-verify-edit-exp565-threatgate`
- Trials: 3
- Original result: 3/3 (100%)
- Pass threshold: ≥2/3

### Arm B: Test-File Threat Gate (EXP-560 replication)
- Scenario: `output-format-compliance-exp560-testgate`
- Trials: 3
- Original result: 3/3 (100%)
- Pass threshold: ≥2/3

### Controls
- No new interventions added
- Same gym runner, same agent binary
- Compare directly to original trial results

## Success Criteria
- **DURABLE**: Both arms ≥2/3 → threat gates confirmed durable, no action needed
- **DEGRADED**: One arm <2/3 → threat framing habituates, need to investigate refresh strategies
- **FAILED**: Both arms <2/3 → threat framing is NOT durable, need structural replacement

## Metrics
- Primary: pass/fail per trial (same checks as original experiments)
- Secondary: which specific checks fail (are threat-gated behaviors still compliant?)

## Expected Outcome
Based on EXP-370/375 precedent (structural interventions held at 95% after 30 days), threat gates should also hold. However, threat framing relies on text priority-elevation which may decay differently than structural injection.

## Risk
- If gym agent binary has changed, results may reflect capability changes, not durability
- Scenario drift (if scenario files were modified post-experiment)

## Timeline
- Run Arm A: 3 trials (~15 min)
- Run Arm B: 3 trials (~15 min)
- Analysis: Compare to original results
- Total: 1 heartbeat

## Status: READY TO RUN
