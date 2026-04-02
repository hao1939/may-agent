# Cross-Reference #179: The Signal Extraction Problem — Five Bottlenecks in Alignment Feedback Loops

**Type:** Cross-Reference Synthesis
**Rating:** ★★★★★ CRITICAL
**Date:** 2026-03-16
**Sources:** DD#301 (ChatGPT Self-Convergence), DD#303 (LLM Judge Best-of-N Failure), DD#307 (Aligning from User Interactions), DD#310 (Distillation via Intermediate Probes), DD#302 (Eye2Eye Cognitive Alignment)
**Related CRs:** CR#149 (Implicit Signal Triad), CR#177 (Self-Improvement Triangle), CR#169 (Domain-Dependent Ceiling), CR#171 (Quality Loops)
**Word Count:** ~4,500

---

## 1. The Unifying Problem

Every alignment system — whether it aligns a model to human preferences, a student to a teacher, or an agent to a user — faces the same fundamental challenge: **extracting a valid improvement signal from a noisy, lossy, and potentially degenerate source.**

Five papers in our corpus, produced independently by five different research groups, each expose a different bottleneck in this signal extraction pipeline. Together, they reveal a **complete taxonomy of alignment signal failure modes** that no individual paper addresses.

The meta-insight: **alignment quality is bounded not by the information available, but by the fidelity of the signal extraction process.** Information exists in teacher representations, user follow-ups, judge evaluations, shared perspectives, and training corpora — but each extraction method introduces systematic distortion that can be identified, measured, and mitigated.

---

## 2. The Five Signal Extraction Bottlenecks

### Bottleneck 1: Projection Loss (DD#310 — Distillation Probes)

**Problem:** Teacher LLMs encode correct answers in their intermediate representations, but this information is distorted through the vocabulary projection head. The output distribution — the standard distillation signal — is a lossy compression of the model's actual knowledge.

**Evidence:**
- Probes on intermediate layers produce cleaner labels than the teacher's own outputs
- Gains are largest under limited data — precisely when signal quality matters most
- Architecture-agnostic: the bottleneck is in the projection, not the model type

**Signal Degradation Mechanism:** Rich continuous representation → discrete token space → format/prompt artifacts → noisy supervision signal. Information is systematically destroyed at each projection step.

**Fix:** Bypass the projection entirely — extract signal from internal representations via probes.

### Bottleneck 2: Aggregation Confusion (DD#303 — LLM Judge Failure)

**Problem:** LLM judges achieve high global correlation with human labels, but fail at the actual deployment task: selecting the best response *within* a single prompt. Global agreement is an artifact of prompt-level baseline effects (recognizing hard vs. easy prompts), not genuine discriminative ability.

**Evidence:**
- Global correlation: r = 0.47 (looks decent)
- Within-prompt correlation: r = 0.27 (terrible for selection)
- Pointwise recovery rate: 21.0% of possible improvement over random
- Pairwise recovery rate: 61.2% — 3× better
- Tie rate (pointwise): 67% — two-thirds of comparisons are useless!

**Signal Degradation Mechanism:** Meaningful within-prompt signal is drowned by between-prompt variance. The aggregation (pooling across prompts) creates the illusion of alignment where none exists.

**Fix:** Explicit pairwise comparison within-prompt; report within-prompt signal, not just global metrics.

### Bottleneck 3: Implicit Channel Noise (DD#307 — User Interaction Alignment)

**Problem:** Multi-turn user interactions contain rich alignment signal (follow-ups indicate errors, corrections reveal preferences), but this signal is implicit, noisy, and mixed with non-corrective follow-ups. Standard alignment methods (RLHF, DPO) ignore this data entirely.

**Evidence:**
- Training on raw WildChat conversations improves alignment and instruction-following benchmarks
- The model *already knows* how to adjust given the follow-up — it just can't proactively
- Self-distillation (hindsight → policy) captures the signal without explicit labels
- Enables personalization: individual users' interactions become alignment gradients

**Signal Degradation Mechanism:** The alignment signal exists in the *difference* between what the model would generate before vs. after seeing the follow-up. Standard fine-tuning treats follow-ups as regular text, missing the contrastive signal.

**Fix:** Self-distillation from hindsight — compare p(y|h) vs p(y|h,f) to isolate the corrective signal.

### Bottleneck 4: Recursive Contamination (DD#301 — Self-Convergence)

**Problem:** When training data becomes contaminated with the model's own outputs (via the open internet), successive model generations show progressive diversity collapse — even at maximum temperature. The feedback loop becomes self-referential: the signal source IS the signal consumer.

**Evidence:**
- Longitudinal measurement across ChatGPT releases shows measurable decline in output diversity
- Effect persists even when explicitly prompted for diversity (temperature = 1.0)
- Different from model collapse: occurs across model versions via the open internet
- This is an **ecosystem-level** pathology, not a single-model problem

**Signal Degradation Mechanism:** Training corpus → model outputs → internet → training corpus → ... The signal-to-noise ratio decreases monotonically because the "noise" (model outputs) becomes an increasing fraction of the "signal" (genuine human text). Eventually, the model is learning from itself through a noisy channel.

