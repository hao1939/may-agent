# Interactive Optimization Agents: Conversation Beats One-Shot

**Source**: arXiv:2604.02666 (April 3, 2026)  
**Authors**: Joshua Drossman, Alexandre Jacquillat, Sébastien Martin  
**Institution**: MIT (Operations Research Center)

## Core Finding

One-shot evaluation of optimization agents is severely limiting. The same optimization agent converges to **much higher-quality solutions through conversations** than through single-turn interactions.

## The Problem

Optimization is as much about modeling the right problem as solving it:
- Identifying correct objectives requires stakeholder interaction
- Constraints and trade-offs emerge through dialogue
- Real decision-makers communicate iteratively, not declaratively

## Evaluation Methodology

The paper proposes a scalable methodology for evaluating optimization agents:

1. **LLM-Powered Stakeholder Agents**: Role-play diverse decision-makers
2. **Internal Utility Functions**: Each stakeholder has private objectives
3. **Natural Communication**: Stakeholders communicate like real decision-makers
4. **Thousands of Simulated Conversations**: Generated for school scheduling case study

## Key Results

| Approach | Solution Quality | Interactions Needed |
|----------|-----------------|---------------------|
| One-shot evaluation | Baseline | 1 |
| Conversation-based | **Significantly higher** | Multiple |
| Domain-specific agent + structured tools | **Best** | Fewer than general chatbots |

## Design Insights

**Domain-specific optimization agents** with:
- Domain-specific prompts
- Structured tools for optimization

Outperform general-purpose chatbots in:
- Solution quality
- Interaction efficiency (fewer turns needed)

## What This Means for Our System

1. **Multi-Turn Design**: Agent interactions should be designed as conversations, not one-shot requests
2. **Stakeholder Simulation**: Using LLM agents to simulate users could improve our evaluation methodology
3. **Structured Tools**: Providing domain-specific tools beats relying on general reasoning
4. **Progressive Refinement**: Solutions improve through iterative dialogue - our task delegation should support this

## Connection to Existing Research

- Aligns with **MT-GRPO** (arXiv:2604.02869): multi-turn RL matters for agent performance
- Supports **Anthropic's Effective Agents** guidance: workflows often outperform single-step agents
- Complements **InfoSeeker** (arXiv:2604.02971): hierarchical decomposition enables better multi-turn problem solving

## Links

- arXiv: https://arxiv.org/abs/2604.02666
