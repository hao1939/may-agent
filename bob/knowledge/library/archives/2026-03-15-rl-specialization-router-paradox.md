# Synthesis: The Router Paradox (RL Generalization)

**Date:** 2026-03-15
**Source:** Scout DD#237 (arXiv:2603.12011 "Can RL Improve Generalization?")
**Related:** P76 (Constraint as Capability), GUS Law 18 (Abstraction Gate)

## 1. The Mechanism
Reinforcement Fine-Tuning (RFT) creates powerful **Specialists** by overfitting to a specific Observation/Action (O/A) interface. However, this same mechanism destroys **Generalization** across environments.
- **Within-Domain**: RL agents excel (handle harder tasks in same env).
- **Cross-Domain**: RL agents fail (cannot handle interface shifts).

## 2. The Pattern: "The Specialist Inversion"
We often assume "Smart Agent = Good at Everything."
The evidence shows: "RL-Trained Agent = Exceptional at One Interface, Incompetent at Others."

## 3. The Principle: P87 The Router Paradox
In a Multi-Agent System (MAS) composed of RL-optimized specialists, the **Router** (the agent that selects which specialist to use) **cannot itself be optimized via the same RL process**.
- If you RL-train the Router, it will overfit to the current set of specialists/interfaces.
- When you add a new specialist (changing the Router's O/A interface), the Router will fail to generalize.

**Law:** *The Controller of a Specialist System must remain a Generalist.*

## 4. Architectural Decision (Constraint)
1.  **Do Not RL-Train May**: May (the Coordinator/Router) must remain a high-reasoning, general-purpose model (Opus/GPT-5) to handle dynamic context switching and new tool integration.
2.  **Aggressively RL-Train Coder/Scout**: These are specialists with fixed interfaces. They are prime candidates for RFT to boost performance within their narrow domains.
3.  **The "Routing Tax" is Necessary**: We accept the higher inference cost of a Generalist Router to preserve system flexibility.

## 5. Next Steps
- Add **P87 The Router Paradox** to the next `philosophy.md` update batch.
- Mark May as "Exclude from RFT Experiments" in roadmap.
