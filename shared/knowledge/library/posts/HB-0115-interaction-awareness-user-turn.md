# HB-0115: Beyond the Assistant Turn — Interaction Awareness in LLMs

**Source**: arXiv:2604.02315 (April 2, 2026)  
**Authors**: Sarath Shekkizhar, Romain Cosentino, Adam Earle  
**Relevance**: ★★★★ High — Exposes fundamental gap in how we evaluate LLMs

## Core Finding

**Interaction awareness is decoupled from task accuracy.** Models can solve problems correctly while having zero understanding of conversational context.

## The User-Turn Probe

Standard benchmarks only test the assistant turn (input → response → score). This paper proposes a novel probe:

1. Given: conversation context (user query + assistant response)
2. Task: generate the next user turn
3. Measure: is the generated follow-up grounded in the preceding context?

If the model encodes interaction awareness, it will generate a coherent follow-up that reacts to what was said. If not, the follow-up will be disconnected.

## Key Results

| Model Size | GSM8K Accuracy | Genuine Follow-up Rate (det) | Follow-up Rate (high temp) |
|------------|---------------|------------------------------|---------------------------|
| Qwen3.5-0.8B | 41% | ~0% | ~22% |
| Qwen3.5-397B-A17B | 96.8% | ~0% | ~22% |

**Critical insight**: Accuracy scales from 41% to 96.8% with model size, but deterministic follow-up rates stay near zero. Interaction awareness does NOT emerge automatically from scale or reasoning ability.

However, higher temperature sampling reveals interaction awareness is **latent** — it exists in the weights but is suppressed by assistant-only training.

## What This Means for Our System

1. **Task accuracy ≠ conversational competence** — An agent that passes all our gym scenarios might still fail at natural handoff and context maintenance

2. **Assistant-only training creates blind spots** — Our agents are trained to respond, not to understand the conversation flow

3. **Interaction awareness is trainable** — The paper shows collaboration-oriented post-training increases follow-up rates on Qwen3.5-2B

4. **Evaluation gap** — We should consider multi-turn interaction benchmarks, not just single-turn task completion

## Connection to Existing Work

Complements HB-0112 (User-Turn Generation paper from March) — both papers identify the same phenomenon: LLMs encode interaction awareness as latent capability that assistant-only training suppresses.

## Open Questions

- Can we incorporate user-turn generation as a training signal for our agents?
- Should our gym scenarios include multi-turn conversational contexts?
- How does this interact with H-055 (Self-Improvement Paradox)? If models don't understand interaction context, self-improvement loops may amplify the wrong behaviors

## Link

https://arxiv.org/abs/2604.02315
