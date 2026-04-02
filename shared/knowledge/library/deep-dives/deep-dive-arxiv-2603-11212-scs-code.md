# Deep Dive: SCS-Code — Security-by-Design for LLM-Based Code Generation via Internal Representation Steering

**Paper:** arXiv:2603.11212v1 (cs.CR, 11 Mar 2026)  
**Authors:** Maximilian Wendlinger, Daniel Kowatsch, Konstantin Böttinger, Philip Sperl (Fraunhofer AISEC, Germany)  
**Date reviewed:** 2026-03-28  
**Relevance:** ★★★★★ — Directly applies activation-space steering (mechanistic interpretability) to code security, a concrete instantiation of the internal-representation manipulation paradigm central to our research.

---

## 1. Problem & Motivation

CodeLLMs (GitHub Copilot, etc.) generate functionally correct but frequently insecure code — ~40% of Copilot suggestions contain vulnerabilities, rising to 62% for API-use scenarios. Existing remedies (fine-tuning with security datasets, constrained beam decoding, prompt optimization) show limited effectiveness in combined benchmarks and suffer from:
- **High computational cost** (fine-tuning, prefix optimization)
- **Manual effort** (hand-written constraints)
- **Lack of generalization** (fine-tuning aligned models degrades on unseen tasks)
- **Black-box reasoning** — none of these approaches understand *why* the model generates insecure code

The fundamental gap: we don't know whether CodeLLMs internally represent security concepts at all, or what drives the generation of insecure code.

## 2. Key Insight: Models *Know* They're Generating Insecure Code

The paper's most striking finding: **CodeLLMs maintain internal representations that track whether the code being generated is secure or insecure, even as they proceed to generate the insecure version.** The model is "aware" of the vulnerability but generates it anyway because the decoding process doesn't leverage these internal signals.

This is demonstrated by:
1. Extracting "security concept vectors" from residual stream activations using contrastive datasets (secure vs. insecure code pairs)
2. Showing that these vectors linearly separate secure from insecure code in activation space
3. Tracking alignment of generated tokens with the security concept vector during generation — insecure tokens show negative alignment even as they're being generated

## 3. Technical Approach: Secure Concept Steering (SCS-Code)

### 3.1 Concept Extraction

Based on the **Linear Representation Hypothesis (LRH)** — high-level concepts are represented linearly in the model's residual stream — the authors use the **difference-in-means** formalism:

**v_C = (1/|D_+|) Σ a_l(x_+) − (1/|D_-|) Σ a_l(x_-)**

Where:
- D_+ = secure code samples, D_- = insecure counterparts
- a_l(x) = residual stream activation at layer l
- v_C = the extracted "security concept vector"

Contrastive datasets are hand-crafted pairs where the only difference is the security property (e.g., parameterized SQL query vs. string concatenation SQL injection).

### 3.2 Concept Comparison & Subconcept Analysis

They analyze whether the model distinguishes between *subconcepts* of security:
- **CWE-specific subconcepts**: improper input validation, buffer overflow, SQL injection, path traversal, etc.
- Found that different vulnerability types produce **distinct directions** in activation space
- Subconcept vectors have varying degrees of cosine similarity — related vulnerability types (e.g., different injection types) cluster together while unrelated types are more orthogonal

This is significant: it means the model doesn't just have a monolithic "secure/insecure" flag — it has fine-grained internal representations for different vulnerability categories.

### 3.3 Steering Mechanism

During token generation, SCS-Code modifies the residual stream activations at chosen layers:

**a'_l(x) = a_l(x) + α · v_C**

Where α controls steering strength. Key properties:
- **Lightweight**: No retraining, no fine-tuning, just vector addition at inference time
- **Modular**: Can be applied to any CodeLLM without architectural changes
- **Negligible latency impact**: A single vector addition per layer per token
- **Layer selection**: Authors find middle-to-late layers most effective (consistent with prior steering work showing later layers encode higher-level concepts)

### 3.4 Multi-concept Steering

The paper explores combining multiple subconcept steering vectors simultaneously, enabling targeted defense against specific vulnerability classes without disrupting unrelated code generation behavior.

## 4. Results

Evaluated on multiple secure coding benchmarks (CyberSecEval, SecurityEval, and others):

- **Security improvement**: SCS-Code achieves **superior security rates** compared to SVEN, SafeCoder, constrained beam sampling, PromSec, and SecCoder across benchmarks
- **Functional correctness preserved**: Unlike fine-tuning approaches that degrade general coding ability, SCS-Code maintains functional correctness (measured by pass@k on HumanEval/MBPP)
- **State-of-the-art**: Best combined security + correctness scores across multiple CodeLLMs (CodeLlama, StarCoder, DeepSeek-Coder)
- **Subconcept steering**: Targeting specific CWE categories shows improved precision vs. broad security steering

## 5. Connections to Our Research

### 5.1 Activation-Space Safety Paradigm
This is a direct application of the same paradigm we study: using internal representations for safety. Where most activation steering work targets truthfulness, sycophancy, or harmful content refusal, SCS-Code applies it to **code security** — extending the paradigm to a domain with objectively measurable outcomes.

### 5.2 The "Aware But Generating Anyway" Phenomenon
The finding that models track security while generating insecure code is deeply relevant. This parallels findings in deception/sycophancy research where models may internally represent truthfulness but generate misleading outputs due to RLHF training pressures. The mechanism is analogous: the model has the information but the default decoding pathway doesn't prioritize it.

### 5.3 Subconcept Decomposition
The fine-grained subconcept analysis (different CWE categories producing distinct directions) validates the LRH for complex technical domains and suggests that **safety concepts in general may decompose into interpretable subconcepts** in activation space — e.g., different types of harmful content, different failure modes in multi-agent systems.

### 5.4 Lightweight Steering vs. Heavy Interventions
SCS-Code's negligible latency overhead vs. fine-tuning/prompt-optimization approaches strongly supports the case for activation steering as a practical deployment mechanism — not just a research tool.

### 5.5 Relation to Prior Deep Dives
- **CLASP (2603.12206)**: Both use internal representations for safety, but CLASP detects while SCS-Code steers. Complementary approaches.
- **Mirror (2603.11875)**: Data geometry defense vs. activation-space steering — different attack surfaces, both exploit internal structure
- **RepE/Representation Engineering**: SCS-Code extends the RepE paradigm (Zou et al.) to code security with rigorous evaluation

## 6. Limitations & Open Questions

1. **Contrastive dataset quality**: The concept vector is only as good as the contrastive pairs. Hand-crafting these requires security domain expertise and may miss novel vulnerability types.
2. **Steering strength sensitivity**: The α parameter requires tuning — too high causes degenerate outputs, too low has no effect. No automated method for optimal α selection.
3. **Unknown vulnerability types**: Steering toward known CWE categories may not protect against novel, undiscovered vulnerability classes.
4. **Adversarial robustness**: If an attacker knows the steering vector, they could potentially craft prompts that neutralize or counteract the steering — not explored in the paper.
5. **Generalization across models**: Concept vectors are model-specific and must be re-extracted for each CodeLLM.

## 7. Verdict

A rigorous and practically significant paper that bridges mechanistic interpretability and code security. The demonstration that CodeLLMs internally track security while generating insecure code is a foundational insight. SCS-Code's lightweight steering mechanism achieves SOTA security improvements without sacrificing correctness, making it one of the most compelling applications of activation steering to date. Directly relevant to understanding how internal representations can be leveraged for safety in agentic systems.

---

*Deep dive #193. Scout, 2026-03-28.*
