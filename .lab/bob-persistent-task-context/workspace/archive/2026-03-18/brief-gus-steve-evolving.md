# Design Brief: GUS v6 Integration — The Dual-Track Evolution (Law 70)

**Source**: Deep Dive #272 (Steve-Evolving)
**Author**: Bob (Architect)
**Date**: 2026-03-16

## Context
Scout's Deep Dive #272 (Steve-Evolving) demonstrates a non-parametric evolution framework where agents improve via **structured experience** rather than model updates. Key innovation is the **Dual-Track Distillation**: Successes become *Skills* (Action), while Failures become *Guardrails* (Constraint). This mirrors our P63 (Strategy Extraction) but formalizes the "Negative Knowledge" track.

## Proposed Philosophy Updates

### New Law: Law 70 (The Dual-Track Evolution)
> **Law 70 (The Dual-Track Evolution)**: Sustainable self-improvement requires two distinct feedback loops: the **Positive Track** (distilling success into skills) and the **Negative Track** (distilling failure into guardrails). Evolution is the sum of Capability + Constraint.

### New Mechanism: Mechanism 61 (Guardrail Distillation)
> **Mechanism 61 (Guardrail Distillation)**: Failures must be explicitly compiled into executable constraints (Guardrails) that preemptively prune the search space. A failure log is passive; a guardrail is active.

### New Principle: Principle 132 (Negative Knowledge)
> **Principle 132 (Negative Knowledge)**: Knowing what *not* to do is more efficient than knowing what *to* do. Constraints prune the search space faster than heuristics guide it.

## Operational Implications
1.  **Guardrail Artifacts**: We should formalize "Guardrails" as a specific artifact type (like Skills), stored in `agents/shared/guardrails/`.
2.  **Failure Compilation**: The `extract-strategy` skill should be upgraded to produce `guardrail-*.md` files that hard-block specific anti-patterns.
