# Cross-Reference: Harness Engineering × Intra-Phase Boundary Analysis

**Date**: 2026-04-03
**Author**: Bob (Architect)
**Sources**: HB-250403-agent-harness-framework, HB-250403-deerflow-stategraph-evolution, HB-250405-harness-engineering-matters, Intra-Phase Boundary Analysis, SYNTH-001

---

## The Convergence

Three independent sources confirm the same insight from different angles:

| Source | Key Claim | Our Mapping |
|--------|-----------|-------------|
| **Harness Engineering Post** (HB-250405) | Same model (Claude 4.5), different harness: 42% → 78%. "Harness > Model for quality" | Matches KE-007: workflows (harness structure) are the only reliable behavioral intervention |
| **Agent Harness Framework** (HB-250403) | Agent = Model + Harness. Six-layer Harness architecture: System Prompt → Context → Memory → Planning → Action → Post-Processing | Maps directly to our L1-L7 intervention hierarchy |
| **DeerFlow Evolution** (HB-250403) | StateGraph → message-driven migration. "State graphs too expensive to maintain for complex workflows" | Confirms our finding that micro-phases (L3) have diminishing returns — finer granularity hits overhead limits |

## The Harness Layers Map to Our Intervention Hierarchy

The HB-250403 Harness Framework defines six layers. Our Intra-Phase Boundary Analysis defines seven intervention levels. They align precisely:

| Harness Layer | Function | Our Level | Proven? |
|------|----------|-----------|---------|
| Post-Processing | Verify outputs, retry on failure | L6: Post-Hoc Loop | Partial |
| Action Control | Constrain available tools/actions | L1: Action Removal | YES |
| Planning | Decompose tasks, set phases | L2: Phase Boundary | YES |
| Memory | Persistent context across sessions | (cross-session, separate) | — |
| Context Injection | Dynamic context during execution | L5: Process Monitoring | UNTESTED |
| System Prompt | Base instructions, behavioral framing | L7: Text Instruction | NO (KE-002) |

**Critical observation**: The harness engineering community treats ALL six layers as equally important. Our experimental evidence shows they are NOT equal:

- **L1-L2 (Action + Planning)**: Proven, high effect sizes (0%→100% in EXP-013/015)
- **L5-L6 (Context + Post-Processing)**: Promising but untested in our system
- **L7 (System Prompt/Instructions)**: Dead end for behavioral change (KE-002, KE-006, KE-009)

The "42% → 78%" improvement likely comes from the Planning and Action layers (structural changes), NOT from better system prompts. The harness engineering narrative obscures which layers are actually load-bearing.

## DeerFlow Validates Our Granularity Limit

DeerFlow's migration from StateGraph to message-driven architecture is empirical evidence for our EXP-016 finding:

**Our finding**: Micro-phases (L3) have diminishing returns. Splitting phases too finely fragments context and adds overhead. `materialize-intermediate-findings` regressed by 11% with a multi-phase workflow.

**DeerFlow's finding**: State graphs (= fine-grained phase control) are "too expensive to maintain for complex workflows." Migration to message-driven (= event-based, looser coupling) improved their system.

Both point to the same principle: **There exists an optimal phase granularity below which additional structure hurts.** This is SYNTH-001's core prediction — workflow benefit follows an inverted U-shape with respect to structural enforcement:

```
Quality
  ↑
  │    ╱‾‾‾‾╲
  │   ╱      ╲
  │  ╱        ╲
  │ ╱          ╲
  │╱            ╲
  └───────────────→ Structure (# of phase boundaries)
  none  optimal  excessive
```

DeerFlow was on the right side of the curve (excessive structure for their task complexity). Their migration moved them toward the optimum.

## New Insight: The Harness Architecture Has Two Zones

Combining the harness framework with our experimental evidence reveals a dichotomy:

### Zone 1: Structural Harness (Proven)
- Action constraints (L1): Remove bad tools/paths
- Phase boundaries (L2): Force assessment-before-action, verification gates
- Works by **eliminating** decisions from the action space
- Effect sizes: 20-100pp (dramatic)
- Maps to high-R decisions (KE-015)

### Zone 2: Contextual Harness (Frontier)
- Environmental nudges (L4): Pre-created templates, defaults
- Process monitoring (L5): Auto-injection during execution
- Post-hoc repair (L6): Verify and redo
- Works by **shifting probability** of remaining decisions
- Expected effect sizes: 5-30pp (moderate)
- Maps to low-R decisions within phases

The harness engineering community doesn't distinguish these zones. They should. The design principles are different:

- **Zone 1 design question**: What can I REMOVE from the action space?
- **Zone 2 design question**: How can I make the desired action the EASIEST path?

This is the key contribution: **the harness engineering "42% → 78%" improvement is Zone 1 work.** Getting from 78% to 90%+ requires Zone 2 work, which is harder and has smaller effect sizes.

## Implications for EXP-017/018/019

Our proposed experiments map directly to Zone 2 exploration:

| Experiment | Zone 2 Mechanism | What We Learn |
|-----------|-----------------|---------------|
| EXP-017 (Environmental Nudge) | L4: Change defaults | Does path-of-least-resistance work? |
| EXP-018 (Auto-Injection) | L5: Process monitoring | Does mid-execution context shift help? |
| EXP-019 (Verify + Redo) | L6: Post-hoc repair | Does forcing redo change tool choice? |

These three experiments will map the Zone 2 frontier. If all three show positive results:
- The harness engineering ceiling is HIGHER than between-phase control
- Our system can improve beyond the current workflow-driven plateau

If all three fail:
- Model capability is the only lever for within-phase quality
- Architecture investment should focus exclusively on Zone 1 (phase design)

## Connection to Skill-JIT and Memento-Skills

The Skill-JIT and Memento-Skills approaches are **Zone 2 mechanisms**:
- Skill-JIT generates contextual knowledge on-demand (L5: dynamic context)
- Memento-Skills stores learned behaviors as external notebooks (L4: environmental defaults)

Both attempt to influence within-phase behavior through context manipulation rather than structural constraint. Our theory predicts they will have moderate effects (+5-25pp) rather than dramatic ones (+50-100pp), because they operate in Zone 2.

This is testable: if Skill-JIT or Memento-Skills are implemented in our system, their effect size should be significantly smaller than workflow enforcement.

## Summary

The harness engineering literature confirms our structural framework but lacks the granularity to distinguish what works from what doesn't. Our experimental evidence adds the critical layer: **structural constraints (Zone 1) are proven; contextual nudges (Zone 2) are the frontier.** The next experiments (EXP-017/018/019) will determine whether Zone 2 is viable.

---

*Bob (Architect) | 2026-04-03*
