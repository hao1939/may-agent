# ProCeedRL: Process Critic with Exploratory Demonstration RL

**Source:** arXiv:2604.02006 (Apr 2, 2026)  
**Authors:** Jingyue Gao, Yanjiang Guo, Xiaoshuai Chen, Jianyu Chen (Tsinghua University)  
**Tags:** #reinforcement-learning #agent-reasoning #process-supervision #exploration

## Summary

This paper identifies a **structural failure mode in multi-turn agentic RL**: suboptimal actions elicit noisy observations that further degrade reasoning, creating a "vicious circle" of accumulated errors that's hard to recover from.

## Key Innovation: ProCeedRL Framework

ProCeedRL shifts exploration from **passive selection to active intervention**:

### 1. Process-Level Critic
- Monitors interactions in **real-time** at each step
- Outputs scalar score + textual critique
- Detects adverse actions (score ≤ threshold)

### 2. Refined Exploratory Demonstration
- When adverse step detected: **rewind and refine**
- Replace suboptimal action with refined demonstration
- Breaks the "vicious circle" before errors compound

### 3. Training with chord-φ
- Demonstration steps masked in failed trajectories (off-policy)
- Special coefficient σ(d) = π(d)·(1-π(d)) stabilizes training
- Combines on-policy samples + refined demonstrations

## Results

| Method | Bamboogle | MuSiQue | Frames | GAIA | WebwalkerQA |
|--------|-----------|---------|--------|------|-------------|
| ReAct | 50.93% | 18.64% | 31.92% | 9.69% | 18.62% |
| +DAPO | 70.83% | 23.60% | 43.59% | 10.10% | 19.51% |
| **+ProCeedRL** | **73.87%** | **29.52%** | **46.42%** | **13.79%** | **23.01%** |

Key findings:
- **Exceeds model's saturated exploration limit**
- Weaker models (Qwen3-8B) suffer more from noisy context than stronger ones
- Environmental noise amplifies action errors → confirms "vicious circle"

## Core Insight

> "In multi-turn agentic tasks, noisy environmental feedback degrades model reasoning ability, with weaker models affected more severely. These phenomena make recovery extremely difficult."

The insight is that **context noise compounds** — once a bad action produces misleading observations, subsequent reasoning is corrupted, making recovery increasingly unlikely.

## Implications for Our System

1. **Process-level supervision > outcome-only RL** — catching errors mid-trajectory prevents compounding
2. **Real-time critic architecture** — could be integrated into our agent harness for self-correction
3. **The "vicious circle" concept** — explains why some agent tasks spiral into failure; suggests need for early intervention mechanisms
4. **Refinement demonstrations** — similar to our skill distillation approach but applied to RL exploration

This validates that **agent reasoning needs continuous monitoring**, not just end-of-task evaluation.
