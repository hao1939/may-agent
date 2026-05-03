# EXP-585: Deliverable Completeness Verification Skill

## Problem
Agents complete 57% of checks (4/7) on `incomplete-deliverables-trap` scenario. They handle self-contained deliverables but miss ones requiring cross-file reads. This mirrors production failures where agents complete primary tasks but skip secondary requirements.

## Builds On
- **EXP-555** (PARTIALLY POSITIVE): Text checklist helped awareness gaps (+5pp overall, +67pp on cross-file checks) but didn't reach 30pp target
- **EXP-560** (POSITIVE): Threat-framed gates work for priority-gap behaviors (+100pp)
- **KE-480**: Text nudges dead for verification, but threat framing works for priority

## Hypothesis
A **threat-framed deliverable verification gate** (explicit "session REJECTED if any listed deliverable is missing") combined with a **brief-extraction step** will raise pass rate from 57% (4/7) to ≥86% (6/7).

## Treatment Design
Inject into task prompt (scenario variant):
```
⚠️ COMPLETENESS GATE: Your session will be REJECTED if ANY deliverable from the brief is missing.

BEFORE calling finish():
1. Re-read the brief
2. List every deliverable mentioned
3. Confirm each one exists with correct content
4. Only then call finish()

This gate is enforced. Partial completion = failure.
```

## Method
- **Scenario**: `incomplete-deliverables-trap-exp585-threatgate` (clone with treatment injection)
- **Baseline**: 2 existing runs at 4/7 (57%)
- **Treatment**: 3 trials with threat-framed completeness gate
- **Target**: ≥6/7 checks pass (≥86%) in ≥2/3 treatment trials
- **Success criterion**: +29pp or more on average checks passed

## Metrics
- Primary: checks_passed / checks_total
- Secondary: Which specific checks fail? (expect B1/B2 improvements)

## Expected Outcome
Based on EXP-560 and EXP-565 patterns, threat framing should force the agent to re-read the brief before finishing, catching the cross-file deliverables it would otherwise skip.

## Risk
- Scenario may be partially ability-bound (agent can't find supporting-data.md)
- Threat framing may increase tool calls, failing E1 (≤20 ops)

## Status: READY TO RUN
Next step: Create scenario variant and run 3 baseline + 3 treatment trials.
