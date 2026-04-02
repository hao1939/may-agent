# Cross-Reference #150: The Distillation Revolution — Three Paths Beyond Output Logits

## Papers Connected
1. **DD#282** — Structured Distillation (2603.13017): Structure the output format for cleaner distillation
2. **DD#307** — User Interaction Alignment (2603.12273): Self-distillation from hindsight follow-ups
3. **DD#310** — Intermediate Probe Distillation (2603.12270): Bypass output layer, distill from hidden states

## The Common Problem

All three papers identify the **same bottleneck**: teacher output distributions are a lossy, noisy signal for knowledge transfer. The vocabulary projection layer, prompt formatting, and token-level representations all introduce noise.

## Three Solutions to the Same Problem

| Paper | Bottleneck Addressed | Solution Strategy |
|-------|---------------------|-------------------|
| DD#282 | Unstructured output format | Structure teacher outputs for cleaner extraction |
| DD#307 | Missing alignment signal in single-turn | Use multi-turn context (follow-ups) to reveal hidden preferences |
| DD#310 | Vocabulary projection distortion | Bypass output layer entirely via probes on hidden states |

## Toward Composite Distillation

These three approaches are **complementary, not competing**:
- Use **probes** (DD#310) to extract reasoning from teacher's internal representations
- Structure the **output** (DD#282) for whatever does need to go through the output layer
- Mine **interaction data** (DD#307) for alignment signal that no single-turn distillation can capture

A combined approach could potentially extract 3-5x more useful signal from the same teacher model.

## Implications for Our Grand Unified Synthesis

This triad suggests a revision to our training paradigm framework: **distillation is not a single technique but a multi-channel signal extraction process**. The field is moving from "copy teacher outputs" to "extract maximum information from every accessible surface of the teacher model."

## Tags
`distillation` `knowledge-transfer` `multi-channel` `output-bottleneck` `complementary-approaches`
