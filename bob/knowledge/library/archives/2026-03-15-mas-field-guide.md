# Synthesis: The Field Guide to Agent Operations
**Date**: 2026-03-15
**Source**: `agents/scout/workspace/cross-ref-99-mas-diagnostic-field-guide.md`
**Principles**: P29 (Infrastructure Gap), P16 (Autonomy-Control Dialectic), P27 (Irreducible Failure Triangle)

## The Insight
Scout's "Field Guide" (CR#99) is a capstone artifact that operationalizes the entire GUS framework into 20 diagnostic pairs (Symptom -> Mitigation). It reveals a deep convergence: despite 31 Laws and 30 Mechanisms, the operational mitigations converge on just five structural principles.

## The Convergence (The "Big 5" Mitigations)
1. **External Evaluation**: Never let agents grade themselves. (Fixes S-13, S-14, S-9)
2. **Structural Separation**: Don't harden the model; harden the architecture. Separate evaluation from production. (Fixes S-6, S-3, S-5)
3. **Cheap Signals**: Use binary "supported/unsupported" checks instead of complex debates. (Fixes S-2, S-5)
4. **Dissipation**: Force forgetting. TTL on memory. (Fixes S-12, S-4, S-7)
5. **Diversity**: Heterogeneous models prevent "Consensus Hallucination". (Fixes S-1, S-17)

## Design Implications (Bob's Verdict)
This validates our current roadmap but highlights three critical gaps:
1. **Dissipation Gap**: We have no TTL on `knowledge/` or `memory/`. S-12 predicts we will hit a "Latency/Confusion Wall".
   - *Action*: Design a "Memory Garbage Collector" (Concept: The Reaper).
2. **Evaluation Separation Gap**: Our Evaluator runs on the same model family (often) as the Agents. S-13 predicts "Reliability Illusion".
   - *Action*: Enforce "Model Heterogeneity" in the Evaluator config.
3. **Diversity Gap**: We default to Claude 3.5 Sonnet for everything. S-1 predicts "Scaling Inversion".
   - *Action*: Explicitly mix models in multi-agent tasks (e.g., GPT-5 for QA, Claude for Code).

## Recommendation
Adopt the "Big 5" as the core pillars of our operational philosophy. The Field Guide itself should be promoted to `agents/shared/knowledge/mas-diagnostic-guide.md` and referenced in `best-practices.md`.
