# KE-072: Positional Privilege Is Architectural — U-Shaped Attention Bias Explains System vs Task Delivery Gap

**Status**: Theoretical (strongly supported by EXP-096, EXP-097 + external literature)
**Source**: DD-660 (Positional Privilege Theory), EXP-096, EXP-097, arXiv:2603.10123 (Lost in the Middle at Birth)
**Date**: 2026-04-09

---

## One-Sentence Summary

The 100% task-message vs 0% system-prompt delivery gap (EXP-096/097) is explained by a U-shaped attention bias that is an inherent geometric property of causal decoders — present at initialization before any training — where system prompts fall in the decaying primacy tail while task messages benefit from O(1) recency anchoring.

---

## The Finding

Our experiments (EXP-084–097) consistently showed:
- **Task-message few-shot delivery**: 15/15 (100%)
- **System-prompt delivery (no framing)**: 0/9 (0%)
- **System-prompt delivery (urgency framing)**: 1/3 (33%)

We labeled this "positional privilege" but lacked a mechanistic explanation. DD-660 synthesizes four papers that provide it:

### The Mechanism (from arXiv:2603.10123 — "Lost in the Middle at Birth")

1. **Primacy Tail** — Causal masking forces logarithmic divergence of gradient influence at the start of the sequence. System prompt content gets high initial attention that decays through the middle of the context.
2. **Recency Delta** — Residual connections create an O(1) anchor at the final tokens (near generation position). Task message content has maximal behavioral influence.
3. **Factorial Dead Zone** — Between primacy and recency, influence drops by O(1/(H-1)!), where H = network depth. Deeper models have worse middle-position suppression.

### Key Evidence
- **Untrained** Qwen2 and GPT-2 show the U-shape at Step 0 — this is geometric, not learned
- Identical with or without RoPE positional encodings
- Standard pretraining does NOT overcome this topological valley
- The deeper the model, the worse the dead zone

---

## Why This Matters for Agent Design

### Position → Attention Profile → Behavioral Effect

| Position | Attention Profile | Effect on Behavior |
|----------|------------------|-------------------|
| System prompt start | Primacy Tail (log divergence) | Rules/identity — acknowledged but passively |
| System prompt middle | Factorial dead zone | Acknowledged, rarely acted on |
| System prompt end | Weak recency within system block | Recognition without urgency |
| Task message | Recency Delta (O(1) anchor) | Immediate behavioral influence |

### Production Implication

**All behavioral few-shot MUST be task-message delivered.** This is not a best practice — it's an architectural constraint of causal decoder models. System prompt is structurally suited for identity/values/knowledge (content that needs to be *available* not *urgently acted upon*).

This validates our existing injected_context.md mechanism and explains why SKILL.md files (loaded into system prompt) cannot replace task-message skill delivery.

---

## Predictions

- **P-072-1**: For any new behavioral skill, task-message delivery will outperform system-prompt delivery by >50% on compliance. (95% confidence)
- **P-072-2**: The gap will be LARGER for deeper models due to factorial dead zone scaling. (80% confidence)
- **P-072-3**: End-of-system-prompt placement will outperform mid-system-prompt, but still underperform task-message. (85% confidence — partially confirmed by EXP-097's 33%)

---

## Connections

- **Explains**: EXP-096 (position > length), EXP-097 (framing partially bridges), KE-059 (few-shot position-dependent), KE-065 (positional privilege as boundary)
- **Extends**: H-091 (skill delivery methods — now with theoretical grounding for WHY position matters)
- **Validates**: KE-060 L0–L5 hierarchy (few-shot at L3 requires task-message delivery, which is architectural not incidental)
- **Connects to**: DD-660 (full literature synthesis), arXiv:2603.10123 (mathematical proof), arXiv:2406.02536 (single-dimension mitigation), arXiv:2404.13208 (instruction hierarchy training)

---

## Open Questions

1. **Does instruction hierarchy training (arXiv:2404.13208) reduce the gap in newer model versions?** — Re-test periodically as models update.
2. **Can we exploit end-of-system-prompt placement for lower-priority behavioral nudges?** — EXP-097 suggests ~33% effectiveness here.
3. **Does the factorial dead zone predict cross-model differences in our pass rates?** — Deeper models should show a larger gap.

---

## Candidate Principle

> **Principle 72 (Positional Privilege)**: In causal decoder architectures, behavioral influence follows a U-shaped curve: high at sequence start (primacy, decaying with depth), minimal in the middle (factorial dead zone), and maximal at sequence end (recency anchor). For behavioral skills, only recency-zone placement (task message) reliably drives action. This is geometric, not learned — present at initialization before any training.
