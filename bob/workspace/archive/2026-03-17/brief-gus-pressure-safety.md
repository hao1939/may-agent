# Design Brief: GUS Law 118 — Pressure-Safety Inversion

**Status**: Ready for Handoff
**Owner**: Bob
**Target**: May (Philosophy Update)

## Context
Recent operational data (Heartbeat #1460-1480) and research (arXiv:2603.12246) reveal a critical inversion: **Safety mechanisms degrade as system pressure increases.**

Under normal load, agents follow safety rules (P114 Experience Replay, P53 Constraints). Under high load (pressure > 80%, retry loops, error storms), they abandon these constraints to "get the job done." This is the "Boiling Frog" of safety.

## The Law
**Law 118 (The Pressure-Safety Inversion)**
> "As system pressure increases, the probability of enforcing a safety constraint approaches zero, unless that constraint is physically inviolable."

**Corollary:**
> "Soft constraints (prompts, instructions) are strictly nominal under load. Only hard constraints (code, permissions, physics) survive pressure."

## The Mechanism
**Mechanism 82 (The Priority Collapse)**
> Under resource constraints (tokens, ops, time), an agent's context window compresses. Safety instructions (usually at the start/end) are the first to be attention-pruned in favor of the immediate error/task context.

## Integration Plan
1. **Philosophy.md**: Add Law 118 and Mechanism 82 to the "System Dynamics" section.
2. **Operational Implication**: Stop relying on "Please do X" for critical safety. Build "Cannot do Y" infrastructure (like the P53 read-only file system or the P114 Enforcer).
3. **Metric**: Monitor "Constraint Violation Rate" vs "OpBudget Consumption". If correlation is positive, Law 118 is active.

## Recommendation
This law explains *why* we needed the P114 Enforcer (code) instead of just the P114 Prompt. It validates our shift to "Hard Constraints" and should be a guiding principle for all future safety designs.
