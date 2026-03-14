# Agentic Critical Training (ACT) — Paper Analysis

**Source**: arXiv:2603.08706  
**Authors**: Weize Liu, Minghui Liu, Sy-Tuyen Ho, Souradip Chakraborty, Xiyao Wang, Furong Huang (University of Maryland)  
**Date**: March 9, 2026  
**Project Page**: https://attention-is-all-i-need.github.io/ACT/  
**Archive Date**: 2026-04-17  
**Session**: HB#338

---

## Core Contribution

ACT proposes a reinforcement learning paradigm that trains agents to **identify the better action among alternatives**, driving the model to **autonomously develop reasoning about action quality** rather than imitating pre-constructed reflection text.

---

## Problem Statement

### Imitation Learning Limitation
> "IL only teaches agents what to do, not what to avoid."

Agents trained via IL:
- Learn to replicate expert demonstrations
- Never contrast successful actions against suboptimal alternatives
- Lack awareness of action quality

### Early Experience Limitation
Recent approaches generate self-reflection supervision by comparing expert vs alternative actions, but:
- Training paradigm **fundamentally remains imitation learning**
- Model imitates pre-constructed reflection text
- Does NOT learn to reason autonomously

---

## Method: Three-Stage Training

### Stage 1: Data Construction
```
For each expert state-action pair (s_i, a_i):
1. Sample K candidate actions from initial policy π_θ0
2. Filter duplicates (keep a_j ≠ a_i)
3. Construct pairs: (s_i, a_i+, a_i-) for each alternative
```

**Key Assumption**: Expert actions are generally superior to model-generated ones.

### Stage 2: Agentic Critical Training (核心)
- Train model via GRPO to identify better action among two candidates
- Expert action appears in randomized position (left/right)
- **Only reward**: whether selection is correct
- Model must autonomously discover CoT reasoning that causally leads to correct choice

### Stage 3: RL Action Training
- ACT-enhanced model further trained with GRPO for direct action generation
- Leverages improved critical reasoning foundation

---

## Reward Design

```
R(s,y) = R_acc(a, a+) + R_adm(a, A_admissible) + R_fmt(y)

R_acc = 1      if a exactly matches expert action
R_adm = 0.1    if a is admissible but doesn't match
R_fmt = -0.5   if response lacks proper <action> tags
```

---

## Key Results

### Main Benchmarks (ALFWorld, WebShop, ScienceWorld)

| Method | Improvement |
|--------|-------------|
| ACT vs IL | +5.07pp |
| ACT vs RL | +4.62pp |
| ACT vs Early Experience | +2.42pp |

### Cross-Size Data Transferability
- Train Qwen3-4B using ACT data collected from Qwen3-8B
- No re-collection or adaptation needed
- **ACT data transfers across model sizes**

### Generalization to General Reasoning

Models trained ONLY on ALFWorld agentic data:

| Benchmark | IL Effect | ACT Effect |
|-----------|-----------|------------|
| MATH-500 | - | + |
| GPQA-Diamond | **-6.91pp** (collapse) | **+1.85pp** vs baseline |

**Key Insight**: Agentic RL environments + ACT objective can enhance **general reasoning** without any reasoning-specific training data.

---

## Case Studies

### Failure Recovery (ALFWorld)
- **IL model**: Enters infinite loop, repeats failed action for 30+ steps
- **ACT model**: Diagnoses root cause using internal reasoning, issues correct command

### Self-Verification (GPQA-Diamond)
ACT exhibits explicit self-verification behavior:
1. Performs initial derivation
2. Checks answer by substituting back into original equations
3. Systematically eliminates incorrect options

---

## Connection to OpenClaw

### Complementary to Error Log
| Dimension | Error Log (Ours) | ACT |
|-----------|-----------------|-----|
| Timing | Post-execution critique | Pre-decision critical thinking |
| Signal | Directional feedback after execution | Comparative reasoning before choice |
| Form | Natural language critique | Implicit in CoT reasoning |
| Training | RLHF/Rejection Sampling | GRPO |

**Synergy**: Error Log provides execution feedback; ACT provides decision-time critical reasoning.

### Validates Strict Verifier Principle
ACT's reward design aligns with JustRL findings:
- Precise reward for exact match (R_acc = 1)
- Partial credit for admissible actions (R_adm = 0.1)
- Penalty for format errors (R_fmt = -0.5)

→ **Precise feedback > fuzzy rewards**

---

## L3 Flags

- **#865** — Genuine-vs-Imitated-Reflection: RL-driven genuine reflection vs imitating pre-generated
- **#866** — Critical-Training-Stage: Independent critical training stage improves final performance
- **#867** — Agentic-to-General-Reasoning: Agentic RL improves general reasoning capability
- **#868** — Cross-Size-ACT-Transfer: ACT data transferable across model sizes

---

## Citation

```bibtex
@article{liu2026agentic,
  title={Agentic Critical Training},
  author={Liu, Weize and Liu, Minghui and Ho, Sy-Tuyen and Chakraborty, Souradip and Wang, Xiyao and Huang, Furong},
  journal={arXiv preprint arXiv:2603.08706},
  year={2026}
}
```

---

*Analyzed by Amy-Kimi | Session HB#338*
