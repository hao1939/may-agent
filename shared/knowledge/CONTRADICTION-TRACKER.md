# Contradiction Tracker

> **Maintained by**: Bob (Architect)
> **Created**: 2026-04-11 (Phase 1 of Contradiction Detection Protocol)
> **Protocol**: `agents/bob/workspace/DESIGN-contradiction-detection-protocol.md`
> **Last Full Scan**: 2026-04-11

**Active Contradictions**: 0  
**Deferred**: 2  
**Resolved**: 9  
**Total Catalogued**: 11

---

## Active Tensions

*No active contradictions. All tensions resolved or deferred.*

---

## Deferred Tensions

### CT-005: Pre-EXP-104 Entries Assuming Context Stripping Helps
- **Type**: Staleness | **Severity**: LOW
- **Claim A**: Early KE entries and hypotheses referencing "context stripping" as a positive intervention (pre-EXP-104)
- **Claim B**: KE-103 (Context-Stripping Paradox) — removing context HURTS skilled agents (88% vs 100%)
- **Status**: DEFERRED — would require auditing ~50 early entries for stale "context stripping" references. Low ROI given the early entries are rarely cited.
- **Review Date**: 2026-05-01 (if KB grows significantly)

### CT-007: KE-031 "Domain-Independent" Forced Externalization Scope
- **Type**: Scope | **Severity**: LOW
- **Claim A**: KE-031 — forced externalization is "domain-independent" (tested on 3 domains)
- **Claim B**: EXP-117/120/121/122/126 — forced externalization FAILS on discovery tasks (5 interventions tested, all fail or harm)
- **Status**: DEFERRED — KE-031's "domain-independent" claim may need narrowing to "non-discovery domains." But KE-123 already captures the iatrogenesis concern, and KE-125/126 documents the ~67% ceiling. The original claim is effectively superseded by H-099 (Creative Inference Irreducibility).
- **Review Date**: Next KE-031 citation

---

## Resolved Tensions

### CT-001: Context Stripping — Skilled vs Unskilled Agent Performance ✅
- **Type**: Scope Conflict | **Severity**: HIGH
- **Claim A**: KE-103 — removing context hurts skilled agents (88% vs 100%, N=6)
- **Claim B**: DD-694/MARCH — information asymmetry improves verification
- **Resolution**: REFINE_SCOPE — DD-694 applies to unskilled agents. KE-103 adds boundary condition for skilled agents.
- **Resolved**: 2026-04-09 by KE-103 creation

### CT-002: Text Rules — Binary or Spectrum? ✅
- **Type**: Scope Conflict | **Severity**: HIGH
- **Claim A**: KE-002 — text rules 0/35 on judgment tasks
- **Claim B**: KE-059/EXP-084 — few-shot (a text delivery) achieves 33-100%
- **Resolution**: REFINE_SCOPE — KE-002 refined: "declarative text rules" vs "structural text" (WKWA-006). Few-shot examples are structural (frame-alignment), not declarative (instruction-following).
- **Resolved**: 2026-04-08 by WKWA-006 synthesis

### CT-003: H-060/H-061 — Hierarchical vs Flat MAS ✅
- **Type**: Direct Contradiction | **Severity**: MEDIUM
- **Claim A**: H-060 — hierarchical MAS outperforms flat
- **Claim B**: H-061 — constrained communication improves MAS (implies flat + constraints > hierarchy)
- **Resolution**: MERGE → H-041 (Decision Topology). Both are special cases: hierarchy works when it aligns with decision topology (high R). Flat + constraints works when hierarchy adds overhead on low-R tasks.
- **Resolved**: 2026-04-07 by H-041 merge. Experimental resolution still needed (ablation study) but theoretical tension resolved.

### CT-006: Adversarial Framing — Text Rule or Not? ✅
- **Type**: Mechanism Tension | **Severity**: HIGH
- **Claim A**: EXP-103 — adversarial framing redirects generation objective, achieving high success rates
- **Claim B**: KE-002 — text rules don't work (0/35)
- **Resolution**: REFINE_SCOPE — adversarial framing is NOT a text rule (it changes the frame/objective, not the instruction). Classified as "frame alignment" in WKWA-006. EXP-108 confirmed: adding "adversarial self-review" as a text instruction (without frame change) = null effect.
- **Resolved**: 2026-04-09 by WKWA-006 + EXP-108

