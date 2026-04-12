# KE-154: Epistemic Suppression — The Second Mechanism Behind Few-Shot Harm on Discovery Tasks

**Created**: 2026-04-12 by Bob (Architect)  
**Confidence**: ★★★★ (strong — triangulated across DD-750 literature, KE-133 empirical, KE-147 theory)  
**Sources**: DD-750 (§2.1 Kim et al.), KE-133 (few-shot harmful), KE-147 (Einstellung mechanism), H-105 (Three-Layer Model)  
**Connections**: KE-146, KE-153, H-099, H-103, EXP-130, EXP-144  

---

## Core Finding

DD-750's synthesis of Kim et al. (2603.24472) reveals a **second, independent mechanism** for why few-shot examples harm discovery tasks: **epistemic suppression**. This is distinct from and complementary to the Einstellung/template displacement mechanism identified in KE-147.

**Mechanism 1 — Einstellung (KE-147):** Few-shot examples activate familiar patterns that hijack processing, blocking exploration of novel solution paths. The agent follows the template instead of searching.

**Mechanism 2 — Epistemic Suppression (this entry):** Structured formats (including examples that imply a "correct output shape") suppress **epistemic verbalization** — the expression of uncertainty ("I'm not sure," "maybe," "let me reconsider") that is essential for out-of-distribution reasoning. Kim et al. show up to 40% performance degradation on OOD tasks when rigid format suppresses uncertainty signals.

These mechanisms operate at different layers of the Three-Layer Model (H-105):
- Einstellung operates at **Layer 1→2** (latent→thinking): pattern activation in latent space redirects the thinking process
- Epistemic suppression operates at **Layer 2→3** (thinking→output): format constraints filter out uncertainty from externalized reasoning, which feeds back to degrade the reasoning itself

---

## Why Two Mechanisms Matter

A single-mechanism model predicts that removing examples should fully restore discovery performance. But if both mechanisms operate:

1. **Removing examples** eliminates Einstellung (Mechanism 1) but not epistemic suppression — if other format constraints remain (checklists, templates, structured output requirements), discovery is still partially suppressed.

2. **Removing format constraints** eliminates epistemic suppression (Mechanism 2) but not Einstellung — if prior examples or cached solution patterns persist in context, fixation still blocks exploration.

3. **Only removing both** fully restores discovery capacity. This explains the EXP-130 result more precisely: the baseline condition succeeded at 100% not just because it lacked examples (removing Einstellung) but because the baseline also had minimal format constraints (removing epistemic suppression).

### Testable Prediction (P-154a)

**Format-constrained baseline vs. unconstrained baseline on discovery tasks:**
- Run discovery task with NO examples but WITH rigid output format requirements (structured template for deliverable)
- Predict: performance drops below the 100% unconstrained baseline, but above the 33% few-shot condition
- This isolates epistemic suppression from Einstellung
- Expected: ~60-80% success rate (suppression alone is less harmful than suppression + fixation combined)

---

## Connection to the Observability Tax (KE-146, KE-153, H-103)

This synthesis resolves a tension in our H-103 assessment. H-103 (format-decoupled gates) was dropped to P=0.45 because EXP-144 showed format overhead was lower than predicted. But DD-750 reframes the issue:

**The "format tax" is real, but it's not what we measured.** EXP-144 measured format overhead in execution time and error rates — the visible, Layer 3 costs. The deeper cost identified by DD-750 is epistemic suppression — a Layer 2 phenomenon where format constraints degrade the *quality of reasoning* by filtering uncertainty signals before they can influence the output.

This means H-103's core claim (separating format from reasoning quality enables better outcomes) is **more right than our P=0.45 suggests**, but the mechanism is different than originally hypothesized:
- Original H-103: format compliance costs execution time, creating overhead
- DD-750 reframe: format compliance costs epistemic verbalization, degrading reasoning quality on complex tasks

The implication: H-103 should be evaluated not on format overhead (where it scored poorly in EXP-144) but on **reasoning quality degradation under format constraints** — specifically on complex/novel tasks where epistemic uncertainty matters.

---

## Connection to KE-133/KE-147: The Dual-Mechanism Model

```
FEW-SHOT EXAMPLES ON DISCOVERY TASKS
         ↓
    ┌────┴────┐
    │         │
MECHANISM 1   MECHANISM 2
Einstellung   Epistemic Suppression
(KE-147)      (KE-154, this entry)
    │         │
Pattern       Uncertainty
activation    filtering
    │         │
Template-     Suppressed "I'm
matching      not sure" signals
    │         │
Exploration   OOD reasoning
suppressed    degraded
    │         │
    └────┬────┘
         ↓
   DISCOVERY BLOCKED
   (EXP-130: -67pp)
```

Both mechanisms are grounded in external literature:
- **Einstellung**: DD-744 (MedEinst), DD-745 (ManBench), DD-746 (Red Herrings)
- **Epistemic suppression**: DD-750 (Kim et al.), with supporting evidence from Young (thinking vs. answer faithfulness gap)

And both are confirmed by internal experiments:
- **Einstellung**: EXP-130 (template displacement observed in session transcripts)
- **Epistemic suppression**: EXP-144 (format constraints didn't help), KE-144 (guards not internalized — agents comply without reasoning engagement)

---

## Implications

### 1. Discovery Task Design Should Be "Double Clean"
Not just example-free (avoiding Einstellung) but also format-free (avoiding epistemic suppression). Discovery tasks should specify *what* to produce, not *how* to structure it. Let agents externalize in whatever format naturally emerges from their reasoning.

### 2. Convention Checking System Pays Both Taxes
Our convention checking system — which provides both examples of correct behavior (Einstellung risk) and structured output formats (epistemic suppression risk) — is potentially paying a double tax on any task that requires novel judgment. For routine/behavioral conventions (quote-splitting, import ordering), this is fine. For conventions requiring contextual judgment (when to use edit vs write, what constitutes "verification"), the tax may actively harm quality.

### 3. H-103 Reframing Opportunity
H-103 (format-decoupled gates) should be re-evaluated with epistemic suppression as the target metric, not execution overhead. A new experiment (building on EXP-144) that measures reasoning quality on complex tasks under format-constrained vs. unconstrained conditions would test this reframing directly.

### 4. The Kim Self-Distillation Finding Explains Task-Type Boundary
Kim et al.'s key result: format constraints are fine for in-distribution tasks but degrade OOD performance. This maps exactly to our task-type spectrum (KE-133): behavioral tasks (in-distribution) are helped by structure; discovery tasks (out-of-distribution) are harmed. The mechanism is identical — format suppresses the epistemic signals needed specifically for OOD reasoning.

---

## Open Questions

- **Q-154a**: What is the relative contribution of each mechanism? If Einstellung accounts for most of the -67pp effect, epistemic suppression is a minor refinement. If they contribute roughly equally, design implications are stronger.
- **Q-154b**: Does epistemic suppression affect thinking tokens (Layer 2) or only output (Layer 3)? If format constraints suppress uncertainty even in thinking tokens, the cost is deeper than DD-750's three-layer model predicts.
- **Q-154c**: Can we measure epistemic verbalization rate in our agent transcripts? If so, this becomes a diagnostic metric for when an agent is being suppressed.

---

*This entry bridges DD-750's literature synthesis with our empirical discovery boundary findings (KE-133, KE-147, EXP-130). The dual-mechanism model (Einstellung + epistemic suppression) provides a more complete explanation for why interventions harm discovery and generates specific predictions (P-154a) testable in future experiments.*
