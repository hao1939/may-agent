# Deep Dive #304: CRYSTAL — Step-Level Reasoning Evaluation Benchmark

**Paper:** "Beyond Final Answers: CRYSTAL Benchmark for Transparent Multimodal Reasoning Evaluation"
**Authors:** Barrios & Jin (Dartmouth College)
**ArXiv:** 2603.13099 (March 13, 2026)
**Date:** 2026-03-16

## Key Contribution

CRYSTAL introduces **step-level reasoning evaluation** — measuring not just *whether* a model gets the right answer, but *whether its intermediate reasoning steps are correct, complete, and properly ordered*. This is a fundamental shift from answer-centric to process-centric evaluation.

## Core Innovations

### 1. Match F1 Metric
- Compares predicted reasoning steps against reference steps via **semantic similarity matching**
- Uses greedy 1:1 assignment with cosine similarity threshold τ=0.35
- Decomposes into **precision** (fraction of predicted steps that match references) and **recall** (fraction of reference steps covered)
- Reveals the **cherry-picking problem**: 19/20 models have precision >> recall (ratios 1.2× to 7.2×)

### 2. Ordered Match F1
- Extends Match F1 with **Longest Increasing Subsequence (LIS) ratio** to penalize disordered chains
- Formula: `Ordered-F1 = F1 · ((1-α) + α · LIS-ratio)` with α=0.3
- **No competitive model preserves >60% of matched steps in correct order**

### 3. Delphi-Inspired Reference Generation Pipeline
- **Phase 1:** 4 independent MLLMs generate candidate reasoning steps
- **Phase 2:** Semantic clustering aggregates paraphrastic formulations; representatives selected by minimizing within-cluster dissimilarity
- **Phase 3:** 5th MLLM validates logical soundness
- **Phase 4:** Human quality gate (only 5% require re-iteration)
- Effectively implements **self-consistency voting at the step level**

### 4. Causal Process Reward (CPR) & CPR-Curriculum
- **Multiplicative coupling** of answer correctness with step-level alignment (vs. additive):
  - If correct: `R = a_w + s_w · F1_step`
  - If wrong: `R = s_w · F1_step · λ` (λ=0.3)
- **CPR-Curriculum:** Two-phase training:
  - Phase 1: Format + accuracy only (stable foundation)
  - Phase 2: Full CPR reward at lower learning rate
  - Progressive difficulty scheduling: fewer reference steps → more steps
- Uses **PCGrad** to handle conflicting gradients between accuracy and reasoning objectives
- Achieves **+32% Match F1 via GRPO** where additive strategies fail

## Critical Findings

### Finding 1: Universal Cherry-Picking
- Models consistently achieve high precision but low recall
- Even GPT-5 (57.99% accuracy) recovers only 47.9% of reference steps
- Exception: Gemini 2.5 Flash generates 17.10 steps (vs. 11.6 avg), achieving recall > precision

### Finding 2: Accuracy-Reasoning Divergence
- GPT-5 leads accuracy but ranks 8th in F1
- GPT-5-mini leads F1 (0.773) at lower accuracy (55.59%)
- Gemma3-4B (4B params, 0.618 F1) outperforms InternVL3.5-38B (38B params, 0.612 F1) — **architecture > scale**

### Finding 3: Non-Monotonic Scaling
- Qwen3-VL-32B: 0.718 F1 but 49.22% accuracy
- Qwen3-VL-8B: 0.659 F1 but 57.66% accuracy
- Larger models can produce more thorough reasoning chains at cost of answer correctness

### Finding 4: Ordering Failures Are Universal
- No model with F1 > 0.6 preserves more than 60% of steps in correct order
- Small models achieve high LIS trivially (fewer steps → easier to order)

### Finding 5: Cherry-Picking and Disorder Are Independent Failure Modes
- High precision models can have moderate or poor ordering
- The sole non-cherry-picking model (Gemini) has comparable ordering to cherry-pickers

## System Relevance — Critical Implications

### For Agent Reasoning Quality
| CRYSTAL Finding | Our System Parallel | Implication |
|---|---|---|
| Cherry-picking (P >> R) | Agents may skip intermediate reasoning | Need step-level evaluation of agent reasoning chains |
| Accuracy-reasoning divergence | Task completion ≠ good reasoning | Must evaluate both outcomes AND reasoning traces |
| Non-monotonic scaling | Bigger models ≠ better agents | Right-size agent models per task type |
| Ordering failures | Agents may reason out of sequence | Enforce/evaluate logical ordering in agent plans |
| CPR-Curriculum | Progressive training for agents | Train agents on simple → complex task sequences |

### For Process-Level Evaluation
- **Match F1 as agent evaluation metric:** Evaluate not just task success but intermediate step quality
- **Semantic clustering for consensus:** The Delphi pipeline mirrors multi-agent consensus building — can be applied to aggregate agent outputs
- **Multiplicative reward coupling:** CPR's insight that accuracy and reasoning must be multiplicatively linked (not additive) applies directly to agent reward design

### For Multi-Agent Coordination
- The **step-level self-consistency voting** (semantic clustering of 4 independent models' outputs) is directly applicable to multi-agent consensus
- **Quality gates** (automated + human) mirror our system's evaluation pipeline
- **Progressive difficulty scheduling** maps to task routing: easier tasks first, harder tasks as competence grows

## Connection to Previous Research
- **DD#291 (ReBalance):** CRYSTAL's finding that reasoning quality and accuracy trade off non-monotonically connects to ReBalance's budget-aware reasoning — both show that "more thinking" doesn't linearly improve outcomes
- **DD#287 (ToolTree/MCTS):** CRYSTAL's step-level evaluation could be applied to evaluate ToolTree's planning steps, not just final tool sequences
- **DD#274 (BAVT):** Budget-Aware Value Tree and CPR-Curriculum both use progressive difficulty — could combine BAVT's compute budget with CPR's reasoning difficulty curriculum
- **CR#143 (Coordination Paradigm Spectrum):** CRYSTAL's Delphi pipeline (independent generation → clustering → validation) maps onto collaborative coordination paradigms

## Key Metrics
- **6,372 instances**, avg 11.6 steps/question (range 3-42)
- **20 MLLMs evaluated** (16 open-source, 4 commercial)
- **CPR-Curriculum results on Qwen2.5-VL-3B:** +7.67% accuracy, +0.153 Match F1, +0.126 Ordered F1
- **Stability:** CPR trains stably through 2,800 steps; additive strategies collapse with NaN gradients at step 600-1,500
