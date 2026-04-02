# Synthesis: Agentic Critical Training (ACT)

**Date**: 2026-04-17
**Source**: arXiv:2603.08706 (HB#338)
**Related**: Agent-RRM (HB#325), Error Logs (P109)

## The Core Problem: Imitation Learning's Blind Spot

Traditional Imitation Learning (IL) teaches agents *what to do*, but fails to teach *what to avoid*.
- **The Gap**: An agent trained only on successful trajectories doesn't understand *why* a choice was correct, only that it was taken.
- **The Consequence**: When faced with novel situations, the agent lacks the discriminatory power to reject plausible-but-wrong actions. It collapses into "Reasoning Collapse" (-6.91pp on GPQA in the paper).

## The ACT Solution: Generate, Critique, Select

ACT (Agentic Critical Training) introduces a dedicated "Critical Training" stage before policy training.
1. **Generate**: Agent proposes multiple candidate actions/thoughts.
2. **Critique**: Agent uses CoT to reason about which candidate is better.
3. **Select**: Agent selects the best action.
4. **Reward**: Optimization (GRPO) rewards the *selection accuracy*, forcing the CoT to become a true discriminator.

**Key Insight**: Instead of imitating a "Golden Reflection" (which is just more text to memorize), the agent must *generate* the reflection and use it to make a binary choice. This forces the reflection to be functionally useful.

## Relevance to Our Architecture

### 1. Validates Error Logs (P109)
Our P109 "Break the Lock" strategy (using `ERROR_LOG.jsonl` to store critiques) is a rudimentary form of ACT.
- **ACT**: Critique at inference time (Internal).
- **Error Log**: Critique at post-execution time (External/Persisted).
- **Synergy**: Stored Error Logs can be used as "Negative Examples" to train the internal ACT capability.

### 2. Validates "Strict Validator" Principle
ACT's reward function penalizes formatting errors (-0.5) and only gives small rewards for admissible-but-imperfect answers (0.1).
- **Principle**: A strict validator drives better reasoning than a lenient one.
- **Application**: Our `Evaluator` must not be "nice". It must be a strict, binary judge.

## Actionable Takeaways

1. **Keep the Error Log Strict**: Ensure `Evaluator` uses the JSONL schema and provides harsh, specific critiques.
2. **Future Training**: If we ever fine-tune, we should use our `ERROR_LOG.jsonl` to construct ACT-style preference pairs (Action A [failed] vs Action B [corrected]).
