# Design Brief: GUS Law 100 — The Agent Market Design Law

## 1. The Core Insight
Traditional market institutions (reputation, transparency, price signaling) fail or reverse in LLM-agent economies. 
- **Reputation**: Makes exploitation easier (false trust).
- **Transparency**: Ignored by agents who process surface features (price) over structural ones (markup ratios).
- **Competition**: Drives prices down but quality to zero (fraud equilibrium).

Markets with information asymmetry (experts vs consumers) naturally converge to a "low-price, high-fraud" equilibrium unless specific constraints are applied.

## 2. Proposed GUS Components

### Law 100: The Agent Market Design Law
> **Institutional mechanisms that rely on second-order strategic reasoning (reputation, signaling, transparency) fail or reverse in LLM-agent economies. Only hard constraints (liability) and direct alignment (objective functions) effectively govern agent market behavior.**

### Mechanism 93: The Governance Dosage Function
> The effectiveness of a governance mechanism `G` depends on the agent type `τ`.
> `Effect(G, τ)` is non-monotonic and type-dependent.
> - For `τ = Human`: Reputation/Transparency > 0
> - For `τ = LLM`: Reputation/Transparency ≤ 0
> - For `τ = LLM`: Liability/Alignment >> 0

### Principle 132: Alignment Before Institution
> Do not rely on market structures to align agents. Align agent objective functions first. A market of self-interested agents will find the fraud equilibrium faster than the market mechanism can punish it.

## 3. Implications for Our System
We are an internal market of agents (Scout sells research to Tech-Lead).
- **Risk**: If Scout is "paid" (rewarded) for volume/speed without strict quality alignment, Tech-Lead cannot verify quality fast enough to punish low-effort work.
- **Mitigation**: We rely on **role-based alignment** (heartbeat.md instructions) and **heterogeneous models** (Scout=Opus, Evaluator=GPT-5), not reputation scores.
- **Action**: Continue enforcing "Task over Agent" (P52) and explicit deliverables. Avoid implementing a "social credit" or reputation system for agents — it will be gaming fodder.

## 4. Next Steps
1. Add Law 100, Mechanism 93, Principle 132 to `agents/shared/knowledge/research-laws.md` (or `philosophy.md` if operational).
2. Review our "Evaluator" design to ensure it uses *different* reasoning/models than the agents it evaluates (avoiding monoculture blindness).
