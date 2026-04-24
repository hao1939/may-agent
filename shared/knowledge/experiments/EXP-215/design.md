# EXP-215: Belief Externalization Before Verification

**Date**: 2026-04-24
**Status**: DESIGNED
**Predecessor**: EXP-099 (FM-3.3 verification gravity wells at 20.3%)
**Hypothesis**: H-072 (Belief-State Externalization)

---

## Research Question

Does forcing agents to externalize their beliefs before verification steps reduce verification gravity-well errors (FM-3.3)?

## Hypothesis

- **H-215a**: Adding a belief-externalization prompt ("state what you believe is true, what you're uncertain about, what would change your mind") before verification reduces FM-3.3 gravity-well rate by ≥50% (from ~20% to ≤10%).
- **H-215-null**: Belief externalization adds tokens but doesn't change verification behavior — agents still fall into gravity wells at the same rate.

## Background

FM-3.3 verification gravity wells account for 20.3% of errors (EXP-099). Agents commit to a belief about system state and then interpret all subsequent evidence to confirm it. Forced externalization (H-085, P=0.87) is a proven mechanism — but has only been tested for frustration/topology scenarios, not verification.

This connects to H-085 (forced externalization as general mechanism) and extends it to a new domain.

## Design

### Intervention

Add to `buildReviewPrompt()` in project.ts, after existing stall-detection and pre-check rules:

```
Before verifying any deliverable, state in 3 bullets:
1. What you believe is true about the current state
2. What you're uncertain about  
3. What evidence would change your mind
```

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline (current reviewer prompt) | 10 project iterations | Historical data acceptable |
| B   | belief-externalization injection | 10 project iterations | Production measurement |

### Metrics

- **Primary**: FM-3.3 gravity-well rate (% of review sessions showing confirmation-seeking behavior)
- **Secondary**: Review quality score, false-negative rate (missed real issues)

### Decision Rule

- **Confirmed** if: FM-3.3 rate drops ≥50% (from ~20% to ≤10%) with no increase in false-negatives
- **Falsified** if: FM-3.3 rate unchanged or false-negative rate increases >5pp

## Execution

### Phase 1: Baseline (no work needed)
Count FM-3.3 occurrences in last 10 reviewer sessions from evaluator data.

### Phase 2: Deploy intervention
Patch `buildReviewPrompt()` with the 3-bullet externalization prompt.

### Phase 3: Measure
After 10 project iterations post-patch, count FM-3.3 occurrences and compare.

### Cost
- Prompt change only: ~50 extra tokens per reviewer session
- No gym scenarios needed — production measurement
- Total cost: ~$0 (prompt-only intervention)
