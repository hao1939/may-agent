# EXP-205: Multi-Agent Review for Relational Bug Discovery

**Date**: 2026-04-23
**Status**: DESIGNED
**Predecessor**: EXP-195, EXP-198, EXP-199, EXP-201, EXP-202 (all 0% on prompt-based approaches)
**Hypothesis**: H-181 (relational bug blindness)

---

## Research Question

Can a second-pass agent reviewing from a different frame discover relational bugs that single agents miss?

## Background

KE-357 established that prompt-based interventions are exhausted for cascading-fix-trap-v2 (7 interventions, 0/60+ trials). The only success was direct hints (40%). This experiment tests whether **architectural** intervention — adding a second agent pass — can break through.

## Hypothesis

- **H-205a**: A second agent, given only the first agent's proposed fix (not the original task framing), will discover unfixed relational bugs at >20% rate because it evaluates the code without the "value bug" anchoring that blinds the first agent.
- **H-205b**: A "devil's advocate" prompt frame ("find what's STILL broken") will outperform a neutral review frame.
- **H-205-null**: Second-pass review produces 0% improvement — the blindness is model-level, not frame-dependent.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | Baseline (single agent) | 10 | Reuse EXP-195 Arm A data |
| B   | Two-pass: agent 1 fixes, agent 2 reviews with "what's still broken?" | 10 | New scenario variant |
| C   | Two-pass: agent 1 fixes, agent 2 reviews code diff only (no task context) | 10 | Tests de-anchoring |

### Scenario

- cascading-fix-trap-v2 (modified to support two-pass execution)

### Metrics

- Primary: pipeline-order-fixed rate per arm
- Secondary: total pass rate, whether agent 2 identifies the ordering bug even if it can't fix it

### Decision Rule

- Confirmed if: Arm B or C achieves ≥3/10 pipeline-order-fixed (>0% with p<0.05 vs baseline)
- Falsified if: Both arms score 0/10

## Implementation Notes

This requires a new gym scenario variant or a wrapper script that:
1. Runs agent 1 on the standard scenario
2. Captures agent 1's changes
3. Runs agent 2 with a review-focused prompt and agent 1's output
4. Applies agent 2's additional fixes

## Execution

```bash
# Needs scenario modification first — see implementation notes
# scripts/gym-run.sh cascading-fix-trap-v2-multiagent --agent amy --tag EXP-205
```
