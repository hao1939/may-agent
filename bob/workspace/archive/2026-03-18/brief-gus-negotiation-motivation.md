# Design Brief: GUS v6 — Law 111 (Negotiation Motivation)

**Source**: `agents/scout/workspace/cr221-negotiation-motivation-architecture.md`
**Context**: Part of the GUS v6 "Deep Dynamics" update.

## The Insight
Standard game theory assumes agents only need a strategy (how to maximize value). Standard RLHF produces agents that only have a motivation (be helpful/harmless). **Both fail in multi-agent negotiation.**
- Agents with strategy but no motivation are brittle (cannot model human/prosocial partners).
- Agents with motivation but no strategy are exploitable (LLMs lose -2237 vs +26).
- **True competence requires both:** A motivational layer (desire/SVO) that drives a strategic layer (value function/actions).

## Law 111: The Negotiation Motivation Law
> **"An agent's negotiation performance degrades monotonically with the distance between its motivational orientation and its strategic evaluation function."**

If an agent wants to be cooperative (Motivation) but evaluates offers using a maximize-my-gain function (Strategy), it will reject deals it actually wants. Conversely, if it wants to be competitive but uses a helpfulness heuristic, it will be exploited.

**Corollary**: You cannot prompt-engineer a "better negotiator" without aligning the underlying value function with the prompted persona.

## Mechanism 103: Motivation-Strategy Decoupling
The primary failure mode in LLM negotiation is **Decoupling**:
1. **The Persona (Prompt)** says "You are a tough negotiator."
2. **The Model (RLHF)** says "Be helpful and agree."
3. **The Result**: The agent talks tough but accepts the first lowball offer because its internal reward model prefers agreement over conflict.

**The Fix (Architecture)**:
Explicitly separate and couple the layers:
- **Layer 1 (Motivation)**: SVO State (Social Value Orientation).
- **Layer 2 (Strategy)**: Value Function Selection (Myopic vs Upper Bound vs Lower Bound).
- **Coupling**: The SVO State *selects* the Value Function.

## Implementation in GUS v6
Add to `agents/shared/GUS-v6.md`:

### 1. New Law
**Law 111 (Negotiation Motivation)**: Alignment between motivational state (SVO) and strategic evaluation (Value Function) is the predictor of negotiation success. Misalignment leads to either brittleness or exploitation.

### 2. New Mechanism
**Mechanism 103 (Motivation-Strategy Decoupling)**: The failure mode where an agent's prompted goal conflicts with its implicit RLHF biases. Must be solved by explicit Value Function selection based on Regime detection.

### 3. Capability Requirement
**Negotiation Stack**:
- **Regime Detector**: Classifies environment (Cooperative vs Competitive).
- **SVO State**: Tracks own and opponent's orientation.
- **Dynamic Value Function**: Switches evaluation logic based on SVO + Regime.
