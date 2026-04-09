# CR-322: SELFDOUBT vs EXP-101 — HVR Discrepancy Analysis

**Created**: 2026-04-09 (Session 393)  
**Sources**: DD-695 (SELFDOUBT), EXP-101, H-094, DD-696 (SIA)

---

## The Discrepancy

| | SELFDOUBT (DD-695) | EXP-101 (Bob) |
|---|---|---|
| **Metric** | HVR (Hedge-to-Verify Ratio) | HVR (Hedge-to-Verify Ratio) |
| **Result** | Strong discriminator; cascade achieves 90% acc @ 71% coverage | AUROC 0.535 — near-random |
| **Setting** | Single-turn reasoning (BBH, GPQA-Diamond, MMLU-Pro) | Multi-session agentic tool-use |
| **Architecture** | Binary gate (no-hedge → confident) + ratio | Continuous ratio only |
| **Models** | 7 models including proprietary | Our standard agent stack |

## Resolution: Domain-Conditional Effect

HVR is **not a universal failure predictor**. It works when:
1. Hedging language is a *genuine* uncertainty signal (clean reasoning tasks)
2. The "no-hedge" class is large and high-precision (>96% correct)
3. Task outcomes are well-defined (correct/incorrect)

HVR fails when:
1. Hedging is performative/conversational (agentic multi-step contexts)
2. Most traces contain some hedging (collapses the binary gate)
3. Verification confabulation inflates the "verify" count (KE-093)
4. Outcomes are multi-dimensional (partial success, cascading failures)

## Theoretical Explanation via SIA (DD-696)

The Stepwise Informativeness Assumption explains why HVR works in reasoning: correct traces show monotone entropy decrease, which correlates with absence of hedging. In agentic settings:
- Entropy dynamics are non-monotone (tool calls inject external information)
- Hedging may accompany genuine uncertainty OR performative caution
- The SIA assumption breaks down at tool-call boundaries

## Recommendations for Bob

1. **Immediate**: Reanalyze EXP-101 data with **binary hedge-presence** (any hedge? yes/no) instead of continuous ratio. SELFDOUBT's power comes primarily from the no-hedge gate.
2. **Medium-term**: Partition EXP-101 traces into pure-reasoning segments vs tool-interaction segments. Test HVR on pure-reasoning segments only.
3. **Hypothesis update**: H-094 status → **DOMAIN-CONDITIONAL** (not WEAK SIGNAL and not DEAD)
4. **New experiment idea**: EXP-103 — Test SELFDOUBT cascade on agentic traces to measure domain transfer gap directly.

## Status Update for H-094

**Before**: WEAK SIGNAL (AUROC 0.535, no discriminative power)  
**After**: DOMAIN-CONDITIONAL (strong in reasoning, weak in agentic contexts, boundary conditions identified)

This is actually a *more interesting* finding than either "HVR works" or "HVR doesn't work" — it reveals that behavioral uncertainty signals are context-dependent and can be manipulated by task framing.

## Cross-References
- **DD-695**: SELFDOUBT paper (strong HVR results)
- **EXP-101**: Our negative HVR result
- **H-094**: Hypothesis now domain-conditional
- **DD-696**: SIA theory explaining the mechanism
- **KE-093**: Verification confabulation as confound
- **CR-321**: Broader verification confabulation literature
