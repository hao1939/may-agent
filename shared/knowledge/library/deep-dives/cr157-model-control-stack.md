# CR#157: The Model Control Stack — From Activations to Logits to Outputs

**Cross-Reference Synthesis connecting DD#319 (SteerRM), DD#320 (ActTail), DD#321 (GONE), DD#324 (AIM), and CR#156 (Knowledge Modification as Manifold Geometry)**

## The Emerging Stack

Across our last 6 deep dives, a coherent **multi-layer model control architecture** has emerged. Each paper operates at a different level of the neural network's computation pipeline, and together they form a complete "control stack":

```
┌─────────────────────────────────────────────────────┐
│  Layer 5: OUTPUT CONTROL                            │
│  AIM (DD#324) — Logits redistribution               │
│  • Noise injection for utility modulation            │
│  • Unilateral shifts for focus modulation            │
│  • Retraining-free, architecture-agnostic            │
├─────────────────────────────────────────────────────┤
│  Layer 4: REWARD SIGNAL CONTROL                     │
│  SteerRM (DD#319) — SAE-based reward debiasing       │
│  • Identify bias features via sparse autoencoders    │
│  • Steer reward model internal representations       │
│  • Intervene at specific representation dimensions   │
├─────────────────────────────────────────────────────┤
│  Layer 3: KNOWLEDGE STRUCTURE CONTROL               │
│  GONE (DD#321) — Neighborhood-expanded unlearning    │
│  • Modify distribution of knowledge neighborhoods   │
│  • Shape what the model "knows" vs. "forgets"        │
│  • Targeted deletion on the knowledge manifold       │
├─────────────────────────────────────────────────────┤
│  Layer 2: ACTIVATION DYNAMICS CONTROL               │
│  ActTail (DD#320) — Heavy-tailed self-regularization │
│  • Control sparsity of activation patterns           │
│  • Exploit power-law statistics of neuron firing     │
│  • Training-time intervention for efficiency         │
├─────────────────────────────────────────────────────┤
│  Layer 1: WEIGHT/PARAMETER CONTROL                  │
│  ROME, MEMIT, etc. (earlier DDs) — Direct editing    │
│  • Modify specific factual associations              │
│  • Rank-one updates to MLP weight matrices           │
│  • Surgical parameter-level changes                  │
└─────────────────────────────────────────────────────┘
```

## The Key Insight: Interventions at Different Layers Serve Different Purposes

| Layer | When | What Changes | Reversible? | Architecture-Specific? |
|-------|------|-------------|-------------|----------------------|
| AIM (Logits) | Inference | Output distribution | Yes — remove noise | No — universal |
| SteerRM (Representations) | Post-training | Reward signals | Partially — can un-steer | Somewhat — needs SAE per model |
| GONE (Knowledge) | Post-training | Model's factual beliefs | No — permanent deletion | Yes — architecture-dependent |
| ActTail (Activations) | Training | Sparsity patterns | No — baked into weights | Somewhat — training recipe |
| ROME (Weights) | Post-training | Specific facts | Technically yes | Yes — requires locate-and-edit |

## Theoretical Unification via CR#156 Manifold Framework

In the manifold geometry framework from CR#156:

- **Layer 1 (Weights):** Moves points on the parameter manifold M_θ
- **Layer 2 (Activations):** Reshapes the activation manifold M_a (changing its topology via sparsity)
- **Layer 3 (Knowledge):** Deletes regions from the knowledge sub-manifold M_k ⊂ M_θ
- **Layer 4 (Representations):** Steers trajectories on the representation manifold M_r
- **Layer 5 (Logits):** Adds noise to the decision boundary manifold M_d — **blurring without deforming**

This gives us a differential-geometric picture: each intervention type corresponds to a different geometric operation (translation, deletion, deformation, blurring) on a different sub-manifold.

## Composability Analysis

Can these interventions be composed? In principle yes, but with caveats:

1. **ActTail + AIM:** Train with heavy-tailed regularization (Layer 2), then modulate at inference (Layer 5). ✅ Compatible — different phases.
2. **GONE + AIM:** Unlearn knowledge (Layer 3), then throttle remaining capabilities (Layer 5). ✅ Compatible — GONE removes, AIM throttles what remains.
3. **SteerRM + AIM:** Debias reward model (Layer 4), then utility-modulate outputs (Layer 5). ✅ Compatible but potentially redundant for the same goals.
4. **ROME + GONE:** Edit facts, then unlearn neighborhoods. ⚠️ Potential conflicts — editing creates new knowledge that unlearning might remove.
5. **Full Stack:** All five layers simultaneously. 🔬 Unexplored — interaction effects are unknown.

## The Model Governance Implication

This stack suggests a **layered model governance architecture**:

- **Layer 1-3 (Deep interventions):** Done by model developers/owners during training or post-training. Permanent changes to model capabilities.
- **Layer 4 (Reward steering):** Done by alignment teams. Semi-permanent adjustments to model values.
- **Layer 5 (Logits modulation):** Done at deployment time by service providers. Reversible, dynamic adjustments to model behavior.

This maps cleanly to organizational roles:
- **Research team** → Layers 1-2 (training choices)
- **Safety team** → Layers 3-4 (unlearning + alignment)
- **Product team** → Layer 5 (tiered services)

## Open Questions

1. **Interference effects:** Do Layer 3 interventions (unlearning) change the logit gap distribution Δᵢ, making Layer 5 modulation behave differently?
2. **Optimal control:** Given a desired behavioral profile, which layer combination achieves it most efficiently?
3. **Attack surface:** Does exposing Layer 5 as a user-facing control create new adversarial attack vectors?
4. **Monitoring:** Can we detect which layers have been intervened on, given only model outputs?

## Verdict

The model control stack is one of the most practically important frameworks to emerge from our research corpus. It organizes a fragmented literature (editing, unlearning, alignment, deployment) into a coherent engineering architecture. AIM's contribution is specifically at the deployment layer — the most accessible and reversible point of intervention.
