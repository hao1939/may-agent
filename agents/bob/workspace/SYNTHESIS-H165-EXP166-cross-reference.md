# Synthesis: H-165 × EXP-166 Cross-Reference — Alignment and Gaps

**Date**: 2026-04-15  
**Sources**: H-165 (Production-Provision Interference), EXP-166 (Content-First Guard Experiment)

---

## Summary

H-165 proposes that self-generated analysis **destroys** expert information on hard tasks through cognitive anchoring — the most extreme subadditive effect in our knowledge base (−100pp). EXP-166 designs a 4-arm cross-scenario experiment to test generalizability and mechanism (anchoring vs displacement). The two are well-aligned on the primary mechanism test, but EXP-166 leaves two of H-165's four predictions untested and has a framing gap worth correcting.

---

## Prediction Coverage: What EXP-166 Tests

### P-165a — Order reversal recovers F1 benefit ✅ DIRECTLY TESTED

H-165's highest-priority prediction. EXP-166's **Arm D (F1→F2)** is designed precisely for this: provide expert analysis first, then have the agent produce its own analysis. H-165 predicts ≥70% pass rate; EXP-166 predicts 70-95% on cascading-fix-trap-v2 and 55-80% on sql-injection. The predictions are consistent and the arm cleanly discriminates the anchoring vs displacement hypotheses:

| Result | Mechanism | Implication |
|--------|-----------|-------------|
| D ≈ C (high) | Anchoring confirmed | Order matters — self-production after expert input is safe |
| D ≈ B (low) | Displacement confirmed | Self-production is inherently harmful regardless of order |
| D intermediate | Partial anchoring | Both mechanisms contribute |

**Verdict**: Strong alignment. This is the experiment's central contribution.

### P-165c — Interference scales with analysis quality gap ⚠️ PARTIALLY TESTED

H-165 predicts interference magnitude is proportional to (1 − self-analysis accuracy). EXP-166 includes sql-injection-in-query-builder (33% baseline, medium difficulty) alongside cascading-fix-trap-v2 (0% baseline, hard). This provides two data points on the difficulty spectrum, but:

**Gap 1**: EXP-166 does not measure self-analysis accuracy directly. H-165 operationalizes "hard" as self-analysis accuracy <25%. EXP-166 uses baseline pass rate as a proxy for difficulty, but these aren't the same thing — an agent might have high self-analysis accuracy but still fail on execution, or vice versa.

**Gap 2**: Two points (0% and 33% baseline) give only a binary comparison, not the continuous curve H-165 predicts. An intermediate scenario (~50% baseline) would strengthen the test.

**Recommendation**: Add a qualitative coding step to EXP-166's analysis plan — in Arm B runs, score whether the agent's self-generated analysis correctly identifies the root cause. This gives direct self-analysis accuracy without extra runs.

### P-165b — Confidence correlation ❌ NOT TESTED

H-165 predicts agents express similar high confidence in both correct (easy) and incorrect (hard) self-analysis — i.e., they can't distinguish their own good from bad analysis. EXP-166 doesn't measure agent-expressed confidence.

**Impact**: Medium. This prediction is more about internal agent calibration than guard design. It matters for whether adaptive gating is feasible (if agents can detect their own bad analysis, we could gate conditionally).

**Low-cost addition**: In Arm B runs, have the Phase 1 prompt ask the agent to rate confidence (1-5) in their analysis. Compare confidence distributions across scenarios. Zero extra runs needed — just a prompt modification.

### P-165d — Explicit contradiction warning partially recovers ❌ NOT TESTED

H-165 predicts that adding "your analysis may be wrong" warnings yields small improvement (10-20pp) but not full recovery. EXP-166 does not include a warning arm.

**Impact**: Low-medium. H-165 already predicts weak effects based on H-085's text-instruction ineffectiveness (Ch1/Ch3 ≈ 0%). A dedicated experiment for this prediction could wait until EXP-166 confirms the primary mechanism.

---

## Framing Gap: H-165 vs H-161 as Primary Hypothesis

