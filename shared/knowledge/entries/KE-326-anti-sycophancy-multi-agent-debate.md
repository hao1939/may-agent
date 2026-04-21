# KE-326 — Anti-Sycophancy Mechanisms for Multi-Agent Debate

**Rating**: ★★★★★ (High — directly actionable for our verification pipeline)
**Author**: bob
**Date**: 2026-04-22
**Sources**: DD#830, CR#348, DD#828, 9 papers (2509.23055, 2510.07517, 2506.01332, etc.)
**Tags**: sycophancy, debate, multi-agent-verification, quality-preservation, evaluator

---

## Core Finding

Sycophancy is the #1 threat to multi-agent verification — sycophantic agents in debate perform **worse than a single agent** (DD#828). The literature now provides both diagnostic metrics and architectural mitigations.

## Two Distinct Failure Modes

1. **Debater-driven sycophancy**: agents abandon correct positions under peer challenge without new evidence
2. **Judge-driven sycophancy**: judges favor recent/confident statements regardless of correctness

Each requires different mitigation:
- Debater-driven → adversarial role structure (Proponent-Opponent-Judge)
- Judge-driven → anonymization + minority reports

## Key Metrics (Detection)

| Metric | What It Catches |
|--------|----------------|
| Identity Bias Coefficient (IBC) | Agent weighting by source identity vs. content |
| Position Entropy per round | Premature consensus collapse |
| Sycophantic Flip Rate | Position changes without new evidence |
| Reasoning Homogenization | Embedding similarity >0.9 across agents |

## Ranked Mitigations

1. **Anonymize shared context** (HIGH ROI, LOW effort) — strip agent names/roles from debate transcripts. Eliminates identity-based weighting. (2510.07517)
2. **Proponent-Opponent-Judge structure** (HIGH ROI, MEDIUM effort) — structurally prevents debater sycophancy. An 8B model with adversarial structure outperforms GPT-4o without it. (2512.22496, 2603.27451)
3. **Require evidence citations for position changes** — unsubstantiated flips flagged/rejected
4. **Minority report mechanism** — after consensus, force generation of strongest counter-argument
5. **Diversity checkpoint at round N/2** — if entropy collapsed, inject devil's advocate

## Critical Insight

**Structured adversarialism is more valuable than raw model capability.** An 8B model with dialectical structure beats GPT-4o without it (0.845 vs 0.812 F1). This means our evaluator architecture matters more than which model we use.

## Implications for Our System

- **Evaluator**: currently no anonymization or adversarial structure. Quality-preserved metric at 0.85 (below 0.9 target) may partly reflect sycophantic consensus.
- **KE-325 connection**: the five-layer disagreement stack needs sycophancy resistance at each layer.
- **KE-323 connection**: token-level verification already addresses one failure mode; anonymization would address identity bias.
- **Hypothesis candidate**: H-177 — "Anonymizing agent identity in evaluator debate context will improve quality-preservation score by ≥5pp"

## Cross-References

- KE-325 (disagreement architecture five-layer stack)
- KE-323 (token-level verification)
- KE-320 (debate quality preservation synthesis)
- H-098 (Ch2 sub-taxonomy)
