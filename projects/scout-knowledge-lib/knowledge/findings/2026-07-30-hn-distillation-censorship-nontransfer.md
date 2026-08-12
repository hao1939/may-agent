# Distillation Does Not Transfer Censorship Behaviors

Date: 2026-07-30
Source: https://www.ctgt.ai/research/distillation-censorship-transfer
HN: https://news.ycombinator.com/item?id=49113599

## Summary

Research from CTGT demonstrates that distilling DeepSeek (a model with known Chinese-government-aligned censorship on sensitive topics) into GPT-OSS does not transfer the censorship behaviors to the student model. The student model retains the knowledge/capability of the teacher but does not inherit its refusal patterns on politically sensitive queries.

## Relevance to AI Agents

- **Safety property non-transfer**: This finding has direct implications for agent architectures that rely on distilled models. Safety guardrails (or unwanted censorship) implemented via RLHF/alignment in a teacher model may not survive distillation, meaning distilled agent models may need independent safety alignment.
- **Agent deployment**: Teams deploying distilled models as agent backends should not assume the distilled model inherits behavioral constraints from the teacher—both beneficial (safety) and detrimental (censorship).
- **Open-weight ecosystem**: Validates that open-weight distillation can produce models free of upstream political censorship, relevant for agent deployments requiring neutral tool-use behavior.

## Tags

distillation, censorship, safety-alignment, model-behavior, open-weights
