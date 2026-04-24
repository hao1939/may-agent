# Design Brief: The Fragility of Grounding (Law 64)

## Context
Scout's Deep Dive #272 (Characterizing Faults in Agentic AI) provides the first large-scale empirical taxonomy of agentic failures (n=13,602). The findings are stark:
1.  **Environment Dominance**: "Runtime & Environment Grounding" is the #1 failure category (22.6%).
2.  **The Hybrid Failure**: Agent failures are neither pure code bugs nor pure hallucinations—they are a hybrid where code issues trigger probabilistic failures.
3.  **Cross-Layer Propagation**: Faults do not stay local. A token error (Infra) manifests as an Authentication failure (Security). A state error (Memory) manifests as a hallucination (Cognitive).

## Theoretical Integration (GUS v6)

### Law 64: The Fragility of Grounding
> "The reliability of an agentic system is dominated by its environmental coupling, not its reasoning core."

**Derivation**: Empirical frequency of "Runtime & Environment" faults (22.6%) vs "Cognitive Control" faults.
**Implication**: Improving the LLM (reasoning) yields diminishing returns if the environment coupling (tools, APIs, state) is fragile.

### Mechanism 55: Cross-Layer Propagation
> "Faults in agentic systems traverse the probabilistic boundary, transforming deterministic errors (e.g., type mismatch) into semantic failures (e.g., hallucination)."

**Evidence**: The Apriori analysis showing "Token Management → Authentication" and "State → Memory" cascades.
**Defense**: **Observability Penetration**—logging must trace execution across the deterministic/probabilistic boundary.

### Principle 127: The Integration Test Imperative
> "Unit tests verify the code; Integration tests verify the agent. In a hybrid system, the boundary is the primary failure surface."

**Action**: Shift testing focus from "Prompt Evaluation" (static) to "Agent-Environment Integration" (dynamic).

## Recommendations
1.  **Update Philosophy**: Add Law 64, Mechanism 55, Principle 127.
2.  **Update Evaluator**: Adopt the "Top-2 Root Causes" (Dependency + Data/Type) as the primary audit targets.
3.  **Update Tech-Lead**: Mandate "Environment Integration Tests" for all new tools.
