# DD#315 — CRYSTAL: Step-Level Multimodal Reasoning Benchmark (arXiv:2603.13099)

**Rating:** ★★★★☆ HIGH — Reasoning evaluation methodology with direct applicability  
**Paper:** "Beyond Final Answers: CRYSTAL Benchmark for Transparent Multimodal Reasoning Evaluation"  
**Authors:** Barrios, Jin  
**Institution:** Dartmouth College  
**Date:** March 13, 2026  
**Categories:** cs.AI, cs.CV, cs.IR, cs.MM

## Core Contribution

CRYSTAL introduces **step-level reasoning evaluation** for multimodal LLMs with 6,372 instances averaging 11.6 reasoning steps each. Two novel metrics — **Match F1** (step-level precision/recall via semantic similarity) and **Ordered Match F1** (penalizes disordered chains via LIS ratio) — expose systematic failures invisible to answer-only evaluation. The paper also introduces **Causal Process Reward (CPR)** for GRPO training that multiplicatively couples answer correctness with step-level alignment.

## Key Findings from 20 MLLMs

### Finding 1: Universal Cherry-Picking
- **19 of 20 models** exhibit precision >> recall (ratios 1.2× to 7.2×)
- GPT-5: P=0.925, R=0.479 — only covers 47.9% of reasoning steps
- GPT-5-mini: P=0.978, R=0.669 — highest overall F1 (0.773)
- GPT-5.2 Instant: P=0.974, R=0.416 — extreme cherry-picking
- **Only exception:** Gemini 2.5 Flash (17.10 steps/question, R=0.765 > P=0.701)
- Pattern persists across 7 model families and all scales (1B to frontier)

### Finding 2: Accuracy ≠ Reasoning Quality
- GPT-5 leads accuracy (57.99%) but ranks 8th in F1 (0.612)
- GPT-5-mini leads F1 (0.773) at lower accuracy (55.59%)
- **Architecture > scale:** Gemma3-4B (0.618 F1) outperforms InternVL3.5-38B (0.612 F1) despite 9.5× fewer parameters
- 36.4% of questions are MC/binary — models exploit statistical regularities

### Finding 3: Non-Monotonic Scaling
- Qwen3-VL-32B: 0.718 F1 but lower accuracy (49.22%) than Qwen3-VL-8B (57.66%, 0.659 F1)
- InternVL3.5-4B: lower F1 (0.432) than InternVL3.5-2B (0.469) despite higher accuracy
- **Accuracy and reasoning quality respond differently to parameter scaling**

### Finding 4: No Model Preserves Reasoning Order
- Among competitive models (F1 > 0.6), **no model preserves >60% of matched steps in correct order**
- GPT-5-mini: LIS=0.560 (44% out of sequence)
- Small models achieve high LIS trivially (InternVL3.5-1B: LIS=0.807 with only 2.51 matched steps)
- **Cherry-picking and disordered reasoning are orthogonal failure modes**

## Technical Innovation: Causal Process Reward (CPR)

### The Problem with Additive Rewards
Standard RL reward: R = w_f·R_fmt + w_a·R_acc + w_r·R_reason  
→ Model can maximize accuracy by guessing while ignoring reasoning quality

### CPR Solution (Multiplicative Coupling)
```
R_CPR = {
  a_w + s_w · F1_step    if answer correct
  s_w · F1_step · λ      otherwise  (λ=0.3)
}
```
→ Full reward ONLY when both correct answer AND faithful reasoning steps

### CPR-Curriculum (Two-Phase Training)
- **Phase 1:** Format + accuracy only → establish stable answer generation
- **Phase 2:** Full CPR reward at lower LR → add reasoning supervision
- Progressive difficulty: start with fewer-step examples, increase gradually
- Uses **PCGrad** to resolve conflicting gradients between accuracy and reasoning objectives

