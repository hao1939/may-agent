# H-084: Agent Learning via RL Training

**Status**: PROPOSED  
**Date**: 2026-04-28  
**Source**: verl (ByteDance), OpenManus-RL (UIUC+MetaGPT)  
**Related**: [HB-0002](../library/posts/HB-0002-verl-bytedance.md), [HB-0004](../library/posts/HB-0004-openmanus-rl.md)

## Hypothesis

Our agents can improve from experience through RL-based post-training, using frameworks like verl to train specialized agent models from interaction trajectories.

## Background

Current findings from Chinese AI ecosystem show a strong trend toward agent learning:

1. **verl** (ByteDance Seed): Production RL training framework for LLMs with HybridFlow programming model
2. **OpenManus-RL**: Live exploration of RL-based agent tuning on GAIA/AgentBench/WebShop/OSWorld
3. **Deepseek-R1/QwQ-32B**: Success of reasoning models trained with RL

All these point to a paradigm shift: from static agents to learning agents.

## Current State

Our system has **no learning mechanism**:
- Agents don't improve from interactions
- No feedback loop for better performance
- Static capabilities over time
- Skills are hand-crafted, not learned

## Proposed Approach

### Phase 1: Trajectory Collection
- Record agent sessions (input, actions, outcomes)
- Label successful vs failed trajectories
- Build agent-specific datasets

### Phase 2: RL Training
- Use verl or similar framework
- Train on agent trajectories with reward signals
- GRPO/PPO algorithms for multi-turn agent interactions

### Phase 3: Deployment
- Load fine-tuned models for specific agents
- Continue collecting trajectories for iterative improvement

## Key Questions

1. **Reward Design**: What constitutes success for each agent type?
2. **Data Volume**: How many trajectories needed per agent?
3. **Compute Cost**: Can we afford regular retraining?
4. **Catastrophic Forgetting**: How to preserve general capabilities?

## Validation Criteria

- [ ] Define reward functions for at least 2 agent types
- [ ] Collect 100+ trajectories per agent
- [ ] Train agent-specific models using verl
- [ ] Measure improvement on held-out tasks
- [ ] Compare RL-trained vs base model performance

## Alternatives Considered

1. **In-context learning**: No parameter updates, limited improvement
2. **Skill distillation**: Extract patterns from trajectories → skills (COSPLAY approach)
3. **Prompt optimization**: Auto-optimize prompts (less powerful than RL)

## Risks

- RL training is compute-intensive
- May require significant infrastructure
- Could destabilize existing capabilities
- Overfitting to specific task distributions

## Next Steps

1. Evaluate verl framework for our use case
2. Design reward functions for scout/agent-type agents
3. Start trajectory collection pipeline
4. Small-scale experiment with 1 agent type

## Related Work

- [HB-260437](../library/posts/HB-260437-cosplay-skill-co-evolution.md): Skill co-evolution approach
- [HB-260410](../library/posts/HB-260410-mt-grpo-tool-calling-rl.md): MT-GRPO for tool-calling
- [HB-0002](../library/posts/HB-0002-verl-bytedance.md): verl framework
