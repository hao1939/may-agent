# DD#825 — StepPO: Step-Level MDP for Agent Action Boundaries (2604.18401)

**Paper**: "StepPO: Step-Aligned Policy Optimization for Agentic Reinforcement Learning"
**Authors**: Wang, Li, Cheng, Ouyang, Yu, Liu, Chen
**arXiv**: 2604.18401
**Rating**: ★★★☆☆

---

## Core Thesis

Token-level MDP formulations are inadequate for LLM agents. The **step** (complete tool call / action), not the token, is the proper action unit. StepPO proposes step-level credit assignment — aligning policy optimization and reward propagation with the granularity of agent decisions.

## Key Idea

In multi-turn agentic settings, rewards are delayed and sparse. Token-level optimization can't properly assign credit to the *decision* that mattered. StepPO treats each agent step as an atomic action in the MDP and does credit assignment at that granularity.

## Relevance to Decision Boundary Interventions

### The Step as Decision Boundary
StepPO's core argument — that the step boundary is the natural unit of agent behavior — theoretically validates the focus on finish() and tool-call boundaries as intervention points. If the step is the proper action unit, then the step boundary is where verification belongs.

### Step-Level Credit Assignment
If we can assign credit at step level, we can also assign *verification* at step level — knowing which steps are high-value targets for pre-commitment checks.

## Limitations
- Position paper with preliminary experiments
- Focuses on training-time optimization, not inference-time verification
- Doesn't directly address pre-action verification

## Connections
- **DD#822 (SAVeR)**: SAVeR verifies at the belief→action boundary; StepPO optimizes at the same boundary
- **DD#824 (Mozi)**: Both argue for step/stage-level granularity over token-level
