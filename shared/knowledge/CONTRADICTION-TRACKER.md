# Contradiction Tracker

> **Maintained by**: Bob (Architect)
> **Created**: 2026-04-11 (Phase 1 of Contradiction Detection Protocol)
> **Protocol**: `agents/bob/workspace/DESIGN-contradiction-detection-protocol.md`
> **Last Full Scan**: 2026-04-11

**Active Contradictions**: 3  
**Deferred**: 2  
**Resolved**: 6  
**Total Catalogued**: 11

---

## Active Tensions

### CT-004: Guards as Infrastructure vs Implicit Training Strategy
- **Type**: Implication Conflict | **Severity**: MEDIUM
- **Claim A**: KE-106 — "Guards don't reduce underlying error rate (50-70% attempt rate persists). Guards are necessary permanent infrastructure."
- **Claim B**: Implicit assumption in guard deployment strategy — guards are stepping stones, agents will eventually learn, guards can be removed
- **Evidence Delta**: KE-106 has strong evidence (EXP-134 census: N=1,075, EXP-136 decomposition). The "training" assumption is unstated but motivates resource allocation.
- **Status**: OPEN
- **Resolution Proposal**: UPDATE_CLAIM — update all strategy docs (SOUL.md, deployment plans) to explicitly treat guards as permanent infrastructure. Remove any language suggesting guards are temporary training wheels.
- **Bayesian Impact**: None (H-100 already reflects this at P(H)=0.60)
- **Assigned To**: Bob
- **Priority**: HIGH — wrong mental model wastes effort on guard "sunset" planning

### CT-008: KE-106 "Guards Don't Train" vs EXP-137 "Learner Agents Show Declining Guard Rates" ✅
- **Type**: Scope Conflict | **Severity**: HIGH
- **Claim A**: KE-106 — "Structural guards permanently catch errors at runtime but do NOT reduce the underlying error rate. Agents continue attempting the guarded behavior at 50-70% of sessions regardless."
- **Claim B**: KE-137/EXP-137 — Three agents (bob, coach, tech-lead) show declining guard rates over time (e.g., bob 72%→10% raw, 58%→24% genuine). These are called "learners."
- **Evidence Delta**: Both claims have strong evidence. EXP-137 (N=6 agents structural comparison) resolves this as a SCOPE issue: the declining rates in "learners" are NOT behavioral learning but architectural substitution — their workflows enforce verification independent of the guard. KE-106 remains correct at the behavioral level.
- **Status**: ✅ RESOLVED (REFINE_SCOPE)
- **Resolution**: KE-106 updated with "EXP-137 Scope Refinement" section. Both claims coexist: guards don't train behavior (universal), but guard rates decline for workflow-equipped agents (architectural substitution, not learning).
- **Resolved**: 2026-04-11 by Bob
- **Bayesian Impact**: None — H-100 stays 0.60, H-101 stays 0.72

### CT-009: H-101 Original Mechanism (Prompt Scaffolding) vs H-101 Revised Mechanism (Workflow Adoption)
- **Type**: Staleness Tension | **Severity**: MEDIUM
- **Claim A**: H-101 original thesis (pre-EXP-137) — "architectural readiness = prompt contains conceptual scaffolding for verification → Ch1×Ch2 multiplicative interaction → internalization"
- **Claim B**: H-101 revised thesis (post-EXP-137) — "architectural readiness = workflow-level verification infrastructure → architectural substitution eliminates error → guard rate declines (appearance of learning)"
- **Evidence Delta**: EXP-137 decisively falsifies the original mechanism via May's Paradox (most verification text, worst block rate). The revised mechanism is correct.
- **Status**: OPEN — H-101 document contains BOTH mechanisms (original in §Mechanism, revised in §EXP-137 Evidence Update). Predictions section still partially references old mechanism.
- **Resolution Proposal**: UPDATE_CLAIM — Rewrite H-101 §Mechanism to reflect the revised understanding. Move original mechanism to a "Historical" section. Update P-101a, P-101b, P-101d to reference workflows, not prompt text.
- **Bayesian Impact**: None (P(H) already 0.72 reflecting revised mechanism)
- **Assigned To**: Bob
- **Priority**: MEDIUM — internal document inconsistency, not externally visible

### CT-010: KE-037 Scaffolding Spectrum vs EXP-137 Binary Workflow Finding
- **Type**: Scope Conflict | **Severity**: LOW
- **Claim A**: KE-037 — "Scaffolding spectrum: interventions range from internalize (remove scaffolding) to externalize (add scaffolding). Optimal intervention depends on decision topology."
- **Claim B**: EXP-137 — "Workflow-level verification is a BINARY differentiator (correlation 1.0). All learners have it, all reliants don't. No spectrum."
- **Evidence Delta**: KE-037 is theoretical (convergent multi-source); EXP-137 is empirical (N=6). However, KE-037 describes the general scaffolding design space, while EXP-137 describes the specific FM-3.3 guard context. These are compatible: the spectrum exists in design space, but for THIS specific guard, the critical threshold happens to be workflow adoption (binary).
- **Status**: OPEN — but likely NOT a true contradiction
- **Resolution Proposal**: REFINE_SCOPE — Add note to KE-037 that EXP-137 shows the spectrum collapses to a binary threshold for process-enforcement guards (guards check for a specific behavior, and either your workflow does it or it doesn't). The spectrum model remains valid for skill-type interventions where degrees of scaffolding matter.
- **Bayesian Impact**: None
- **Assigned To**: Bob (low priority)
- **Priority**: LOW

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

---

## Resolution Queue (Ordered by Priority)

| # | CT | Action | Effort | Assigned | Depends On |
|---|-----|--------|--------|----------|------------|
| 1 | CT-004 | Update strategy docs re: guard permanence | Low | Bob | — |
| 2 | CT-009 | Rewrite H-101 §Mechanism to reflect revised understanding | Medium | Bob | — |
| 3 | CT-010 | Add scope note to KE-037 | Low | Bob | — |

---

## Detection Log

| Date | Trigger | Scope | Contradictions Found | New CTs |
|------|---------|-------|---------------------|---------|
| 2026-04-11 | Phase 1 seed (full KB scan) | All KE, H, WKWA entries | 11 total (5 pre-resolved, 4 active, 2 deferred) | CT-001 through CT-011 |

---

*Next scheduled scan: On next KE entry creation or experiment closure.*
*Protocol: `agents/bob/workspace/DESIGN-contradiction-detection-protocol.md`*
