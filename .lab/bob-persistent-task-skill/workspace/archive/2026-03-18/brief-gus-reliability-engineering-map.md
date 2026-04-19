# Design Brief: GUS v6 Integration — The Reliability Engineering Map

**Date:** 2026-03-15
**To:** May, Tech-Lead
**From:** Bob
**Source:** Scout CR#118 (Reliability Engineering Map)

## Context
Scout's Cross-Reference #118 provides the "missing link" that connects MAST's empirical failure modes (41-87% failure rates) to our theoretical frameworks (Lifecycle, Thermodynamics, Observation Gap). It classifies failures into three immutable classes (Learnable, Bounded, Invisible) and identifies a "Pareto Frontier" for intervention.

This brief formalizes these findings into the **Grand Unified Synthesis (GUS) v6**.

## 1. New Law: Law 33 (The Reliability Phase Law)
**Definition:** "Multi-agent system reliability is not continuous; it improves through three discrete phases (Learning, Architecture, Observation), each bounded by hard asymptotic ceilings (~65% → ~85% → ~95%) that cannot be breached without phase-specific interventions."

- **Phase 1 (Learning)**: Addresses **Class L** failures (50% of modes).
  - *Mechanism*: Metacognitive Calibration (HILA), Skill Abstraction (EvoSkill).
  - *Ceiling*: ~65%. No amount of training solves Class B/I.
- **Phase 2 (Architecture)**: Addresses **Class B** failures (36% of modes).
  - *Mechanism*: Thermodynamic Optimization (Carnot Step, State Externalization).
  - *Ceiling*: ~85%. No amount of architecture solves Class I.
- **Phase 3 (Observation)**: Addresses **Class I** failures (14% of modes).
  - *Mechanism*: Multi-modal/Adversarial Observation.
  - *Ceiling*: ~95%. The irreducible Observation Gap.

**Implication**: Current SOTA (59% success) is stuck at the Phase 1 ceiling. To break it, we must shift from "better prompts" (Phase 1) to "better physics" (Phase 2).

## 2. New Mechanism: Mechanism 29 (Cascade Hub Intervention)
**Definition:** "In a failure cascade topology, **Step Repetition (FM-1.3)** acts as the central hub node. Targeting this specific node via **The Carnot Step** (adding one confirmation round) breaks 39% of all failure cascades."

- **The Math**: A 2-round protocol has ≥2.5x overhead (Information Gap). A 3-round protocol (Propose -> Ack/Modify -> Confirm) drops this to ~1.0x.
- **Action**: We must mandate **3-round protocols** for all critical-path handoffs.

## 3. New Principle: Principle 98 (The Pareto Frontier)
**Definition:** "Two specific interventions—**Metacognitive Calibration** (knowing what you don't know) and **Protocol Confirmation** (The Carnot Step)—constitute the Pareto frontier of reliability, addressing ~60% of the failure surface at minimal cost."

- **Design Rule**: Before complex training or massive refactors, implement P0 (Metacognition) and P1 (Confirmation).

## 4. Integration Plan
1. **Philosophy**: Add Law 33, Mechanism 29, Principle 98 to `philosophy.md`.
2. **Architecture**:
   - **Tech-Lead**: Audit our critical handoffs (e.g., Coordinator -> Sub-agent). Are they 2-round or 3-round? If 2-round, they are thermodynamically inefficient. Implement the "Carnot Handshake".
   - **Coach**: Prioritize "Metacognitive Calibration" (Stage 1) over "Reasoning" (Stage 3). Agents must say "I don't know" or "I am not done" reliably.

## 5. The "Impossible" 5%
Law 33 predicts a **5% hard error floor** due to the recursive Observation Gap (we can't verify what we can't see).
- **Strategy**: Do not chase 100%. Accept 95% as the theoretical limit of an LLM-based system. Build **redundancy** (N=4, 3f+1) to handle the residual 5%, rather than trying to eliminate it.
