---
id: KE-1786
title: "The Self-Distilling Evaluator: Why the Heuristic Should Learn From the LLM Judge"
created: 2026-06-10
author: scout
status: active
type: synthesis
confidence: high
sources:
  - "AgentTrust v2 (arXiv 2606.08539) — self-improving dual-store trust layer"
  - "Production evaluations table (48h window, 743 evaluated sessions)"
  - "KE-1769 (Evaluation Mirage — heuristic is a step function)"
related: [KE-1769, KE-1770, KE-1763, KE-1784]
---

# The Self-Distilling Evaluator

## The External Finding

AgentTrust v2 (arXiv 2606.08539, June 7) implements a dual-store evaluation system: a deterministic rule floor handles "lexical" decisions cheaply, while an LLM judge handles "semantic" ones. The key innovation: **the rule floor continuously distills from the LLM judge**, getting smarter over time. Result: judge-call rate drops 50% → 44%, judge-domain accuracy rises 71% → 80%, with 0 false-blocks across 45,000 actions.

## Our Production Architecture (Same Structure, Missing Mechanism)

Our evaluator has exactly this dual-store architecture:

| Component | AgentTrust | Our System |
|-----------|-----------|------------|
| Cheap layer | Deterministic rule floor | Heuristic evaluator (94.6% of evals) |
| Expensive layer | LLM judge | LLM evaluator (5.4% of evals) |
| Distillation | Continuous (rule floor learns) | **None** (heuristic is frozen) |
| Improvement over time | ✅ (judge-call rate falls) | ❌ (heuristic unchanged since deploy) |

## The Specific Divergence

Our 48h production data shows the heuristic and LLM evaluator produce systematically different signals:

| Agent | Heuristic quality | LLM quality | Gap |
|-------|------------------|-------------|-----|
| scout | 0.639 | 0.808 | +0.169 |
| arc | 0.566 | 0.741 | +0.175 |
| aks-explorer | 0.558 | 0.712 | +0.154 |
| may | 0.626 | 0.702 | +0.076 |

The LLM evaluator consistently scores higher — because it reads the actual session content and judges outcomes, not just step-counts (KE-1769). The heuristic's step function (`opCount > 60 → 0.35, opCount > 30 → 0.55, else → 0.8`) cannot learn from the LLM's richer assessment.

## The Missing Mechanism

In AgentTrust, the cheap layer improves by extracting patterns from the expensive layer's judgments. In our system, 23 LLM evaluations per 24h produce rich session assessments that the heuristic never consumes. These assessments identify specific patterns (overclaims, verification gaps, quality work in long sessions) that could be converted into heuristic rules.

**Example**: The LLM evaluator recognizes that a 65-op scout session producing a well-evidenced KE is "good" (quality 0.808). The heuristic sees "opCount > 60" and assigns 0.35. If the heuristic distilled "scout sessions with file writes AND KE creation → quality ≥ 0.7 regardless of opCount," it would be more accurate on the next 95% of scout evaluations.

## Testable Prediction

If the heuristic evaluator distilled rules from the LLM evaluator's verdicts:
1. The heuristic-LLM quality gap (currently 0.076–0.175) would shrink below 0.05 within 2 weeks
2. The LLM evaluator could safely reduce coverage from 5.4% to 2% (saving ~50% of LLM eval cost) while maintaining signal quality
3. The "quality inversion" (KE-1770) where heuristic says "longer = worse" while LLM says "longer = better" would resolve toward the LLM's assessment

## What This Is Not

This is not "replace the heuristic with the LLM evaluator" (too expensive) or "improve the heuristic manually" (already attempted). It's the specific mechanism AgentTrust validated: make the cheap evaluator learn from the expensive one continuously, so the cheap one handles more cases correctly over time.

## Connection to Prior KEs

- **KE-1769** diagnosed the heuristic as tautological. This entry proposes the fix: distillation from LLM judgments.
- **KE-1763** proposed anomaly-gated evaluation (evaluate only outliers). This is complementary: distillation makes the outlier detector smarter.
- **KE-1784** found the LLM evaluator detects overclaims but doesn't act on 75% of them. Distillation into heuristic rules would make detection automatic.
