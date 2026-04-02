# DD#321: GONE — Structural Knowledge Unlearning via Neighborhood-Expanded Distribution Shaping

**Paper:** arXiv:2603.12275 (21 Feb 2026)
**Authors:** Chahana Dahal, Ashutosh Balasubramaniam, Zuobin Xiong (UNLV, IIT Guwahati)
**Venue:** Preprint, under review
**Deep-Dive Date:** 2026-03-16

## The Problem

LLM knowledge unlearning has been studied at the **sentence level** (TOFU, RWKU benchmarks), but knowledge in LLMs is **relationally structured** — a fact like ("Einstein", "won", "Nobel Prize") connects to paraphrases, inverse relations, and multi-hop reasoning chains. Existing unlearning methods either:
- **Over-forget**: Destroying related but distinct facts (catastrophic forgetting)
- **Under-forget**: Removing surface answers while leaving multi-hop "reasoning leakage" paths intact

No benchmark previously evaluated unlearning over **structured knowledge graph facts** with multi-hop leakage detection.

## Key Contributions

### 1. GONE Benchmark: KG-Derived Unlearning Evaluation
The first benchmark that **disentangles three unlearning effects**:
- **Direct fact removal**: Can the model still answer "What prize did Einstein win?"
- **Reasoning-based leakage**: Can it still answer multi-hop paths ("Which physicist who developed relativity won a Nobel Prize?")
- **Catastrophic forgetting**: Does "Einstein was a physicist" still work?

**Data sources**: Wikidata (factual/structural) + ConceptNet (commonsense/associative)

**Probe types per target fact** (both QA and Fill-in-the-Blank):
| Probe Type | Count | Purpose |
|---|---|---|
| Single-hop Direct | 1 | Tests direct forgetting |
| Paraphrase | 2 | Tests generalization |
| Inverse | 1 | Tests bidirectional link |
| Two-hop | 2 | Checks neighbor leakage |
| Three-hop | 1 | Checks deep leakage |
| Retain (Unrelated) | 1 | Tests utility preservation |

**Critical design**: Only direct single-hop QA probes used during unlearning training — all other probes held out for evaluation. Any correctness on multi-hop/paraphrase probes = **knowledge leakage**.

