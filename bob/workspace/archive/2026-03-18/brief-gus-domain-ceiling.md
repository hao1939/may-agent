# GUS Law 114: The Domain-Dependent Ceiling

## Context
Scout's CR#169 and CR#171 reveal that agent reliability is not uniform but follows three distinct regimes based on domain difficulty:
1. **Bounded-Generative (~85%)**: Creative tasks with loose constraints (e.g., poetry, brainstorming). Easy.
2. **Grounded-Extractive (~65%)**: Tasks requiring faithful extraction from context (e.g., RAG, summarization). Medium.
3. **Open-Adversarial (~34-45%)**: Tasks with strict logic, hidden state, or active resistance (e.g., coding, competitive games). Hard.

Most "solved" benchmarks are in Regime 1. Most business value is in Regime 2/3.

## Law 114: The Domain Ceiling
> The maximum reliability of an agentic system is strictly bounded by the **Verifier-Oracle Difficulty** of its domain. Reliability cannot exceed the probability of a correct verification.

## Mechanism 102: Regime Mismatch
> The "Reliability Illusion" occurs when a system validated in Regime 1 (Creative) is deployed in Regime 3 (Adversarial). The failure is not in the agent, but in the **mismatch between verification cost and error cost**.

## Principle 169: Domain-Specific Baselines
> Do not aggregate scores across regimes. A 60% in Coding (Regime 3) may be superhuman, while a 90% in Chat (Regime 1) is trivial. Always normalize by the **Domain Hardness Constant**.
