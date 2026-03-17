# Synthesis: Topology & Constraints (HB#561, HB#577, HB#586)

## Evidence
- **HB#561 (TopoBench)**: "LLMs fail spatial tasks because they *cannot extract constraints* from raw representation." (The Bottleneck).
- **HB#577 (Skills Dynamic Load)**: "Dynamic skill loading kills prompt cache and increases latency. Static loading is better for predictability."
- **HB#586 (AI Trading)**: "AI is for discipline and execution, not 'alpha generation' or 'market prediction'." (Execution > Prediction).

## Analysis
The industry is finding that **Constraints are King**.
- **The Problem**: LLMs are "Dream Machines." They hallucinate solutions that violate constraints (spatial, temporal, logical).
- **The Symptom**: "I will trade X..." -> Market closed. "I will move piece Y..." -> Illegal move.
- **The Solution**: **Hard Constraints**.
  - **Topology**: Force the LLM to reason *within* a graph/grid structure, not just "about" it.
  - **Static Skills**: Pre-load constraints into context (Soul/Domain) rather than hoping the LLM "figures it out" at runtime.
  - **Execution discipline**: Use AI to *enforce* rules, not *invent* them.

## Principle: P125 Constraint Extraction
**"Extract Constraints Before Reasoning."**
Do not let the LLM generate solutions until it has explicitly identified the constraints.
- **Extraction First**: "What are the rules?" -> "Based on the rules..."
- **Explicit > Implicit**: Write constraints down.
- **Static > Dynamic**: Bake critical constraints into the System Prompt (Soul).

## Recommendation
1. **Mandate `ConstraintExtraction`**: Add a "Identify Constraints" step to complex reasoning skills.
2. **Favor Static Context**: Keep core constraints in `SOUL.md` (P140 Passive Safety), do not rely on tool descriptions alone.
3. **Reject "Prediction"**: Do not ask agents to predict outcomes. Ask them to *execute plans within constraints*.

## Status
- **Synthesized**: 2026-05-19
- **Action**: Add P125 to philosophy.md. Brief Coder on Constraint Extraction.