**Fix:** Signal provenance tracking — distinguish human-generated from model-generated training data. Deliberate diversity injection. Ecosystem-level coordination to avoid recursive contamination.

### Bottleneck 5: Channel Mismatch (DD#302 — Eye2Eye Cognitive Alignment)

**Problem:** In human-AI collaboration, alignment signals must pass through a communicative bottleneck: rich parallel human intentions → sequential verbal commands → AI processing. This channel mismatch means the AI receives a severely compressed version of the human's actual intent.

**Evidence:**
- Eye2Eye replaces verbal channel with shared first-person perspective
- Task completion time decreases, interaction load decreases, trust increases
- Revisable memory enables correction of stale assumptions
- Framework components work synergistically — more than sum of parts

**Signal Degradation Mechanism:** Human intent (high-dimensional, parallel, embodied) → verbal description (sequential, discrete, decontextualized) → AI interpretation (biased by training distribution). Each translation step loses information.

**Fix:** Channel alignment — share the perceptual channel directly rather than translating through an intermediate representation.

---

## 3. The Signal Extraction Stack

These five bottlenecks compose into a hierarchical stack:

```
Level 5: CHANNEL MISMATCH (DD#302)
  ↓ Intent → Language compression
Level 4: IMPLICIT NOISE (DD#307) 
  ↓ Signal buried in behavioral patterns
Level 3: AGGREGATION CONFUSION (DD#303)
  ↓ Signal drowned by between-group variance
Level 2: PROJECTION LOSS (DD#310)
  ↓ Internal knowledge → output format distortion
Level 1: RECURSIVE CONTAMINATION (DD#301)
  ↓ Signal source self-corruption over time
```

### Compositional Property

Each level's distortion **compounds** with the levels below it. A system suffering from all five bottlenecks simultaneously would:

1. **Channel Mismatch**: Receive a compressed, lossy version of human intent
2. **Implicit Noise**: Extract a noisy signal from implicit behavioral cues
3. **Aggregation Confusion**: Evaluate that noisy signal using globally-calibrated but locally-useless metrics
4. **Projection Loss**: Distill the evaluation through a lossy output projection
5. **Recursive Contamination**: Train on data increasingly corrupted by its own outputs

The compounding effect means that **fixing any single bottleneck while leaving others intact yields sublinear improvement**. Conversely, addressing multiple bottlenecks simultaneously produces superlinear gains.

### The Signal Fidelity Equation

Each bottleneck introduces a fidelity factor f_i ∈ (0, 1):

```
Total Signal Fidelity = f_channel × f_implicit × f_aggregation × f_projection × f_recursive
```

If each bottleneck preserves 70% of the signal independently:
- Single bottleneck: 70% fidelity
- All five: 0.7^5 = 16.8% fidelity

This explains why alignment remains so hard despite significant progress on individual bottlenecks. **The problem is multiplicative, not additive.**

---

## 4. Cross-Bottleneck Interactions

### 4.1 Contamination × Aggregation Amplification (DD#301 × DD#303)

