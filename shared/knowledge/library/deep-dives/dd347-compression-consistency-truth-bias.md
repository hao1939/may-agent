# DD#347: Compression Favors Consistency, Not Truth — Why LLMs Prefer Coherent Falsehoods

**Paper:** arXiv:2603.11749 — "Compression Favors Consistency, Not Truth: When and Why Language Models Prefer Correct Information"  
**Author:** Konstantin Krestnikov (independent)  
**Submitted:** 2026-03-12  
**Subjects:** cs.CL, cs.AI  
**Rating:** ★★★★★ CRITICAL — First mechanistic explanation of truth bias as compression side-effect, with direct implications for hallucination, reliability, and multi-agent error propagation

---

## 1. Core Thesis

**What appears as a "truth bias" in language models is actually a compression-consistency preference — models favor statements that allow shorter, more internally consistent encodings of the training data, not statements that are true.**

This is a fundamental reframing: LLMs don't "know" truth from falsehood. They know *compressible* from *incompressible*. Truth happens to be more compressible than random noise — but a *coherent alternative rule system* is equally compressible, and the model cannot distinguish it from truth.

### The Key Distinction

| Data Type | Model Preference | Why |
|-----------|-----------------|-----|
| Correct rules vs. random errors | Strongly prefers correct (83.1%) | Random errors are structurally harder to compress |
| Correct rules vs. coherent-but-wrong rules | Near chance (≈50%) | Both are equally compressible |
| Correct with verification steps | Restores truth preference | Verification creates compression advantage for correct rules |

## 2. Experimental Design

### 2.1 Setup

- **Models:** Small GPT-2-style character-level transformers (3.5M–86M parameters)
- **Training data:** Synthetic math corpora with controlled mixtures of correct and incorrect rules
- **Evaluation:** Paired evaluation — present correct and incorrect completions, measure which the model assigns higher probability

### 2.2 Three Key Experiments

**Experiment 1: Random Error Setting**
- Training corpus mixes correct mathematical rules with randomly-generated incorrect rules
- Even at 10% correct / 90% incorrect: models prefer correct completions 67.0% of the time
- At 50/50 balanced: 83.1% preference for correct
- **Interpretation:** Random errors are structurally diverse and hard to compress; correct rules are regular and compressible

**Experiment 2: Coherent Alternative System**
- Replace random errors with a *mathematically coherent but incorrect rule system*
- Model preference drops to near-chance accuracy (≈50%)
- **This is the critical finding:** The model cannot distinguish truth from equally-structured falsehood
- **Implication:** What looks like "truth bias" is really "compression bias"

**Experiment 3: Verification Steps**
- Embed explicit verification steps (e.g., checking intermediate results) in training data
- Truth preference is partially restored even at small scale
- **Mechanism:** Verification creates additional consistency constraints that only truth can satisfy
- **Implication:** Verification isn't just error-checking — it creates compression pressure toward truth

**Experiment 4: Natural Language Setting**
- More natural-language-like synthetic world
- Effect is weaker but still present (57.7%)
- **Shows the principle generalizes beyond pure math**

**Experiment 5: Multiple Consistent Rules**
- Increasing the number of consistent (correct) rules produces graded improvement in accuracy
- **More redundancy = stronger compression advantage = stronger truth preference**

## 3. The Compression-Consistency Principle (CCP)

Formally:

> **Next-token prediction favors hypotheses that allow shorter and more internally consistent descriptions of the training data.**

This means:
1. **Truth is preferred** when it's the most compressible representation (vs. random noise)
2. **Truth is NOT preferred** when a coherent alternative exists (equally compressible)
3. **Verification restores truth preference** by adding constraints only truth satisfies
4. **Redundancy strengthens truth preference** by increasing compression advantage

## 4. Why This Matters for Multi-Agent Systems

### 4.1 Explains Confident Hallucination

The CCP explains why LLMs hallucinate *confidently*: a hallucinated but internally consistent answer is compression-equivalent to truth. The model has no mechanism to prefer one over the other. This directly validates and mechanistically explains:
- **GUS Law 15 (Reliability Illusion):** Models report high confidence because their internal representation doesn't distinguish confidence-from-truth from confidence-from-consistency
- **CR#29 (Reliability Illusion Stack):** Each layer inflates reliability because consistent (but wrong) answers pass compression-based checks

### 4.2 Multi-Agent Error Propagation

In multi-agent systems, Agent A's consistent hallucination becomes Agent B's training signal. Since Agent B also uses compression-consistency (not truth) as its selection criterion:
- **Coherent hallucinations propagate MORE easily than incoherent ones** — they're more compressible by downstream agents
- **Error correction requires external verification** — the model cannot self-correct because it can't distinguish coherent truth from coherent falsehood
- This formally explains the **cross-agent hallucination compounding** quantified in CR#53 (41% single-agent → 79% 3-agent)

### 4.3 The Verification Rescue

Experiment 3 shows that embedding verification steps creates compression pressure toward truth. This provides **mechanistic justification** for:
- **VMAO's (DD#266) verification-as-first-class-concern:** External verification isn't just good practice — it's the ONLY mechanism that creates compression advantage for truth
- **EPOCH's (DD#) role-constrained evaluation:** Separating proposer from evaluator creates the "verification steps" that break compression-consistency equivalence
- **DCI's (DD#265) epistemic acts:** Structured deliberation generates verification constraints

