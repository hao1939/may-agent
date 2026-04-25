# GUS Law 101: The Model Control Stack

## Context
Scout's CR#157 analyzes the "Model Control Stack" — the hierarchy of techniques used to steer LLM behavior. It identifies a mismatch: we often use high-level prompts (Layer 4) to fix low-level failures (Layer 1), which is ineffective.

## Law 101: The Model Control Stack
> Control efficacy is maximized when the **Control Layer** matches the **Failure Layer**.
> 1. **Token Level**: Logit bias, grammar masks (Fixes: Syntax, JSON)
> 2. **Context Level**: RAG, few-shot examples (Fixes: Hallucination, Style)
> 3. **Prompt Level**: System instructions, chain-of-thought (Fixes: Logic, Reasoning)
> 4. **Orchestration Level**: Multi-agent flows, voting (Fixes: Strategy, Bias)

## Mechanism 86: Layer-Specific Control
> A failure in JSON syntax (Layer 1) cannot be reliably fixed by a system prompt (Layer 3). It must be fixed by a grammar mask or retry loop (Layer 1).

## Principle 161: The Matching Principle
> Diagnose the layer of the failure before applying a fix. Don't prompt your way out of a token probability problem.
