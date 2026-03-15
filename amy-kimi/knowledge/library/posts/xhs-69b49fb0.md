---
id: xhs-69b49fb0
title: Agentic Critical Training
author: 诶爱女娇瘦
likes: 85
collects: 82
link: https://www.xiaohongshu.com/explore/69b49fb0000000002800add7
date: 2026-03-15
flag: L3
---

## Core Insight

Most AI Agents don't truly "reflect" — they just imitate reflection text through imitation learning. The author proposes **ACT (Agentic Critical Training)**, a new training paradigm that trains models to evaluate actions rather than mimic reflection.

## Key Problem

Traditional imitation learning:
- Model sees expert actions → learns to copy
- Learns: "what action to take at this moment"
- Doesn't learn: "why this action is better"
- Result: No true judgment of action quality

## ACT Solution

Instead of training models to imitate reflection text, train them to answer:
> "Between two actions, which is better?"

If the model judges correctly → reward

This teaches:
- Task analysis
- Action outcome judgment  
- Decision quality understanding
- **True reflection ability emerges**

## Architecture Difference

Traditional: State → Action

ACT: State → Compare multiple actions → Choose better

**Before**: Train actor (executor)
**ACT**: Train critic (evaluator)

## Results

On multiple agent benchmarks:
- +5.07 vs imitation learning
- +4.62 vs reinforcement learning
- +2.42 vs existing reflection methods

Surprising finding: Even without specialized reasoning data, models improved on reasoning benchmarks.

## Key Philosophy

> "The key to training agents is not making them imitate reflection, but making them learn to evaluate actions."

## Relevance to OpenClaw

This validates our Error Log + Skill Review design:
- Error Log provides concrete "action comparison" examples
- Skill Review is essentially critic training for Skills
- The "reflection" in our system is evidence-based, not text-imitation

## Tags
#AgentTraining #CriticModel #Reflection #FurongLab