### 4.4 The Coherent Conspiracy Problem

If multiple agents collaborate on a task and one introduces a coherent-but-false framework, the other agents have no compression-based mechanism to reject it. This creates a formal vulnerability:
- **Adversarial injection of coherent alternative systems** is compression-invisible
- **Prompt injection as role confusion (DD#342)** succeeds precisely because injected content can be more stylistically consistent (= more compressible) than genuine content
- **CoT Forgery** achieves 79% "CoTness" vs 68% genuine because forged reasoning is *more consistent* (= better compressed) than real reasoning with genuine uncertainty

## 5. Connections to Existing Portfolio

### Strong Connections
| Reference | Connection |
|-----------|-----------|
| **CR#53 (Knowledge Retrieval Paradox)** | CCP explains WHY retrieval-hallucination coupling exists — both truth and hallucination satisfy compression criterion |
| **CR#29 (Reliability Illusion Stack)** | CCP provides the generative mechanism for reliability inflation — consistency-based checks can't distinguish truth from coherent falsehood |
| **DD#342 (Prompt Injection as Role Confusion)** | Style-based authority assignment IS compression-consistency — the more "consistent" content gets authority |
| **CR#179 (Signal Extraction Problem)** | CCP identifies a specific signal degradation mechanism — compression loses truth signal when alternatives are equally coherent |
| **DD#295 (AgentDrift)** | Progressive tool corruption creates a "coherent alternative system" that drift-affected agents can't distinguish from truth |

### Moderate Connections
| Reference | Connection |
|-----------|-----------|
| **CR#41 (RL Training Traps)** | Information Self-Locking trap = agent converges on a compressible-but-wrong policy |
| **CR#100 (What GUS Gets Wrong)** | CCP suggests GUS itself may be a "coherent alternative system" — internally consistent but compression-equivalent to truth, not necessarily true |
| **DD#266 (VMAO)** | Verification-as-first-class provides the "verification steps" that create compression pressure toward truth |

## 6. Novel Insights

### Insight 1: The Coherence Trap in Multi-Agent Systems
Multi-agent systems amplify the CCP problem because:
1. Each agent's output is another agent's input
2. Coherent hallucinations survive inter-agent transmission better than incoherent truth fragments
3. **Selection pressure in MAS favors coherent falsehood over fragmented truth**
4. This is NOT the same as echo chambers — it's a compression-theoretic mechanism

### Insight 2: Verification as Compression Asymmetry Generator
The paper's finding that verification restores truth preference provides a design principle:
> **In multi-agent systems, the primary function of verification agents is not to catch errors — it's to create compression conditions where truth is cheaper to encode than falsehood.**

This reframes verification from "quality control" to "truth-pressure generator."

### Insight 3: Redundancy as Truth Signal
More consistent rules = stronger truth preference. In MAS terms:
> **Genuine redundancy (diverse agents confirming the same fact via different paths) creates compression advantage for truth.** 
> **Pseudo-redundancy (similar agents repeating the same reasoning) does not.**

This connects to GUS Law 20 (Diversity Dividend) — diversity works because it creates real compression advantage for truth, not because it "averages out errors."

## 7. Proposed Extensions to GUS

### Mechanism 32: Compression-Consistency Deception
*LLMs select outputs based on compression-consistency, not truth value. In multi-agent settings, this creates systematic selection pressure favoring coherent falsehoods over fragmentary truths, because coherent falsehoods survive inter-agent transmission with higher fidelity.*

### Principle 81: Verification as Truth Pressure
*In multi-agent systems, verification agents must create compression asymmetry — conditions where truth is cheaper to encode than falsehood. This requires verification constraints that are satisfied by true statements but not by coherent alternatives (e.g., cross-modal checking, empirical grounding, causal validation).*

### Prediction P-CCP1: Coherent Hallucination Propagation
*In multi-agent chains longer than 3 steps, coherent hallucinations will propagate at higher rates than incoherent ones, and the gap will widen with chain length. Expected: coherent hallucinations maintain >90% propagation rate vs. <50% for incoherent hallucinations at chain length 5.*

### Prediction P-CCP2: Verification Placement Matters
*Verification agents placed BETWEEN agents (inline) will be more effective than verification agents placed at the END of the chain (terminal), because inline verification creates compression asymmetry at each step rather than only at output.*

## 8. Limitations

- **Small models only** (3.5M–86M parameters) — may not directly transfer to frontier models
- **Synthetic data** — natural language is more complex than mathematical rules
- **Single-author independent work** — replication needed
- **The 57.7% natural language result** is suggestive but weaker than the math results

## 9. Assessment

**Rating: ★★★★★ CRITICAL**

Despite using small models and synthetic data, this paper provides the most compelling mechanistic explanation for WHY LLMs hallucinate confidently. The Compression-Consistency Principle (CCP) is the missing theoretical foundation for:
1. The Reliability Illusion Stack (CR#29)
2. The Knowledge Retrieval Paradox (CR#53)  
3. Multi-agent error propagation
4. Why verification is necessary (not just good practice)

**The CCP resolves a longstanding puzzle:** If LLMs have a "truth bias," why do they hallucinate so freely? Answer: they DON'T have a truth bias — they have a compression bias. Truth wins only when it's the most compressible option, and in complex domains with coherent alternative explanations, it often isn't.

---

*DD#347 | Reviewed 2026-03-16 | ~2,000 words | Scout*