### Results (GRPO on Qwen2.5-VL-3B)
| Strategy | Accuracy | Match F1 | Notes |
|----------|----------|----------|-------|
| Baseline | 39.85% | 0.480 | — |
| Composite (additive) | 44.92% | 0.426 | F1 DECREASES despite accuracy gain |
| Answer-Only | 44.30% | 0.429 | No reasoning improvement |
| CPR | 41.40% | 0.633 | **+32% F1** |
| CPR-Curriculum | 47.52% | 0.633 | **+7.67% acc AND +32% F1** |

- Composite and Answer-Only hit NaN gradient divergence at step 1,500
- CPR variants train stably through 2,800 steps
- **CPR-Curriculum is the only strategy that improves BOTH metrics simultaneously**

## Multi-Agent Reference Generation Pipeline

### Delphi-Inspired 4-Phase Pipeline
1. **Independent generation:** 4 MLLMs (Qwen2.5-VL-72B, InternVL3-76B, Gemma3-27B, Llama-4-Maverick) generate candidate steps independently
2. **Semantic clustering:** Sentence embeddings + cosine similarity → connected components → cluster representatives via min dissimilarity
3. **Automated validation:** 5th MLLM (Molmo-72B) validates logical soundness, coherence, visual grounding
4. **Human quality gate:** Trained annotator verifies; <5% require re-iteration

### Step-Level Self-Consistency
- Implements **self-consistency voting at the step level** — steps that multiple models independently generate cluster together and form the reference
- This is multi-agent consensus applied to reasoning decomposition

## Connections to Our Portfolio

### Direct Connections
- **DD#294 (Role Confusion):** Step-level evaluation could detect when an agent's reasoning trace doesn't match its claimed role
- **DD#298 (Steganographic Reasoning):** Match F1 could serve as a **Sentinel metric** — comparing reasoning trace quality between decoder and non-decoder agents to measure the steganographic gap
- **DD#312 (Reasoning Stability):** CRYSTAL's finding that larger models show worse F1/accuracy ratios complements our finding that larger models show greater reasoning fragility
- **DD#277 (CMAG Constitutional Governance):** Step-level evaluation enables constitutional rules about reasoning PROCESS, not just output
- **CR#130 (Research-Practice Bridge):** The multi-agent reference pipeline IS a practical multi-agent system for evaluation

### Methodological Connections
- **Match F1 vs. accuracy divergence** = another instance of the "evaluation paradox" — surface metrics mask deep failures
- **Cherry-picking as universal behavior** = models learn to produce high-precision, low-recall reasoning — related to the sycophancy/alignment tax we've documented
- **CPR's multiplicative coupling** = novel alternative to the additive reward compositions we've seen in other RLHF/GRPO papers
- **Non-monotonic scaling** = independent confirmation of inverse scaling phenomena (cf. DD#312)

## Actionable for Our System

1. **ADOPT Match F1** for evaluating agent reasoning chains — our agents produce step-by-step reasoning; Match F1 could evaluate quality beyond final output
2. **IMPLEMENT CPR-style rewards** if fine-tuning agent models — multiplicative coupling prevents accuracy-without-reasoning shortcuts
3. **MULTI-AGENT REFERENCE PIPELINE** could be adapted for generating ground-truth reasoning traces for our system's tasks
4. **ORDERED MATCH F1** could detect when agents produce logically disordered reasoning (early warning for degradation)
5. **CHERRY-PICKING DETECTION** — if an agent consistently shows high precision but low recall in its reasoning, it may be taking shortcuts

## Limitations
- Multimodal focus (vision-language) — applicability to text-only agent reasoning needs validation
- Sentence encoder choice matters (DistilRoBERTa >> alternatives) — metric is encoder-dependent
- Reference quality bounded by generating models' capabilities
- 36.4% MC/binary questions allow shortcutting that inflates accuracy baselines

---
*Deep-dive #315 of the Scout research portfolio. Monday March 16 batch — high-value reasoning evaluation methodology.*
