# JustRL: Scaling 1.5B LLM with a Simple RL Recipe

**Source:** GitHub (thunlp/JustRL) | 267 stars | ICLR 2026 Blogpost Track Poster  
**Found:** Heartbeat 2026-04-26  
**Relevance:** ⭐⭐⭐⭐ High — RL scaling, simplicity-first approach, efficient training

---

## What It Is

**JustRL** demonstrates that competitive RL performance can be achieved with **simple techniques** — no complex methods required. It scales a 1.5B parameter LLM using a minimal RL recipe.

> "Simplicity at Scale — Competitive RL Performance Without Complex Techniques"

## Core Philosophy

JustRL challenges the trend toward increasingly complex RL training methods. It shows that:
- Simple RL recipes can match complex approaches
- Smaller models (1.5B) can be effectively scaled with RL
- Complex ≠ Better in reinforcement learning

## Key Results

| Metric | JustRL Approach |
|--------|-----------------|
| Model Size | 1.5B parameters |
| Method | Simple RL recipe |
| Performance | Competitive with complex methods |
| Complexity | Minimal |

## Repository Structure

```
JustRL/
├── assets/           # Figures and visualizations
├── data/             # Training data
├── evals/            # Evaluation scripts
├── train/            # Training implementation
└── README.md
```

## Technical Approach

The key insight: **Remove complexity, keep fundamentals.**

JustRL strips away:
- Fancy reward shaping
- Complex multi-stage training
- Elaborate data augmentation
- Sophisticated regularization

And achieves competitive results with:
- Basic RL algorithm (likely PPO or similar)
- Clean reward signals
- Standard data pipeline
- Simple training loop

## What This Means for Us

### 1. Simplicity Bias
Before adding complexity to our agent training, test if simple approaches suffice.

### 2. Small Model Viability
1.5B models with RL can be surprisingly capable. Don't assume we need 70B+ models.

### 3. RL for Agent Improvement
JustRL's approach could inform:
- Agent skill learning from feedback
- Preference-based agent training
- Reward modeling for agent behavior

### 4. Training Efficiency
Complex RL methods may not be necessary. Start simple, add complexity only when justified.

## Relevant to Our System

| Our Challenge | JustRL Insight |
|---------------|----------------|
| Agent skill improvement | Simple RL > complex heuristics |
| Model selection | 1.5B+RL may suffice for many tasks |
| Training costs | Simpler methods = lower compute |
| Evaluation | Competitive without complexity |

## Academic Context

- **Venue**: ICLR 2026 Blogpost Track Poster
- **Institution**: THUNLP (Tsinghua University NLP Lab)
- **Position**: Simplicity-first RL research

## Links

- Repo: https://github.com/thunlp/JustRL
- Paper: ICLR 2026 Blogpost Track
- Lab: https://github.com/thunlp (Tsinghua NLP)
