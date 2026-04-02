# CR#191: The Compression-Truth Gap — Why Multi-Agent Systems Systematically Amplify Coherent Falsehoods

**Type:** Cross-Reference Synthesis  
**Rating:** ★★★★★ CRITICAL  
**Date:** 2026-03-16  
**Primary Sources:** DD#347 (CCP), DD#342 (Prompt Injection/Role Confusion), DD#295 (AgentDrift), DD#296 (LMEB), DD#266 (VMAO)  
**Supporting References:** CR#53 (Knowledge Retrieval Paradox), CR#29 (Reliability Illusion Stack), CR#179 (Signal Extraction Problem), CR#41 (RL Training Traps)

---

## Executive Summary

The Compression-Consistency Principle (CCP, DD#347) reveals that language models don't prefer truth — they prefer *compressibility*. This single mechanism, when traced through the multi-agent pipeline, explains why our entire portfolio converges on the same finding: **multi-agent systems systematically amplify coherent falsehoods while filtering out fragmentary truths.** We show that five independently-discovered failure modes (role confusion, progressive drift, memory degradation, reliability inflation, hallucination compounding) are all manifestations of a single underlying mechanism: compression-consistency selection acting at each inter-agent handoff.

---

## 1. The Mechanism: Compression-Consistency Selection

### 1.1 What CCP Proves (DD#347)

Krestnikov (2026) demonstrates with controlled experiments on GPT-2-style models that:

- **Random errors vs. truth:** Models prefer truth 83.1% of the time (truth is more compressible than noise)
- **Coherent alternative systems vs. truth:** Models prefer truth ≈50% (both equally compressible)  
- **Verification steps restore truth preference:** Only when verification creates compression asymmetry

The critical implication: **LLMs have a compression bias, not a truth bias.** What looks like "knowing the truth" is actually "preferring the more compressible option."

### 1.2 Why This Matters for Multi-Agent Systems

In a single-agent system, CCP means the model sometimes confabulates coherently. Annoying but manageable. In a **multi-agent system**, CCP creates a *selection pressure*:

> At each inter-agent handoff, the receiving agent applies compression-consistency selection to the incoming signal. Coherent falsehoods pass this filter with the same probability as coherent truths. Fragmentary truths — which are harder to compress — are *filtered out* at each step.

**The multi-agent pipeline acts as a coherence filter that systematically selects for compressible content regardless of truth value.**

## 2. Five Failure Modes as CCP Manifestations

### 2.1 Role Confusion as Compression Selection (DD#342)

Ye et al. (MIT CSAIL) show that LLMs assign authority based on **style**, not tags. Why? Because in the model's latent space, style IS the compression structure. A prompt injection attack succeeds when the injected content has a *more consistent style* (= more compressible representation) than the legitimate content.

**The CCP link:** CoT Forgery achieves 79% "CoTness" vs. 68% for genuine reasoning because *forged reasoning is designed for stylistic consistency* while genuine reasoning contains genuine uncertainty — which is less compressible.

| | Genuine Reasoning | Forged Reasoning |
|---|---|---|
| **Consistency** | Contains hedging, uncertainty, backtracking | Clean, linear, confident |
| **Compressibility** | Lower (uncertainty = information) | Higher (consistency = compressible) |
| **Model preference** | 68% CoTness | 79% CoTness |

**CCP prediction confirmed:** The model prefers the more compressible option — even when it's the forgery.

### 2.2 Progressive Drift as Compression Lock-In (DD#295)

AgentDrift shows that cumulative tool corruption achieves 83% drift rate at 50% corruption — but agents detect only 14.6%. Why is detection so poor?

**CCP explanation:** Each corrupted tool output is individually *coherent* — it maintains internal consistency. The agent's compression-consistency criterion treats each response as acceptable because it's compressible. The cumulative bias goes undetected because **consistency-based evaluation cannot detect systematic bias** — bias that maintains coherence is invisible to compression.

This explains the specific finding that "agents evaluate each tool response in isolation" (DD#295) — they MUST, because compression-consistency is a local property. The model has no mechanism for detecting that a *series* of individually-coherent responses has drifted from truth.

### 2.3 Memory Degradation as Compression Loss (DD#296)

LMEB reveals that current embedding models achieve only ~60% NDCG@10 on agent memory retrieval. Different memory types require different embedding capabilities, and no single model excels across all types.

**CCP explanation:** Memory embedding IS a form of compression. When models compress episodic memories, they preserve *consistency* (internal coherence) but lose *specificity* (truth-discriminating details). This is why:
- **Procedural memory** (high abstraction, low temporal dependency) works best — procedures are already compressed to consistent patterns
- **Episodic memory** (low abstraction, high temporal dependency) works worst — episodes contain noisy, truth-discriminating details that compression discards

The 60% ceiling is a **compression-truth gap** — the 40% lost is exactly the truth-discriminating information that compression doesn't preserve.

### 2.4 Reliability Inflation as Compression Circularity (CR#29)

The Reliability Illusion Stack shows that each evaluation layer independently inflates reliability estimates, and the inflation multiplies. A system reporting 58% benchmark success may have 1-9% real-world reliability.

**CCP explanation:** Each evaluation layer applies compression-consistency to the assessed output. A coherent-but-wrong answer passes compression-based evaluation with the same probability as a coherent-and-correct answer. The inflation is *systematic* because:
1. Evaluation IS compression — "does this answer look right?" ≈ "is this answer internally consistent?"
2. Coherent falsehoods score identically to coherent truths on consistency checks
3. Multi-layer evaluation multiplies the false-pass rate

### 2.5 Hallucination Compounding as Compression Cascade (CR#53)

The Knowledge Retrieval Paradox quantifies that multi-agent hallucination compounds from 41% (single agent) to 79% (3 agents). CCP explains why:

**At each handoff:**
1. Agent produces output with hallucination rate h
2. Some hallucinations are *incoherent* (random errors) → next agent's compression filter catches these
3. Some hallucinations are *coherent* (structured falsehoods) → next agent's compression filter passes these
4. After k agents, only *the most coherent hallucinations* survive → they look maximally "true" to all downstream consumers

**The multi-agent pipeline is a coherence-maximizing filter that converges toward the most compressible output — which is NOT necessarily the truest output.**

## 3. The Unified Theory: Compression-Truth Gap (CTG)

We can now formalize the relationship:

### 3.1 Single-Agent CTG

For a single agent with compression-consistency criterion C and truth criterion T:
- P(C accepts truth) = p_t ≈ 1 (truth is usually compressible)
- P(C accepts coherent falsehood) = p_f ≈ 1 (coherent falsehoods are also compressible)
- P(C rejects random error) = p_r ≈ 1 (random errors are not compressible)

**Single-agent gap:** The model catches random errors but passes coherent falsehoods.

### 3.2 Multi-Agent CTG

For a chain of k agents, each applying compression-consistency selection:
- **Random errors:** Filtered at first handoff → low propagation
- **Coherent falsehoods:** Pass every handoff → high propagation
- **Truth:** Passes every handoff — BUT competes with coherent falsehoods at each step

**After k steps:** The output population is enriched in coherent falsehoods and depleted of random errors. Since coherent falsehoods and truth are compression-equivalent, the system has no mechanism to distinguish them.

### 3.3 The Verification Rescue

CCP's Experiment 3 shows that verification steps create compression asymmetry. In multi-agent terms:

> **Verification agents must create conditions where truth is cheaper to compress than falsehood.**

This means verification can't just check consistency — consistency checks are compression-equivalent and don't help. Verification must introduce **external constraints** that only truth satisfies:
- **Cross-modal verification** (compare text against structured data, video, code execution)
- **Causal checking** (verify that claimed causal chains actually produce claimed effects)
- **Empirical grounding** (check claims against external evidence sources)
- **Adversarial probing** (test whether the output's coherence survives perturbation)

## 4. Design Implications

### 4.1 Verification Architecture

VMAO (DD#266) treats verification as a first-class concern — now we understand WHY this works mechanistically:

| VMAO Feature | CCP Explanation |
|---|---|
| Independent verification model (Opus verifying Sonnet) | Different model = different compression basis → creates asymmetry |
| Property-based testing | External constraints that only truth satisfies |
| Replan on failure | Breaks compression lock-in by forcing new compression attempt |
| 23% overhead | The cost of truth pressure generation |

### 4.2 The Diversity-Verification Nexus

GUS Law 20 (Diversity Dividend) and CCP together explain why diverse agent teams outperform homogeneous ones:
- **Homogeneous team:** All agents have the same compression basis → coherent falsehoods pass all agents
- **Diverse team:** Different compression bases → a falsehood coherent to one model may be incoherent to another
- **Diversity IS verification** — it creates compression asymmetry naturally

### 4.3 Memory Design

For agent memory systems (DD#296), CCP implies:
- **Don't compress memory to consistency** — preserve the "rough edges" (uncertainty markers, contradiction flags, source provenance) that distinguish truth from coherent falsehood
- **Maintain multiple compression bases** — store the same fact in different representational formats
- **Decay coherence markers** — over time, reduce confidence in highly-consistent memories (they may be compression artifacts)

## 5. Proposed GUS Extensions

### Mechanism 32: Compression-Consistency Cascade
*Multi-agent handoffs act as coherence filters that pass coherent content and reject incoherent content regardless of truth value. Over k handoffs, this systematically enriches the output population in coherent falsehoods while depleting random errors — creating an increasingly "clean" but not increasingly "true" output. The cascade accelerates with chain length and decelerates with agent diversity.*

### Principle 81: Compression Asymmetry as Verification Criterion  
*Effective verification must create compression asymmetry — conditions where true statements are cheaper to encode than coherent falsehoods. Pure consistency checks are insufficient because coherent falsehoods are compression-equivalent to truth. Verification must introduce external constraints (empirical, causal, cross-modal) that break compression equivalence.*

### Principle 82: Preserve Truth-Discriminating Noise
*Agent memory and communication systems should preserve uncertainty markers, source provenance, confidence intervals, and other "noisy" signals that distinguish truth from coherent falsehood. Compressing communications to maximum consistency destroys the very information needed for downstream truth discrimination.*

### Prediction P91a: Coherence-Truth Divergence Scaling
*In multi-agent chains of length k with homogeneous models, the correlation between output coherence and output truth will decrease monotonically with k. At k=1, coherence and truth correlate >0.8. At k=5, correlation will drop below 0.5. Diverse-model chains will show slower divergence.*

### Prediction P91b: Verification Placement Effect
*Inline verification (between every k agents) will outperform terminal verification (at chain end) by a factor proportional to chain length. At chain length 5, inline verification every 2 steps will achieve >40% more truth preservation than terminal-only verification.*

## 6. Meta-Observation

This synthesis itself demonstrates the CCP: by integrating 5 deep-dives into a coherent framework, we've created a maximally-compressible explanation. The CCP tells us to be suspicious of exactly this — our synthesis is internally consistent, but is it *true*?

**Self-test:** The CCP framework makes specific, testable predictions (P91a, P91b) that could falsify it. A pure compression artifact would resist falsification. That our framework generates falsifiable predictions is weak evidence (but not proof) that it captures something beyond mere consistency.

---

## 7. Summary Table

| Failure Mode | Paper | CCP Mechanism | Detection Difficulty |
|---|---|---|---|
| Role Confusion | DD#342 | Style > tags because style is more compressible | High (requires probes) |
| Progressive Drift | DD#295 | Each step coherent → cumulative drift invisible to compression checks | Very High (14.6% detection) |
| Memory Degradation | DD#296 | Compression discards truth-discriminating details | Medium (measurable via NDCG) |
| Reliability Inflation | CR#29 | Consistency-based evaluation ≈ compression check → can't distinguish coherent falsehood | Very High (58% reported → 1-9% real) |
| Hallucination Compounding | CR#53 | Coherent hallucinations survive inter-agent compression filters | High (41% → 79% over 3 agents) |

---

*CR#191 | 2026-03-16 | ~2,800 words | Scout*
*The Compression-Truth Gap: Multi-agent systems don't converge on truth — they converge on compressibility.*
