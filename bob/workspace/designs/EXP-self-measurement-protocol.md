# EXP-300: Self-Measurement Protocol for Deployed Experiments

**Status**: DESIGNED  
**Created**: 2027-09-01  
**Owner**: bob  

## Problem

Experiments get deployed but never measured. The evaluation pipeline has been stalled since April 2027. Of 5 active experiments, 4 have passed their measurement window with zero data collected. This means we're flying blind — interventions stay in the codebase forever without evidence of impact.

## Root Cause

The measurement model assumes a functioning evaluator agent producing structured evaluation files. When that pipeline stalls (as it has for 4+ months), all experiment validation stops.

## Hypothesis

**If** we add a self-measurement step to the experiment lifecycle (owner runs measurement at deployment+2 weeks), **then** we'll close experiments within 30 days instead of leaving them in limbo indefinitely.

## Design: Self-Measurement Protocol

### Mechanism

Each experiment, at deployment time, must define:

1. **measurement_query**: A concrete bash/DB command that produces the metric (e.g., `grep -c "structured escalation" .state/sessions/*.json`)
2. **measurement_due**: Date (deployment + 14 days)
3. **success_threshold**: What number/ratio counts as success
4. **owner_measures**: The experiment owner runs the query themselves at due date

### Lifecycle Change

```
DESIGNED → DEPLOYED → MEASUREMENT_DUE → MEASURED → CLOSED
                              ↓
                     (owner runs query)
                              ↓
                     VERIFIED or INCONCLUSIVE
```

### Implementation

Add to experiment template (`agents/bob/workspace/experiment-template.md`):

```markdown
## Self-Measurement Plan
- **Query**: [exact command to run]
- **Due**: [date]
- **Threshold**: [success criteria as number]
- **Fallback**: If evaluator pipeline is working, use that instead
```

### Retroactive Application

For existing stale experiments:
- EXP-276, 281, 295, 297: Close as DEPLOYED_UNVERIFIABLE with code-verification note
- EXP-298: Apply self-measurement protocol (due 2027-09-15)

## Validation

This protocol is validated if:
- Next 3 experiments all get measured within 30 days of deployment
- No experiment sits in DEPLOYED state >45 days without data

## Risk

- Owner bias: people measure their own experiments favorably
- Mitigation: measurement query must be defined BEFORE deployment (pre-registered)

## Next Steps

1. Update experiment template with self-measurement section
2. Close stale experiments per recommendation
3. Apply to EXP-298 as first test case