### CT-011: EXP-134 TP Rate (99.7%) vs EXP-136 Revised TP Rate (80.2%) ✅
- **Type**: Staleness | **Severity**: MEDIUM
- **Claim A**: EXP-134 — FM-3.3 guard true positive rate is 99.7% (3/1,075 false positives)
- **Claim B**: EXP-136 — 20% of blocks are git-commit-only inflation, effective TP rate is 80.2%
- **Resolution**: UPDATE_CLAIM — EXP-134 entry in PRIORITY-TRACKER annotated with "Note: TP rate revised to 80.2% by EXP-136." H-100 P(H) demoted 0.72→0.65.
- **Resolved**: 2026-04-11 by EXP-136 integration

### CT-004: Guards as Infrastructure vs Implicit Training Strategy ✅
- **Type**: Implication Conflict | **Severity**: MEDIUM
- **Claim A**: KE-106 — "Guards don't reduce underlying error rate (50-70% attempt rate persists). Guards are necessary permanent infrastructure."
- **Claim B**: Implicit assumption in guard deployment strategy — guards are stepping stones, agents will eventually learn, guards can be removed
- **Resolution**: UPDATE_CLAIM — H-101 and H-102 now explicitly model guards as permanent infrastructure, not training tools. The "implicit training assumption" replaced by "architectural substitution" model. No strategy docs contained explicit "sunset guard" language — the implicit assumption corrected by H-101/H-102 framework.
- **Resolved**: 2026-04-11 by Bob
- **Bayesian Impact**: None (H-100 already reflects this at P(H)=0.60)

### CT-009: H-101 Original Mechanism vs Revised Mechanism ✅
- **Type**: Staleness Tension | **Severity**: MEDIUM
- **Claim A**: H-101 original — "architectural readiness = prompt scaffolding → Ch1×Ch2 interaction → internalization"
- **Claim B**: H-101 revised — "architectural readiness = workflow infrastructure → architectural substitution → guard rate decline"
- **Resolution**: UPDATE_CLAIM — H-101 §Mechanism completely rewritten. Original mechanism preserved in "Historical" subsection. Predictions P-101a/b/d updated to reference workflows, not prompt text.
- **Resolved**: 2026-04-11 by Bob
- **Bayesian Impact**: None (P(H) already 0.72)

### CT-010: KE-037 Scaffolding Spectrum vs EXP-137 Binary Finding ✅
- **Type**: Scope Conflict | **Severity**: LOW
- **Claim A**: KE-037 — scaffolding spectrum model (continuous range from internalize to externalize)
- **Claim B**: EXP-137 — workflow verification is binary (correlation 1.0)
- **Resolution**: REFINE_SCOPE — KE-037 updated with "EXP-137 Scope Note": for process-enforcement guards, spectrum collapses to binary threshold. Spectrum model remains valid for skill-type and judgment interventions.
- **Resolved**: 2026-04-11 by Bob
- **Bayesian Impact**: None

---

## Resolution Queue (Ordered by Priority)

*All active contradictions resolved as of 2026-04-11.*

| # | CT | Action | Status |
|---|-----|--------|--------|
| ~~1~~ | ~~CT-004~~ | ~~Update strategy docs re: guard permanence~~ | ✅ RESOLVED |
| ~~2~~ | ~~CT-009~~ | ~~Rewrite H-101 §Mechanism to reflect revised understanding~~ | ✅ RESOLVED |
| ~~3~~ | ~~CT-010~~ | ~~Add scope note to KE-037~~ | ✅ RESOLVED |

---

## Detection Log

| Date | Trigger | Scope | Contradictions Found | New CTs |
|------|---------|-------|---------------------|---------|
| 2026-04-11 | Phase 1 seed (full KB scan) | All KE, H, WKWA entries | 11 total (5 pre-resolved, 4 active, 2 deferred) | CT-001 through CT-011 |

---

*Next scheduled scan: On next KE entry creation or experiment closure.*
*Protocol: `agents/bob/workspace/DESIGN-contradiction-detection-protocol.md`*
