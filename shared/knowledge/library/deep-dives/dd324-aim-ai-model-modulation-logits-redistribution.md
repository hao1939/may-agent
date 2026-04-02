# DD#324: AIM — AI Model Modulation via Logits Redistribution

**Paper:** arXiv:2603.12755 (13 Mar 2026)
**Authors:** Zihan Wang, Zhongkui Ma, Xinguo Feng, Zhiyang Mei, Ethan Ma, Derui Wang, Minhui Xue, Guangdong Bai (University of Queensland / CSIRO Data61)
**Venue:** ACM Web Conference 2025
**Code:** https://github.com/UQ-Trust-Lab/AIM/

## Why This Matters

AIM introduces a paradigm shift in how we think about model adaptation: instead of maintaining multiple fine-tuned model versions, a *single model* can exhibit diverse behaviors through controlled logits manipulation. This is **training-data-agnostic and retraining-free** — you never touch model weights. The implications for model-as-a-service deployment, tiered access control, and personalized AI are profound.

## Core Idea: Logits as the Universal Control Surface

The key insight is that logits — the raw scores before softmax — are the "last mile" of any neural network's decision process. By decomposing a network f into f₂ ∘ f₁ (where f₁ extracts features→logits and f₂ maps logits→outputs), AIM inserts a control function Λ between them:

```
f_modulated = f₂ ∘ Λ ∘ f₁
```

This preserves all learned feature representations while enabling post-hoc behavioral modification.

## Two Modulation Modes

### 1. Utility Modulation (for Model Owners)
**Goal:** Control output quality levels (premium vs. free tier)
**Mechanism:** Add bilateral Gaussian noise to logits:
```
Λ(ŷᵢ) = ŷᵢ + ϵᵢ, where ϵ ~ N(0, σ²)
```

**Key Theorem (Theorem 1):** The probability that logit ordering is preserved after noise:
```
Pr(order preserved) = ∏ᵢ Φ(Δᵢ / (√2·σ))
```
where Δᵢ = gap between adjacent ordered logits, Φ = standard normal CDF.

**Implications:**
- Larger σ → more ordering disruptions → lower accuracy → degraded utility
- The degradation is **monotonic and continuous** — model owners get fine-grained control
- Logits with larger gaps are more robust to noise → the model's "confident" predictions survive longer
- Rate of change is always negative (Theorem 2), guaranteeing predictable degradation

### 2. Focus Modulation (for Users)
**Goal:** Shift model attention toward specific features/classes
**Mechanism:** Add *unilateral* noise (non-negative or non-positive) to specific class logits:
```
For target class c: Λ(ŷc) = ŷc + |ϵc|  (half-normal boost)
For other classes:  Λ(ŷⱼ) = ŷⱼ - |ϵⱼ|  (half-normal suppress)
```

**Effect:** The target class gets a probabilistic "bonus" in the ranking, making the model more responsive to specific features while maintaining overall accuracy on non-target classes.

## Architecture Universality

AIM works across fundamentally different architectures because logits are a universal representation:
- **ResNet-56** (image classification, CIFAR-10)
- **SegFormer-B2** (semantic segmentation, Cityscapes)
- **Llama-3.1-8B** (text generation)

This cross-architecture applicability is rare — most model modification techniques are architecture-specific.

## Evaluation Highlights

### Utility Modulation Results:
- ResNet-56: Accuracy degrades from 93.6% → ~10% (random) as σ increases from 0 → 10
- SegFormer-B2: mIoU degrades smoothly and predictably
- Llama-3.1: Perplexity increases monotonically with σ, text remains coherent at moderate noise levels but becomes degraded at higher levels

### Focus Modulation Results:
- **Cityscapes pedestrian detection:** When model is originally vehicle-focused, focus modulation improves pedestrian IoU by ~15% with <2% overall mIoU drop
- This demonstrates the use case: ADAS system that can be personalized without retraining

## Theoretical Foundation

The formal framework is elegant. By treating logits as random variables with joint probability distributions, AIM provides:

1. **Ordering preservation probability** — exact formula relating noise variance to prediction stability
2. **Sensitivity analysis** — rate of change quantifies how quickly utility degrades
3. **Distribution invariance** — results hold for any logit distribution, not just specific architectures
4. **Pairwise independence** — the noise terms are i.i.d., making ordering disruptions decomposable into independent pairwise events

## Connection to Our Research Corpus

### vs. SteerRM (DD#319)
Both operate on model internals without retraining. SteerRM uses SAEs to identify and steer reward model features. AIM operates downstream at the logits level — it's *simpler* but *less targeted*. SteerRM modifies internal representations to change what the model "values"; AIM modifies outputs to change what the model "says." They're complementary layers of a model control stack.

### vs. ActTail (DD#320)
ActTail achieves sparsity via heavy-tailed self-regularization of activations during training. AIM achieves behavioral diversity at inference time via logits noise. ActTail is a training-time intervention; AIM is a deployment-time intervention. Together they suggest a full lifecycle of activation/logit control.

### vs. GONE (DD#321)
GONE achieves unlearning via neighborhood-expanded distribution shaping — modifying the model's knowledge geometry. AIM doesn't modify knowledge — it modulates how knowledge is *expressed* in outputs. For model governance: GONE removes capabilities, AIM *throttles* them.

### Manifold Geometry Connection (CR#156)
AIM adds a new dimension to the knowledge modification manifold. Where editing (ROME) and unlearning (GONE) alter the manifold's shape, AIM adds noise that effectively "blurs" the decision boundaries without changing the manifold itself. This is a fundamentally different operation — *perturbation* vs. *deformation*.

## Limitations & Open Questions

1. **Security:** If σ is known, adversaries could attempt to "de-noise" free-tier outputs
2. **Coherence floor:** For LLMs, at what σ does text become incoherent? The paper doesn't deeply analyze the semantic degradation curve
3. **Focus modulation generalization:** Works well for classification but how does it scale to open-ended generation tasks?
4. **Interaction effects:** What happens when utility AND focus modulation are applied simultaneously?

## Scout Assessment

**Relevance: HIGH** — Direct connection to model internals research (SteerRM, ActTail), unlearning (GONE), and the broader model governance theme. The logits-as-universal-control-surface insight is powerful.

**Novelty: HIGH** — First formal framework for model modulation that's architecture-agnostic and retraining-free. The theoretical foundation via joint probability distributions is rigorous.

**Actionability: VERY HIGH** — Code available. Immediate applications in tiered AI services, personalized systems, and model governance. Could be combined with SAE-based steering for multi-level control.
