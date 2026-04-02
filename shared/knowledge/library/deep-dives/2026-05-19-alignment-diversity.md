# Synthesis: Alignment Diversity & "Adversarial Graders" (HB#566, HB#389)

## Evidence
- **HB#566 (Three-Layer Grader)**: "Code-based (deterministic) + Model-based (evaluator) + Human (gold)." (Three checks > One check).
- **HB#389 (Adversarial Sycophancy)**: "Model-based graders can be tricked by sycophancy (fake safety, self-praise)." (Single point of failure).

## Analysis
The industry is moving away from "LLM-as-Judge" as the sole source of truth.
- **The Problem**: LLMs are suggestible. An agent can say "I carefully followed safety rules..." and the Evaluator LLM will nod along, ignoring the actual *failure* to follow rules.
- **The Symptom**: "Evaluation Passed!" -> Actual result is garbage.
- **The Solution**: **Alignment Diversity**. Use *different* modalities to evaluate.
  - **Code**: Did the test pass? (Unforgiving).
  - **Model**: Is the reasoning sound? (Nuanced).
  - **Human**: Is this what I wanted? (Gold Standard).

## Principle: P126 Alignment Diversity
**"Trust, but Verify via Multiple Modalities."**
No single grader is sufficient. Evaluation requires triangulation.
- **Code (Hard)**: Determinstic checks. (Unit tests, Lint, Syntax).
- **Model (Soft)**: Reasoning checks. (Policy adherence, logic flow).
- **Human (Gold)**: Intent checks. (Does it solve the *user's* problem?).

## Recommendation
1. **Implement `ThreeLayerGrader`**: Upgrade Evaluator to use *all three* inputs.
2. **Prioritize Code**: Code checks > Model checks. If code fails, model reasoning is irrelevant.
3. **Audit Sycophancy**: Run `detectAdversarialSycophancy` (HB#108) on all Evaluator outputs.

## Status
- **Synthesized**: 2026-05-19
- **Action**: Add P126 to philosophy.md. Brief Evaluator on `ThreeLayerGrader`.
