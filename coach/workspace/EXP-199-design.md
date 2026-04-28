# EXP-199: Workflow-Enforced Pipeline Swap Discovery

**Date**: 2026-06-22
**Status**: CLOSED — superseded by EXP-256 (step-start primer proven at 84.2%). Workflow enforcement approach validated via different experiment.
**Predecessor**: EXP-198 (procedural skill 0%), EXP-195 (direct hint 40%)
**Hypothesis**: H-181 (Relational Bug Blindness)
**Pattern**: EXP-015 (workflow enforcement 0%→100% on npx avoidance)

---

## Research Question

Can a **two-phase workflow** that forces the agent to mechanically swap each adjacent pipeline step and observe test results break through the relational bug blindness that defeated both declarative (EXP-195: 0%) and procedural (EXP-198: 0%) interventions?

## Background

The intervention hierarchy for relational bugs:
- Generic declarative skill: **0%** (EXP-195)
- Procedural discovery method: **0%** (EXP-198) — agent doesn't execute procedures
- Direct hint (near-explicit): **40%** (EXP-195)
- Full fix provided: ~100%

Key insight from EXP-015 (npx avoidance): text instructions fail but workflow enforcement succeeds because the workflow **forces the action** rather than instructing the agent to do it. The gym runner supports multi-phase via `---` delimiter in task.md.

## Hypothesis

**H-199**: A two-phase workflow (Phase 1: forced swap audit, Phase 2: fix using audit) will raise cascading-fix-trap-v2 pass rate to ≥30% (from 0% baseline).

**Mechanism**: Phase 1 forces the agent to physically swap each adjacent step pair and run tests. This produces empirical evidence (SWAP_AUDIT.md) showing that swapping normalize↔applyPenalties increases test passes. Phase 2 reads that evidence and applies the helpful swaps.

**Key difference from EXP-198**: EXP-198 told the agent "swap steps and check." This workflow *makes* the agent do it by structuring it as a required Phase 1 deliverable (SWAP_AUDIT.md).

## Design

### Scenario

`cascading-fix-trap-v2-exp199-swap` — identical environment to cascading-fix-trap-v2, but task.md has two phases separated by `---`:

**Phase 1** (PIPELINE ORDERING AUDIT): For each adjacent pair of pipeline steps, swap, run tests, record results in SWAP_AUDIT.md. No permanent fixes.

**Phase 2** (FIX BUGS): Read SWAP_AUDIT.md, apply helpful swaps permanently, fix remaining bugs.

### Arms

| Arm | Scenario | N | Notes |
|-----|----------|---|-------|
| A (baseline) | cascading-fix-trap-v2 | 10 | Re-use existing data (0/130) |
| B (workflow) | cascading-fix-trap-v2-exp199-swap | 10 | Two-phase swap audit |

### Metrics

- Primary: overall pass rate (all 9 checks)
- Secondary: `pipeline-order-fixed` check specifically (the 0/130 bottleneck)
- Tertiary: whether SWAP_AUDIT.md exists and contains meaningful swap data

### Decision Rule

- **H-199 confirmed**: Arm B ≥ 30% AND `pipeline-order-fixed` passes in ≥3/10 runs
- **H-199 falsified**: Arm B ≤ 10% (baseline noise)
- If confirmed: write KE, promote workflow pattern for relational bug discovery
- If falsified: relational bug blindness is truly a model capability gap — close research line

## Cost

~$5 (10 treatment runs × ~$0.50)

## Files

- Scenario: `agents/gym/scenarios/cascading-fix-trap-v2-exp199-swap/`
- Design: `agents/coach/workspace/EXP-199-design.md` (this file)

## Execution

```bash
agents/test/gym/run-gym.sh cascading-fix-trap-v2-exp199-swap --agent coder  # ×10
```

Requires `GYM_AGENT_BIN` to be set for live agent execution.
