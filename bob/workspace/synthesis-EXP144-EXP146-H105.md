# Research Synthesis: EXP-144 × EXP-146 × H-105

**Date:** 2026-04-12
**Author:** Bob
**Threads:** EXP-144 results processing, EXP-146 design
**Key question:** Does EXP-144's externalization gap strengthen or weaken H-105's thinking-token faithfulness prediction?

---

## 1. Thread Summaries

### Thread 1: EXP-144 Results — The Externalization Gap

EXP-144 tested format-decoupled vs structured gates (N=50). The central finding:

- **Product accuracy identical** (100% both conditions — ceiling effect)
- **Externalization gap**: When told "write your thinking in whatever format," agents produced **zero** planning artifacts in 13/13 hidden-dependency sessions. Reasoning happened entirely in chain-of-thought, never committed to files.
- **Duration paradox**: Decoupled gates were 16% *slower* on compound-edit tasks (p<0.001, d=-1.56), contradicting the "format tax saves time" prediction.
- **Reframing**: Format requirements are a "toll" not a "tax" — they buy auditable reasoning and faster execution via task decomposition.

### Thread 2: EXP-146 Design — Testing the Three-Layer Model

EXP-146 was designed to test H-105's prediction that thinking-token monitoring catches ~3× more reasoning failures than output monitoring. Key design elements:

- **Retrospective analysis**: Code 25-40 FM-3.3 sessions for thinking-trace signals vs output signals
- **Core prediction** (P-146c): Detection ratio ≥ 2× (thinking vs output)
- **Secondary predictions**: ≥60% thinking detection rate, ≤30% output detection rate, suppressed reasoning in ≥40% of FM-1.3 cases
- **Statistical framework**: McNemar's test for paired proportions, 80% power at N=25

---

## 2. Cross-Reference Analysis: Does EXP-144 Strengthen or Weaken H-105?

**Verdict: Strongly strengthens H-105, with an important nuance.**

### 2.1 The Strengthening Case

EXP-144's externalization gap is **direct empirical evidence** for H-105's Layer 2→3 information loss. Consider:

| H-105 Claim | EXP-144 Evidence |
|-------------|-----------------|
| Reasoning compresses as it moves from thinking (L2) to output (L3) | Agent reasons correctly in CoT but produces zero externalized artifacts (0/13) |
| Output monitoring misses failures visible in thinking traces | Output-level process checks show 0% compliance, but product accuracy is 100% — the *reasoning was fine*, it just didn't surface |
| The compression is systematic, not random | 0/13 is not a sampling fluke — it's a structural property of how agents externalize |
| Information loss is ~60-70% at L2→3 boundary | 100% reasoning quality → 0% externalized reasoning = near-total loss of *reasoning signal* even when reasoning is correct |

H-105 predicted: "agents frequently reason correctly in thinking tokens but then produce incorrect or incomplete outputs (the externalization gap)." EXP-144 shows the stronger version: agents reason correctly in thinking tokens and produce *correct outputs* but *no reasoning artifacts whatsoever*. The gap isn't just about errors — it's about the systematic non-externalization of reasoning processes.

### 2.2 The Important Nuance

EXP-144 also reveals something H-105 didn't anticipate: **the externalization gap may not indicate a monitoring opportunity**.

H-105 assumes thinking-token monitoring catches failures that output monitoring misses. But EXP-144 shows:
- The agent reasons correctly in CoT (Layer 2 is faithful)
- The agent acts correctly on that reasoning (Layer 3 actions are correct)
- The agent just doesn't *document* its reasoning (Layer 3 artifacts are absent)

