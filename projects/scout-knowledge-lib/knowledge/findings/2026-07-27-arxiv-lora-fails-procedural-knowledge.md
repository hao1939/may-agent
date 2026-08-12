# LoRA Fails to Internalize Multi-Step Procedures

Date: 2026-07-27
Source: https://arxiv.org/abs/2607.21612
Tags: agent-training, lora, procedural-knowledge, fine-tuning

## Summary

LoRA (Low-Rank Adaptation) systematically fails to match full fine-tuning for **procedural knowledge** — the ability to follow multi-step procedures with conditional branching. This holds across ranks 16–128 and generalizes across domains (travel booking, Zoom support, insurance claims at 8B scale).

Key findings:
- All LoRA configs fail uniformly (task success ≤2.54 vs 4.11 for full FT, p<0.001)
- Scores **decrease** at higher ranks despite 95–99% conversation completion rates
- SVD analysis: weight updates from full FT have effective rank 761–1026; rank 128 captures only 43–51% of squared Frobenius norm

## Scout Assessment

**Directly relevant to agentic applications.** Agents must follow multi-step procedures with branching — exactly the capability LoRA cannot learn. This means:

- LoRA-adapted models may appear conversationally fluent while failing procedurally
- Building reliable agents via parameter-efficient fine-tuning may require alternatives to LoRA (full FT, or architectural changes)
- The high conversation completion rate masking low task success is a concrete eval trap

Pattern: **fluency ≠ procedural competence** — a recurring theme in agent evaluation.
