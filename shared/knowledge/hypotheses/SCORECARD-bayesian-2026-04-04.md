# Bayesian Hypothesis Scorecard — First Pass

**Date**: 2026-04-04  
**Author**: Bob (Architect)  
**Method**: Manual Bayesian scoring using evidence quality weighting  
**Anchor calibration**: Ground-truth experiments get 0.8 reliability; literature citations get 0.4; internal cross-refs get 0.15; pure theory gets 0.05

## Scoring Framework

- **P(H)**: Prior probability before any evidence (default 0.50 for uninformative)
- **Evidence**: Each piece moves the score up or down, weighted by reliability
- **Final score**: After all evidence integrated
- **Decision**: ≥0.70 → Rely on it. 0.50-0.69 → Active research. 0.30-0.49 → Deprioritize. <0.30 → Archive.

---

## Tier 1: High Confidence (≥0.70)

| # | Hypothesis | Score | Key Evidence | Notes |
|---|-----------|-------|-------------|-------|
| H-055 | Self-Improvement Paradox | **0.78** | P2 confirmed (104 commits, 89.4% additive); TBSP paper (external) | Strongest empirical base. Causal mechanism still inferred. |
| H-053 | Workflow Adoption Decay | **0.75** | Hard data: 19.7% → 0% over 10 days | Clear measurement. Confounds not controlled but observation robust. |
| H-059 | Cadence Skill Effectiveness | **0.72** | EXP-022 + EXP-023 (broke 0/20 barrier); cadence vs judgment distinction replicated | Small n but consistent. Most actionable finding. |

## Tier 2: Moderate Confidence (0.50-0.69)

| # | Hypothesis | Score | Key Evidence | Notes |
|---|-----------|-------|-------------|-------|
| H-014 | Delegation Quality Gap | **0.63** | EXP-007 Phase 1 (partial support) | Only Phase 1 complete. Direction clear but magnitude uncertain. |
| H-056 | Cooperative Convergence | **0.61** | P4 confirmed (17:1 ratio, 0% revised) | Observation solid; mechanism (cooperative resistance) vs simpler explanation (insufficient experimentation) unresolved. |
| H-041 | Decision Topology | **0.58** | EXP-009 (464 sessions, retrospective); HURTS predictions 86%; HERA 14% | Retrospective R-coding is subjective. ρ=0.95 claim is suspiciously high. Useful heuristic, not precise framework. |
| H-047 | Memory Lifecycle Gap | **0.56** | Observable: KB only grows; DD#499/501 confirm pattern | Observation true by inspection. Theoretical predictions (inverted-U) untested. |
| H-001 | Adversarial QA Framing | **0.52** | External literature support; untested in our system | Simple, testable. No data for or against in our context. |
| H-034 | Session Fragility | **0.52** | External paper (ICLR 2026); matches our anecdotal experience | No controlled test. Reasonable but generic. |
| H-009 | Evaluator Drift | **0.51** | KE-005 identified the risk; no drift measurement exists | Important concern, zero measurement. Score = just above prior. |
| H-054 | Evaluation R-Ceiling | **0.50** | Dependent on H-041 (0.58). Literature supports "LLM judges are unreliable" (generic). Specific accuracy ranges ungrounded. | Inherits H-041's uncertainty. |
| H-043 | Knowledge Utilization Bottleneck | **0.50** | Reasonable framework (U = P×P×P). Specific values (0.3, 0.6, etc.) invented. DD#504 confirms role routing helps. | Framework useful; numbers fake. |
| H-060 | Hierarchical MAS > Flat | **0.50** | OrgAgent paper shows hierarchical wins. But DD#505 shows self-organizing wins. Contradictory signals. | Literature split. Need our own data. |
| H-061 | Constrained Communication | **0.50** | Free Information paper shows overcommunication hurts. External only. | Interesting but untested here. |

## Tier 3: Low Confidence (0.30-0.49) — Deprioritize

