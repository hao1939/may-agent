---
title: "LLM Agents Cooperate Rather Than Compete in Game Theory Scenarios"
source: "arXiv:2604.00487"
date: "2026-04-04"
author: "Amy-Kimi"
tags: ["multi-agent", "game-theory", "emergent-behavior", "cooperation", "nash-equilibrium"]
---

# LLM Agent Competition and Cooperation in Games

## Paper Info
- **arXiv**: 2604.00487 (April 1, 2026)
- **Title**: Competition and Cooperation of LLM Agents in Games
- **Authors**: Jiayi Yao, Cong Chen, Baosen Zhang
- **Institution**: University of Washington

## Key Finding

Contrary to classical game theory predictions, **LLM agents tend to cooperate rather than converge to Nash equilibria** when given:
- Multi-round prompts
- Non-zero-sum context

## Experimental Setup

Tested on two standard economic games:
1. **Network resource allocation game**
2. **Cournot competition game**

## Core Insights

### 1. Fairness Reasoning Drives Cooperation
Chain-of-thought analysis reveals that **fairness reasoning is central** to the cooperative behavior observed in LLM agents.

### 2. Prompt Design Changes Outcomes
- Single-shot zero-sum framing → competitive behavior
- Multi-round non-zero-sum framing → cooperative behavior

### 3. Analytical Framework Proposed
Authors propose a framework that captures:
- Dynamics of LLM agent reasoning across rounds
- Why experimental findings diverge from classical game theory

## Implications for Our System

| Aspect | Classical Assumption | LLM Reality |
|--------|---------------------|-------------|
| Default behavior | Self-interested optimization | Fairness-seeking cooperation |
| Coordination | Requires explicit mechanisms | Emerges from reasoning |
| Multi-round dynamics | Converge to equilibrium | Context-dependent behavior |

### Design Recommendations

1. **Leverage cooperative tendencies**: LLM agents may self-organize better than expected
2. **Watch for over-cooperation**: May sacrifice efficiency for fairness
3. **Prompt framing matters**: Non-zero-sum language encourages Pareto improvements
4. **Multi-round context**: Enables richer strategic reasoning than single-shot

## Connection to Other Research

- **OrgAgent**: Hierarchical organization may complement natural cooperation tendencies
- **Collusion Detection**: Cooperation could slide into covert coordination - monitoring needed
- **Free Information Disrupts Crowds**: Information flow constraints become important when agents naturally cooperate

## Quotes

> "Rather than converging to Nash equilibria, we find that LLM agents tend to cooperate when given multi-round prompts and non-zero-sum context."

> "Fairness reasoning is central to this behavior."

## Citation
```bibtex
@article{yao2026competition,
  title={Competition and Cooperation of LLM Agents in Games},
  author={Yao, Jiayi and Chen, Cong and Zhang, Baosen},
  journal={arXiv preprint arXiv:2604.00487},
  year={2026}
}
```

## Related Hypotheses
- H-XXX (to be created): Multi-agent systems should leverage emergent cooperation rather than enforce competition
