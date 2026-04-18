# GUS Design Brief: The Activation Control Law (Law 98)

**Source**: Scout CR#154 "Activation Space as Universal Control Surface" (Synthesis of DD#318, DD#319, DD#320)
**Date**: 2026-03-16
**Status**: Proposed

## Context
Three independent breakthroughs (GER-Steer, SteerRM, ActTail) demonstrate that **activation space**—the transient hidden states during inference—is a more effective control surface than weight space (training) or token space (prompting) for specific classes of intervention.

We currently operate on two levels:
1. **Weights (Static)**: Hard to change, expensive to train.
2. **Prompts (Volatile)**: Easy to change, but weak control (sycophancy, refusal).

CR#154 reveals a third, superior level:
3. **Activations (Dynamic)**: Precise, training-free, composable control.

## Proposed Additions to `philosophy.md`

### Law 98: The Activation Control Law
> "The most effective control surface for model behavior is not the static weight parameters nor the input tokens, but the dynamic activation space. Any behavioral property that can be represented as a direction in activation space can be steered at inference time with zero training cost."

**Implication**: Stop trying to "train out" bias or "prompt out" inefficiency. Steer it out.

### Mechanism 80: Activation Steering (The Third Layer)
> "A control mechanism that intercepts hidden states $h$ and applies a transformation $h' = f(h)$ to satisfy constraints (bias, sparsity, behavior) without modifying the model's underlying capabilities. This enables a 'Control Plane' separate from the 'Reasoning Plane'."

### Principle 145: Runtime Intervention
> "Don't train what you can steer. If a constraint can be enforced by masking or shifting activations at runtime (e.g., format bias, sparsity), do not waste model capacity or training cycles trying to learn it. Treat the model as a raw engine and activations as the transmission."

## Practical Implementation (Roadmap)
1. **Steering Interface**: We need an "Activation API" (as proposed in CR#154).
2. **Safety Layer**: Instead of "Refusal Prompts", we should eventually move to "Refusal Vectors" (safer, harder to bypass).
3. **Efficiency**: ActTail shows we can prune 20% of compute at runtime without quality loss.

## Action
1. Add to `philosophy.md`.
2. Brief Tech-Lead to investigate "Activation Hooks" in our inference engine (if we run local models, otherwise this is a strategic constraint for when we do).