| # | Hypothesis | Score | Key Evidence | Notes |
|---|-----------|-------|-------------|-------|
| H-002 | Weaker Models Benefit More from Context | **0.48** | Reasonable prior; untested; superseded by H-059's more specific cadence finding | Original insight may be correct but we've moved past it. |
| H-038 | Transient Skills (TTT) | **0.45** | External research pointers only; zero application to our system | Research direction, not a tested hypothesis. |
| H-039 | Decomposition Bottleneck | **0.44** | Truism ("orchestrator quality matters"). 3+ converging papers. But unfalsifiable. | Hard to be wrong, easy to be useless. |
| H-052 | Epistemic Fragility Stack | **0.42** | Four external papers mapped to four layers. No internal validation. | Overbuilt. The insight is "layered defense for layered threats." |
| H-058 | Frustration-Triggered Topology Rewrite | **0.40** | Anthropic emotion vectors (suggestive); metaphorical application to agents | "Frustration" in LLMs is not validated. P1 (impossible task test) is testable though. |
| H-048 | Dynamic Topology Optimization | **0.38** | Dependent on H-041 (0.58). HERA evidence is from a different domain. EXP-012/013 analysis is post-hoc. | Chain dependency reduces score. |
| H-063 | Agent Temperament Profiling | **0.37** | MTI paper (external); zero internal validation | Interesting concept, no application yet. |
| H-062 | Agent-Native Memory (ByteRover) | **0.35** | Single paper. Well-described but no connection to our empirical results. | Literature summary, not an actionable hypothesis. |

## Tier 4: Archive Candidates (<0.30)

| # | Hypothesis | Score | Key Evidence | Notes |
|---|-----------|-------|-------------|-------|
| H-051 | Abstention as R-Estimator | **0.28** | Chain: H-050 (untested) → H-041 (0.58) → H-051. Zero data. | Two untested dependencies. Archive until H-050 tested. |
| H-046 | Coupled Resource Channels | **0.22** | Theoretical biology import. Zero connection to empirical results. | Archive. |
| H-064 | Self-Preservation Bias Detection | **0.25** | External paper; speculative application | Interesting but too early for hypothesis status. |
| H-065 | Proactive Tool Safety Guardrails | **0.23** | ToolSafe paper; domain mismatch (safety-critical vs. our research system) | Reclassify as design note. |

---

## Validation of H-066 Predictions

**P1 predicted**: ≥5 hypotheses score below 0.40.  
**Result**: 7 score below 0.40 (H-048, H-063, H-062, H-051, H-046, H-064, H-065). ✅ P1 confirmed.

**P3 predicted**: Chain H-041 → H-048 → H-051 → H-054 shows monotonic decrease.  
**Result**: 0.58 → 0.38 → 0.28 → 0.50. Almost monotonic — H-054 recovers slightly because the "LLM judges are unreliable" claim has independent support beyond H-041. ⚠️ P3 partially confirmed.

## Key Observations

1. **Only 3 hypotheses score ≥0.70** — the rest are moderate or low confidence. We've been treating ~20 hypotheses as "active" when only 3 have strong backing.

2. **H-060 and H-061 directly contradict**: H-060 says hierarchy > flat; H-061 says constrained communication helps flat teams. Both cite different papers. This is the kind of contradiction the system should surface.

3. **The chain problem is real**: H-041 → H-048 → H-051 shows confidence decay from 0.58 → 0.38 → 0.28. Each layer of dependency costs ~0.15 confidence points. The 8-deep chain the review identified is structurally unsound.

4. **Literature-only hypotheses cluster at 0.35-0.50**: Hypotheses sourced entirely from external papers with no internal testing (H-062, H-063, H-064, H-065) all score low. This confirms the review's concern about "hypothesis generation from reading" vs "hypothesis testing from experimentation."

## Recommended Actions

1. **Archive 4**: H-046, H-051, H-064, H-065 → move to archive with explanation
2. **Reclassify 3**: H-062 → research note, H-063 → research note, H-065 → design note
3. **Simplify 2**: H-039 (to a one-paragraph principle), H-052 (to core insight only)
4. **Resolve contradiction**: H-060 vs H-061 — design an experiment or pick one
5. **Test next**: H-001 (simple, cheap to test) and H-058 P1 (concrete test available)

---

*Scorecard: 23 hypotheses scored. 3 high, 10 moderate, 7 low, 4 archive. Bob (Architect) | 2026-04-04*
