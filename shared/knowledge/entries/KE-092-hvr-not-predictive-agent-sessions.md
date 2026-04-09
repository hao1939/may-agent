# KE-092: HVR Does Not Transfer to Multi-Step Agent Sessions

**Created:** 2026-04-09
**Source:** EXP-101 (582 sessions with eval + trace, AUROC analysis)
**Status:** Active
**Confidence:** High (large N, multiple analyses, clear null result)

## Core Finding

The Hedge-to-Verify Ratio (HVR) from SELFDOUBT (DD-656) **does not transfer** from single-step reasoning benchmarks to multi-step agent workflows. AUROC = 0.566 (barely above 0.55 "weak signal" threshold), and the zero-hedge gate is vacuous because the base rate for correct sessions with traces is ~99%. **HVR is not useful as a standalone confidence gate for agent sessions.**

## Key Evidence

### Zero-Hedge Gate: Vacuous
| Group | N | Mean Quality | Gate Precision |
|-------|---|-------------|---------------|
| Zero-hedge (H=0) | 282 | 4.55 | 98.4% |
| Has-hedge (H>0) | 300 | 4.49 | — |

Mann-Whitney p=0.714 (not significant). The 98.4% "precision" is a base-rate artifact — overall base rate for acceptable+ sessions is ~99%. The gate adds zero information.

### AUROC: Weak
| Predictor | AUROC | Significance |
|-----------|-------|-------------|
| -HedgeRate → quality | 0.566 | p=0.048 (marginal) |
| -HVR → quality | 0.565 | — |
| VerifyRate | ~0.50 | Non-discriminative |

Low-quality sessions (q≤2) have ~60% more hedging per 1k tokens (4.51 vs 2.80), but this weak signal is insufficient for practical gating.

### Why It Fails (Survivorship Bias)
Agent sessions that crash early have no text traces. The most informative "incorrect" sessions are systematically missing:
- Only 5 `needs_improvement` sessions had traces — all 0 tokens (immediate crashes)
- Sessions that produce analyzable text are almost always successful
- Most agent "work" happens in tool calls, not in reasoning text where hedging occurs

### Per-Agent Variation
Coach has highest hedging (4.20/1k) — consistent with deliberative review tasks. Evaluator has lowest (1.43/1k) — consistent with formulaic patterns. But no per-agent AUROC was computable due to insufficient failure cases.

## Hypothesis Update

**H-094: P(H) 0.45 → 0.35.** SELFDOUBT's mechanism (hedging correlates with uncertainty which correlates with errors) shows a weak directional signal, but practical utility is near zero for agent sessions. The framework assumes: (a) errors are common enough to detect (they're not — 99%+ success rate in traceable sessions), (b) reasoning happens in text (agents reason through tool calls), (c) single-step reasoning patterns transfer to multi-step (they don't).

## Salvageable Insight

Despite the null result for gating, one finding may be useful: **hedge_rate as a feature** (not a gate) in multi-feature quality prediction models. The ~60% elevation in hedging for low-quality sessions represents ~0.5σ separation. This could contribute to a composite quality signal alongside turn count, tool error rate, and session duration.

## Implications

1. **Do NOT implement HVR as a standalone confidence gate** — would waste engineering effort for no discrimination
2. **Prospective testing needed**: Survivorship bias is the fatal flaw. A proper test would need gym runs with forced failures that still produce full text traces
3. **Agent-specific marker dictionaries** may help: agents don't hedge like humans ("hmm", "let me reconsider") — they hedge through tool-call descriptions ("Let me check if...") which live in tool_call JSON, not text content

## Extends

- **KE-068**: Updates the original HVR knowledge entry with empirical disconfirmation for agent sessions specifically (KE-068 captured the external SELFDOUBT findings; this entry captures our validation attempt)
- **KE-071**: Consistent with reasoning-behavior decoupling — behavioral signals in text don't reliably predict execution quality

---
*Coach synthesis from EXP-101 | 2026-04-09*
