# GrandCode: First AI to Beat All Humans in Live Competitive Programming

**Source**: arXiv:2604.02721 (April 3, 2026)  
**Authors**: DeepReinforce Team (Xiaoya Li et al.)  
**Status**: Tech Report / Pre-print

---

## Core Achievement

**GrandCode is the first AI system to consistently beat all human participants in live competitive programming contests.**

In three consecutive Codeforces live competitions:
- **Round 1087** (Mar 21, 2026): 1st place
- **Round 1088** (Mar 28, 2026): 1st place  
- **Round 1089** (Mar 29, 2026): 1st place

This includes defeating legendary human grandmasters — something no previous AI system had achieved under live competition conditions.

---

## Technical Architecture

### Two Key Innovations

1. **Multi-Agent Module Orchestration**
   - Hypothesis proposal agent
   - Solver agent
   - Test generator agent
   - Summarization agent
   - Joint improvement through post-training + online test-time RL

2. **Agentic GRPO (Group Relative Policy Optimization)**
   - Designed specifically for multi-stage agent rollouts
   - Handles delayed rewards (common in agentic systems)
   - Addresses severe off-policy drift prevalent in agentic RL

### Why Previous Systems Failed

Google's Gemini 3 Deep Think — the previous best result — only achieved 8th place, and notably was **not** evaluated under live competition conditions. GrandCode's multi-agent approach with specialized RL training overcomes this ceiling.

---

## Key Insight: Competitive Programming as Agentic RL

The paper frames competitive programming as the ultimate test of agentic capabilities:
- Requires hypothesis generation, implementation, testing, debugging
- Multi-stage reasoning with sparse, delayed rewards
- Demands both exploration (novel solutions) and exploitation (correct implementations)

---

## Implications for Our System

| Aspect | Lesson |
|--------|--------|
| **Multi-Agent > Single Model** | Even for coding, specialized agents beat monolithic models |
| **Delayed Reward RL** | Agentic GRPO shows specialized RL methods needed for agent rollouts |
| **Test-Time Training** | Online improvement during inference is crucial |
| **Live vs Offline** | Systems that work offline may fail under real-time pressure |

---

## Questions Raised

1. **Generalization**: Does this agentic architecture transfer to other complex reasoning domains?
2. **Cost**: What's the inference cost compared to single-model approaches?
3. **Robustness**: How does it handle problem types outside training distribution?

---

## Citation

```
arXiv:2604.02721 [cs.AI]
Title: GrandCode: Achieving Grandmaster Level in Competitive Programming via Agentic Reinforcement Learning
Authors: DeepReinforce Team
```

---

*Discovered: April 7, 2026 | HB-260426*
