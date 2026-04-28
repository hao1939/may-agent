# EXP-247: Multi-Agent Structural Auditor for Relational Bug Detection

**Date**: 2026-04-28
**Status**: DESIGNED
**Predecessor**: EXP-199 (tool-assisted relational discovery — FAILED), EXP-195 (direct hint +30pp)
**Hypothesis**: H-181 (Relational Bug Blindness)

---

## Research Question

Does a separate auditor agent that checks relational/ordering properties improve detection of relational bugs?

## Background

EXP-177/195/199 established that single-agent interventions (hints, skills, tools) cannot fix relational bug blindness. The agent always finds value bugs but never ordering bugs. Only telling the agent WHERE the bug is helps (+30pp). This suggests the bottleneck is **discovery**, not fixing.

**Architectural hypothesis**: A separate agent whose SOLE job is checking structural/relational properties (ordering, sequencing, dependency chains) — NOT fixing anything — can discover relational bugs and feed findings to the primary agent, achieving similar gains to the "direct hint" arm without human intervention.

## Hypothesis

- **H-247a**: A two-phase workflow (auditor discovers → primary fixes) achieves ≥30pp improvement over single-agent baseline on cascading-fix-trap-v2 (from ~10% to ≥40%)
- **H-247b**: The auditor agent correctly identifies the ordering bug in ≥60% of runs (even if the primary agent fails to act on it)
- **H-247-null**: Multi-agent architecture provides no benefit (<10pp over baseline) because the auditor has the same relational blindness

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | Baseline (single agent, no hints) | 10 | Expected ~10% (from EXP-177) |
| B   | Two-phase: Auditor → Primary | 10 | Auditor checks ordering/sequencing only |
| C   | Auditor-only (measure auditor accuracy) | 10 | Does auditor find the bug? |

### Scenario

- **cascading-fix-trap-v2** — has known relational bug (pipeline ordering) that single agents consistently miss

### Auditor Agent Design

The auditor agent receives:
1. The codebase (same as primary)
2. A focused prompt: "Your job is to check ONLY structural/relational properties: ordering of operations, sequencing of pipeline stages, dependency relationships. List any ordering bugs you find. Do NOT fix anything."
3. No knowledge of what the value bugs are

The auditor's output (list of suspected ordering issues) is injected into the primary agent's context as a "structural audit report" before the primary begins fixing.

### Metrics

- Primary: Pass rate on `pipeline-order-fixed` check (the relational bug check)
- Secondary: Overall scenario pass rate (all checks), auditor accuracy (true positive rate)

### Decision Rule

- H-247a confirmed if: Arm B ≥ 40% on pipeline-order-fixed (≥30pp over Arm A)
- H-247b confirmed if: Arm C ≥ 60% correctly identifies the ordering bug
- H-247-null if: Arm B < 20% AND Arm C < 30% (auditor also blind)

### Cost Estimate

- 30 runs × ~$0.50 = ~$15
- Plus auditor runs (shorter, ~$0.20 each) = ~$2
- Total: ~$17

## Execution

```bash
# Phase 1: Baseline
# scripts/gym-run.sh cascading-fix-trap-v2 --agent coder --tag EXP-247-A --n 10

# Phase 2: Auditor-only (measure accuracy)  
# scripts/gym-run.sh cascading-fix-trap-v2 --agent auditor --tag EXP-247-C --n 10

# Phase 3: Two-phase (auditor → primary)
# scripts/gym-run.sh cascading-fix-trap-v2 --agent coder --pre-phase auditor --tag EXP-247-B --n 10
```

## Implementation Notes

1. Need to create an auditor agent prompt focused purely on relational/structural checking
2. Need a mechanism to inject auditor output into primary agent's initial context
3. May need a custom gym runner or wrapper that chains two agent runs
4. This connects to the blocked EXP-245b (Separate Auditor Agent) in bob's todo — this IS that experiment, now properly designed

## Connection to System Architecture

If this works, it validates the principle that **cognitive specialization** (separate agents for separate cognitive tasks) can overcome single-agent blind spots. This would inform:
- H-055 (self-improvement paradox): separation as mitigation
- Agent architecture: when to split vs. instruct
- The broader question of multi-agent coordination value
