# EXP-270: Structured Taint Tokens for Auditor Handoff

**Hypothesis**: H-206 (Auditor findings are ignored 60% of the time because handoff is unstructured)
**Status**: READY-TO-RUN (prompts defined 2028-01-05)
**Date**: 2028-01-04
**Inspired by**: DD#881 (arXiv:2604.22879) — Semantic Taint Token protocol for cross-agent policy enforcement

## Problem

EXP-247 showed the auditor detects structural bugs 100% of the time, but the primary agent ignores findings 60% of the time. The handoff is currently a free-text message ("I found X, please fix Y"). The primary agent treats this as advisory, not mandatory.

## Intervention: Structured Taint Tokens

Instead of free-text handoff, the auditor attaches a **structured violation record** that the primary agent must explicitly acknowledge before proceeding:

```
## VIOLATION RECORD (must address before finish)
- **Type**: ordering-dependency
- **Location**: pipeline step 3 → step 5
- **Evidence**: step 5 reads output of step 3, but step 4 overwrites it
- **Required Action**: reorder steps OR add intermediate variable
- **Acknowledgment**: [ ] I have addressed this violation (explain how)
```

The key differences from baseline:
1. **Structured format** — not buried in prose
2. **Explicit checklist** — agent must fill in acknowledgment
3. **"Must address before finish"** framing — positions as blocker, not suggestion

## Arms

| Arm | Description | N (target) |
|-----|-------------|------------|
| A (Control) | Auditor sends free-text findings (current behavior) | 15 |
| B (Structured Token) | Auditor sends structured violation record | 15 |
| C (Structured + Gate) | Structured record + system prompt says "you cannot call finish() until all violation records are addressed" | 15 |

## Scenario

Same as EXP-247: `cascading-fix-trap-v2`. Auditor always detects the ordering bug (100% from EXP-247). We measure whether the primary agent fixes it.

## Metrics

- **Primary**: `pipeline-order-fixed` rate per arm
- **Secondary**: Whether agent explicitly references the violation in its work

## Decision Rules

| Outcome | Action |
|---------|--------|
| Arm B ≥ 70% (vs 40% baseline) | H-206 SUPPORTED — structured format alone helps |
| Arm C ≥ 90% | H-206 STRONGLY SUPPORTED — gate mechanism needed |
| Arm B < 50% AND Arm C ≥ 80% | Format alone insufficient, gate required |
| Both B and C < 50% | H-206 REFUTED — problem is not format/framing |

## Theoretical Grounding

arXiv:2604.22879 (Wu & Gong 2026) shows:
- Text-based alignment achieves only F1=0.85 for cross-agent violations
- Structured enforcement (their "STT Protocol") achieves F1=0.95
- The gap is exactly our problem: the primary agent has the violation info but doesn't act on it

Our Arm B tests whether structure alone closes the gap. Arm C tests whether a gate (analogous to their zero-trust enforcement) is needed.

## Implementation Notes

- Reuse EXP-247 gym infrastructure
- Auditor prompt unchanged (already works at 100%)
- Only modify the handoff message format (Arm B) and system prompt (Arm C)
- Each run: auditor phase → handoff → primary phase → evaluate
