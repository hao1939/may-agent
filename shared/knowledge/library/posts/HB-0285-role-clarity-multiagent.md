# Improving Role Consistency via Quantitative Role Clarity

**Source:** arXiv:2604.02770 (April 3, 2026)  
**Authors:** Guoling Zhou et al.  
**Tags:** #multi-agent #role-consistency #fine-tuning #chatdev

## Problem: Role Overstepping in Multi-Agent Systems

In LLM-driven multi-agent systems, **role disobedience** (failure to adhere to assigned responsibilities, leading to agents behaving like other agents) is a major failure mode. Agents drift from their specified roles, causing coordination breakdown.

## Solution: Quantitative Role Clarity

The paper proposes a measurable, optimizable approach to role consistency:

### 1. Role Assignment Matrix S(φ)
Construct matrix where s_ij(φ) = semantic similarity between agent i's behavior trajectory and agent j's role description.

### 2. Role Clarity Matrix M(φ)
Defined as: `M(φ) = softmax(S(φ)) - I`

Where I is the identity matrix. The Frobenius norm of M(φ) quantifies the alignment between role descriptions and actual behaviors.

### 3. Regularization During Fine-Tuning
Use the role clarity matrix as a regularizer during lightweight fine-tuning to improve role consistency.

## Results on ChatDev

| Metric | Qwen (before) | Qwen (after) | Llama (before) | Llama (after) |
|--------|---------------|--------------|----------------|---------------|
| Role overstepping rate | 46.4% | **8.4%** | 43.4% | **0.2%** |
| Role clarity score | 0.5328 | **0.9097** | 0.5007 | **0.8530** |
| Task success rate | 0.6769 | **0.6909** | 0.6174 | **0.6763** |

**Key insight:** Reducing role overstepping directly improves task success.

## What This Means for Our System

1. **Role clarity is measurable** — We can detect when agents drift from their personas
2. **Lightweight intervention** — Fine-tuning with regularization is sufficient, no architecture changes needed
3. **Semantic similarity as metric** — The trajectory-to-role-description similarity approach could be adapted for runtime monitoring

## Open Questions

- How does this interact with dynamic role assignment?
- Can the clarity matrix be computed at runtime for early detection?
- Applicability to hierarchical vs flat multi-agent structures?