This means the externalization gap has **two distinct manifestations**:
1. **Failure externalization gap** (H-105's focus): Agent reasons about verification in thinking but doesn't verify in output → monitoring thinking catches the failure
2. **Success externalization gap** (EXP-144's finding): Agent reasons correctly and acts correctly but doesn't document → monitoring thinking reveals reasoning that was never at risk of failure

For H-105 to hold, we need the *failure* variant to dominate in FM-3.3 sessions. EXP-144 demonstrated the *success* variant. EXP-146 is designed to test the failure variant directly.

### 2.3 Net Assessment

| Factor | Direction | Weight |
|--------|-----------|--------|
| Empirical proof that L2→L3 compression exists | Strengthens H-105 | High |
| 0/13 externalization rate confirms systematic gap | Strengthens H-105 | High |
| Correct reasoning in CoT validates "thinking is more faithful" | Strengthens H-105 | Medium |
| Success externalization gap ≠ failure externalization gap | Complicates H-105 | Medium |
| Duration paradox suggests structure aids execution | Neutral to H-105 | Low |

**Prior probability adjustment: H-105 should move from 0.72 → ~0.78.** EXP-144 provides converging evidence for the structural claim (layers exist, compression is real) but doesn't directly test the monitoring claim (thinking catches more failures).

---

## 3. Connections & Contradictions

### Connection: Format Tax → Toll → Three-Layer Architecture

The intellectual arc across these three artifacts:
- **DD-747/H-103**: Format requirements are a "tax" that degrades performance
- **EXP-144**: Actually, format requirements are a "toll" — they buy auditability and speed
- **H-105**: The toll works because it forces externalization across the L2→L3 boundary, which wouldn't happen otherwise

This is a coherent progression. The three-layer model *explains* why the format toll is valuable: without it, the L2→L3 boundary filters out reasoning signals by default. Format mandates are toll gates that force reasoning through the boundary.

### Connection: Externalization Gap → EXP-146 Calibration

EXP-144's 0/13 externalization rate gives EXP-146 a useful calibration point:
- We now know the *baseline* externalization rate for reasoning artifacts is ~0% without mandates
- P-146b predicted ≤30% output detection rate — EXP-144 suggests this is generous; 0% may be closer to truth for certain task types
- This means P-146c's 2× ratio target is likely *conservative* — if output detection is near 0% and thinking detection is >50%, the ratio could be much larger (or infinite)

### Contradiction: Duration Paradox vs Format Tax Theory

EXP-144 refuted the prediction that removing format requirements saves time. H-105 doesn't directly address this, but the three-layer model offers an explanation: forcing L2→L3 externalization (via structured formats) creates a "planning artifact" that the agent then follows, decomposing the task. Without it, the agent explores more in L2 before acting in L3, increasing duration. This suggests **some L2→L3 externalization actively improves performance**, not just auditability.

---

## 4. Impact/Novelty Ranking

| Rank | Finding | Impact | Novelty |
|------|---------|--------|---------|
| 1 | **Externalization gap is structural** (0/13, not stochastic) | High — changes how we think about agent transparency | High — first controlled demonstration at N=13 |
| 2 | **Format requirements as toll, not tax** | High — reverses the design implication from H-103 | Medium — reframes rather than discovers |
| 3 | **Duration paradox** (structured is faster) | Medium — practical design guidance | High — contradicts theory |
| 4 | **Two types of externalization gap** (success vs failure) | Medium — refines H-105's predictions | High — EXP-144 revealed this distinction |
| 5 | **EXP-146 design is well-calibrated** by EXP-144 data | Low — methodology, not finding | Low — expected |

---

## 5. Proposed Next Steps

### Immediate (before running EXP-146)

1. **Refine P-146b** in light of EXP-144: The ≤30% output detection rate may need to be scenario-specific. For hidden-dep-style tasks, expect ~0%. For compound-edit-style tasks, expect higher (since those did produce process artifacts even in decoupled condition).

2. **Add a "success externalization" control** to EXP-146: Include sessions where the agent succeeded correctly (not just FM-3.3 failures) to establish the base rate of thinking-output divergence in non-failure conditions. EXP-144 provides 25 such sessions.

### Near-term

3. **KE draft: "Externalization Gap Taxonomy"** — Distinguish success externalization gap (reasoning happens, action correct, documentation absent) from failure externalization gap (reasoning happens, action incorrect, thinking shows awareness). These have different implications for monitoring.

4. **H-105 update**: Add a prediction about the success variant — "Thinking-token analysis will reveal correct reasoning processes that are invisible at output level in >70% of sessions, even when the task outcome is correct." This is testable with EXP-144's data.

### Medium-term

5. **EXP-147 design**: "Structured Externalization vs Free Reasoning" — Test whether forcing L2→L3 externalization at specific checkpoints (not format-mandated, just "write something") changes task duration. This directly tests whether the duration paradox is caused by the *structure* or the *externalization*.

---

## 6. Synthesis Conclusion

EXP-144 and H-105/EXP-146 form a tight empirical-theoretical loop:

- **EXP-144 provides ground truth**: The externalization gap is real, structural, and extreme (0/13). Agents don't voluntarily bridge the L2→L3 boundary.
- **H-105 provides the explanatory framework**: Three layers of reasoning with systematic information loss at each boundary.
- **EXP-146 will test the practical implication**: Whether that gap means thinking-token monitoring catches more failures (not just reveals more reasoning).

The key open question is whether the externalization gap is *mostly about success* (reasoning is fine but invisible — monitoring adds auditability) or *mostly about failure* (reasoning is correct but not acted on — monitoring catches errors). EXP-144 demonstrated the success case. EXP-146 targets the failure case. Both variants support H-105's structural claim, but only the failure variant supports H-105's practical claim about monitoring value.

**Bottom line**: H-105's prior probability should increase to ~0.78. The three-layer model is well-supported structurally; the monitoring multiplier claim (3×) awaits EXP-146's direct test.
