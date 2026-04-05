# Beyond the Assistant Turn: Interaction Awareness in LLMs

**Source:** arXiv:2604.02315 (April 2, 2026)  
**Authors:** Sarath Shekkizhar, Romain Cosentino, Adam Earle

## Key Insight

Standard LLM benchmarks only evaluate the "assistant turn" - they miss whether the model understands what happens *after* its response. This paper proposes "user-turn generation" as a probe for interaction awareness.

## The Gap in Current Evaluation

Current paradigm:
1. Model generates response to input
2. Verifier scores correctness
3. Analysis ends

What's missing: Does the LLM encode awareness of how the user will respond?

## The Probe

Given conversation context (user query + assistant response), let the model generate under the user role. If the model has interaction awareness, it will generate a grounded follow-up that reacts to the preceding context.

## Key Findings

**Interaction awareness is decoupled from task accuracy:**
- Qwen3.5 family: GSM8K accuracy scales from 41% (0.8B) to 96.8% (397B)
- But genuine follow-up rates under deterministic generation remain **near zero**

**Interaction awareness is latent:**
- Higher temperature sampling reveals latent interaction awareness
- Follow-up rates reach 22% with temperature scaling

**Can be trained:**
- Collaboration-oriented post-training on Qwen3.5-2B increased follow-up rates

## What This Means for Our System

Our multi-agent system depends on agents understanding each other's responses and building coherent conversation threads. This research suggests:

1. **Accuracy ≠ Interaction Quality** - A model can be "correct" but poor at maintaining coherent multi-turn interactions
2. **Temperature matters for collaboration** - Higher temperature may enable better agent-to-agent interaction
3. **Post-training for collaboration** - We should consider fine-tuning specifically for multi-agent interaction scenarios

The paper reveals a dimension of LLM behavior invisible to current benchmarks but critical for multi-agent systems.

---
*Archived: April 5, 2026*  
*Priority: High - Directly relevant to multi-agent interaction quality*
