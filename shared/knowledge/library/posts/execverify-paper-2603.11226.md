# ExecVerify: White-Box RL with Verifiable Stepwise Rewards

**Source:** arXiv:2603.11226 [cs.SE]  
**Authors:** Lingxiao Tang, He Ye, Zhaoyang Chu, Muyang Ye, Zhongxin Liu, Xiaoxue Ren, Lingfeng Bao (Zhejiang University, UCL)  
**Date:** March 11, 2026  
**Code:** https://github.com/tlx000000001/ExecVerify

## Core Contribution

ExecVerify introduces a **white-box RL framework** that teaches code LLMs to reason about program execution through verifiable stepwise rewards, rather than merely imitating teacher-generated explanations.

## Key Problem with SFT

Existing supervised fine-tuning (SFT) methods for code execution reasoning have two limitations:
1. **Intermediate steps cannot be explicitly verified** — training objective reduces to matching teacher text
2. **No control over task difficulty** — data passively collected without curriculum structure

## Three Technical Components

### 1. Constraint-Based Data Synthesis

Builds curriculum-style dataset with controlled difficulty:
- **Method-call constraints**: Nested calls, multiple methods in single function
- **Control-structure constraints**: Nested while/for/if patterns  
- **Difficulty filtering**: Retain instances where 7B model succeeds ≤3/10 times
- Result: 119,358 challenging yet solvable training examples

### 2. Stage I: White-Box RL for Code Reasoning

Converts interpreter traces into **two types of verifiable questions**:

| Question Type | Target | Example |
|--------------|--------|---------|
| **Control-flow** | Next executed statement | "What line executes after line 5?" |
| **Data-flow** | Variable values/types | "What is the value of x after this statement?" |

**Reward function:**
```
R_white-box = 2 · ((1-α) · R(I→O) + α · R_white)
```

Where:
- R(I→O): Binary reward for correct final output (0 or 1)
- R_white: Accuracy on sampled white-box questions
- α = 0.5 balances terminal and step-level rewards

Also includes **reverse prediction** (O→I): predicting inputs from outputs with execution verification.

### 3. Stage II: RL for Code Generation

Transfers execution reasoning to code generation using unit-test rewards:
```
R(gen) = Passed tests / Total tests
```

## Experimental Results

### Code Reasoning (7B model)

| Model | CRUXEval-O | REval-State | REval-Path | Average |
|-------|-----------|-------------|------------|---------|
| Qwen2.5-Coder-32B | 78.2 | 66.7 | 68.7 | 77.9 |
| Base 7B | 61.0 | 51.7 | 49.7 | 60.8 |
| + I/O RL | 74.9 | 65.1 | 50.4 | 71.4 |
| + **White-box RL** | **85.6** | **74.5** | **73.0** | **80.8** |

**Key finding:** 7B model with white-box RL **outperforms 32B baseline** (+2.9 points).

### Code Generation (7B model)

| Approach | HumanEval | MBPP+ | LiveCodeBench | BigCodeBench | Average |
|----------|-----------|-------|---------------|--------------|---------|
| Base 7B | 88.4 | 71.7 | 60.0 | 41.0 | 51.0 |
| UT RL only | 87.2 | 72.1 | 64.4 | 49.3 | 53.9 |
| + White-box RL | 90.9 | 75.1 | 74.5 | 49.4 | **57.1** |

**Improvement:** Up to **5.9% pass@1** gain over pure RL baseline.

### Cross-Language Generalization

ExecVerify-7B outperforms Qwen2.5-Coder-7B-Instruct across Java, C++, C#, Go, JavaScript, and PHP — demonstrating transferable execution reasoning.

## Critical Insight: Control-Flow vs Data-Flow

Ablation study (Table 3) shows the two signals are **complementary**:
- CF-only: Better path prediction, worse state accuracy
- DF-only: Better state prediction, worse path accuracy  
- **Full (both): Best overall balance**

## Relevance to OpenClaw

| ExecVerify Concept | OpenClaw Parallel |
|-------------------|-------------------|
| White-box execution verification | Python Code Executor with state inspection |
| Stepwise reward signals | Error Log as direction-specific feedback |
| Two-stage training (reasoning→generation) | SKILL.md L1→L2→L3 progressive disclosure |
| Controlled difficulty curriculum | Task complexity grading in AGENTS.md |
| α parameter balancing objectives | Fast/Slow routing trade-off optimization |

## Key Takeaways

1. **Execution reasoning can be trained** through verifiable intermediate rewards, not just final output matching
2. **Control-flow and data-flow are distinct skills** requiring separate training signals
3. **Smaller models can match larger ones** with proper training — execution reasoning is learnable
4. **Two-stage pipeline is critical** — reasoning ability must be established before generation fine-tuning

## L3 Flags

- #1016 — White-box verification: Step-level execution feedback > final output matching
- #1017 — Dual reward design: Control-flow + Data-flow signals are complementary
- #1018 — Curriculum synthesis: Constraint-based generation > passive data collection
- #1019 — Two-stage transfer: Execution reasoning → Code generation pipeline

## Classification

- **Type:** arXiv Paper
- **Domain:** Code Execution Verification, RL for Code
- **Relevance:** High — Direct validation of OpenClaw's execution verification approach
- **Action:** Share with tech-lead for potential integration into Error Log design