### 2. Topological Orthogonality
The retain set is constructed with **strict separation** from the forget set:
- Geodesic distance d(t, t') > 3 between forget and retain objects
- Schema separation: retain relations from disjoint property families
- Node disjointness: no shared direct edges
- API-based BFS verification up to depth=3

This prevents confounding fact erasure with entity degradation.

### 3. NEDS: Neighborhood-Expanded Distribution Shaping
The core algorithm innovation:

**Three knowledge partitions:**
1. **Target fact** (xi, yi) — suppressed via NPO loss
2. **Correlated neighbors** N(i) — k=10 related but distinct facts, **preserved via anchor loss**
3. **Orthogonal retain set** R — distant facts (d>3), preserved via standard retain loss

**The key insight**: Correlated neighbors aren't targets to delete — they're **anchors** that define a precise decision boundary.

**Loss function:**
```
L_NEDS = L_forget (target suppression) + lambda * Sum L_anchor (neighborhood stabilization)
```

Where:
- L_forget = -log sigma(-beta * h_theta(yt|xt)) — NPO-style suppression
- L_anchor = -log pi_theta(yn|xn) — cross-entropy preservation for neighbors

**Theoretical justification**: NEDS acts as **approximate null-space projection** — anchor gradients cancel components of the forget gradient along neighbor directions, confining updates to the null space of neighbor gradients. Equivalent to AlphaEdit's constrained editing but achieved through loss terms rather than explicit Jacobian computation.

### 4. Knowledge Connectivity Score (KCS)
Novel metric measuring structural integrity of residual knowledge:
```
KCS = (1/|N_f|) * Sum ROUGE-L_recall(y_hat(p), y) over neighbor probes
```
KCS Drop (delta KCS) quantifies how much the underlying knowledge structure is disrupted.

## Key Results

### On LLaMA-3-8B-Instruct (GONE/Wikidata, QA):
| Method | Direct UE | Paraphrase | Inverse | Multi-hop | Locality | Refusal |
|---|---|---|---|---|---|---|
| NPO | 0.635 | 0.595 | 0.209 | 0.406 | **0.938** | 0.000 |
| ICU | 1.000 | 0.984 | 0.679 | 0.950 | 0.273 | 0.715 |
| AlphaEdit | 0.487 | 0.462 | 0.289 | 0.348 | 0.514 | 0.225 |
| **NEDS** | **1.000** | **1.000** | **0.725** | **1.000** | 0.698 | **0.000** |

### On Mistral-7B (GONE/Wikidata, QA):
| Method | Direct UE | Multi-hop | Locality |
|---|---|---|---|
| NPO | 0.992 | 0.998 | 0.717 |
| ICU | 0.981 | 0.967 | 0.606 |
| **NEDS** | **1.000** | **0.999** | **0.839** |

**Critical findings:**
1. **NEDS achieves perfect unlearning (1.000 Direct, 1.000 Multi-hop)** with 0% refusal rate — true erasure, not safety refusal
2. **NPO has massive inverse leakage**: 0.635 Direct but only 0.209 Inverse on LLaMA-3 — forgetting is unidirectional
3. **ICU destroys locality** (0.273) and depends on refusal prompts (71.5% refusal rate)
4. **Commonsense harder to unlearn**: On ConceptNet, gradient methods barely move beyond baseline — commonsense more deeply embedded than factual knowledge

### Distributional Boundary Validation
NEDS creates strongest distributional separation: ROC-AUC 0.448 → 0.660 (+0.212), log-probability gap 0.079 (4x larger than NPO's 0.022).

## Architectural Insights

### Why Graph Structure Matters for Unlearning
**Flat sentence-level unlearning is fundamentally insufficient**:
- Models retain "reasoning leakage" through multi-hop KG connections
- Inverse relations create bidirectional knowledge that single-direction unlearning misses
- Paraphrase robustness requires understanding semantic neighborhood

### The Anchor Principle
**Don't just suppress targets — stabilize boundaries.** Effective forgetting requires explicitly protecting the semantic neighborhood. Counterintuitive: you must actively reinforce what should stay to precisely control what goes.

### Architecture-Agnostic Formulation
Works through loss terms only — applicable to any causal LM. Uses LoRA (rank=16, alpha=32).

## Cross-References to Portfolio

### → DD#319 (SteerRM) & DD#320 (ActTail): Activation Space Control
GONE operates in **parameter space** (weight modification), while SteerRM/ActTail operate in **activation space** (output steering). Complementary:
- NEDS for **permanent** knowledge removal (privacy/safety)
- Activation steering for **dynamic** behavior control
- Both preserve neighborhoods while modifying targets

### → CR#154 (Activation Space as Universal Control Surface)
GONE adds a **fourth modality**: not just steering, sparsifying, or debiasing activations, but **surgically editing weight-level knowledge structures**.

### → DD#294/DD#295 (Prompt Injection/AgentDrift): Safety
Structured unlearning for **agent safety**: remove dangerous knowledge while preserving useful domain knowledge. Topological orthogonality ensures "forget weapons manufacturing" doesn't destroy "understand chemical reactions." Multi-hop leakage detection prevents reconstruction through indirect reasoning.

### → CR#155 (Verification Quality Revolution)
GONE's evaluation methodology embodies the verification quality thesis: evaluating multi-hop leakage exposes failures invisible to simpler benchmarks.

### → DD#312 (Reasoning Traces)
Multi-hop leakage shows reasoning capabilities are **structurally connected** — you can't remove a fact without addressing its reasoning-accessible neighborhood.

## Implications for Agent Systems

1. **Memory Management**: Remove outdated/incorrect facts ensuring multi-hop consistency. The anchor principle: when updating memory, explicitly stabilize related memories.
2. **Privacy Compliance**: GDPR "right to be forgotten" requires ensuring models can't reconstruct data through reasoning. GONE provides compliance verification.
3. **KG-Grounded Agent Design**: Structure knowledge as graphs for precise surgery. Multi-hop awareness prevents "knowledge zombies" (facts that reappear through inference).

## Limitations
- Tested only on 7-8B models — unclear if scales to 70B+
- Static benchmark; real agents need continuous unlearning
- Commonsense gap: gradient methods struggle with deeply embedded commonsense
- No evaluation of multi-fact simultaneous unlearning composition
- No durability evaluation over continued training

## Scout Assessment
**Relevance: HIGH** — First rigorous KG-based unlearning benchmark + novel algorithm. The anchor principle (stabilize neighbors to sharpen forgetting) is a powerful general insight. Connects to safety, privacy, knowledge management across portfolio.

**Key Takeaway**: Effective forgetting requires understanding what to remember. NEDS's "anchor neighbors" principle — explicitly reinforcing the boundary between forget and retain — is the inverse of the "verification quality" thesis: just as better evaluation enables better training, better retention enables better forgetting.
