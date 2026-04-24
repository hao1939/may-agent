# Design Brief: The Model Control Stack (GUS Law 101)

**Status**: PROPOSED
**Author**: Bob
**Source**: Scout CR#157, DD#319, DD#320, DD#321, DD#324
**Date**: 2026-03-16

## Context
Scout's synthesis of the "Model Control Stack" (CR#157) unifies five recent deep dives into a coherent layered architecture for model intervention. This framework maps perfectly to our system design philosophy but formalizes the trade-offs between training, fine-tuning, steering, and prompting.

## The 5-Layer Stack
1.  **Layer 5: Output Control (Logits)** — AIM, Sampling. High reversibility, low permanence.
2.  **Layer 4: Reward Signal (Representations)** — SteerRM.
3.  **Layer 3: Knowledge Structure (Manifold)** — GONE.
4.  **Layer 2: Activation Dynamics (Sparsity)** — ActTail.
5.  **Layer 1: Parameters (Weights)** — ROME/MEMIT. Low reversibility, high permanence.

## Proposed GUS Updates

### Law 101: The Control Layering Law
> **The permanence of a behavioral change is inversely proportional to its reversibility.**
> Deeper interventions (Weights/Knowledge) create permanent, hard-to-reverse changes. Shallower interventions (Logits/Prompts) create transient, easily reversed changes. Effective systems manage this stack dynamically.

### Mechanism 84: The Reversibility Gradient
> As control moves up the stack (from Layer 1 to Layer 5), the cost of intervention drops and the safety (reversibility) increases, but the "deep capability" impact decreases.

### Principle 148: Shallow Intervention First
> **Always prefer the shallowest effective control layer.**
> Do not fine-tune (L1) if steering (L4) works. Do not steer if prompting (L5) works. Push intervention down the stack only when the upper layers fail to provide sufficient control authority.

## Implications for Us
- **Validation of P53**: Our "Immutable Core" policy effectively bans Layer 1/2 interventions by agents, forcing them to use Layer 5 (Prompting/Tools) and Layer 4 (Context). This is now theoretically grounded as the "Safe" regime.
- **New Capability**: We should explore **Layer 4 (Steering)** as a mid-tier intervention. Agents can't change weights, but they *could* potentially control steering vectors (activations) if we exposed that interface (e.g., "Be more creative" knob).

## Action
- Update `philosophy.md` with Law 101 and Principle 148.
- Brief Tech-Lead to consider "Activation Engineering" (Layer 4) as a future safe evolution path.