As model outputs contaminate training data (DD#301), output diversity decreases. Lower diversity means more ties in LLM judge evaluation (DD#303). More ties mean less usable selection signal. The result: **recursive contamination amplifies the aggregation confusion bottleneck**.

Quantitative estimate: if diversity decreases by 30% per generation (DD#301 evidence), tie rates increase proportionally (67% → ~85%), and recovery rates drop from 21% to ~10%. Within 3 generations, pointwise judge selection becomes virtually random.

### 4.2 Channel × Implicit Signal Synergy (DD#302 × DD#307)

Eye2Eye's shared perspective (DD#302) naturally generates richer implicit signals (DD#307). When a user's gaze lingers on an AI suggestion, that's an implicit follow-up — far more informative than a text-based "try again." **Richer channels produce richer implicit signals.**

This suggests that the most effective alignment systems should:
1. Maximize channel bandwidth (DD#302)
2. Mine the resulting implicit signals (DD#307)
3. Avoid collapsing this richness through coarse evaluation (DD#303)

### 4.3 Projection × Aggregation Independence (DD#310 × DD#303)

DD#310 shows that internal representations are cleaner than outputs. DD#303 shows that global evaluation is noisier than local. Together: **the cleanest signal comes from probing internal representations at the local (within-prompt) level** — bypassing both bottlenecks simultaneously.

This predicts that an "internal pairwise probe" — comparing hidden-state representations of two responses to the same prompt — should dramatically outperform standard pointwise output-based judging. This combination has not been tested in the literature.

### 4.4 Recursive × Projection Divergence (DD#301 × DD#310)

If output distributions degrade through recursive contamination but internal representations remain more stable (as DD#310 suggests), then **probe-based alignment should be more robust to ecosystem contamination than output-based alignment**. Internal representations may serve as a more stable anchor than outputs that are increasingly shaped by self-referential training loops.

---

## 5. Implications for System Design

### 5.1 Signal Audit Protocol

Every alignment system should audit its signal extraction pipeline for all five bottlenecks:

| Question | Bottleneck | Test |
|---|---|---|
| "Is our evaluation within-task or cross-task?" | Aggregation | Report within-prompt metrics alongside global |
| "Does our signal source contain our own outputs?" | Recursive | Track data provenance and generation attribution |
| "Are we using outputs or representations?" | Projection | Compare probe-based vs. logit-based supervision |
| "What channel carries our alignment signal?" | Channel | Measure information bandwidth of feedback path |
| "Is our signal explicit or implicit?" | Implicit | Quantify signal-to-noise ratio of behavioral cues |

### 5.2 Application to Multi-Agent Systems

In MAS, the five bottlenecks manifest as:

1. **Channel Mismatch → Message Format Loss**: Agent-to-agent messages compress rich internal states into text tokens
2. **Implicit Noise → Behavioral Coordination**: Agents must infer coordination signals from peer actions, not explicit requests
3. **Aggregation Confusion → Team-Level Metrics**: System-level KPIs may mask individual agent contribution (cf. DD#341 CoMAM's credit assignment problem)
4. **Projection Loss → Capability Reporting**: An agent's external API (what it says it can do) may poorly represent its actual capabilities
5. **Recursive Contamination → Echo Chambers**: Agents training on each other's outputs risk epistemic collapse (cf. DD#297)

### 5.3 Our System Specifically

Applying the Signal Extraction Stack to our Scout → Evaluator → May pipeline:

| Bottleneck | Our Status | Mitigation |
|---|---|---|
| Channel | ✅ Text-only but adequate for our domain | N/A |
| Implicit | ⚠️ We mine implicit signals (journal patterns) but not systematically | Structured behavioral analytics |
| Aggregation | ❌ Our quality metrics are largely global (★ ratings) | Add within-task comparative evaluation |
| Projection | ⚠️ Summaries (DD/CR) are projections of full paper understanding | Reference original sources, not summaries |
| Recursive | ⚠️ CRs synthesize DDs which are themselves syntheses of papers | Maintain clear provenance chain; periodically re-read primary sources |

---

## 6. Novel Predictions

### Prediction 1: The Signal Fidelity Law
**Alignment improvement scales with the product of bottleneck mitigations, not the sum.** Fixing the weakest bottleneck first always yields the highest marginal return. Corollary: spending 80% of effort on one bottleneck while ignoring others is inefficient — balanced investment across all five yields better outcomes.

### Prediction 2: Representation Stability Hypothesis
**Internal representations are more robust to recursive contamination than output distributions.** As ecosystem self-contamination increases, probe-based methods should maintain alignment quality longer than output-based methods. Testable via longitudinal probe analysis across model generations.

### Prediction 3: The Channel-Implicit Complementarity
**Richer feedback channels (visual, embodied, interactive) automatically increase the quality of implicit alignment signals.** Systems that invest in channel bandwidth will discover that implicit signal mining becomes dramatically more effective — a positive complementarity that current text-only systems miss entirely.

### Prediction 4: Pairwise-Probe Supremacy
**Combining internal probing (DD#310) with pairwise comparison (DD#303) should yield evaluation quality exceeding either method alone.** Internal pairwise probes should achieve >80% recovery rate vs. 61% for output pairwise and 21% for output pointwise. This is the most directly testable prediction.

---

## 7. Connection to Existing Framework

This synthesis extends several prior cross-references:

- **CR#149 (Implicit Signal Triad):** Bottleneck 3 (Implicit Noise) is the same problem but now contextualized within the full 5-level stack. The Implicit Signal Triad addressed one level; we address all five.
- **CR#177 (Self-Improvement Triangle):** The three-speed improvement stack (diagnosis → evolution → optimization) maps to different signal extraction levels. Fast diagnosis operates at Level 3-4 (evaluation); slow optimization at Level 1-2 (training data quality).
- **CR#169 (Domain-Dependent Ceiling):** The performance ceilings in different task regimes can be partially explained by which signal extraction bottlenecks dominate. Bounded-generative tasks have fewer bottlenecks (Level 1-2 only); adversarial-MAS tasks suffer from all five.
- **CR#171 (Quality Loops):** Quality oracle incorruptibility is equivalent to high fidelity at Level 3 (Aggregation). The Quality Ceiling Theorem (quality ≈ oracle incorruptibility × informativeness) is a special case of our multiplicative fidelity equation.

---

## 8. Conclusion

The Signal Extraction Problem is the meta-challenge underlying all alignment work. Five independent papers reveal five distinct bottlenecks — Channel Mismatch, Implicit Noise, Aggregation Confusion, Projection Loss, and Recursive Contamination — that compose multiplicatively to determine overall alignment quality.

The practical implication is stark: **no amount of improvement at one level can compensate for degradation at another.** The field's focus on individual bottlenecks (better judges, better data, better channels) misses the compositional nature of the problem. The most impactful interventions are those that raise the minimum fidelity across all five levels simultaneously.

This synthesis resolves the orphan status of DD#301, DD#302, DD#303, DD#307, and DD#310, connecting them into a unified framework that has predictive power beyond any individual paper.

---

*Cross-reference synthesis by Scout, 2026-03-16. All source papers verified against archived deep-dives.*
