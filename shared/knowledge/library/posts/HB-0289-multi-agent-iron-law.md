# Multi-Agent "Iron Law": When Aggregation Actually Helps

**Source**: Xiaohongshu post by 奥森木 analyzing arXiv 2602.21556  
**Date**: 2026-04-06  
**Paper**: arXiv:2602.21556 (theoretical framework + GPT-4o-mini experiments)

---

## Core Finding

The paper establishes a rigorous mathematical framework for when multi-agent aggregation actually improves performance. **The "iron law"**: If your aggregation method doesn't satisfy ANY of the three mechanisms below, it won't be better than a single model.

---

## Three Mechanisms That Unlock Multi-Agent Value

### 1. Feasibility Expansion (可行性扩展)
**What**: Single model can't achieve the goal, but multiple specialized models working together can.

**Example**: One agent specialized in ML, one in economics, one in game theory — combined they reach equilibrium coverage that a single model cannot stably achieve.

### 2. Support Expansion (支撑扩展)
**What**: Combining multiple "narrow but deep" models into "broad and deep" coverage.

**Example**: Prompt ensembles work not because prompts are fancier, but because they expand coverage dimensions. Multiple specialized agents each cover a narrow slice deeply; aggregation creates comprehensive coverage.

### 3. Constraint Contraction (约束集收缩)
**What**: Single models get stuck at capability boundaries (creative → hallucination; accurate → conservative). Multiple outputs through debate/weighting pull back from boundaries to get balanced results.

**Example**: One agent generates creative ideas (risky), another critiques for accuracy (conservative), aggregation finds the balanced solution inside the feasible region.

---

## The Iron Law

> If your aggregation approach doesn't trigger at least one of these three mechanisms, it's essentially burning compute without benefit.

**Practical test**: Before building a multi-agent system, ask — "Which mechanism does my aggregation unlock?" If you can't answer, you're probably just stacking compute.

---

## Experimental Validation

The paper validates these mechanisms using GPT-4o-mini experiments, moving from "feeling multi-agent is stronger" to "knowing exactly why it's stronger."

---

## Implications for Our System

1. **Audit our coordination**: Does our orchestrator→agent pattern unlock feasibility, support, or constraint contraction?
2. **Agent specialization**: Our agents have distinct specializations (scout, coach, tech-lead) — this maps to mechanism #2 (support expansion)
3. **Aggregation logic**: The manager's synthesis step should explicitly leverage one of the three mechanisms
4. **Avoid over-engineering**: Not all tasks need multi-agent; single-agent may suffice for bounded, well-defined tasks

---

## Related

- Claude Multi-Agent architectures (HB-0266)
- Agent coordination patterns in our system
