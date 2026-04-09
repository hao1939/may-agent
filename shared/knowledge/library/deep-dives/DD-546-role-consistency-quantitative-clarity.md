# DD#546: Quantitative Role Clarity — Reducing Agent Role Overstepping from 46.4% to 8.4%

**Date:** 2026-04-06
**Paper:** arXiv:2604.02770 — "Improving Role Consistency in Multi-Agent Collaboration via Quantitative Role Clarity"
**Rating:** ★★★★ HIGH

## Key Finding

A differentiable "role clarity" metric that measures and corrects agent role overstepping in multi-agent systems. Role assignment matrix S(ϕ) measures semantic similarity between agent behavior trajectories and role descriptions. Role clarity matrix M(ϕ) = softmax(S(ϕ)) - I, whose Frobenius norm quantifies total role deviation. Used as LoRA fine-tuning regularizer: overstepping 46.4% → 8.4% (Qwen), 43.4% → 0.2% (Llama). Modest but consistent end-to-end task improvement (+2-9%).

## Core Problem

Agents in multi-agent systems routinely violate role boundaries at 43-46% rates across mainstream models. CEO starts writing code, testers make product decisions, programmers review their own code. Not cosmetic — directly reduces task success via duplicated work, missed subtasks, coordination chaos.

## Technical Approach

1. **Role Assignment Matrix**: Embed role descriptions and behavior trajectories via mean-pooled hidden states, compute cosine similarity matrix
2. **Role Clarity Matrix**: Row-wise softmax minus identity — diagonal = role inconsistency, off-diagonal = role overstepping
3. **Differentiable Regularizer**: Cross-entropy loss on correct role assignments added to MLE loss during LoRA fine-tuning
4. **Rejection Sampling**: Filter for clean trajectories (proper termination) as training data

## Key Results

| Model | Overstepping Before → After | Task Success Before → After |
|---|---|---|
| Qwen 2.5 7B | 46.4% → 8.4% | 0.677 → 0.691 (+2.1%) |
| Llama 3.1 8B | 43.4% → 0.2% | 0.617 → 0.676 (+9.5%) |

Dramatic role clarity gains translate to only modest task success gains — role consistency is necessary but not sufficient.

## Why This Matters

- **First quantifiable, differentiable definition** of role clarity in MAS (prior approaches: prompt-based, rule-based, or evaluation-only)
- **LoRA-compatible**: lightweight fine-tuning, works with any base model, role clarity "baked in"
- **46% overstepping rate is a wake-up call** for unoptimized production MAS

## Connections

- DD#534 (Intellectual Elites): Role overstepping is a mechanism for power-law centralization
- DD#535 (Sycophancy Propagation): Complementary failure — agents doing each other's jobs vs agreeing with each other
- CR#290 (MAS Scaling Paradox): Overstepping directly contributes to scaling paradox
- DD#544 (Textbook Formalization): Type-system role enforcement as stronger alternative

## Predictions

- P308: >30% overstepping rates in most production MAS that haven't specifically optimized
- P309: Role clarity + verification architectures (CR#295) → multiplicative improvements

**Seeds KE-088.**
