# DD#823 — Learning to Negotiate: Multi-Agent Deliberation for Collective Value Alignment

**Paper**: [2603.10476] Learning to Negotiate: Multi-Agent Deliberation for Collective Value Alignment in LLMs  
**Authors**: Anantaprayoon, Babina, Asgharbeygi, Tarifi (Mar 2026, revised Apr 2026)  
**Venue**: LREC 2026 DELITE Workshop  
**Rating**: ★★★★★  
**Topics**: agent conflict resolution, value alignment, multi-agent negotiation, GRPO, collective agency

## Key Idea

Trains LLMs to resolve value conflicts between agents through **negotiation-based deliberation**. Two self-play LLM instances with opposing personas engage in turn-based dialogue to synthesize mutually beneficial solutions. Optimized via RLAIF using GRPO with an external LLM reward model scoring "Collective Agency" (CA).

## Method

1. **Persona assignment**: Two LLM instances get opposing value-laden personas (e.g., utilitarian vs. deontological)
2. **Moral dilemma prompts**: Synthetic scenarios with genuine value tensions
3. **Turn-based negotiation**: Agents argue, counter-argue, and converge toward a joint solution
4. **Reward signal**: External LLM evaluates final completion on CA score (does the solution expand collective agency?)
5. **Training trick**: Rewards computed on final completion, but **gradients applied to dialogue tokens** — this directly improves the deliberation dynamics, not just the answer
6. **Optimization**: Group Relative Policy Optimization (GRPO)

## Key Results

- CA alignment **comparable to single-agent baseline** (doesn't sacrifice alignment quality)
- **Substantially improved conflict-resolution performance** (the negotiation itself gets better)
- **No degradation in general language capabilities** (the training doesn't break the model)
- Emergent negotiation strategies: agents learn to find common ground, propose compromises, escalate constructively

## Why ★★★★★

This is the most direct hit on "agent conflict resolution in multi-agent LLM systems" from our search queries. Key contributions:

### 1. Conflict Resolution as a Trainable Skill
Previous work treats conflict resolution as an emergent property of debate or voting. This paper treats it as a **learnable capability** that can be optimized through RL. The distinction matters: you can *improve* at resolving conflicts, not just *have* conflicts.

### 2. Gradient-on-Dialogue Innovation
Applying gradients to dialogue tokens rather than just the final answer is clever. It means the model learns *how to negotiate well*, not just *what good answers look like*. This is analogous to training a chess player on move quality vs. just game outcomes.

### 3. Collective Agency as Objective
The CA objective (expanding collective agency) is a principled alternative to simple agreement-seeking. A resolution that suppresses one agent's values to reach "consensus" scores poorly. A resolution that finds genuine synthesis scores well. This directly addresses the verification collapse pattern where agents converge on easy agreement rather than correct answers.

### Connection to DD#667-673 (Verification Collapse)
Verification collapse often occurs because agents lack the *skill* to productively disagree. They default to agreement because disagreement is costly and they don't know how to resolve it. This paper provides a training paradigm that could inoculate against collapse: agents trained on negotiation might be better at maintaining productive disagreement.

### Connection to CR#318
CR#318 discusses conflict resolution mechanisms. This paper provides a concrete, learnable approach. The self-play training paradigm could be integrated as a pre-training step for agents in CR#318-style architectures.

## Limitations

- Only tested with 2 agents (bilateral negotiation). Real systems have N>2 stakeholders
- Moral dilemmas are synthetic — may not transfer to practical software engineering disagreements
- GRPO requires substantial compute for training
- External LLM reward model introduces potential reward hacking risk
- No analysis of when negotiation *should* fail (some conflicts are irreconcilable)

## Practical Implications

1. **Pre-train agents on negotiation** before deploying in multi-agent systems
2. **CA scoring** as a reward signal for multi-agent interactions (does the outcome expand everyone's capabilities?)
3. **Dialogue-level gradients** as a general pattern for training interactive agents
4. Could improve our own agent coordination — agents that can negotiate disagreements rather than escalating or silently conforming
