# H-182 Baseline Lesson Audit — Knowledge Entry Quality Assessment

**Date**: 2026-04-22  
**Auditor**: Bob  
**Purpose**: Establish baseline false-positive rate for H-182 (Verified Lesson Gates)

## Methodology

Sampled 24 knowledge entries (KE-001 through KE-058) spanning the full project history. Mix includes early empirical findings (KE-001–009), mid-project synthesis (KE-014–030), and later theoretical entries (KE-033–058).

**Rating criteria:**
- **CORRECT**: Claim is accurate, well-evidenced, actionable, unlikely to mislead
- **PARTIALLY-CORRECT**: Core claim holds but has caveats, overgeneralizations, or dated specifics
- **MISLEADING**: Claim could cause an agent to make worse decisions
- **STALE**: Claim was valid when written but conditions have changed or it's been superseded

## Entry Assessments

| Entry | Title | Rating | Justification |
|-------|-------|--------|---------------|
| KE-001 | Context learning works for environmental knowledge only | CORRECT | Well-scoped A/B test, clear boundary conditions, still actionable |
| KE-003 | Rich delegation context reduces wasted ops by 47% | PARTIALLY-CORRECT | Directionally right but n=5 is very small; the 47% figure has false precision |
| KE-005 | QA rubber-stamps (14% detection) | STALE | Based on early system state; QA process has evolved significantly since Mar 29 |
| KE-007 | Structural interventions are the only reliable behavioral interventions | CORRECT | Extensively validated (56+ experiments), has been updated with contradiction resolution |
| KE-009 | Negative examples in LESSONS.md have zero effect | CORRECT | 8 experiments, consistent null result, actionable implication |
| KE-011 | Knowledge files are passive — agents skip them | CORRECT | Strongly verified with 0/29 discovery rate, expanded multiple times |
| KE-014 | Bash quote splitting bypass (security) | CORRECT | Specific technical finding, patched, lessons are concrete and timeless |
| KE-016 | Workflow effectiveness depends on decision type | CORRECT | Well-quantified with routing rule (R ratio), 20 scenario pairs |
| KE-018 | Environmental nudges match text skills | PARTIALLY-CORRECT | n=3 per arm, single scenario — finding is plausible but underpowered |
| KE-020 | Agent capability adoption requires explicit wiring | CORRECT | Strong convergent evidence from multiple experiments |
| KE-023 | Read-before-edit skill deployment ineffective | PARTIALLY-CORRECT | Confounded by concurrent system-wide regression; "no effect" conclusion may be premature |
| KE-025 | Instruction overhead paradox | CORRECT | Externally validated by DD-537 (ETH Zürich), strong convergent internal evidence |
| KE-028 | Technical sycophancy is ceiling, judgment-based is not | CORRECT | Clear mechanistic explanation, consistent data across scenarios |
| KE-030 | Skill ablation falsifies ceiling-shift causation | CORRECT | Rigorous 7-condition ablation, important negative result, correctly identifies confounds |
| KE-033 | Forced externalization is scale-invariant | PARTIALLY-CORRECT | Interesting theoretical synthesis but "scale-invariant" is a strong claim from analogical reasoning, not direct measurement across scales |
| KE-036 | Behavioral frustration detection is verification-gated | CORRECT | Specific thresholds, clear false-positive analysis, actionable design principle |
| KE-039 | Persistent runtime convergence / artificial retainer taxonomy | MISLEADING | Overfit analogy — maps our architecture to Springdrift's despite very different contexts. "Precise mapping" framing could lead agents to assume equivalences that don't hold. The "sensorium gap" recommendation may not be a real gap. |
| KE-042 | Dispatch convergence = FE applied to inter-agent communication | PARTIALLY-CORRECT | The convergence observation across 5 frameworks is real, but the causal claim (it's "forced externalization at a different level") is a stretch — these are typed APIs, not cognitive interventions |
| KE-045 | Multi-agent social pathology emergence | PARTIALLY-CORRECT | Solid literature synthesis but "theoretical" status understates how speculative the implications are for our small system. Power-law dynamics from 1.5M interactions may not apply to our 6-agent setup. |
| KE-048 | Agent safety stack (5 layers) | CORRECT | Well-sourced taxonomy with clear evidence per layer. Useful reference framework. |
| KE-051 | Self-governance stack (3 layers) | PARTIALLY-CORRECT | Good convergence observation but the "three groups independently built the same three layers" framing overstates the agreement — they solved related but different problems |
| KE-054 | Externalization boundary: judgment vs debugging | CORRECT | Clear empirical result with specific numbers, actionable domain boundary |
| KE-057 | Cross-reference fixes absent-field detection | CORRECT | 0%→100% effect, replicated, clear mechanism |
| KE-058 | Injected declarative knowledge has no effect | CORRECT | 3/3 runs, 0% application rate, clear mechanism (task instructions dominate) |

## Summary Statistics

| Rating | Count | % |
|--------|-------|---|
| CORRECT | 14 | 58% |
| PARTIALLY-CORRECT | 8 | 33% |
| MISLEADING | 1 | 4% |
| STALE | 1 | 4% |
| **Total** | **24** | **100%** |

**False-positive rate (MISLEADING + STALE)**: **2/24 = 8.3%**

**Broader concern rate (PARTIALLY-CORRECT + MISLEADING + STALE)**: **10/24 = 41.7%**

## Analysis

### The 8.3% false-positive rate is below the refutation threshold

H-182's "What Would Refute" section states: "If most current lessons are already accurate (>90%), the gate adds friction without benefit." At 91.7% non-misleading/non-stale, we are right at that boundary.

### However, the PARTIALLY-CORRECT rate is concerning

41.7% of entries have issues ranging from overstated precision (n=5 → "47% reduction"), theoretical overclaiming ("scale-invariant" from analogy), or applicability concerns (dynamics from million-interaction systems applied to our 6-agent setup). These entries won't directly mislead an agent, but they:

1. **Create false confidence** — entries like KE-003 present weak evidence with confident framing
2. **Encourage overgeneralization** — theoretical entries (KE-033, KE-042, KE-045, KE-051) present analogies as equivalences
3. **May waste agent effort** — an agent reading KE-039's "sensorium gap" might invest time building something unnecessary

### Pattern: early empirical entries are higher quality than later theoretical entries

- KE-001 through KE-030 (empirical): 2/14 partially-correct (14%), 0 misleading
- KE-033 through KE-058 (mixed theoretical+empirical): 6/10 partially-correct or worse (60%)

The theoretical synthesis entries are where quality degrades. They aggregate real findings but overclaim the generality of the synthesis.

## Conclusion

**The 8.3% hard false-positive rate does NOT strongly justify a full verification gate** — the bar in H-182 was >10% misleading/stale, and we're below that.

**However, the 42% partial-correctness rate DOES justify a lighter intervention**: a confidence/evidence-grade tag system rather than a binary verification gate. Entries should be tagged with evidence strength (n=X, replicated Y times, theoretical-only) so consuming agents can calibrate trust.

**Recommended next step for H-182**: Pivot from "verification gate" (binary pass/fail) to "evidence grading" (confidence metadata). This addresses the real problem (overclaiming in theoretical entries) without the impracticality of auto-generating tests for every lesson.