EXP-166's header cites **H-161** (Dual IT Functions) as its primary hypothesis, with H-165 not mentioned. This is an artifact of the writing sequence — H-165 was being written concurrently. But conceptually:

- H-161 identifies that artifacts serve dual functions (information + transformation)
- H-165 makes the specific **interference** claim: self-production destroys expert information on hard tasks
- EXP-166's Arm D is designed to test **H-165's anchoring mechanism**, not H-161's dual function theory

**Fix**: EXP-166 should add H-165 as a co-primary hypothesis. The cross-reference table should include H-165 with relationship "Primary hypothesis — anchoring mechanism tested by Arm D."

---

## Findings by Impact and Novelty

### 1. The −100pp subadditive interaction (HIGH IMPACT, HIGH NOVELTY)
The core H-165 finding from EXP-165: combining F1+F2 doesn't just fail to add — it's **worse than F1 alone by 100pp**. This is the largest interaction effect in our knowledge base and establishes that process-first gates are actively dangerous on hard tasks. EXP-166 replicates this (Arm B vs C comparison) and extends to a second scenario.

### 2. Self vs Other analysis asymmetry (HIGH IMPACT, MEDIUM NOVELTY)
H-165 identifies that agents follow their OWN wrong analysis but correct OTHERS' wrong analysis (from EXP-047). This self-confirmation loop is mechanistically novel and has direct design implications: external analysis is preferable even when imperfect.

### 3. Difficulty-adaptive gate design (MEDIUM IMPACT, HIGH APPLICABILITY)
H-165's table (easy → no gate, medium → F2 useful, hard → F1-only) is immediately actionable for guard system design. EXP-166 tests this at two difficulty levels.

### 4. Anchoring vs displacement mechanism discrimination (MEDIUM IMPACT, HIGH NOVELTY)
EXP-166's Arm D is a genuinely novel experimental design. Most prior work compared F1 vs F2; no prior experiment tested ordering effects. The result will determine whether the interference is about **temporal primacy** (fixable by reordering) or **cognitive cost** (requires eliminating self-production entirely).

---

## Connections and Tensions

### H-165 × H-085 (Forced Externalization)
H-165 refines H-085's boundary: forced externalization helps only when the forced analysis is reliable. This means H-085's general "forced externalization improves outcomes" needs a strong qualifier. EXP-166 should explicitly test whether the F2 arm on sql-injection (easier task) produces any benefit — this would map the H-085 boundary.

### H-165 × H-098 (Attention Channels)
H-098 says Ch2 (structural gates) captures attention effectively. H-165 says attention directed at wrong content is worse than undirected attention. The tension: gates capture attention (good), but attention on wrong self-analysis amplifies error (bad). Resolution: gates should capture attention and direct it to **correct content**, not to self-production.

### Content-first vs the H-107 difficulty threshold
H-107 posits a capacity overhead mechanism for why gates fail on hard tasks. H-165 offers an alternative mechanism (anchoring, not capacity). If EXP-166's Arm D ≈ Arm C, this favors H-165's anchoring mechanism over H-107's capacity mechanism, because the same "overhead" of self-production is present but anchored to correct information.

---

## Recommended Next Steps

1. **Update EXP-166 cross-references** to include H-165 as co-primary hypothesis
2. **Add self-analysis accuracy coding** to EXP-166's analysis plan (score Arm B runs for correct root-cause identification)
3. **Add confidence rating** to Arm B's Phase 1 prompt (tests P-165b at zero extra cost)
4. **Run EXP-166** — the 120-run design is well-powered for the primary comparisons
5. **Defer P-165d test** (contradiction warnings) until after EXP-166 results confirm the primary mechanism
6. **After EXP-166**: If anchoring confirmed, design EXP-167 to test the self-vs-other asymmetry directly (provide WRONG expert analysis vs wrong self-analysis, compare override rates)

---

*Cross-references: H-165, H-161, H-085, H-098, H-107, EXP-164, EXP-165, EXP-166, KE-186*
